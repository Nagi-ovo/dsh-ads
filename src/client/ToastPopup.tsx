/**
 * The corner pop-up.
 *
 * A separate species from the gutter banners: it slides up out of the
 * bottom-right corner behind a fake window chrome, chimes on arrival, and
 * carries the smallest close target in the plugin. This is the shape the
 * 2000s Chinese web reserved for its most aggressive inventory, so it draws
 * from the loud full-colour artwork rather than the flat edge strips.
 *
 * It never retracts on its own, and its real ✕ is nearly unhittable — the
 * honest way out is to misfire into the takeover and skip it, which the layer
 * counts as having watched the ad and temporarily closes the pop-up.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import type { AdCreative } from './types.ts'
import { resolveHitbox } from './hitbox.ts'
import { playChime } from './sound.ts'

/** Rendered width of the pop-up window, in CSS pixels. */
const POPUP_WIDTH = 320

/**
 * Side of the pop-up's real close hitbox, in CSS pixels — two below the
 * banners'. The corner pop-up was always the worst offender.
 */
const POPUP_HITBOX_PX = 5

/** Visual size of the pop-up's ✕ glyph box, in CSS pixels. */
const POPUP_CLOSE_PX = 16

/** Props for one corner pop-up. */
export interface ToastPopupProps {
  /** The artwork to show. */
  readonly creative: AdCreative
  /** Frozen randomness driving the decoy hitbox, in [0, 1). */
  readonly seed: number
  /** Whether to chime on arrival. */
  readonly chime: boolean
  /** Called when the real hitbox is hit. */
  readonly onClose: () => void
  /** Called when anything else on the pop-up is clicked. */
  readonly onMisfire: () => void
}

const chromeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 22,
  padding: '0 4px 0 8px',
  background: 'linear-gradient(#4a90d9, #2f6cad)',
  color: '#fff',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  userSelect: 'none',
}

/**
 * Draw a corner pop-up.
 * @param props - see {@link ToastPopupProps}.
 * @returns the fixed-position pop-up window.
 */
export function ToastPopup({ creative, seed, chime, onClose, onMisfire }: ToastPopupProps) {
  const [entered, setEntered] = useState(false)
  const hit = resolveHitbox(seed, POPUP_HITBOX_PX)
  // No retract timer: a pop-up that leaves on its own is a notification, not
  // an ad. It sits there until the user finds the real hitbox.
  useEffect(() => {
    if (chime) playChime()
    const raise = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(raise)
  }, [chime])
  const height = POPUP_WIDTH * (creative.height / creative.width)
  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        width: POPUP_WIDTH,
        zIndex: 2_147_450_000,
        // Slides up from below its own height plus the chrome bar, the way a
        // corner pop-up crawls out from behind the taskbar.
        transform: entered ? 'none' : `translateY(${height + 40}px)`,
        transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 2px 14px rgba(0, 0, 0, 0.45)',
        border: '1px solid #1f4d7a',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
      onClick={onMisfire}
    >
      <div style={chromeStyle}>
        <span>DSH 消息中心</span>
        <span style={{ position: 'relative', width: POPUP_CLOSE_PX, height: POPUP_CLOSE_PX }}>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ✕
          </span>
          <button
            type="button"
            aria-label="关闭弹窗广告"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
            style={{
              position: 'absolute',
              top: hit.top,
              right: POPUP_CLOSE_PX - hit.size - hit.left,
              width: hit.size,
              height: hit.size,
              padding: 0,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
            }}
          />
        </span>
      </div>
      <img
        src={creative.src}
        alt={creative.alt}
        draggable={false}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />
    </div>
  )
}
