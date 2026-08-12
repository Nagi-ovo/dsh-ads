/**
 * Placement's hard obligations: banners may cover the empty margins and
 * nothing else. The composer, the session sidebar, and the conversation column
 * are all off limits — the first two would break the app, and the third would
 * cover the transcript the user is actually reading. On top of that, banners
 * in one gutter must never overlap each other.
 */

import { describe, expect, it } from 'vitest'
import {
  FALLBACK_SAFE_AREA,
  layout,
  looksLikeSidebar,
  resolvePlacement,
  type SafeArea,
  type Viewport,
} from '../src/client/placement.ts'
import type { AdCreative, PlacedAd } from '../src/client/types.ts'

const viewport: Viewport = { width: 1600, height: 900 }

/** A wide window: 280px sidebar, 760px centred column, 220px composer band. */
const safe: SafeArea = {
  ...FALLBACK_SAFE_AREA,
  bottom: 220,
  left: 280,
  columnLeft: 500,
  columnRight: 1260,
  right: 16,
}

const wide: AdCreative = { id: 'w', width: 900, height: 120, shape: 'wide', weight: 1, alt: 'w', src: '' }
const strip: AdCreative = { id: 's', width: 900, height: 46, shape: 'strip', weight: 1, alt: 's', src: '' }
const tall: AdCreative = { id: 't', width: 160, height: 640, shape: 'tall', weight: 1, alt: 't', src: '' }
const sponsorTall: AdCreative = { id: 'st', width: 300, height: 480, shape: 'tall', weight: 1, alt: 'st', src: '' }

/**
 * Build a run of placed banners cycling through the given artwork.
 * @param count - how many to place.
 * @param pool - artwork to cycle through.
 * @returns the placed banners, in spawn order.
 */
function placeMany(count: number, pool: readonly AdCreative[] = [wide, strip, tall]): PlacedAd[] {
  return Array.from({ length: count }, (_unused, i) => {
    const { side, row } = resolvePlacement(i)
    return { key: `k${i}`, creative: pool[i % pool.length] as AdCreative, side, row, seed: 0.5, bornAt: 0 }
  })
}

describe('resolvePlacement', () => {
  it('alternates gutters so both fill evenly', () => {
    expect(resolvePlacement(0)).toStrictEqual({ side: 'left', row: 0 })
    expect(resolvePlacement(1)).toStrictEqual({ side: 'right', row: 0 })
    expect(resolvePlacement(2)).toStrictEqual({ side: 'left', row: 1 })
  })
})

describe('layout', () => {
  it('never overlaps the conversation column', () => {
    for (const { box } of layout(placeMany(20), viewport, safe)) {
      const clearsLeft = box.left + box.width <= safe.columnLeft
      const clearsRight = box.left >= safe.columnRight
      expect(clearsLeft || clearsRight).toBe(true)
    }
  })

  it('never reaches into the sidebar or past the right margin', () => {
    for (const { box } of layout(placeMany(20), viewport, safe)) {
      expect(box.left).toBeGreaterThanOrEqual(safe.left)
      expect(box.left + box.width).toBeLessThanOrEqual(viewport.width - safe.right)
    }
  })

  it('never reaches into the composer band', () => {
    const floor = viewport.height - safe.bottom
    for (const { ad, box } of layout(placeMany(20), viewport, safe)) {
      const height = box.width * (ad.creative.height / ad.creative.width)
      expect(box.top).toBeGreaterThanOrEqual(safe.top)
      expect(box.top + height).toBeLessThanOrEqual(floor)
    }
  })

  it('never overlaps two banners in the same gutter', () => {
    const placed = layout(placeMany(20), viewport, safe)
    for (const side of ['left', 'right'] as const) {
      const column = placed.filter((p) => p.ad.side === side)
      for (const a of column) {
        for (const b of column) {
          if (a === b) continue
          const aH = a.box.width * (a.ad.creative.height / a.ad.creative.width)
          const bH = b.box.width * (b.ad.creative.height / b.ad.creative.width)
          const apart = a.box.top + aH <= b.box.top || b.box.top + bH <= a.box.top
            || a.box.left + a.box.width <= b.box.left || b.box.left + b.box.width <= a.box.left
          expect(apart).toBe(true)
        }
      }
    }
  })

  it('gives a sponsor skyscraper the full gutter width instead of duplicating it', () => {
    const skyscraper = layout(placeMany(1, [sponsorTall]), viewport, safe)[0]
    const horizontal = layout(placeMany(1, [wide]), viewport, safe)[0]
    expect(skyscraper).toBeDefined()
    expect(horizontal).toBeDefined()
    expect(Math.round(skyscraper!.box.width)).toBe(Math.round(horizontal!.box.width))
  })

  it('drops the gutters entirely rather than rendering unreadable slivers', () => {
    // A 14" window with a wide transcript leaves margins too narrow to carry
    // legible Chinese artwork; no column is the right answer there.
    const cramped: SafeArea = { ...safe, left: 240, columnLeft: 330, columnRight: 1400, right: 16 }
    expect(layout(placeMany(6), { width: 1440, height: 900 }, cramped)).toHaveLength(0)
  })

  it('uses a wide margin fully instead of leaving it half empty', () => {
    const roomy: SafeArea = { ...safe, left: 0, columnLeft: 600, columnRight: 1000, right: 16 }
    const placed = layout(placeMany(2, [wide]), { width: 1600, height: 900 }, roomy)
    expect(placed[0]!.box.width).toBeGreaterThan(300)
  })

  it('renders both gutters at the same width so the columns line up', () => {
    const lopsided: SafeArea = { ...safe, columnLeft: 700, columnRight: 900 }
    const placed = layout(placeMany(4, [wide]), viewport, lopsided)
    const widths = new Set(placed.map((p) => Math.round(p.box.width)))
    expect(widths.size).toBe(1)
  })

  it('drops the overflow instead of clamping banners on top of each other', () => {
    const many = layout(placeMany(40), viewport, safe)
    expect(many.length).toBeLessThan(40)
    expect(many.length).toBeGreaterThan(0)
  })

  it('shrinks an unusually narrow skyscraper only as much as needed to fit vertically', () => {
    const placed = layout(placeMany(6), viewport, safe)
    const skyscraper = placed.find((p) => p.ad.creative.shape === 'tall')
    const banner = placed.find((p) => p.ad.creative.shape === 'wide')
    expect(skyscraper).toBeDefined()
    expect(banner).toBeDefined()
    expect(skyscraper!.box.width).toBeLessThan(banner!.box.width)
  })

  it('still places banners before the column has been measured', () => {
    const unmeasured: SafeArea = { ...FALLBACK_SAFE_AREA, left: 280, bottom: 220 }
    const placed = layout(placeMany(4), viewport, unmeasured)
    expect(placed.length).toBeGreaterThan(0)
    for (const { box } of placed) expect(box.left).toBeGreaterThanOrEqual(unmeasured.left)
  })

  it('squeezes rather than spilling over the transcript in a narrow window', () => {
    const small: Viewport = { width: 900, height: 700 }
    const tight: SafeArea = { ...safe, left: 0, columnLeft: 200, columnRight: 700, bottom: 180 }
    for (const { box } of layout(placeMany(6), small, tight)) {
      expect(box.left + box.width <= tight.columnLeft || box.left >= tight.columnRight).toBe(true)
    }
  })
})

describe('looksLikeSidebar', () => {
  /** A viewport tall enough that the 60% height rule is meaningful. */
  const VIEWPORT_H = 846

  it('recognises the sidebar collapsed to its icon rail', () => {
    // The measured rail is 56px. A threshold set for the expanded column let
    // banners start at the viewport edge and bury the navigation, which is the
    // one region this layer promises to leave alone.
    expect(looksLikeSidebar({ left: 0, width: 56, height: 846 }, VIEWPORT_H)).toBe(true)
  })

  it('still recognises it expanded', () => {
    expect(looksLikeSidebar({ left: 0, width: 280, height: 846 }, VIEWPORT_H)).toBe(true)
  })

  it('ignores things that merely touch the left edge', () => {
    expect(looksLikeSidebar({ left: 0, width: 14, height: 846 }, VIEWPORT_H)).toBe(false)
    expect(looksLikeSidebar({ left: 0, width: 900, height: 846 }, VIEWPORT_H)).toBe(false)
    expect(looksLikeSidebar({ left: 0, width: 200, height: 200 }, VIEWPORT_H)).toBe(false)
    expect(looksLikeSidebar({ left: 320, width: 200, height: 846 }, VIEWPORT_H)).toBe(false)
  })
})
