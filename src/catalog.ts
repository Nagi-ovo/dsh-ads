/**
 * Reading the plugin hub.
 *
 * `dsh-external/hub` is a private repository, so there is no anonymous URL to
 * fetch: every path here spends someone's GitHub credentials. Three are tried
 * in order of how likely they are to be both present and current — the `gh`
 * CLI, which every hub member already has authenticated; a token from the
 * environment, for headless hosts; and finally the snapshot baked in at build
 * time, which is stale but always works and keeps the ad layer from depending
 * on the network to have anything to show.
 *
 * @module
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { RegistryPayload, SponsoredPlugin } from './protocol.ts'
import { CATALOG_SNAPSHOT } from './catalog-snapshot.ts'

const execFileAsync = promisify(execFile)

/** Owner/repo of the hub catalog. */
const HUB_REPO = 'dsh-external/hub'

/** Path of the catalog within the hub. */
const HUB_PATH = 'catalog.json'

/** Cap on the fetched catalog, in bytes; the real one is ~140 KB. */
const MAX_CATALOG_BYTES = 8 * 1024 * 1024

/** One repository as the hub records it; every other field is ignored here. */
interface HubRepo {
  readonly name?: unknown
  readonly url?: unknown
  readonly description?: unknown
  readonly note?: unknown
  readonly pushedAt?: unknown
  readonly tags?: unknown
  readonly hide?: unknown
  readonly empty?: unknown
}

/** The catalog document. */
interface HubCatalog {
  readonly repos?: unknown
}

/**
 * Narrow one hub record into a sponsor, or reject it.
 *
 * Hidden and empty repositories are dropped because the hub already marks them
 * as not worth showing; anything missing a name or URL is dropped because an
 * advertisement nobody can act on is just noise.
 *
 * @param raw - one entry of the catalog's `repos` array.
 * @param owner - hub owner, used to build the `<owner>/<repo>` slug.
 * @returns the sponsor, or undefined when the entry is not advertisable.
 */
function toSponsor(raw: unknown, owner: string): SponsoredPlugin | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const repo = raw as HubRepo
  if (repo.hide === true || repo.empty === true) return undefined
  const name = typeof repo.name === 'string' ? repo.name : ''
  const url = typeof repo.url === 'string' ? repo.url : ''
  if (name === '' || url === '') return undefined
  // The hub's `note` is an editorialised one-liner and `description` is the
  // repo's own; the note reads better as ad copy when both exist.
  const note = typeof repo.note === 'string' ? repo.note : ''
  const description = typeof repo.description === 'string' ? repo.description : ''
  return {
    slug: `${owner}/${name}`,
    name,
    description: note !== '' ? note : description,
    url,
    pushedAt: typeof repo.pushedAt === 'string' ? repo.pushedAt : '',
    tags: Array.isArray(repo.tags) ? repo.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  }
}

/**
 * Parse a catalog document into sponsors.
 * @param text - the raw `catalog.json` body.
 * @param owner - hub owner, for slugs.
 * @returns every advertisable plugin, in hub order.
 */
export function parseCatalog(text: string, owner: string): readonly SponsoredPlugin[] {
  const parsed: unknown = JSON.parse(text)
  const repos = (parsed as HubCatalog | undefined)?.repos
  if (!Array.isArray(repos)) return []
  const out: SponsoredPlugin[] = []
  for (const raw of repos) {
    const sponsor = toSponsor(raw, owner)
    if (sponsor !== undefined) out.push(sponsor)
  }
  return out
}

/**
 * Keep the plugins pushed within the freshness window.
 *
 * The window is a window rather than a top-N because exposure must not depend
 * on who happened to have a session open when someone pushed: everyone who
 * shipped this fortnight is eligible, and which of them a given user sees is
 * the browser's fairness ledger to decide.
 *
 * It is anchored to the newest push *in the list*, not to the wall clock. A
 * live catalog makes the two identical, and a baked snapshot months old still
 * yields its own last fortnight instead of yielding nothing at all — which is
 * the only way the offline fallback is worth having.
 *
 * @param plugins - candidates.
 * @param freshDays - window width in days; zero or less keeps everything.
 * @param excludeSlug - a plugin to drop, normally this one — an ad layer that
 * advertises itself takes a slot away from someone who did not write it.
 * @returns the eligible subset.
 */
export function selectFresh(
  plugins: readonly SponsoredPlugin[],
  freshDays: number,
  excludeSlug: string,
): readonly SponsoredPlugin[] {
  const dated = plugins
    .filter((plugin) => plugin.slug !== excludeSlug)
    .map((plugin) => ({ plugin, pushed: Date.parse(plugin.pushedAt) }))
    .filter((entry) => Number.isFinite(entry.pushed))
  if (freshDays <= 0) return dated.map((entry) => entry.plugin)
  let newest = -Infinity
  for (const entry of dated) newest = Math.max(newest, entry.pushed)
  const floor = newest - freshDays * 86_400_000
  return dated.filter((entry) => entry.pushed >= floor).map((entry) => entry.plugin)
}

/**
 * Read the catalog through the `gh` CLI.
 * @returns the raw document body.
 * @throws when `gh` is absent, unauthenticated, or denied access to the hub.
 */
async function readViaGh(): Promise<string> {
  const { stdout } = await execFileAsync(
    'gh',
    ['api', `repos/${HUB_REPO}/contents/${HUB_PATH}`, '-H', 'Accept: application/vnd.github.raw'],
    { maxBuffer: MAX_CATALOG_BYTES, timeout: 20_000 },
  )
  return stdout
}

/**
 * Read the catalog with a token from the environment.
 * @param token - a GitHub token with read access to the hub.
 * @returns the raw document body.
 * @throws when GitHub refuses the request.
 */
async function readViaToken(token: string): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${HUB_REPO}/contents/${HUB_PATH}`, {
    headers: { accept: 'application/vnd.github.raw', authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`GitHub responded ${response.status}`)
  return await response.text()
}

/**
 * Assemble the payload the browser half consumes.
 *
 * Never throws: the last resort is the baked snapshot, and a plugin whose only
 * job is to put jokes on screen must not be able to fail a page.
 *
 * @param nowMs - current epoch time.
 * @param freshDays - freshness window in days.
 * @param excludeSlug - plugin to leave out of its own rotation.
 * @returns the sponsor list, tagged with where it came from.
 */
export async function loadRegistry(
  nowMs: number,
  freshDays: number,
  excludeSlug: string,
): Promise<RegistryPayload> {
  const owner = HUB_REPO.split('/')[0] ?? 'dsh-external'
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? ''
  const attempts: readonly { source: RegistryPayload['source']; read: () => Promise<string> }[] = [
    { source: 'gh-cli', read: readViaGh },
    ...(token === '' ? [] : [{ source: 'github-token' as const, read: () => readViaToken(token) }]),
  ]
  for (const attempt of attempts) {
    try {
      const plugins = parseCatalog(await attempt.read(), owner)
      if (plugins.length === 0) continue
      return {
        generated: new Date(nowMs).toISOString(),
        source: attempt.source,
        freshDays,
        plugins: selectFresh(plugins, freshDays, excludeSlug),
      }
    } catch {
      // Swallowed deliberately, once per channel: `gh` may be missing or
      // logged out and the token may be scoped elsewhere, and neither is an
      // error the user needs to hear about from an ad layer. The loop falls
      // through to the next channel and finally to the snapshot, which cannot
      // fail.
      continue
    }
  }
  return {
    generated: new Date(nowMs).toISOString(),
    source: 'snapshot',
    freshDays,
    plugins: selectFresh(CATALOG_SNAPSHOT, freshDays, excludeSlug),
  }
}
