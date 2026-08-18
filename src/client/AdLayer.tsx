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
import { ToastPopup } from './ToastPopup.tsx'
import { VirusToast } from './VirusToast.tsx'
import { ShieldToast } from './ShieldToast.tsx'
import { SpeedToast } from './SpeedToast.tsx'
import { readSpeed, type SpeedReading } from './speed-score.ts'
import { GamePoster, POSTER_WIDTH } from './GamePoster.tsx'
import type { AdControlsProps } from './AdControls.tsx'
import { retireAds, useRetired } from './retire.ts'
import { isSolo, useAdSettings } from './settings.ts'
import { usePersisted, type Anchor } from './persist.ts'
import { repoFromHref } from './star-check.ts'
import { FALLBACK_SAFE_AREA, layout, looksLikeSidebar, pickComposer, resolvePlacement, type SafeArea, type Viewport } from './placement.ts'
import { pruneCooling, targetCount, weightedPick, type SpawnConfig } from './schedule.ts'
import type { AdCreative, AdLocale, PlacedAd } from './types.ts'

/** How often the layer re-checks its population target, in ms. */
const TICK_MS = 2000

/** Gap between attempts to read the navigation timing, in ms. */
const SPEED_RETRY_MS = 250

/** How many attempts before giving up on a browser that reports no timing. */
const SPEED_ATTEMPTS = 20

/** Props for the ad layer. */
export interface AdLayerProps {
  /** Language used by the host UI and creative pool. */
  readonly locale?: AdLocale
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
  /** Delay before the corner pop-up first appears, in ms; zero disables it. */
  readonly popupFirstDelayMs: number
  /** Delay before the bottom-left poster first appears, in ms; zero disables it. */
  readonly posterFirstDelayMs: number
  /** Delay between automatic bottom-left poster changes, in ms; zero disables rotation. */
  readonly posterRotateMs: number
  /**
   * Delay before a closed pop-up or poster comes back, in ms. Neither retracts
   * on its own, so this is the only thing that paces them after the first one.
   */
  readonly respawnMs: number
  /** Whether a pop-up or poster chimes on arrival. */
  readonly chime: boolean
  /**
   * Delay after the benchmark window leaves before the fake security alert
   * arrives, in ms; zero disables the alert.
   */
  readonly scareDelayMs: number
  /**
   * Where the alert's "立即修复" sends the user. When it points at a GitHub
   * repository, the alert also offers star verification against it
   * ({@link repoFromHref}); anywhere else just hides the verify row.
   */
  readonly scareHref: string
  /**
   * Delay before the benchmark result appears, in ms; zero disables it.
   * Shorter than every other opening delay on purpose — it opens the corner's
   * programme, and a benchmark that turned up third would have missed its
   * moment.
   */
  readonly speedFirstDelayMs: number
}

/** How deep to descend from `<body>` when looking for the sidebar. */
const SIDEBAR_SCAN_DEPTH = 5

/**
 * How deep to descend when looking for the header.
 *
 * Deeper than the sidebar scan because it has to be: the shell renders its
 * `<header>` eight levels below `<body>`, so the sidebar's depth of 5 never
 * reached it and every header measurement silently returned zero. That put
 * `safe.top` back on its 56px fallback and let both gutters start above the
 * view tabs, covering them.
 */
const HEADER_SCAN_DEPTH = 12

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
 * {@link looksLikeSidebar} owns what counts as one; this walk only bounds the
 * search, so a deep render tree cannot turn it into a full-document scan on
 * every tick.
 *
 * @param viewportHeight - current viewport height, in CSS pixels.
 * @returns the sidebar's right edge, or 0 when it is collapsed or absent.
 */
function measureSidebar(viewportHeight: number): number {
  let right = 0
  const visit = (node: Element, depth: number) => {
    if (depth > SIDEBAR_SCAN_DEPTH) return
    const rect = node.getBoundingClientRect()
    if (looksLikeSidebar(rect, viewportHeight)) right = Math.max(right, rect.right)
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
  const consider = (rect: DOMRect) => {
    const wide = rect.width > viewport.width * 0.3
    const shallow = rect.height > 0 && rect.height < 90 && rect.bottom < HEADER_BAND
    if (wide && shallow && rect.left <= columnLeft) bottom = Math.max(bottom, rect.bottom)
  }
  // Semantics first. The shell's class names are per-build hashes, but it does
  // render a real `<header>` and a real `role="tablist"`, and the tab strip is
  // exactly the thing a banner must not cover — it is the only control up
  // there. Geometry alone missed both, and missing them is not a near-miss:
  // it silently yields zero, which reads as "no header" rather than as a
  // failed measurement.
  for (const node of document.querySelectorAll('header, [role="tablist"]')) consider(node.getBoundingClientRect())
  const visit = (node: Element, depth: number) => {
    if (depth > HEADER_SCAN_DEPTH) return
    consider(node.getBoundingClientRect())
    for (const child of node.children) visit(child, depth + 1)
  }
  for (const child of document.body.children) visit(child, 1)
  return bottom
}

/**
 * Track whether a host modal is open.
 *
 * `[role="dialog"][aria-modal="true"]` is the one semantic landmark the shell
 * offers — its class names are per-build hashes — and it is the right signal
 * anyway: a modal is a claim on the user's whole attention, and an ad layer
 * that keeps painting over one has stopped being a joke about ads and started
 * being a broken window manager.
 *
 * Watched rather than polled, so the layer clears the moment the dialog opens
 * instead of on the next two-second tick.
 *
 * @returns true while a modal dialog is on screen.
 */
function useModalOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const check = () => setOpen(document.querySelector('[role="dialog"][aria-modal="true"]') !== null)
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true, attributeFilter: ['role', 'aria-modal'] })
    return () => observer.disconnect()
  }, [])
  return open
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
      const left = measureSidebar(viewport.height)
      // The composer is both the bottom exclusion and the width reference for
      // the conversation column: it is centred on the column and always
      // present, which no transcript element is.
      //
      // Picking it needs care. The shell has other text inputs — the sidebar's
      // session search above all — and taking the topmost match found that one
      // instead, which collapsed the column onto the sidebar and let the
      // gutters draw straight over the transcript. The composer is the input
      // sitting lowest on screen, and it is never inside the sidebar.
      const inputs = document.querySelectorAll('textarea, [contenteditable="true"]')
      const composer = pickComposer([...inputs].map((node) => node.getBoundingClientRect()), left)
      const bottom = composer === undefined
        ? FALLBACK_SAFE_AREA.bottom
        : Math.max(FALLBACK_SAFE_AREA.top, viewport.height - composer.top + 12)
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
  locale: AdLocale,
): AdCreative | undefined {
  const candidates = locale === 'en' ? englishGutterCandidates(creatives, placed) : creatives
  const used = new Map<string, number>()
  for (const ad of placed) used.set(ad.creative.id, (used.get(ad.creative.id) ?? 0) + 1)
  let fewest = Infinity
  for (const c of candidates) fewest = Math.min(fewest, used.get(c.id) ?? 0)
  const pool = candidates.filter((c) => (used.get(c.id) ?? 0) === fewest)
  const w = pool.map((c) => weights[creatives.indexOf(c)] ?? c.weight)
  return pool[weightedPick(w, Math.random())]
}

/**
 * Keep both English skyscraper treatments above the fold, then spend the
 * remaining population on shorter banners that still fit below them.
 *
 * The selected community plugins remain random per conversation. This only
 * controls shape and tier: the generated sponsored skyscraper occupies the
 * first gutter, a built-in skyscraper occupies the other, and horizontal
 * inventory fills the remaining slots.
 *
 * @param creatives - localized built-ins plus selected community plugins.
 * @param placed - banners already spawned in this population.
 * @returns the candidates allowed for the next draw.
 */
export function englishGutterCandidates(
  creatives: readonly AdCreative[],
  placed: readonly PlacedAd[],
): readonly AdCreative[] {
  if (placed.length === 0) {
    const sponsoredTall = creatives.filter((creative) => creative.shape === 'tall' && creative.sponsor !== undefined)
    if (sponsoredTall.length > 0) return sponsoredTall
  }
  if (placed.length === 1) {
    const builtinTall = creatives.filter((creative) => creative.shape === 'tall' && creative.sponsor === undefined)
    if (builtinTall.length > 0) return builtinTall
  }
  if (placed.length >= 2) {
    const horizontal = creatives.filter((creative) => creative.shape !== 'tall')
    if (horizontal.length > 0) return horizontal
  }
  return creatives
}


/**
 * Mount the layer.
 * @param props - see {@link AdLayerProps}.
 * @returns a portal carrying every live banner, or null before the first spawn.
 */
export function AdLayer(props: AdLayerProps) {
  const { creatives, popups, posters, spawn, hitboxPx, chime } = props
  const locale = props.locale ?? 'zh'
  const {
    popupFirstDelayMs, posterFirstDelayMs, posterRotateMs, respawnMs,
    scareDelayMs, scareHref, speedFirstDelayMs,
  } = props
  const viewport = useViewport()
  const safe = useSafeArea(viewport)
  const modalOpen = useModalOpen()
  const [ads, setAds] = useState<readonly PlacedAd[]>([])
  // Reopen timestamps for slots the user has closed. One entry suppresses one
  // banner until it expires; see schedule.ts for why the target is expressed
  // this way rather than as a running dismissal count.
  const [cooling, setCooling] = useState<readonly number[]>([])
  const [takeover, setTakeover] = useState<PlacedAd | undefined>(undefined)
  const [popup, setPopup] = useState<PlacedAd | undefined>(undefined)
  // The fake security alert holds the bottom-right corner before the pop-up
  // does. Which face it wears — threat or protection report — is latched when
  // it fires, not read live: a verification succeeding mid-display must let
  // the 修复成功 panel finish its moment instead of yanking it away.
  const [scare, setScare] = useState<{ seed: number; shield: boolean } | undefined>(undefined)
  // The benchmark result, once measured. Same corner, strictly after the alert.
  const [speed, setSpeed] = useState<{ reading: SpeedReading; seed: number } | undefined>(undefined)
  const [poster, setPoster] = useState<PlacedAd | undefined>(undefined)
  // "关闭所有广告" lives in its own module because the button that presses it
  // sits in the host's settings dialog, a different React tree. See retire.ts
  // for why it is page-load state rather than a stored setting.
  const retired = useRetired()
  // Which placements are switched on, and whether they chime. Stored, shared
  // with the host's own settings page, and the reason the layer can be pared
  // down to "just the whale and the benchmark" and stay that way.
  const [settings, setSettings] = useAdSettings()
  const muted = settings.muted
  const solo = isSolo(settings)
  const [collapsed, setCollapsed] = usePersisted('poster-collapsed', false)
  const [anchor, setAnchor] = usePersisted<Anchor | null>('poster-anchor', null)
  // The security alert's star status. Persistent, unlike dismissals: the user
  // did the one thing the alert asked for, and a cure that wears off on
  // refresh would make the verify row a lie. Verification does not stop the
  // corner slot — it flips it to the protection report, which arrives on the
  // same schedule and gloats instead of threatening. The id is kept too, so
  // the next attempt (this browser, any day) starts prefilled.
  const [starVerified, setStarVerified] = usePersisted('star-verified', false)
  const [githubId, setGithubId] = usePersisted('github-id', '')
  // Mirrored into a ref so the scare timer can read the value current at fire
  // time without re-arming whenever verification flips it.
  const starVerifiedRef = useRef(starVerified)
  useEffect(() => { starVerifiedRef.current = starVerified }, [starVerified])
  const mountedAt = useRef(Date.now())
  const spawnedTotal = useRef(0)
  const placements = useRef(0)
  const popupRound = useRef(0)
  const scareRound = useRef(0)
  const speedRound = useRef(0)
  const posterRound = useRef(0)
  const weights = useMemo(() => creatives.map((c) => c.weight), [creatives])

  // A language switch replaces same-sized creative pools, so pool length is
  // not a useful change signal. Clear live placements once and let each
  // scheduler repopulate them with the new language.
  useEffect(() => {
    placements.current = 0
    setAds([])
    setPopup(undefined)
    setPoster(undefined)
    setTakeover(undefined)
  }, [locale])

  // The dynamic tier arrives after a fetch, by which time the first tick has
  // already filled every slot from the built-ins alone — and a full layer
  // never spawns again, so community plugins would never reach the gutters at
  // all. Growing the pool therefore clears the board once and lets it refill
  // from everything. Compared against the previous size rather than array
  // identity so a re-render cannot turn this into a spawn loop.
  const poolSize = useRef(creatives.length)
  useEffect(() => {
    if (creatives.length === poolSize.current) return
    poolSize.current = creatives.length
    placements.current = 0
    setAds([])
  }, [creatives.length])

  useEffect(() => {
    if (creatives.length === 0 || retired || !settings.gutter) return
    const tick = () => {
      const now = Date.now()
      setCooling((current) => pruneCooling(now, current))
      const want = targetCount(now, spawn, cooling)
      setAds((current) => {
        if (current.length >= want) return current.length > want ? current.slice(0, want) : current
        const next = [...current]
        while (next.length < want) {
          const creative = pickCreative(creatives, weights, next, locale)
          if (creative === undefined) break
          const { side } = resolvePlacement(placements.current)
          placements.current += 1
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
        return next
      })
    }
    tick()
    const timer = setInterval(tick, TICK_MS)
    return () => clearInterval(timer)
  }, [creatives, weights, spawn, cooling, retired, settings.gutter, viewport, safe])

  // The bottom-right corner runs a fixed programme: benchmark, then virus
  // alert, then the ordinary pop-up rotation. Each of the first two fires once
  // and waits for the one before it to be dismissed — a suite that congratulates
  // you on your hardware and only then discovers an infection is funnier in
  // that order, and looping either would starve everything behind it.
  useEffect(() => {
    if (retired || !settings.speed || speedFirstDelayMs <= 0 || speedRound.current > 0) return
    let attempts = 0
    /** Show the benchmark, or report that the timing is not readable yet. */
    const attempt = (): boolean => {
      const reading = readSpeed()
      if (reading === undefined) {
        attempts += 1
        return attempts < SPEED_ATTEMPTS
      }
      speedRound.current += 1
      setSpeed({ reading, seed: Math.random() })
      return false
    }
    // A startup benchmark has to arrive at startup, which puts it in a race
    // with the very thing it measures: `loadEventEnd` is still zero until the
    // load event fires, and a single early read would come back empty and
    // silently retire the window for the whole session. So it retries.
    let poll: ReturnType<typeof setInterval> | undefined
    const start = setTimeout(() => {
      if (!attempt()) return
      poll = setInterval(() => { if (!attempt()) clearInterval(poll) }, SPEED_RETRY_MS)
    }, speedFirstDelayMs)
    return () => {
      clearTimeout(start)
      clearInterval(poll)
    }
  }, [speedFirstDelayMs, retired, settings.speed])

  useEffect(() => {
    if (retired || !settings.scare || scareDelayMs <= 0 || scareRound.current > 0) return
    // Waits for the benchmark to have both happened and gone. A machine whose
    // timing API said nothing never runs the benchmark at all, so the alert
    // must not be held hostage to it.
    if (speed !== undefined) return
    if (speedRound.current === 0 && speedFirstDelayMs > 0 && readSpeed() !== undefined) return
    const timer = setTimeout(() => {
      scareRound.current += 1
      setScare({ seed: Math.random(), shield: starVerifiedRef.current })
    }, scareDelayMs)
    return () => clearTimeout(timer)
  }, [scareDelayMs, speedFirstDelayMs, speed, retired, settings.scare])

  // The pop-up waits its turn: all three live in the bottom-right corner, and
  // two windows stacked there would just look like a rendering fault.
  useEffect(() => {
    if (retired || !settings.popup || popups.length === 0 || popupFirstDelayMs <= 0 || popup !== undefined) return
    if (scare !== undefined || speed !== undefined) return
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
    }, popupRound.current === 0 ? popupFirstDelayMs : respawnMs)
    return () => clearTimeout(timer)
  }, [popups, popupFirstDelayMs, respawnMs, popup, retired, settings.popup, scare, speed])

  // The bottom-left poster: opposite corner from the pop-up so the two never
  // fight for the same pixels.
  useEffect(() => {
    if (retired || !settings.poster || posters.length === 0 || posterFirstDelayMs <= 0 || poster !== undefined) return
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
    }, posterRound.current === 0 ? posterFirstDelayMs : respawnMs)
    return () => clearTimeout(timer)
  }, [posters, posterFirstDelayMs, respawnMs, poster, retired, settings.poster])

  // Keep the fake-game slot moving even when nobody manages to hit its tiny
  // close target. A one-item localized pool stays still; changing the locale
  // still replaces the current creative immediately through the effect above.
  useEffect(() => {
    if (
      retired || !settings.poster || posters.length < 2
      || posterRotateMs <= 0 || poster === undefined
    ) return
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
    }, posterRotateMs)
    return () => clearTimeout(timer)
  }, [posters, posterRotateMs, poster, retired, settings.poster])

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
    setScare(undefined)
    setSpeed(undefined)
    retireAds()
  }, [])

  // Laid out as a running total down each gutter, so banners that overflow the
  // composer band are simply not drawn; closing one slides the rest up and can
  // bring an overflowed banner back into view.
  const placed = settings.gutter ? layout(ads, viewport, safe) : []
  /** Where the poster starts before anyone drags it: the bottom-left corner. */
  const defaultAnchor: Anchor = { left: 12, bottom: 12 }

  const controls: AdControlsProps = {
    locale,
    settings,
    onChange: (next) => {
      // Anything switched off leaves immediately rather than lingering until
      // its own timer notices: a switch that takes effect "eventually" reads
      // as broken. Switching one back on lets the next tick bring it in.
      if (!next.gutter) setAds([])
      if (!next.popup) setPopup(undefined)
      if (!next.scare) setScare(undefined)
      if (!next.speed) setSpeed(undefined)
      if (!next.poster) setPoster(undefined)
      setSettings(next)
    },
    onNuke: nuke,
  }

  if (retired) return null
  // Nothing on screen means nothing to portal. Every control now lives in the
  // host's settings dialog or in the poster's own title bar, so an empty layer
  // strands no one.
  const empty = ads.length === 0 && takeover === undefined && popup === undefined
    && poster === undefined && scare === undefined && speed === undefined
  if (empty) return null
  return createPortal(
    <div
      // Any DOM scrubber that skips subtrees under this attribute skips ours too.
      data-dsh-anti-ads
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2_147_400_000,
        pointerEvents: 'none',
        // Hidden rather than unmounted while a dialog is up: tearing the layer
        // down would reset every countdown and replay every entrance animation
        // the moment the dialog closed.
        visibility: modalOpen ? 'hidden' : 'visible',
      }}
    >
      {placed.map(({ ad, box }) => (
        <AdBanner
          locale={locale}
          key={ad.key}
          ad={ad}
          box={box}
          hitboxPx={hitboxPx}
          onDismiss={() => dismiss(ad.key)}
          onMisfire={() => setTakeover(ad)}
        />
      ))}
      {scare !== undefined && (scare.shield
        ? (
          <ShieldToast
            locale={locale}
            key={`shield-${scareRound.current}`}
            chime={chime && !muted}
            onClose={() => setScare(undefined)}
          />
        )
        : (
          <VirusToast
            locale={locale}
            key={`scare-${scareRound.current}`}
            seed={scare.seed}
            chime={chime && !muted}
            href={scareHref}
            repo={repoFromHref(scareHref)}
            username={githubId}
            onVerdict={(username, starred) => {
              // The id is worth keeping even on a miss — star later, press
              // 重新检测, and it is already filled in. Protection only ever
              // turns on here; the way back is clearing site data.
              setGithubId(username)
              if (starred) setStarVerified(true)
            }}
            onClose={() => setScare(undefined)}
          />
        ))}
      {speed !== undefined && (
        <SpeedToast
          locale={locale}
          reading={speed.reading}
          seed={speed.seed}
          chime={chime && !muted}
          href={scareHref}
          onClose={() => setSpeed(undefined)}
        />
      )}
      {popup !== undefined && (
        <ToastPopup
          locale={locale}
          key={popup.key}
          creative={popup.creative}
          seed={popup.seed}
          chime={chime && !muted}
          onClose={() => setPopup(undefined)}
          onMisfire={() => setTakeover(popup)}
        />
      )}
      {poster !== undefined && (
        <GamePoster
          locale={locale}
          key={poster.key}
          creative={poster.creative}
          seed={poster.seed}
          chime={chime && !muted}
          anchor={anchor ?? defaultAnchor}
          onMove={setAnchor}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onClose={() => setPoster(undefined)}
          onMisfire={() => setTakeover(poster)}
          controls={controls}
          leftFloor={safe.left}
        />
      )}
      {takeover !== undefined && (
        <Lightbox
          locale={locale}
          creative={takeover.creative}
          seed={takeover.seed}
          onClose={() => {
            // Sitting through the takeover pays for the corner pop-up that
            // launched it: its real ✕ is the smallest in the plugin, so the
            // takeover's skip button doubles as the pop-up's honest exit.
            // Ordinary respawn pacing still applies — this is a temporary
            // close, not a retirement.
            if (takeover.key === popup?.key) setPopup(undefined)
            setTakeover(undefined)
          }}
        />
      )}
    </div>,
    document.body,
  )
}
