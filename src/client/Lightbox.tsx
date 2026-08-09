/**
 * The "landing page": what a missed close button gets you.
 *
 * Missing the real hitbox blows the banner up to full screen behind a scrim,
 * exactly like a mistapped mobile ad. The joke has a floor — the skip control
 * becomes a normal, honestly-sized button after a short countdown, and Escape
 * always works — so a user who wants out is never actually trapped.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import type { AdCreative } from './types.ts'
import { resolveHitbox, VISUAL_CLOSE_PX } from './hitbox.ts'

/** Seconds before the honest skip button appears. */
const SKIP_AFTER_S = 3

/** Props for the full-screen ad takeover. */
export interface LightboxProps {
  /** The banner that was mistapped. */
  readonly creative: AdCreative
  /** Frozen randomness of the originating banner, reused for the decoy ✕. */
  readonly seed: number
  /** Dismiss the takeover. */
  readonly onClose: () => void
}

const scrimStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2_147_483_000,
  background: 'rgba(0, 0, 0, 0.86)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  pointerEvents: 'auto',
}

const skipStyle: CSSProperties = {
  padding: '6px 18px',
  borderRadius: 4,
  border: '1px solid rgba(255, 255, 255, 0.4)',
  background: 'rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.85)',
  fontSize: 13,
  fontFamily: 'system-ui, sans-serif',
  cursor: 'pointer',
}

/**
 * Draw the takeover.
 * @param props - see {@link LightboxProps}.
 * @returns the scrim element.
 */
export function Lightbox({ creative, seed, onClose }: LightboxProps) {
  const [left, setLeft] = useState(SKIP_AFTER_S)
  useEffect(() => {
    const timer = setInterval(() => setLeft((n) => (n <= 1 ? 0 : n - 1)), 1000)
    return () => clearInterval(timer)
  }, [])
  // Escape is the unconditional exit: the countdown is a gag, not a trap.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])
  // The takeover's own ✕ is skewed too — with the complementary seed, so the
  // second attempt is wrong in a different direction than the first.
  const hit = resolveHitbox(1 - seed)
  return (
    <div style={scrimStyle}>
      <div style={{ position: 'relative', maxWidth: '92vw' }}>
        <img
          src={creative.src}
          alt={creative.alt}
          draggable={false}
          style={{ display: 'block', maxWidth: '92vw', maxHeight: '70vh', width: 'auto', height: 'auto' }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -VISUAL_CLOSE_PX - 6,
            right: 0,
            width: VISUAL_CLOSE_PX,
            height: VISUAL_CLOSE_PX,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.75)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          ✕
        </div>
        <button
          type="button"
          aria-label="关闭广告"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: -VISUAL_CLOSE_PX - 6 + hit.top,
            right: VISUAL_CLOSE_PX - hit.size - hit.left,
            width: hit.size,
            height: hit.size,
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
          }}
        />
      </div>
      {left > 0
        ? <div style={{ ...skipStyle, opacity: 0.5, cursor: 'default' }}>{left} 秒后可跳过</div>
        : <button type="button" style={skipStyle} onClick={onClose}>跳过广告</button>}
    </div>
  )
}
