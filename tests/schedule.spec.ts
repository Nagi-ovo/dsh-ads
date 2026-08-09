/**
 * The population model and the decoy hitbox are the two places where the joke
 * could silently stop working — a model that never refills leaves a screen the
 * user can permanently clear one ✕ at a time, and a hitbox that escapes its
 * glyph makes the ✕ simply broken rather than deceptive. Both are pure
 * functions, so both are pinned here without a DOM.
 */

import { describe, expect, it } from 'vitest'
import { DEFAULT_SPAWN, pruneCooling, targetCount, weightedPick } from '../src/client/schedule.ts'
import { resolveHitbox, DEFAULT_HITBOX_PX, VISUAL_CLOSE_PX } from '../src/client/hitbox.ts'
import { resolvePlacement } from '../src/client/placement.ts'

const NOW = 1_700_000_000_000

describe('targetCount', () => {
  it('opens at full strength', () => {
    expect(targetCount(NOW, DEFAULT_SPAWN, [])).toBe(DEFAULT_SPAWN.maxAds)
  })

  it('holds one slot empty per outstanding cooldown', () => {
    const cooling = [NOW + 5_000, NOW + 9_000]
    expect(targetCount(NOW, DEFAULT_SPAWN, cooling)).toBe(DEFAULT_SPAWN.maxAds - 2)
  })

  it('refills the slot once its cooldown expires', () => {
    const cooling = [NOW + DEFAULT_SPAWN.respawnDelayMs]
    expect(targetCount(NOW, DEFAULT_SPAWN, cooling)).toBe(DEFAULT_SPAWN.maxAds - 1)
    expect(targetCount(NOW + DEFAULT_SPAWN.respawnDelayMs + 1, DEFAULT_SPAWN, cooling)).toBe(DEFAULT_SPAWN.maxAds)
  })

  it('ignores expired cooldowns without requiring the caller to prune', () => {
    expect(targetCount(NOW, DEFAULT_SPAWN, [NOW - 1, NOW - 60_000])).toBe(DEFAULT_SPAWN.maxAds)
  })

  it('never goes negative when more slots are cooling than exist', () => {
    const cooling = Array.from({ length: DEFAULT_SPAWN.maxAds + 5 }, () => NOW + 1000)
    expect(targetCount(NOW, DEFAULT_SPAWN, cooling)).toBe(0)
  })
})

describe('pruneCooling', () => {
  it('drops expired entries and keeps pending ones', () => {
    expect(pruneCooling(NOW, [NOW - 1, NOW + 1000])).toStrictEqual([NOW + 1000])
  })

  it('returns the same array when nothing expired, so React state stays stable', () => {
    const cooling = [NOW + 1000]
    expect(pruneCooling(NOW, cooling)).toBe(cooling)
  })
})

describe('weightedPick', () => {
  it('returns each index for the roll range that owns it', () => {
    expect(weightedPick([1, 3], 0.1)).toBe(0)
    expect(weightedPick([1, 3], 0.9)).toBe(1)
  })

  it('stays in range at the closed upper end', () => {
    expect(weightedPick([1, 1, 1], 0.999_999)).toBe(2)
  })
})

describe('resolveHitbox', () => {
  it('keeps the real target fully inside the drawn glyph', () => {
    for (let i = 0; i < 1000; i += 1) {
      const hit = resolveHitbox(i / 1000)
      expect(hit.left).toBeGreaterThanOrEqual(0)
      expect(hit.top).toBeGreaterThanOrEqual(0)
      expect(hit.left + hit.size).toBeLessThanOrEqual(VISUAL_CLOSE_PX)
      expect(hit.top + hit.size).toBeLessThanOrEqual(VISUAL_CLOSE_PX)
    }
  })

  it('is smaller than the glyph it hides in — otherwise there is no joke', () => {
    expect(DEFAULT_HITBOX_PX).toBeLessThan(VISUAL_CLOSE_PX)
  })

  it('is stable for a given seed', () => {
    expect(resolveHitbox(0.4242)).toStrictEqual(resolveHitbox(0.4242))
  })

  it('skews both axes independently', () => {
    const offsets = new Set<string>()
    for (let i = 0; i < 200; i += 1) {
      const hit = resolveHitbox(i / 200)
      offsets.add(`${hit.left.toFixed(2)}:${hit.top.toFixed(2)}`)
    }
    expect(offsets.size).toBeGreaterThan(20)
  })
})

describe('resolvePlacement', () => {
  it('keeps the two gutters balanced as the population grows', () => {
    let left = 0
    for (let i = 0; i < 14; i += 1) if (resolvePlacement(i).side === 'left') left += 1
    expect(left).toBe(7)
  })
})
