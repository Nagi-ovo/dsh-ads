/**
 * Where banners land.
 *
 * Two vertical gutters, one either side of the conversation column, filled
 * alternately top to bottom. The reading column itself is off limits: a banner
 * floating over the transcript covers the thing the user came for, and the
 * in-transcript ad has its own home in the turn-tail chain. Placement is a
 * pure function of the instance's ordinal, so a banner never migrates between
 * renders.
 */

import type { PlacedAd } from './types.ts'

/** Screen regions the layer must never cover. */
export interface SafeArea {
  /** Reserved band along the bottom (composer + dock), in CSS pixels. */
  readonly bottom: number
  /** Reserved band along the top (session header), in CSS pixels. */
  readonly top: number
  /** Reserved band on the right (settings trigger column), in CSS pixels. */
  readonly right: number
  /** Reserved band on the left (session sidebar), in CSS pixels. */
  readonly left: number
  /** Left edge of the conversation column, in CSS pixels. */
  readonly columnLeft: number
  /** Right edge of the conversation column, in CSS pixels. */
  readonly columnRight: number
}

/** Used before anything has been measured — deliberately generous. */
export const FALLBACK_SAFE_AREA: SafeArea = {
  bottom: 200,
  top: 56,
  right: 16,
  left: 0,
  columnLeft: 0,
  columnRight: 0,
}

/**
 * Column width both gutters render at. The columns take whatever the margins
 * offer up to this cap — leaving a 400px margin occupied by a 260px banner
 * looks like a layout bug, not like inventory. Both sides use the same number
 * so the two columns line up instead of drifting with the available room.
 */
const MAX_COLUMN_WIDTH = 400

/**
 * Narrowest a column may render, in CSS pixels.
 *
 * Below this the artwork's Chinese text stops being legible on a 14" screen,
 * and an ad nobody can read is just noise. A margin that cannot fit this gets
 * no column at all — the in-transcript ad and the corner pop-ups still work
 * fine on a narrow window.
 */
const MIN_COLUMN_WIDTH = 150

/** Gap between banners and against the gutter edges, in CSS pixels. */
const GAP = 8

/** Which gutter a banner occupies. */
export type AdSide = 'left' | 'right'

/**
 * Assign a gutter and row to the *n*-th banner.
 *
 * Sides alternate so both gutters fill evenly and the screen stays balanced
 * as the population grows.
 *
 * @param ordinal - zero-based spawn index.
 * @returns the gutter and row to place it in.
 */
export function resolvePlacement(ordinal: number): { side: AdSide; row: number } {
  return { side: ordinal % 2 === 0 ? 'left' : 'right', row: Math.floor(ordinal / 2) }
}

/** Absolute CSS box for one placed banner, in `position: fixed` coordinates. */
export interface AdBox {
  /** Distance from the viewport's left edge, in CSS pixels. */
  readonly left: number
  /** Distance from the viewport's top edge, in CSS pixels. */
  readonly top: number
  /** Rendered width, in CSS pixels. */
  readonly width: number
}

/** Viewport dimensions the layer lays banners out against. */
export interface Viewport {
  /** Viewport width, in CSS pixels. */
  readonly width: number
  /** Viewport height, in CSS pixels. */
  readonly height: number
}

/**
 * Usable horizontal span of one gutter.
 * @param side - which gutter.
 * @param viewport - current viewport size.
 * @param safe - measured regions.
 * @returns the gutter's left edge and width, before the max-width cap.
 */
function gutter(side: AdSide, viewport: Viewport, safe: SafeArea): { left: number; width: number } {
  // An unmeasured column (both edges zero) means "no transcript on screen yet";
  // the gutters then span everything between the sidebar and the right margin.
  const measured = safe.columnRight > safe.columnLeft
  const columnLeft = measured ? safe.columnLeft : (viewport.width + safe.left) / 2
  const columnRight = measured ? safe.columnRight : (viewport.width + safe.left) / 2
  if (side === 'left') return { left: safe.left, width: Math.max(0, columnLeft - safe.left) }
  const right = viewport.width - safe.right
  return { left: columnRight, width: Math.max(0, right - columnRight) }
}

/**
 * Rendered geometry for one gutter column.
 *
 * The width is the *narrower* of what the two margins can offer, so both
 * columns render identically wide — a left column at 260 and a right one at
 * 180 reads as a layout accident, not as two ad slots.
 *
 * @param side - which gutter.
 * @param viewport - current viewport size.
 * @param safe - measured regions.
 * @returns the column's left edge and its width.
 */
function gutterMetrics(side: AdSide, viewport: Viewport, safe: SafeArea): { left: number; width: number } {
  const here = gutter(side, viewport, safe)
  const other = gutter(side === 'left' ? 'right' : 'left', viewport, safe)
  const room = Math.min(here.width, other.width) - 2 * GAP
  // Zero width means "this window has no usable margin"; layoutColumn treats
  // that as no column rather than rendering illegible slivers.
  const width = room < MIN_COLUMN_WIDTH ? 0 : Math.min(MAX_COLUMN_WIDTH, room)
  const inset = Math.max(GAP, (here.width - width) / 2)
  const left = side === 'left' ? here.left + inset : here.left + Math.min(here.width - width - GAP, inset)
  return { left, width }
}

/** A banner and the box it occupies. */
export interface LaidOut {
  /** The banner. */
  readonly ad: PlacedAd
  /** Its box. */
  readonly box: AdBox
}

/**
 * Lay every banner out down its gutter.
 *
 * Positions accumulate from each banner's *actual* rendered height rather than
 * from a fixed row slot. A fixed slot cannot serve both a 19:1 strip and a 1:4
 * skyscraper — sizing it for the strip makes the skyscraper overlap everything
 * below it, and sizing it for the skyscraper leaves the column mostly empty.
 *
 * Banners that would run past the composer band are dropped from the result
 * instead of being clamped on top of their neighbours. Because the layout is
 * a running total, closing one banner slides the rest up and can reveal a
 * banner that was previously overflowed — which is exactly the "it grows back"
 * behaviour, for free.
 *
 * @param ads - placed banners, in spawn order.
 * @param viewport - current viewport size.
 * @param safe - regions to keep clear.
 * @returns the banners that fit, with their boxes.
 */
export function layout(ads: readonly PlacedAd[], viewport: Viewport, safe: SafeArea): readonly LaidOut[] {
  return [
    ...layoutColumn(ads.filter((a) => a.side === 'left'), 'left', viewport, safe),
    ...layoutColumn(ads.filter((a) => a.side === 'right'), 'right', viewport, safe),
  ]
}

/**
 * Lay one gutter column out top to bottom.
 *
 * Horizontal banners take the full column width. Skyscrapers are paired: two
 * of them side by side span exactly one column, which is both how a real
 * portal stacks its inventory and the only way a 1:4 banner fits at a readable
 * width. A skyscraper with no partner left in the queue takes the half-width
 * slot alone rather than stretching to a size where it would tower over the
 * whole gutter.
 *
 * @param column - the banners assigned to this gutter, in spawn order.
 * @param side - which gutter.
 * @param viewport - current viewport size.
 * @param safe - regions to keep clear.
 * @returns the banners that fit, with their boxes.
 */
function layoutColumn(
  column: readonly PlacedAd[],
  side: AdSide,
  viewport: Viewport,
  safe: SafeArea,
): readonly LaidOut[] {
  const { left, width } = gutterMetrics(side, viewport, safe)
  if (width === 0) return []
  const floor = viewport.height - safe.bottom
  const half = (width - GAP) / 2
  const height = (ad: PlacedAd, w: number) => w * (ad.creative.height / ad.creative.width)
  const queue = [...column]
  const out: LaidOut[] = []
  let top = safe.top
  while (queue.length > 0) {
    const ad = queue.shift()
    if (ad === undefined) break
    if (ad.creative.shape !== 'tall') {
      const h = height(ad, width)
      if (top + h > floor) continue
      out.push({ ad, box: { left, top, width } })
      top += h + GAP
      continue
    }
    const partnerAt = queue.findIndex((a) => a.creative.shape === 'tall')
    const partner = partnerAt < 0 ? undefined : queue.splice(partnerAt, 1)[0]
    const rowHeight = Math.max(height(ad, half), partner === undefined ? 0 : height(partner, half))
    if (top + rowHeight > floor) continue
    out.push({ ad, box: { left, top, width: half } })
    if (partner !== undefined) out.push({ ad: partner, box: { left: left + half + GAP, top, width: half } })
    top += rowHeight + GAP
  }
  return out
}
