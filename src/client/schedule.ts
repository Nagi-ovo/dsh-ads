/**
 * How the infestation maintains itself.
 *
 * The layer opens at full strength — a page like this was never tastefully
 * empty for the first minute — and then holds that headcount. Closing a banner
 * does not lower the population target; it takes that one slot off the board
 * for a cooldown, after which a replacement drifts back in. So the screen you
 * arrive at is the steady state, and swatting individual banners buys a few
 * seconds of quiet each, never progress.
 *
 * The target is a pure function of the clock and the outstanding cooldowns,
 * which makes the whole model testable without touching the DOM.
 */

/** Tunables for the population model. */
export interface SpawnConfig {
  /** How many banners the layer keeps on screen. */
  readonly maxAds: number
  /** How long a dismissed slot stays empty before a replacement arrives, in ms. */
  readonly respawnDelayMs: number
}

/** The shipped settings: a full screen on arrival, replacements after 15s. */
export const DEFAULT_SPAWN: SpawnConfig = {
  maxAds: 14,
  respawnDelayMs: 15_000,
}

/**
 * How many banners should exist right now.
 *
 * Each entry in `cooling` is the epoch-ms timestamp at which one dismissed
 * slot reopens; entries still in the future suppress exactly one banner each.
 * Expired entries are ignored here rather than requiring the caller to prune
 * first, so a tab backgrounded past several cooldowns returns to the correct
 * headcount in a single tick.
 *
 * @param nowMs - current epoch time.
 * @param config - the population model.
 * @param cooling - reopen timestamps for slots the user dismissed.
 * @returns the target population, in `[0, maxAds]`.
 */
export function targetCount(nowMs: number, config: SpawnConfig, cooling: readonly number[]): number {
  let pending = 0
  for (const until of cooling) if (until > nowMs) pending += 1
  return Math.max(0, config.maxAds - pending)
}

/**
 * Drop cooldowns that have already expired.
 * @param nowMs - current epoch time.
 * @param cooling - reopen timestamps.
 * @returns the still-pending timestamps, or `cooling` itself when none expired.
 */
export function pruneCooling(nowMs: number, cooling: readonly number[]): readonly number[] {
  const live = cooling.filter((until) => until > nowMs)
  return live.length === cooling.length ? cooling : live
}

/**
 * Pick the next creative index by weight, deterministically from a roll.
 * @param weights - per-creative draw weights, all non-negative, at least one positive.
 * @param roll - a uniform sample in [0, 1).
 * @returns the chosen index.
 */
export function weightedPick(weights: readonly number[], roll: number): number {
  let total = 0
  for (const w of weights) total += w
  let cursor = roll * total
  for (let i = 0; i < weights.length; i += 1) {
    cursor -= weights[i] ?? 0
    if (cursor < 0) return i
  }
  return weights.length - 1
}
