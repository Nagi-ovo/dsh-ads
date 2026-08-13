/**
 * The dynamic tier: real community plugins, drawn as fake advertisements.
 *
 * This module owns the *gutter* half of it. Chinese mode keeps the original
 * eight-plugin rotation; English mode uses three, leaving most edge inventory
 * to the localized built-ins instead of turning both columns into a plugin
 * directory. Working through the rest of the topic is the feed's job; see
 * [feed.ts](./feed.ts) for why that placement can carry the complete list.
 *
 * One fetch per page load, shared at module scope: both placements want the
 * same list, and asking the host twice for a joke would be rude.
 *
 * @module
 */

import { useEffect, useMemo, useState } from 'react'
import { REGISTRY_ROUTE, type RegistryPayload, type SponsoredPlugin } from '../protocol.ts'
import { setFeedPlugins } from './feed.ts'
import { pluginCreative } from './plugin-banner.ts'
import { CONTRIB_ADS } from './contrib-ads.generated.ts'
import { readLedger, recordSeen, rotate, writeLedger } from './rotation.ts'
import type { AdCreative, AdLocale } from './types.ts'

/** How many plugins one Chinese conversation advertises in its gutters. */
const ZH_PER_CONVERSATION = 8

/** How many plugins one English conversation advertises in its gutters. */
const EN_PER_CONVERSATION = 3

/** Every third pick is drawn as a skyscraper, so the gutters get both shapes. */
const TALL_EVERY = 3

/**
 * Resolve the gutter sponsor budget without reducing the feed inventory.
 * @param locale - active DSH language.
 * @returns plugin creatives admitted to the side gutters.
 */
export function gutterSponsorCount(locale: AdLocale): number {
  return locale === 'en' ? EN_PER_CONVERSATION : ZH_PER_CONVERSATION
}

/** Shared fetch, started on first use and reused for the page's lifetime. */
let pending: Promise<readonly SponsoredPlugin[]> | undefined

/**
 * Fetch the sponsor list from the host.
 * @returns the plugins, or an empty list if the route is absent or broken.
 */
async function fetchPlugins(): Promise<readonly SponsoredPlugin[]> {
  try {
    const response = await fetch(REGISTRY_ROUTE, { cache: 'no-store' })
    if (!response.ok) return []
    const payload = await response.json() as RegistryPayload
    return Array.isArray(payload.plugins) ? payload.plugins : []
  } catch {
    // Swallowed: a host without the node half, an offline machine, or a
    // Failed GitHub discovery channels all land here. The built-in banners are
    // unaffected, so the layer simply has less inventory.
    return []
  }
}

/** Contributed copy and artwork, indexed by slug. */
const CONTRIB = new Map(CONTRIB_ADS.map((entry) => [entry.slug, entry]))

/**
 * Draw one plugin, preferring contributed artwork over the generated banner.
 * @param plugin - the subject.
 * @param index - position in the rotation, which decides the shape.
 * @returns the creative.
 */
function creativeFor(plugin: SponsoredPlugin, index: number, locale: AdLocale): AdCreative {
  // Current contributed copy/art is Chinese-only. English mode falls back to
  // the generated English banner instead of showing a mixed-language ad.
  const contrib = locale === 'zh' ? CONTRIB.get(plugin.slug) : undefined
  const shape = index % TALL_EVERY === TALL_EVERY - 1 ? 'tall' : 'wide'
  const art = contrib?.art
  if (art === undefined) return pluginCreative(plugin, shape, contrib?.copy ?? {}, locale)
  // Contributed artwork replaces the drawing entirely, but keeps the plugin's
  // identity: the takeover still links to the repository, and impressions
  // still count against the same slug.
  return {
    id: `hub-art-${locale}-${plugin.slug}`,
    width: art.width,
    height: art.height,
    shape: art.shape,
    weight: 1,
    alt: contrib?.copy.headline ?? plugin.description,
    src: art.src,
    href: plugin.url,
    sponsor: plugin.slug,
  }
}

/**
 * Rotate the sponsor list for one conversation.
 *
 * @param sessionId - the open conversation; changing it reshuffles the picks,
 * which is what "rotates per conversation" means in practice.
 * @param locale - language of generated plugin creatives.
 * @returns creatives to merge into the banner pool.
 */
export function useSponsoredAds(sessionId: string | undefined, locale: AdLocale = 'zh'): readonly AdCreative[] {
  const [plugins, setPlugins] = useState<readonly SponsoredPlugin[]>([])
  useEffect(() => {
    let mounted = true
    pending ??= fetchPlugins()
    void pending.then((list) => {
      // The feed takes the whole list; the gutters take the locale-specific
      // subset below. One fetch, two placements with different capacities.
      setFeedPlugins(list)
      if (mounted) setPlugins(list)
    })
    return () => { mounted = false }
  }, [])

  const sponsorCount = gutterSponsorCount(locale)
  const chosen = useMemo(
    () => rotate(plugins, readLedger(), sponsorCount, sessionId ?? ''),
    [plugins, sessionId, sponsorCount],
  )

  // Counted once per rotation, not once per render: the ledger is what decides
  // who gets shown next, and inflating it on re-render would quietly rotate
  // whoever happens to be on a busy screen out of the pool.
  useEffect(() => {
    if (chosen.length === 0) return
    writeLedger(recordSeen(readLedger(), chosen))
  }, [chosen])

  return useMemo(() => chosen.map((plugin, index) => creativeFor(plugin, index, locale)), [chosen, locale])
}
