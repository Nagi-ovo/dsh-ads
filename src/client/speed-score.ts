/**
 * The benchmark, which is half real.
 *
 * The load time is genuine — `PerformanceNavigationTiming` measures it, the
 * same number the browser's own devtools would show. Everything after that is
 * invented: the national percentile, the rank, the tier name. That is exactly
 * the trick the 2000s "optimiser" utilities ran, and keeping the one real
 * measurement is what makes the invented parts land.
 *
 * The curve is calibrated against a fast local dev machine loading the web UI
 * in about 140 ms, which lands near the top of the scale — the flattery has to
 * be plausible for the person most likely to run this first, and get less
 * flattering, but never insulting, as the number grows.
 *
 * @module
 */

/** One point on the percentile curve: a load time and what it "beats". */
type Anchor = readonly [ms: number, percentile: number]

/**
 * The curve, interpolated in log time between anchors.
 *
 * Log rather than linear because load times span two orders of magnitude and a
 * linear curve would put everything from 200 ms to 2 s in the same bucket.
 */
const CURVE: readonly Anchor[] = [
  [100, 99.9],
  [150, 99.5],
  [250, 98],
  [400, 95],
  [700, 90],
  [1200, 78],
  [2000, 60],
  [3500, 35],
  [6000, 14],
  [10_000, 2],
]

/**
 * Invented size of the user base the rank is drawn from.
 *
 * Small on purpose. The rank and the percentile are the same fact stated twice,
 * so they have to agree — and against millions of users, beating 99% of them
 * still leaves tens of thousands ahead, which reads as a contradiction however
 * correct the arithmetic is. A base this size makes "beat 99%" and "ranked
 * two-thousandth" the same sentence.
 */
const POPULATION = 200_000

/**
 * The percentile a load time "beats".
 *
 * @param ms - measured load time in milliseconds.
 * @returns a percentile in [1, 99.9], one decimal place.
 */
export function scorePercentile(ms: number): number {
  const first = CURVE[0] as Anchor
  const last = CURVE[CURVE.length - 1] as Anchor
  if (!Number.isFinite(ms) || ms <= first[0]) return first[1]
  if (ms >= last[0]) return 1
  for (let i = 1; i < CURVE.length; i += 1) {
    const low = CURVE[i - 1] as Anchor
    const high = CURVE[i] as Anchor
    if (ms > high[0]) continue
    const span = Math.log(high[0]) - Math.log(low[0])
    const along = (Math.log(ms) - Math.log(low[0])) / span
    return Math.round((low[1] + (high[1] - low[1]) * along) * 10) / 10
  }
  return 1
}

/**
 * The invented national rank behind a percentile.
 * @param percentile - as returned by {@link scorePercentile}.
 * @returns a rank, at least 1.
 */
export function nationalRank(percentile: number): number {
  return Math.max(1, Math.round(((100 - percentile) / 100) * POPULATION))
}

/** Tier names, best first; each applies from its percentile upward. */
const TIERS = {
  zh: [
    [99, '超凡入圣'],
    [95, '登峰造极'],
    [85, '身手不凡'],
    [60, '略胜一筹'],
    [30, '泯然众人'],
    [0, '亟需优化'],
  ],
  en: [
    [99, 'ABSOLUTELY CRACKED'],
    [95, 'ELITE SILICON'],
    [85, 'SUSPICIOUSLY FAST'],
    [60, 'ABOVE AVERAGE'],
    [30, 'MID-TIER MORTAL'],
    [0, 'URGENTLY OPTIMIZABLE'],
  ],
} as const

/**
 * The tier name for a percentile.
 * @param percentile - as returned by {@link scorePercentile}.
 * @param locale - language used for the invented title.
 * @returns the tier's name.
 */
export function tierName(percentile: number, locale: 'zh' | 'en' = 'zh'): string {
  for (const [floor, name] of TIERS[locale]) if (percentile >= floor) return name
  return (TIERS[locale][TIERS[locale].length - 1] as readonly [number, string])[1]
}

/** What the benchmark measured. */
export interface SpeedReading {
  /** Total load time in milliseconds. */
  readonly loadMs: number
  /** First contentful paint in milliseconds, when the browser reported one. */
  readonly paintMs: number | undefined
  /** Logical cores the browser admits to. */
  readonly cores: number
}

/**
 * Read the browser's own navigation timing.
 *
 * @returns the reading, or undefined when the timing API reports nothing
 * usable — a fresh navigation that has not finished loading, mostly.
 */
/**
 * The two performance entries this file reads, structurally.
 *
 * The package compiles against both the DOM and Node type universes, and
 * Node's narrower `performance` shadows the browser one — so `'navigation'` is
 * not even a legal entry type by the time the checker sees it. Describing the
 * two shapes here and casting once keeps the mismatch at this single boundary
 * instead of scattering assertions through the reader.
 */
interface TimingSource {
  /**
   * Fetch performance entries by type.
   * @param type - `'navigation'` or `'paint'`.
   * @returns the entries, loosely typed.
   */
  getEntriesByType(type: string): readonly {
    readonly name?: string
    readonly startTime?: number
    readonly loadEventEnd?: number
    readonly domContentLoadedEventEnd?: number
  }[]
}

export function readSpeed(): SpeedReading | undefined {
  const source = performance as unknown as TimingSource
  const [entry] = source.getEntriesByType('navigation')
  if (entry === undefined) return undefined
  // `loadEventEnd` is zero until the load event has actually fired; falling
  // back to `domContentLoadedEventEnd` keeps the number honest rather than
  // reporting a triumphant zero.
  const loadMs = Math.round(
    (entry.loadEventEnd ?? 0) > 0 ? entry.loadEventEnd ?? 0 : entry.domContentLoadedEventEnd ?? 0,
  )
  if (!(loadMs > 0)) return undefined
  const paint = source.getEntriesByType('paint').find((mark) => mark.name === 'first-contentful-paint')
  return {
    loadMs,
    paintMs: paint?.startTime === undefined ? undefined : Math.round(paint.startTime),
    cores: navigator.hardwareConcurrency,
  }
}
