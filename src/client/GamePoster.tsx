/**
 * The bottom-left takeover — and, in solo mode, the one thing the layer is.
 *
 * Deliberately the opposite corner from {@link ToastPopup}, so the two never
 * compete for the same real estate, and deliberately the largest thing the
 * layer puts on screen. It is also the only piece with real affordances: the
 * title bar drags it anywhere, the chevron folds it down to that bar, and both
 * are honest controls with honest hitboxes. Only the ✕ lies.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import type { AdCreative } from './types.ts'
import type { Anchor } from './persist.ts'
import { useDrag } from './useDrag.ts'
import { resolveHitbox } from './hitbox.ts'
import { playRing } from './sound.ts'

/** Rendered width of the poster, in CSS pixels. */
export const POSTER_WIDTH = 300

/** Height of the fake window chrome, in CSS pixels. */
const CHROME_H = 22

/** Side of the poster's real close hitbox, in CSS pixels — the smallest here. */
const POSTER_HITBOX_PX = 4

/** Visual size of the poster's ✕ glyph box, in CSS pixels. */
const POSTER_CLOSE_PX = 18

/** Props for the bottom-left poster. */
export interface GamePosterProps {
  /** The artwork to show. */
  readonly creative: AdCreative
  /** Frozen randomness driving the decoy hitbox, in [0, 1). */
  readonly seed: number
  /** Whether to chime on arrival. */
  readonly chime: boolean
  /** Current position. */
  readonly anchor: Anchor
  /** Called with a new position when the user drags it. */
  readonly onMove: (next: Anchor) => void
  /** Whether it is folded down to its title bar. */
  readonly collapsed: boolean
  /** Toggle the fold. */
  readonly onToggleCollapse: () => void
  /** Called when the real hitbox is hit. */
  readonly onClose: () => void
  /** Called when the artwork itself is clicked (and not dragged). */
  readonly onMisfire: () => void
}

const chromeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  height: CHROME_H,
  padding: '0 3px 0 8px',
  background: 'linear-gradient(#8b1a1a, #5c0f0f)',
  color: '#ffd76a',
  fontSize: 11,
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 700,
  userSelect: 'none',
}

const chromeButtonStyle: CSSProperties = {
  width: POSTER_CLOSE_PX,
  height: POSTER_CLOSE_PX,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: '#ffd76a',
  fontSize: 11,
  lineHeight: 1,
  cursor: 'pointer',
}

/**
 * Draw the poster.
 * @param props - see {@link GamePosterProps}.
 * @returns the fixed-position poster window.
 */
export function GamePoster(props: GamePosterProps) {
  const { creative, seed, chime, anchor, onMove, collapsed, onToggleCollapse, onClose, onMisfire } = props
  const [entered, setEntered] = useState(false)
  const hit = resolveHitbox(seed, POSTER_HITBOX_PX)
  const height = POSTER_WIDTH * (creative.height / creative.width)
  const drag = useDrag(anchor, onMove, { width: POSTER_WIDTH, height: (collapsed ? 0 : height) + CHROME_H })
  // No retract timer: it stays until the user finds the real hitbox.
  useEffect(() => {
    if (chime) playRing()
    const raise = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(raise)
  }, [chime])
  return (
    <div
      style={{
        position: 'fixed',
        left: anchor.left,
        // Bottom-anchored so folding drops the body onto the title bar instead
        // of leaving the bar floating where the card's head used to be.
        bottom: anchor.bottom,
        width: POSTER_WIDTH,
        zIndex: 2_147_450_000,
        transform: entered ? 'none' : `translateY(${height + 40}px)`,
        // Suppressed mid-drag: a transition on a dragged element lags the
        // cursor and feels broken.
        transition: drag.dragging ? 'none' : 'transform 520ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 3px 18px rgba(0, 0, 0, 0.6)',
        border: '2px solid #c9a227',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{ ...chromeStyle, cursor: drag.dragging ? 'grabbing' : 'grab' }}
        onPointerDown={drag.onPointerDown}
      >
        <span>★ 火爆开服 ★</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            style={chromeButtonStyle}
            aria-label={collapsed ? '展开广告' : '收起广告'}
            title={collapsed ? '展开' : '收起'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleCollapse}
          >
            {collapsed ? '▲' : '▼'}
          </button>
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
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onClose}
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
        </span>
      </div>
      {!collapsed && (
        <img
          src={creative.src}
          alt={creative.alt}
          draggable={false}
          // A drag that ends over the artwork must not also open the takeover.
          onClick={() => { if (!drag.moved()) onMisfire() }}
          style={{ display: 'block', width: '100%', height: 'auto', cursor: 'pointer' }}
        />
      )}
    </div>
  )
}
