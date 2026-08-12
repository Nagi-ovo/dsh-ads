/** Locale selection and generated artwork parity. */

import { describe, expect, it } from 'vitest'
import {
  BUILTIN_ADS_BY_LOCALE,
  BUILTIN_POPUPS_BY_LOCALE,
  BUILTIN_POSTERS_BY_LOCALE,
  BUILTIN_REWARDS_BY_LOCALE,
} from '../src/client/builtin-ads.ts'
import { adLocale } from '../src/client/locale.ts'
import { gutterSponsorCount } from '../src/client/registry.ts'
import type { AdCreative } from '../src/client/types.ts'

/** Comparable layout facts for one creative pool. */
function geometry(pool: readonly AdCreative[]): string[] {
  return pool.map((creative) => `${creative.shape}:${creative.width}x${creative.height}`).sort()
}

/** Whether the candidate pool covers every canvas in the reference pool. */
function coversGeometry(candidate: readonly AdCreative[], reference: readonly AdCreative[]): boolean {
  const remaining = geometry(candidate)
  return geometry(reference).every((canvas) => {
    const index = remaining.indexOf(canvas)
    if (index < 0) return false
    remaining.splice(index, 1)
    return true
  })
}

describe('localized artwork', () => {
  it('uses English only when the DSH language is English', () => {
    expect(adLocale('en')).toBe('en')
    expect(adLocale('zh')).toBe('zh')
    expect(adLocale('fr')).toBe('zh')
  })

  it('keeps English side gutters mostly available to localized built-ins', () => {
    expect(gutterSponsorCount('en')).toBe(3)
    expect(gutterSponsorCount('zh')).toBe(8)
  })

  it('ships an English creative for every Chinese canvas', () => {
    expect(coversGeometry(BUILTIN_ADS_BY_LOCALE.en, BUILTIN_ADS_BY_LOCALE.zh)).toBe(true)
    expect(coversGeometry(BUILTIN_POPUPS_BY_LOCALE.en, BUILTIN_POPUPS_BY_LOCALE.zh)).toBe(true)
    expect(coversGeometry(BUILTIN_POSTERS_BY_LOCALE.en, BUILTIN_POSTERS_BY_LOCALE.zh)).toBe(true)
    expect(coversGeometry(BUILTIN_REWARDS_BY_LOCALE.en, BUILTIN_REWARDS_BY_LOCALE.zh)).toBe(true)
  })

  it('ships the English fake-game takeover as a playable video', () => {
    const poster = BUILTIN_POSTERS_BY_LOCALE.en[0]
    expect(poster?.video).toMatch(/^data:video\/mp4;base64,/)
    expect(poster?.alt).not.toMatch(/[\u3400-\u9fff]/)
  })
})
