/**
 * The "landing page": what a missed close button gets you.
 *
 * Missing the real hitbox blows the banner up to full screen behind a scrim,
 * exactly like a mistapped mobile ad. Creatives that carry a video play it
 * here instead of enlarging the still — a game ad opening into a video ad is
 * the whole shape of the thing.
 *
 * The joke has a floor — the skip control becomes a normal, honestly-sized
 * button after a short countdown, and Escape always works — so a user who
 * wants out is never actually trapped.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AdCreative, AdLocale } from './types.ts'
import { resolveHitbox, VISUAL_CLOSE_PX } from './hitbox.ts'

/** Seconds before the honest skip button appears. */
const SKIP_AFTER_S = 3

/** Props for the full-screen ad takeover. */
export interface LightboxProps {
  /** Language used by the host UI. */
  readonly locale?: AdLocale
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

/** Shared box for the enlarged still and the video, so both fill the scrim identically. */
const mediaStyle: CSSProperties = {
  display: 'block',
  maxWidth: '92vw',
  maxHeight: '70vh',
  width: 'auto',
  height: 'auto',
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
export function Lightbox({ creative, seed, onClose, locale = 'zh' }: LightboxProps) {
  const [left, setLeft] = useState(SKIP_AFTER_S)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const timer = setInterval(() => setLeft((n) => (n <= 1 ? 0 : n - 1)), 1000)
    return () => clearInterval(timer)
  }, [])
  // React sets `muted` as a DOM property but never as the HTML attribute, and
  // the autoplay policy reads the attribute — so a JSX-only `muted autoPlay`
  // video mounts paused. Setting it here, before asking to play, is what
  // actually starts it.
  useEffect(() => {
    const video = videoRef.current
    if (video === null) return
    video.muted = true
    void video.play().catch(() => {
      // Swallowed: a refusal leaves the poster frame on screen, which is a
      // fine still ad. Nothing else in the takeover depends on playback.
    })
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
        {creative.video === undefined
          ? (
            <img
              src={creative.src}
              alt={creative.alt}
              draggable={false}
              style={mediaStyle}
            />
          )
          : (
            // Muted autoplay is the only kind browsers reliably allow; the
            // unmute control below hands the sound back on a real click.
            <video
              ref={videoRef}
              src={creative.video}
              poster={creative.src}
              autoPlay
              loop
              muted
              playsInline
              aria-label={creative.alt}
              style={mediaStyle}
            />
          )}
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
          aria-label={locale === 'en' ? 'Close advertisement' : '关闭广告'}
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
      <div style={{ display: 'flex', gap: 10 }}>
        {creative.href !== undefined && (
          // The one link in the layer that goes somewhere real. Community
          // plugins are advertised without being asked, so the least the joke
          // owes them is a working way through to the repository.
          <a
            href={creative.href}
            target="_blank"
            rel="noreferrer noopener"
            style={{ ...skipStyle, textDecoration: 'none' }}
          >
            {locale === 'en' ? '🔗 VIEW THIS PLUGIN' : '🔗 去看看这个插件'}
          </a>
        )}
        {creative.video !== undefined && (
          <button
            type="button"
            style={skipStyle}
            onClick={() => {
              const video = videoRef.current
              if (video === null) return
              video.muted = !muted
              setMuted(!muted)
              void video.play().catch(() => {
                // Swallowed: a rejected play() here means the browser still
                // refuses audible playback, which leaves the video exactly as
                // it was. Nothing else in the takeover depends on it.
              })
            }}
          >
            {muted
              ? (locale === 'en' ? '🔇 TAP FOR SOUND' : '🔇 点击有声播放')
              : (locale === 'en' ? '🔊 MUTE' : '🔊 静音')}
          </button>
        )}
        {left > 0
          ? (
            <div style={{ ...skipStyle, opacity: 0.5, cursor: 'default' }}>
              {locale === 'en' ? `SKIP IN ${left}` : `${left} 秒后可跳过`}
            </div>
            )
          : <button type="button" style={skipStyle} onClick={onClose}>{locale === 'en' ? 'SKIP AD' : '跳过广告'}</button>}
      </div>
    </div>
  )
}
