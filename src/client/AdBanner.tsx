/**
 * One banner on screen: the artwork, an entrance animation, and the close
 * button that mostly does not close it.
 *
 * Three overlapping click targets, outermost first: the banner body opens the
 * lightbox, the drawn ✕ *also* opens the lightbox, and only the small skewed
 * patch inside the ✕ dismisses the banner. See `hitbox.ts` for why the skew is
 * frozen per banner.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import type { AdLocale, PlacedAd } from './types.ts'
import type { AdBox } from './placement.ts'
import { resolveHitbox, VISUAL_CLOSE_PX } from './hitbox.ts'

/** Props for a single placed banner. */
export interface AdBannerProps {
  /** Language used by the host UI. */
  readonly locale?: AdLocale
  /** The banner instance to draw. */
  readonly ad: PlacedAd
  /** The box the layout assigned it. */
  readonly box: AdBox
  /** Side of the real close hitbox, in CSS pixels. */
  readonly hitboxPx: number
  /** Called when the real hitbox is hit. */
  readonly onDismiss: () => void
  /** Called when anything else on the banner is clicked. */
  readonly onMisfire: () => void
}

const closeGlyphStyle: CSSProperties = {
  position: 'absolute',
  top: 2,
  right: 2,
  width: VISUAL_CLOSE_PX,
  height: VISUAL_CLOSE_PX,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 3,
  background: 'rgba(0, 0, 0, 0.55)',
  color: '#fff',
  fontSize: 13,
  lineHeight: 1,
  fontFamily: 'system-ui, sans-serif',
  cursor: 'pointer',
  userSelect: 'none',
}

/**
 * `outline`, not `border`: the layout computes each banner's height from the
 * artwork's aspect ratio, and a border would add two pixels per banner that
 * the running total does not know about — seven banners down a gutter, that
 * accumulated drift is enough to overlap them.
 */
const imgStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  outline: '1px solid rgba(0, 0, 0, 0.25)',
  outlineOffset: -1,
}

/**
 * Draw a placed banner.
 * @param props - see {@link AdBannerProps}.
 * @returns the fixed-position banner element.
 */
export function AdBanner({ ad, box, hitboxPx, onDismiss, onMisfire, locale = 'zh' }: AdBannerProps) {
  const hit = resolveHitbox(ad.seed, hitboxPx)
  // Entrance: banners slide in from the nearest edge, the way a cheap ad
  // script reveals them after the page has already settled.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(timer)
  }, [])
  const slide = ad.side === 'left' ? -40 : 40
  return (
    <div
      style={{
        position: 'fixed',
        left: box.left,
        top: box.top,
        width: box.width,
        zIndex: 2_147_400_000 + ad.row,
        opacity: entered ? 1 : 0,
        transform: entered ? 'none' : `translateX(${slide}px)`,
        transition: 'opacity 320ms ease, transform 320ms cubic-bezier(0.2, 1.4, 0.4, 1)',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
      onClick={onMisfire}
    >
      <img src={ad.creative.src} alt={ad.creative.alt} style={imgStyle} draggable={false} />
      <div style={closeGlyphStyle} aria-hidden="true">✕</div>
      <button
        type="button"
        aria-label={locale === 'en' ? 'Close advertisement' : '关闭广告'}
        onClick={(event) => {
          event.stopPropagation()
          onDismiss()
        }}
        style={{
          position: 'absolute',
          top: 2 + hit.top,
          right: 2 + (VISUAL_CLOSE_PX - hit.size - hit.left),
          width: hit.size,
          height: hit.size,
          padding: 0,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
        }}
      />
    </div>
  )
}
