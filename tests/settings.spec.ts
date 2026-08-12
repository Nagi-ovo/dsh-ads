/**
 * The stored placement switches, and the one shortcut that folds them.
 *
 * Solo mode used to be its own stored flag; it is now derived from the same
 * switches everything else reads, so the two have to agree exactly — a solo
 * check that disagreed with what is on screen would show the wrong label on
 * the poster's own menu.
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, PLACEMENTS, isSolo, toggleSolo } from '../src/client/settings.ts'

describe('isSolo', () => {
  it('is false while anything besides the poster is on', () => {
    expect(isSolo(DEFAULT_SETTINGS)).toBe(false)
  })

  it('is false when even the poster is off', () => {
    const nothing = {
      ...DEFAULT_SETTINGS,
      gutter: false,
      feed: false,
      reward: false,
      popup: false,
      speed: false,
      scare: false,
      poster: false,
    }
    expect(isSolo(nothing)).toBe(false)
  })

  it('is true for exactly the poster', () => {
    expect(isSolo(toggleSolo(DEFAULT_SETTINGS))).toBe(true)
  })
})

describe('toggleSolo', () => {
  it('leaves only the poster on', () => {
    const solo = toggleSolo(DEFAULT_SETTINGS)
    for (const row of PLACEMENTS) expect(solo[row.key]).toBe(row.key === 'poster')
  })

  it('puts everything back on the way out', () => {
    for (const row of PLACEMENTS) expect(toggleSolo(toggleSolo(DEFAULT_SETTINGS))[row.key]).toBe(true)
  })

  it('does not touch sound either way', () => {
    // Muting is a preference about noise, not about which ads exist; a solo
    // shortcut that silently unmuted would be changing something else.
    const muted = { ...DEFAULT_SETTINGS, muted: true }
    expect(toggleSolo(muted).muted).toBe(true)
    expect(toggleSolo(toggleSolo(muted)).muted).toBe(true)
  })
})
