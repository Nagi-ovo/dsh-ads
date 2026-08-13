/**
 * Choosing what the in-transcript feed advertises.
 *
 * The feed is where fairness actually lives. The gutters cannot rotate: they
 * are laid out as a running total down a column, so swapping a banner for one
 * of a different height shoves everything below it and jolts whatever the user
 * was reading. The feed has no such constraint — each ad arrives with a new
 * turn, below everything already on screen — so this is the surface that can
 * work through the whole discovered topic instead of the eight plugins one conversation
 * happens to draw.
 *
 * Two rules, and they pull against each other:
 *
 * - Least-seen first, so every plugin appears before any appears twice.
 * - Stable per turn, because an ad that changed as the transcript re-rendered
 *   or the user scrolled would read as a rendering fault.
 *
 * Both hold because a turn is assigned exactly once per page load and then
 * remembered. The ledger moves; a turn that already has an ad does not.
 *
 * @module
 */

import type { SponsoredPlugin } from '../protocol.ts'
import { pluginCreative } from './plugin-banner.ts'
import { readLedger, recordSeen, rotate, writeLedger } from './rotation.ts'
import { hashString } from './stable-hash.ts'
import type { AdCreative, AdLocale } from './types.ts'

/** Every eligible plugin, as published by the registry fetch. */
let plugins: readonly SponsoredPlugin[] = []

/**
 * Hand the feed the full plugin list.
 *
 * The gutters get a rotated eight; the feed gets all of them, because it is
 * the placement that can afford to work through a long list.
 *
 * @param list - every plugin inside the freshness window.
 */
export function setFeedPlugins(list: readonly SponsoredPlugin[]): void {
  plugins = list
}

/** Assignments made this page load, keyed by `<session>:<seq>`. */
const assigned = new Map<string, AdCreative>()

/** Ledger slug for a built-in banner, namespaced away from real repositories. */
function builtinSlug(creative: AdCreative): string {
  return `builtin/${creative.id}`
}

/** One thing the feed could show, and how to draw it if chosen. */
interface Candidate {
  /** Ledger identity. */
  readonly slug: string
  /** Build the artwork; only called for the winner. */
  readonly draw: () => AdCreative
}

/**
 * The shipped banners as candidates.
 *
 * Skyscrapers are excluded: the feed slot is a ~420px-wide column, and a 2:5
 * banner scaled into it becomes a thousand-pixel wall that pushes the rest of
 * the turn off screen. They belong in the gutters, which is the shape they
 * were drawn for.
 */
function houseCandidates(builtins: readonly AdCreative[]): readonly Candidate[] {
  return builtins
    .filter((creative) => creative.shape !== 'tall')
    .map((creative) => ({ slug: builtinSlug(creative), draw: () => creative }))
}

/** The hub as candidates. Drawing is deferred; there are well over a hundred. */
function hubCandidates(locale: AdLocale): readonly Candidate[] {
  return plugins.map((plugin) => ({ slug: plugin.slug, draw: () => pluginCreative(plugin, 'wide', {}, locale) }))
}

/**
 * Pick the advertisement for one turn.
 *
 * The two tiers get half the feed each rather than sharing one queue. Eight
 * hand-drawn banners against a hub of well over a hundred means a single
 * least-seen queue would surface the artwork about once in twenty ads and
 * quietly retire the best thing the plugin has. Splitting keeps both visible,
 * and inside each half the order is still strictly least-seen, so nothing in
 * community plugins are starved by it.
 *
 * @param key - stable turn identity, `<session>:<seq>`.
 * @param builtins - the shipped banner pool.
 * @param locale - language used for dynamic plugin artwork and assignment identity.
 * @returns the creative for this turn, or undefined when nothing is eligible.
 */
export function feedAd(key: string, builtins: readonly AdCreative[], locale: AdLocale = 'zh'): AdCreative | undefined {
  const assignmentKey = `${locale}:${key}`
  const already = assigned.get(assignmentKey)
  if (already !== undefined) return already
  const house = houseCandidates(builtins)
  const hub = hubCandidates(locale)
  const wantsHouse = hashString(key) % 2 === 0
  // Either half standing empty — no hub yet, or a host shipping no artwork —
  // hands its slots to the other rather than leaving the turn blank.
  const preferred = wantsHouse ? house : hub
  const candidates = preferred.length > 0 ? preferred : (wantsHouse ? hub : house)
  // Salted with the turn key, not the session: consecutive turns are almost
  // always tied on impressions, and a per-session salt would break every one of
  // those ties the same way and repeat one plugin down the whole transcript.
  const [chosen] = rotate(candidates, readLedger(), 1, key)
  if (chosen === undefined) return undefined
  writeLedger(recordSeen(readLedger(), [chosen]))
  const creative = chosen.draw()
  assigned.set(assignmentKey, creative)
  return creative
}

/**
 * Forget every assignment and every impression.
 *
 * The feed is deliberately sticky — a turn keeps its ad, and the ledger only
 * ever grows — so there is otherwise no way back to a clean slate. Tests need
 * one; so would any future "start the rotation over" control.
 */
export function resetFeed(): void {
  assigned.clear()
  writeLedger({})
}
