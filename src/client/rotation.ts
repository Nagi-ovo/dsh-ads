/**
 * Whose plugin gets the slot.
 *
 * The pool is every plugin pushed in the last fortnight, which is far more
 * than fits on one screen, so something has to choose — and the obvious
 * choices are all unfair. Random picks let a few plugins never appear.
 * Newest-first rewards whoever pushed most recently, which is the same as
 * rewarding whoever pushes most often. Stars would reward whoever is already
 * known, and GitHub forbids trading anything for them anyway.
 *
 * So: least-seen first, counted per browser. Everyone in the pool is shown
 * before anyone is shown twice, ties broken by a hash of the slug and the
 * session id — which is what makes two users, and two conversations, see
 * different plugins from the same ledger.
 *
 * The ledger is local. Nobody reports it anywhere, so there is nothing to game
 * and no impressions to buy.
 *
 * @module
 */

import { hashString } from './plugin-banner.ts'

/** Impressions per `<owner>/<repo>`, as counted by this browser. */
export type SeenLedger = Readonly<Record<string, number>>

/** Storage key holding {@link SeenLedger}. */
const LEDGER_KEY = 'dsh-ads:sponsor-seen'

/**
 * Last written counts, kept in memory.
 *
 * Storage is not always there — private-mode Safari, a sandboxed frame — and
 * without this the feed would re-read an empty ledger on every turn and hand
 * the same few plugins out forever. The memory copy keeps rotation correct
 * within the page; only carrying it across reloads is lost.
 */
let memory: SeenLedger | undefined

/**
 * Read the counts out of storage.
 * @returns the stored ledger, or undefined when storage cannot be read.
 */
function stored(): SeenLedger | undefined {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Record<string, number> = {}
    for (const [slug, count] of Object.entries(parsed)) {
      if (typeof count === 'number' && Number.isFinite(count)) out[slug] = count
    }
    return out
  } catch {
    // Swallowed: unusable or corrupt storage is indistinguishable from absent
    // storage here, and both are answered the same way — by the memory copy.
    return undefined
  }
}

/**
 * Read the impression ledger.
 * @returns the counts this browser has served, empty on a first visit.
 */
export function readLedger(): SeenLedger {
  return stored() ?? memory ?? {}
}

/**
 * Write the impression ledger.
 * @param ledger - counts to record.
 */
export function writeLedger(ledger: SeenLedger): void {
  memory = ledger
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger))
  } catch {
    // Swallowed: the counts stay in memory for this page load, which is the
    // whole of what a failed write costs.
  }
}

/**
 * Choose which plugins to advertise.
 *
 * @param pool - every eligible plugin, keyed by slug.
 * @param ledger - impressions this browser has already served.
 * @param take - how many to choose; more than the pool holds returns the pool.
 * @param salt - varies the tie-break; the session id, so a new conversation
 * reshuffles the plugins that are tied on impressions.
 * @returns the chosen plugins, least-seen first.
 */
export function rotate<T extends { readonly slug: string }>(
  pool: readonly T[],
  ledger: SeenLedger,
  take: number,
  salt: string,
): readonly T[] {
  const ranked = [...pool].sort((a, b) => {
    const seen = (ledger[a.slug] ?? 0) - (ledger[b.slug] ?? 0)
    if (seen !== 0) return seen
    return hashString(a.slug + salt) - hashString(b.slug + salt)
  })
  return ranked.slice(0, Math.max(0, take))
}

/**
 * Count one round of impressions.
 * @param ledger - the current counts.
 * @param shown - the plugins that were chosen.
 * @returns a new ledger with each shown plugin incremented.
 */
export function recordSeen(ledger: SeenLedger, shown: readonly { readonly slug: string }[]): SeenLedger {
  const next: Record<string, number> = { ...ledger }
  for (const plugin of shown) next[plugin.slug] = (next[plugin.slug] ?? 0) + 1
  return next
}
