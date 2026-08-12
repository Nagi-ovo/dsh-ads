/**
 * dsh-ads, node half.
 *
 * The built-in banners need nothing from the host — they are baked into the
 * browser bundle and the layer's knobs all live where the user can reach them.
 * The dynamic tier is the reason this half exists at all: it advertises real
 * community plugins, the hub that lists them is private, and only the host
 * holds credentials for it. So this registers two routes — the sponsor list,
 * and the star check that lets the security alert verify through the host's
 * own GitHub login — and does nothing else.
 *
 * A surface without the browser half simply has no ad layer, which is the
 * correct degradation for TUI, ACP, and headless.
 *
 * @module @dsh-external/dsh-ads
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { REGISTRY_ROUTE, STAR_ROUTE, type RegistryPayload, type StarCheckPayload } from './protocol.ts'
import { loadRegistry } from './catalog.ts'
import { checkHostStarred } from './star-host.ts'

/** The slice of the host context this plugin uses. */
interface HostContext {
  /** The web shell's HTTP server; the only host capability the ad layer needs. */
  webServer: {
    /**
     * Publish a route.
     * @param route - the path to claim and the handler to serve it.
     * @returns the disposer that unpublishes it.
     */
    register(route: {
      kind: 'exact'
      path: string
      handler(req: IncomingMessage, res: ServerResponse): Promise<void>
    }): () => void
  }
  /**
   * Register a disposable effect.
   * @param callback - runs on apply, returns its own teardown.
   */
  effect(callback: () => (() => void)): void
}

/** Host capabilities required for the dynamic tier. */
export const inject = ['webServer']

/** Plugin configuration. */
export interface Config {
  /**
   * How recently a plugin must have been pushed to enter the rotation, in
   * days. Zero or less advertises the whole hub.
   */
  freshDays?: number
  /** How long a fetched catalog is reused before the hub is read again, in minutes. */
  cacheMinutes?: number
}

/** Freshness window: a fortnight is long enough that a weekend release still gets seen. */
const DEFAULT_FRESH_DAYS = 14

/** Catalog reuse window; the hub regenerates far more slowly than this. */
const DEFAULT_CACHE_MINUTES = 30

/** This plugin's own slug, kept out of its own rotation. */
const SELF_SLUG = 'dsh-external/dsh-ads'

/** A payload plus when it was assembled. */
interface CacheSlot {
  /** The served list. */
  readonly payload: RegistryPayload
  /** Epoch ms at which it was built. */
  readonly at: number
}

/**
 * Serve JSON.
 * @param res - the response to write.
 * @param body - the payload.
 */
function json(res: ServerResponse, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    // The client caches per page load itself; letting the browser cache on top
    // of the host's 30-minute window would make a freshly-pushed plugin wait
    // twice as long to appear.
    'cache-control': 'no-store',
  })
  res.end(text)
}

/**
 * Register the sponsor route.
 * @param ctx - host context.
 * @param config - see {@link Config}.
 */
export function apply(ctx: HostContext, config: Config = {}): void {
  const freshDays = config.freshDays ?? DEFAULT_FRESH_DAYS
  const cacheMs = (config.cacheMinutes ?? DEFAULT_CACHE_MINUTES) * 60_000
  let cache: CacheSlot | undefined
  // Coalesces concurrent requests: several sessions opening at once must not
  // each shell out to `gh`.
  let inflight: Promise<RegistryPayload> | undefined

  const resolve = async (): Promise<RegistryPayload> => {
    const now = Date.now()
    if (cache !== undefined && now - cache.at < cacheMs) return cache.payload
    inflight ??= loadRegistry(now, freshDays, SELF_SLUG)
      .then((payload) => {
        cache = { payload, at: Date.now() }
        return payload
      })
      .finally(() => { inflight = undefined })
    return await inflight
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: REGISTRY_ROUTE,
    handler: async (_req, res) => { json(res, await resolve()) },
  }))

  // A star, once seen, is remembered for the process; a miss is not, because
  // "star, then press 重新检测" has to see the new state on the next click.
  // Coalescing keeps a click-happy user from stacking `gh` invocations.
  let starSeen: StarCheckPayload | undefined
  let starInflight: Promise<StarCheckPayload> | undefined
  const resolveStar = async (): Promise<StarCheckPayload> => {
    if (starSeen !== undefined) return starSeen
    starInflight ??= checkHostStarred(SELF_SLUG)
      .then((payload) => {
        if (payload.verdict === 'starred') starSeen = payload
        return payload
      })
      .finally(() => { starInflight = undefined })
    return await starInflight
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: STAR_ROUTE,
    handler: async (_req, res) => { json(res, await resolveStar()) },
  }))
}
