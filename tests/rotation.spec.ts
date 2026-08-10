/**
 * The promise the dynamic tier makes to plugin authors: being in the pool is
 * enough. Nobody has to push at the right hour, star anything, or be popular
 * already — everyone is shown before anyone is shown twice.
 *
 * That is the whole reason this file exists. If `rotate` ever starves a slug,
 * the fair-rotation claim in the README is a lie.
 */

import { describe, expect, it } from 'vitest'
import { recordSeen, rotate, type SeenLedger } from '../src/client/rotation.ts'

/** A pool larger than one round, so starvation is possible if the rule is wrong. */
const POOL = Array.from({ length: 23 }, (_, i) => ({ slug: `owner/plugin-${i}` }))

/** How many one conversation shows. */
const TAKE = 8

describe('rotate', () => {
  it('shows every plugin before showing any of them twice', () => {
    let ledger: SeenLedger = {}
    const rounds = Math.ceil(POOL.length / TAKE)
    for (let round = 0; round < rounds; round += 1) {
      ledger = recordSeen(ledger, rotate(POOL, ledger, TAKE, `session-${round}`))
    }
    const counts = POOL.map((plugin) => ledger[plugin.slug] ?? 0)
    expect(Math.min(...counts)).toBeGreaterThan(0)
    // Three rounds of 8 over 23 plugins: one plugin necessarily comes round
    // again, but nothing may be on its third airing while another waits.
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('picks a different set for a different conversation', () => {
    const first = rotate(POOL, {}, TAKE, 'session-a').map((plugin) => plugin.slug)
    const second = rotate(POOL, {}, TAKE, 'session-b').map((plugin) => plugin.slug)
    expect(first).not.toEqual(second)
  })

  it('is stable for the same conversation', () => {
    const ledger = { 'owner/plugin-3': 2 }
    expect(rotate(POOL, ledger, TAKE, 'x')).toEqual(rotate(POOL, ledger, TAKE, 'x'))
  })

  it('prefers the least-seen regardless of the tie-break', () => {
    const ledger: SeenLedger = Object.fromEntries(POOL.map((plugin) => [plugin.slug, 5]))
    const starved = POOL[17] as { slug: string }
    const chosen = rotate(POOL, { ...ledger, [starved.slug]: 0 }, 1, 'anything')
    expect(chosen).toEqual([starved])
  })

  it('returns the whole pool when asked for more than it holds', () => {
    expect(rotate(POOL, {}, 999, 's')).toHaveLength(POOL.length)
  })
})

describe('recordSeen', () => {
  it('counts a plugin once per round it appears in', () => {
    const ledger = recordSeen(recordSeen({}, [{ slug: 'a' }, { slug: 'b' }]), [{ slug: 'a' }])
    expect(ledger).toEqual({ a: 2, b: 1 })
  })
})
