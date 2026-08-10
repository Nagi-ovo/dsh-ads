/**
 * The benchmark's one real number is the load time; the percentile is invented.
 * What has to hold is that the invention is *monotone* and calibrated — a
 * faster machine must never score worse, and the fast local dev machine this
 * was tuned against has to land where the joke expects it to.
 */

import { describe, expect, it } from 'vitest'
import { nationalRank, scorePercentile, tierName } from '../src/client/speed-score.ts'

/** Measured on the machine the curve was calibrated against, in ms. */
const CALIBRATION_MS = 139

describe('scorePercentile', () => {
  it('puts the machine it was calibrated on at the top of the scale', () => {
    const score = scorePercentile(CALIBRATION_MS)
    expect(score).toBeGreaterThan(99)
    expect(tierName(score)).toBe('超凡入圣')
  })

  it('never rewards a slower load', () => {
    let previous = Infinity
    for (const ms of [50, 100, 139, 250, 400, 700, 1200, 2000, 3500, 6000, 10_000, 30_000]) {
      const score = scorePercentile(ms)
      expect(score).toBeLessThanOrEqual(previous)
      previous = score
    }
  })

  it('stays inside a believable range at both extremes', () => {
    expect(scorePercentile(0)).toBeLessThan(100)
    expect(scorePercentile(1)).toBeLessThan(100)
    expect(scorePercentile(600_000)).toBeGreaterThan(0)
  })

  it('separates ordinary machines instead of bunching them at the top', () => {
    // A curve that flattered everyone would have no joke in it: a second-long
    // load has to read as clearly worse than a fast one.
    expect(scorePercentile(1200)).toBeLessThan(85)
    expect(scorePercentile(400)).toBeGreaterThan(90)
  })

  it('survives a timing API that reports nonsense', () => {
    expect(Number.isFinite(scorePercentile(Number.NaN))).toBe(true)
  })
})

describe('nationalRank', () => {
  it('gives a better rank to a better percentile', () => {
    expect(nationalRank(scorePercentile(139))).toBeLessThan(nationalRank(scorePercentile(2000)))
  })

  it('never claims a rank below first place', () => {
    expect(nationalRank(100)).toBeGreaterThanOrEqual(1)
  })
})

describe('tierName', () => {
  it('names every band, including the bottom one', () => {
    expect(tierName(99.9)).toBe('超凡入圣')
    expect(tierName(50)).toBe('泯然众人')
    expect(tierName(1)).toBe('亟需优化')
  })
})
