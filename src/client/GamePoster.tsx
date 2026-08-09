/**
 * The bottom-left takeover: browser-game inventory.
 *
 * Deliberately the opposite corner from {@link ToastPopup} — these two never
 * compete for the same real estate — and deliberately the largest thing the
 * layer puts on screen. It is the heavyweight slot: a full vertical poster
 * with fake chrome, a countdown ribbon, and the smallest ✕ of all three ad
 * species, on the rarest cadence.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import type { AdCreative } from './types.ts'
import { resolveHitbox } from './hitbox.ts'
import { playRing } from './sound.ts'

/** Rendered width of the poster, in CSS pixels. */
const POSTER_WIDTH = 300

/** Side of the poster's real close hitbox, in CSS pixels — the smallest here. */
const POSTER_HITBOX_PX = 4

/** Visual size of the poster's ✕ glyph box, in CSS pixels. */
const POSTER_CLOSE_PX = 18

/** Props for one bottom-left poster. */
export interface GamePosterProps {
  /** The artwork to show. */
  readonly creative: AdCreative
  /** Frozen randomness driving the decoy hitbox, in [0, 1). */
  readonly seed: number
  /** Whether to chime on arrival. */
  readonly chime: boolean
  /** Called when the real hitbox is hit. */
  readonly onClose: () => void
  /** Called when anything else on the poster is clicked. */
  readonly onMisfire: () => void
}

const chromeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 20,
  padding: '0 3px 0 8px',
  background: 'linear-gradient(#8b1a1a, #5c0f0f)',
  color: '#ffd76a',
  fontSize: 11,
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 700,
  userSelect: 'none',
}

/**
 * Draw the bottom-left poster.
 * @param props - see {@link GamePosterProps}.
 * @returns the fixed-position poster window.
 */
export function GamePoster({ creative, seed, chime, onClose, onMisfire }: GamePosterProps) {
  const [entered, setEntered] = useState(false)
  const hit = resolveHitbox(seed, POSTER_HITBOX_PX)
  // No retract timer: it stays until the user finds the real hitbox.
  useEffect(() => {
    if (chime) playRing()
    const raise = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(raise)
  }, [chime])
  const height = POSTER_WIDTH * (creative.height / creative.width)
  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        width: POSTER_WIDTH,
        zIndex: 2_147_450_000,
        transform: entered ? 'none' : `translateY(${height + 40}px)`,
        transition: 'transform 520ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 3px 18px rgba(0, 0, 0, 0.6)',
        border: '2px solid #c9a227',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
      onClick={onMisfire}
    >
      <div style={chromeStyle}>
        <span>★ 火爆开服 ★</span>
        <span style={{ position: 'relative', width: POSTER_CLOSE_PX, height: POSTER_CLOSE_PX }}>
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
            aria-label="关闭游戏广告"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
            style={{
              position: 'absolute',
              top: hit.top,
              right: POSTER_CLOSE_PX - hit.size - hit.left,
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
