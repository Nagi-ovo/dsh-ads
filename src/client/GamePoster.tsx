/**
 * The bottom-left takeover — and, in solo mode, the one thing the layer is.
 *
 * Deliberately the opposite corner from {@link ToastPopup}, so the two never
 * compete for the same real estate, and deliberately the largest thing the
 * layer puts on screen. It is also the only piece with real affordances: the
 * title bar drags it anywhere, the chevron folds it down to that bar, and both
 * are honest controls with honest hitboxes. Only the ✕ lies.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AdSettingsMenu, type AdControlsProps } from './AdControls.tsx'
import type { AdCreative, AdLocale } from './types.ts'
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
  /** Language used by the host UI. */
  readonly locale?: AdLocale
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
  /** The layer's controls, revealed by the title bar's ⚙. */
  readonly controls: AdControlsProps
}

const chromeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  height: CHROME_H,
  padding: '0 3px 0 8px',
  fontSize: 11,
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 700,
  userSelect: 'none',
}

/**
 * Window chrome painted to match the artwork it frames.
 *
 * The red-and-gold chrome is the Chinese browser-game look, and it clashed
 * badly once the slot started rotating the English posters, which are drawn
 * purple-and-yellow. The skin follows the creative for the same reason the
 * title does.
 */
const CHROME_SKIN: Readonly<Record<AdLocale, { readonly background: string; readonly color: string; readonly border: string }>> = {
  zh: { background: 'linear-gradient(#8b1a1a, #5c0f0f)', color: '#ffd76a', border: '#c9a227' },
  en: { background: 'linear-gradient(#4d126d, #2d005c)', color: '#ffe600', border: '#a24bd8' },
}

/**
 * The ⚙ popover. It opens *above* the title bar because the card is
 * bottom-anchored — dropping it downward would cover the artwork it belongs to.
 */
const settingsPanelStyle: CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  right: -2,
  marginBottom: 4,
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

/** The ⚙ is a real control people are meant to find, so it gets a real target. */
const gearButtonStyle: CSSProperties = {
  ...chromeButtonStyle,
  width: 22,
  height: 18,
  fontSize: 13,
}

/**
 * Draw the poster.
 * @param props - see {@link GamePosterProps}.
 * @returns the fixed-position poster window.
 */
export function GamePoster(props: GamePosterProps) {
  const { creative, seed, chime, anchor, onMove, collapsed, onToggleCollapse, onClose, onMisfire } = props
  const locale = props.locale ?? 'zh'
  const [entered, setEntered] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLSpanElement | null>(null)
  const hit = resolveHitbox(seed, POSTER_HITBOX_PX)
  const skin = CHROME_SKIN[creative.locale ?? locale]
  const height = POSTER_WIDTH * (creative.height / creative.width)
  const drag = useDrag(anchor, onMove, { width: POSTER_WIDTH, height: (collapsed ? 0 : height) + CHROME_H })
  // No retract timer: it stays until the user finds the real hitbox.
  useEffect(() => {
    if (chime) playRing()
    const raise = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(raise)
  }, [chime])

  // Clicking away closes the menu, the way every menu does. Without it the
  // panel sat over the artwork until the user found the ⚙ again — and the ⚙ is
  // deliberately small. Escape closes it too; a popover with exactly one exit
  // is the same trap as the ✕, and the honest controls do not play that game.
  useEffect(() => {
    if (!settingsOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && settingsRef.current?.contains(target) === true) return
      setSettingsOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    // Capture phase: the poster's own handlers stop propagation, so a bubbling
    // listener would never see a click that landed on the artwork.
    addEventListener('pointerdown', onPointerDown, true)
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('pointerdown', onPointerDown, true)
      removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])
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
        border: `2px solid ${skin.border}`,
        pointerEvents: 'auto',
        // Grab anywhere. Only the title bar used to drag, which stranded the
        // poster once it was pushed far enough that the sliver still on screen
        // was artwork rather than chrome.
        cursor: drag.dragging ? 'grabbing' : undefined,
      }}
      onPointerDown={drag.onPointerDown}
    >
      <div
        style={{ ...chromeStyle, background: skin.background, color: skin.color, cursor: drag.dragging ? 'grabbing' : 'grab' }}
      >
        <span>{(creative.locale ?? locale) === 'en' ? '★ ACTUAL GAMEPLAY ★' : '★ 火爆开服 ★'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ position: 'relative', display: 'flex' }} ref={settingsRef}>
            <button
              type="button"
              style={gearButtonStyle}
              aria-label={locale === 'en' ? 'Ad settings' : '广告设置'}
              title={locale === 'en' ? 'Ad settings' : '广告设置'}
              aria-expanded={settingsOpen}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              ⚙
            </button>
            {settingsOpen && (
              <div
                style={settingsPanelStyle}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {/* Flipping a switch closes the panel: it covers the artwork
                    it belongs to, and a one-shot menu that lingers reads as a
                    settings page the user still has to dismiss. */}
                <AdSettingsMenu {...props.controls} onPick={() => setSettingsOpen(false)} />
              </div>
            )}
          </span>
          <button
            type="button"
            style={chromeButtonStyle}
            aria-label={collapsed
              ? (locale === 'en' ? 'Expand advertisement' : '展开广告')
              : (locale === 'en' ? 'Collapse advertisement' : '收起广告')}
            title={collapsed
              ? (locale === 'en' ? 'Expand' : '展开')
              : (locale === 'en' ? 'Collapse' : '收起')}
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
              aria-label={locale === 'en' ? 'Close game advertisement' : '关闭游戏广告'}
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
