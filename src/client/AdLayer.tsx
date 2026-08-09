/**
 * The ad layer itself: a portal onto `document.body` that grows a population
 * of banners over the life of a session.
 *
 * It lives in a slot entry but renders nothing inline — the slot is only a
 * mounting point with a React lifecycle, which is what keeps the layer tied to
 * an open session instead of leaking across the whole app. Every banner is
 * `position: fixed`, so the conversation's own layout is never disturbed.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AdBanner } from './AdBanner.tsx'
import { Lightbox } from './Lightbox.tsx'
import { ToastPopup, POPUP_LIFETIME_MS } from './ToastPopup.tsx'
import { GamePoster, POSTER_LIFETIME_MS } from './GamePoster.tsx'
import { FALLBACK_SAFE_AREA, layout, resolvePlacement, type SafeArea, type Viewport } from './placement.ts'
import { pruneCooling, targetCount, weightedPick, type SpawnConfig } from './schedule.ts'
import type { AdCreative, PlacedAd } from './types.ts'

/** How often the layer re-checks its population target, in ms. */
const TICK_MS = 2000

/** Props for the ad layer. */
export interface AdLayerProps {
  /** The banner pool to draw from. */
  readonly creatives: readonly AdCreative[]
  /** The corner pop-up pool, rotated in order. */
  readonly popups: readonly AdCreative[]
  /** The bottom-left poster pool, rotated in order. */
  readonly posters: readonly AdCreative[]
  /** Growth curve. */
  readonly spawn: SpawnConfig
  /** Side of the real close hitbox, in CSS pixels. */
  readonly hitboxPx: number
  /** Gap between corner pop-ups, in ms; zero disables them. */
  readonly popupIntervalMs: number
  /** Gap between bottom-left posters, in ms; zero disables them. */
  readonly posterIntervalMs: number
  /** Whether a pop-up or poster chimes on arrival. */
  readonly chime: boolean
}

/** How deep to descend from `<body>` when looking for the sidebar. */
const SIDEBAR_SCAN_DEPTH = 5

/**
 * Slack added either side of the composer to derive the conversation column.
 * The transcript's own bubbles sit slightly wider than the composer card, so
 * the column has to be a touch wider than what is measured.
 */
const COLUMN_PAD = 12

/**
 * Find the right edge of the session sidebar, geometrically.
 *
 * The sidebar is navigation, not content: burying the session list makes the
 * app unusable rather than annoying, so the layer stops at its right edge.
 * It is identified by shape — flush with the left edge, most of the viewport
 * tall, in a plausible sidebar width band — rather than by tag or class,
 * because the shell's class names are per-build CSS-module hashes
 * (`n3zdcq_sidebarCol`) and there is no semantic landmark to match. The scan
 * is depth-bounded so a deep render tree cannot turn this into a full-document
 * walk on every tick.
 *
 * @param viewportHeight - current viewport height, in CSS pixels.
 * @returns the sidebar's right edge, or 0 when it is collapsed or absent.
 */
function measureSidebar(viewportHeight: number): number {
  let right = 0
  const visit = (node: Element, depth: number) => {
    if (depth > SIDEBAR_SCAN_DEPTH) return
    const rect = node.getBoundingClientRect()
    if (rect.left <= 2 && rect.height > viewportHeight * 0.6 && rect.width > 120 && rect.width < 400) {
      right = Math.max(right, rect.right)
    }
    for (const child of node.children) visit(child, depth + 1)
  }
  for (const child of document.body.children) visit(child, 1)
  return right
}

/** Deepest a header candidate may sit below the top edge, in CSS pixels. */
const HEADER_BAND = 140

/**
 * Find the bottom of the session header — title bar plus view tabs.
 *
 * Same geometric approach as {@link measureSidebar}, for the same reason: the
 * shell has no semantic landmark and its class names are per-build hashes.
 * Candidates are wide, shallow, and anchored near the top; the deepest one
 * wins, so the tab strip under the title is included rather than clipped.
 *
 * @param viewport - current viewport size.
 * @param columnLeft - left edge of the conversation column; header candidates
 * must start at or before it, which excludes anything inside the transcript.
 * @returns the header's bottom edge, or 0 when nothing matches.
 */
function measureHeader(viewport: Viewport, columnLeft: number): number {
  let bottom = 0
  const visit = (node: Element, depth: number) => {
    if (depth > SIDEBAR_SCAN_DEPTH) return
    const rect = node.getBoundingClientRect()
    const wide = rect.width > viewport.width * 0.3
    const shallow = rect.height > 0 && rect.height < 90 && rect.bottom < HEADER_BAND
    if (wide && shallow && rect.left <= columnLeft) bottom = Math.max(bottom, rect.bottom)
    for (const child of node.children) visit(child, depth + 1)
  }
  for (const child of document.body.children) visit(child, 1)
  return bottom
}

/**
 * Track the viewport size.
 * @returns the current viewport dimensions, updated on resize.
 */
function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(() => ({ width: innerWidth, height: innerHeight }))
  useEffect(() => {
    const onResize = () => setViewport({ width: innerWidth, height: innerHeight })
    addEventListener('resize', onResize)
    return () => removeEventListener('resize', onResize)
  }, [])
  return viewport
}

/**
 * Measure the regions banners must not cover.
 *
 * The composer is found by its input element rather than by a class name, so
 * the exclusion survives shell restyling; when nothing matches, the generous
 * {@link FALLBACK_SAFE_AREA} applies. Re-measured on the same ticker as
 * spawning, which is frequent enough for a composer that grows as the user
 * types and cheap enough to ignore.
 *
 * @param viewport - current viewport, so the hook re-measures after a resize.
 * @returns the reserved bands.
 */
function useSafeArea(viewport: Viewport): SafeArea {
  const [safe, setSafe] = useState<SafeArea>(FALLBACK_SAFE_AREA)
  useEffect(() => {
    const measure = () => {
      // The composer is both the bottom exclusion and the width reference for
      // the conversation column: it is centred on the column and always
      // present, which no transcript element is.
      const inputs = document.querySelectorAll('textarea, [contenteditable="true"]')
      let composer: DOMRect | undefined
      for (const node of inputs) {
        const rect = node.getBoundingClientRect()
        if (rect.height === 0) continue
        if (composer === undefined || rect.top < composer.top) composer = rect
      }
      const bottom = composer === undefined
        ? FALLBACK_SAFE_AREA.bottom
        : Math.max(FALLBACK_SAFE_AREA.top, viewport.height - composer.top + 12)
      const left = measureSidebar(viewport.height)
      // A column narrower than the composer would let banners overlap the
      // transcript, so pad the measured card outward a little.
      const columnLeft = composer === undefined ? 0 : Math.max(left, composer.left - COLUMN_PAD)
      const columnRight = composer === undefined ? 0 : Math.min(viewport.width, composer.right + COLUMN_PAD)
      const header = measureHeader(viewport, columnLeft === 0 ? viewport.width / 2 : columnLeft)
      const top = Math.max(FALLBACK_SAFE_AREA.top, header + 8)
      setSafe({ ...FALLBACK_SAFE_AREA, top, bottom, left, columnLeft, columnRight })
    }
    measure()
    const timer = setInterval(measure, TICK_MS)
    return () => clearInterval(timer)
  }, [viewport.height, viewport.width])
  return safe
}

/**
 * Draw the next creative for a gutter.
 *
 * The population (14) exceeds the pool, so repeats are unavoidable; what the
 * layer owes the user is that every banner in the set gets shown before any of
 * them appears a third time. Drawing from the *least-used* tier does that,
 * where excluding everything already on screen would collapse to uniform
 * randomness once the pool ran out — which is how four copies of one banner
 * ended up on screen while another creative never appeared at all.
 *
 * @param creatives - the full pool.
 * @param weights - per-creative draw weights, index-aligned with `creatives`.
 * @param placed - banners already on screen.
 * @returns the chosen creative, or undefined when the pool is empty.
 */
function pickCreative(
  creatives: readonly AdCreative[],
  weights: readonly number[],
  placed: readonly PlacedAd[],
): AdCreative | undefined {
  const used = new Map<string, number>()
  for (const ad of placed) used.set(ad.creative.id, (used.get(ad.creative.id) ?? 0) + 1)
  let fewest = Infinity
  for (const c of creatives) fewest = Math.min(fewest, used.get(c.id) ?? 0)
  const pool = creatives.filter((c) => (used.get(c.id) ?? 0) === fewest)
  const w = pool.map((c) => weights[creatives.indexOf(c)] ?? c.weight)
  return pool[weightedPick(w, Math.random())]
}

const nukeStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  bottom: 4,
  zIndex: 2_147_400_000,
  padding: '2px 8px',
  border: '1px solid rgba(128, 128, 128, 0.5)',
  borderRadius: 3,
  background: 'rgba(240, 240, 240, 0.9)',
  color: '#444',
  fontSize: 11,
  fontFamily: 'system-ui, sans-serif',
  cursor: 'pointer',
  pointerEvents: 'auto',
}

/**
 * Mount the layer.
 * @param props - see {@link AdLayerProps}.
 * @returns a portal carrying every live banner, or null before the first spawn.
 */
export function AdLayer(props: AdLayerProps) {
  const { creatives, popups, posters, spawn, hitboxPx, popupIntervalMs, posterIntervalMs, chime } = props
  const viewport = useViewport()
  const safe = useSafeArea(viewport)
  const [ads, setAds] = useState<readonly PlacedAd[]>([])
  // Reopen timestamps for slots the user has closed. One entry suppresses one
  // banner until it expires; see schedule.ts for why the target is expressed
  // this way rather than as a running dismissal count.
  const [cooling, setCooling] = useState<readonly number[]>([])
  const [takeover, setTakeover] = useState<PlacedAd | undefined>(undefined)
  const [popup, setPopup] = useState<PlacedAd | undefined>(undefined)
  const [poster, setPoster] = useState<PlacedAd | undefined>(undefined)
  // "关闭所有广告" is the one control here that tells the truth: it ends the
  // layer for this page load. Nothing re-arms it short of a reload, so a user
  // who is done with the joke is done with it.
  const [retired, setRetired] = useState(false)
  const mountedAt = useRef(Date.now())
  const spawnedTotal = useRef(0)
  const placements = useRef(0)
  const popupRound = useRef(0)
  const posterRound = useRef(0)
  const weights = useMemo(() => creatives.map((c) => c.weight), [creatives])

  useEffect(() => {
    if (creatives.length === 0 || retired) return
    const tick = () => {
      const now = Date.now()
      setCooling((current) => pruneCooling(now, current))
      const want = targetCount(now, spawn, cooling)
      setAds((current) => {
        if (current.length >= want) return current.length > want ? current.slice(0, want) : current
        const next = [...current]
        while (next.length < want) {
          const creative = pickCreative(creatives, weights, next)
          if (creative === undefined) break
          // Skyscrapers spawn as a matched pair of the *same* artwork, on the
          // same side. The layout puts two of them in one column-wide row, and
          // a pair of different skyscrapers would render at different heights
          // and leave a ragged gap — two copies of one banner is how a portal
          // fills that row anyway.
          const copies = creative.shape === 'tall' ? 2 : 1
          // Sides alternate per *placement*, not per banner: a skyscraper pair
          // is one placement occupying two slots, and counting its two copies
          // separately would skip a turn and pile placements onto one gutter.
          const { side } = resolvePlacement(placements.current)
          placements.current += 1
          for (let i = 0; i < copies && next.length < want; i += 1) {
            spawnedTotal.current += 1
            next.push({
              key: `${creative.id}-${spawnedTotal.current}`,
              creative,
              side,
              row: next.length,
              seed: Math.random(),
              bornAt: now,
            })
          }
        }
        return next
      })
    }
    tick()
    const timer = setInterval(tick, TICK_MS)
    return () => clearInterval(timer)
  }, [creatives, weights, spawn, cooling, retired, viewport, safe])

  // The corner pop-up runs on its own clock: it rotates through its pool in
  // order (each round is a different creative), and its cadence tightens as
  // the gutters fill, so a long session escalates on both axes at once.
  useEffect(() => {
    if (retired || popups.length === 0 || popupIntervalMs <= 0) return
    const pressure = 1 / (1 + ads.length * 0.12)
    const gap = Math.max(POPUP_LIFETIME_MS, popupIntervalMs * pressure)
    const timer = setTimeout(() => {
      const creative = popups[popupRound.current % popups.length]
      if (creative === undefined) return
      popupRound.current += 1
      setPopup({
        key: `popup-${popupRound.current}`,
        creative,
        side: 'right',
        row: 0,
        seed: Math.random(),
        bornAt: Date.now(),
      })
    }, gap)
    return () => clearTimeout(timer)
  }, [popups, popupIntervalMs, ads.length, popup, retired])

  // The bottom-left poster: opposite corner from the pop-up so the two never
  // fight for the same pixels, and a much rarer cadence — it is the largest
  // interruption the layer makes.
  useEffect(() => {
    if (retired || posters.length === 0 || posterIntervalMs <= 0) return
    const timer = setTimeout(() => {
      const creative = posters[posterRound.current % posters.length]
      if (creative === undefined) return
      posterRound.current += 1
      setPoster({
        key: `poster-${posterRound.current}`,
        creative,
        side: 'left',
        row: 0,
        seed: Math.random(),
        bornAt: Date.now(),
      })
    }, Math.max(POSTER_LIFETIME_MS, posterIntervalMs))
    return () => clearTimeout(timer)
  }, [posters, posterIntervalMs, poster, retired])

  const dismiss = useCallback((key: string) => {
    setAds((current) => current.filter((ad) => ad.key !== key))
    setCooling((current) => [...current, Date.now() + spawn.respawnDelayMs])
  }, [spawn.respawnDelayMs])

  // Retire the layer for this page load. Unlike every individual ✕, this one
  // is honest and final: no blackout timer, no doubling, nothing that brings
  // the banners back without an explicit reload.
  const nuke = useCallback(() => {
    setAds([])
    setTakeover(undefined)
    setPopup(undefined)
    setPoster(undefined)
    setRetired(true)
  }, [])

  // Laid out as a running total down each gutter, so banners that overflow the
  // composer band are simply not drawn; closing one slides the rest up and can
  // bring an overflowed banner back into view.
  const placed = layout(ads, viewport, safe)

  if (retired) return null
  if (ads.length === 0 && takeover === undefined && popup === undefined && poster === undefined) return null
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2_147_400_000, pointerEvents: 'none' }}>
      {placed.map(({ ad, box }) => (
        <AdBanner
          key={ad.key}
          ad={ad}
          box={box}
          hitboxPx={hitboxPx}
          onDismiss={() => dismiss(ad.key)}
          onMisfire={() => setTakeover(ad)}
        />
      ))}
      {popup !== undefined && (
        <ToastPopup
          key={popup.key}
          creative={popup.creative}
          seed={popup.seed}
          chime={chime}
          onClose={() => setPopup(undefined)}
          onMisfire={() => setTakeover(popup)}
        />
      )}
      {poster !== undefined && (
        <GamePoster
          key={poster.key}
          creative={poster.creative}
          seed={poster.seed}
          chime={chime}
          onClose={() => setPoster(undefined)}
          onMisfire={() => setTakeover(poster)}
        />
      )}
      <button type="button" style={nukeStyle} onClick={nuke}>关闭所有广告</button>
      {takeover !== undefined && (
        <Lightbox
          creative={takeover.creative}
          seed={takeover.seed}
          onClose={() => setTakeover(undefined)}
        />
      )}
    </div>,
    document.body,
  )
}
