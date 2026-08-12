// @vitest-environment jsdom

/**
 * The layer's two promises to the user, exercised against a real DOM:
 * "关闭所有广告" ends the layer for this page load, and the drawn ✕ is a decoy
 * that only closes the banner when its small offset patch is the click target.
 *
 * Everything else here is timing and taste; these two are the difference
 * between a joke and a trap.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AdLayer, englishGutterCandidates } from '../src/client/AdLayer.tsx'
import type { AdCreative, PlacedAd } from '../src/client/types.ts'
import type { SpawnConfig } from '../src/client/schedule.ts'
import { LEVELS } from '../src/client/VirusToast.tsx'
import { clearPersisted } from '../src/client/persist.ts'
import { resetRetired } from '../src/client/retire.ts'
import { AdsSection } from '../src/client/AdsSection.tsx'
import { GamePoster } from '../src/client/GamePoster.tsx'
import { DEFAULT_SETTINGS } from '../src/client/settings.ts'

/**
 * Two flat banners: short enough that jsdom's 1024×768 viewport fits the whole
 * population, so these tests exercise the population model rather than the
 * gutter's overflow behaviour (which `placement.spec.ts` owns).
 */
const CREATIVES: readonly AdCreative[] = [
  { id: 'a', width: 900, height: 120, shape: 'wide', weight: 1, alt: '广告甲', src: 'data:,' },
  { id: 'b', width: 900, height: 100, shape: 'wide', weight: 1, alt: '广告乙', src: 'data:,' },
]

/** A small screen with a short cooldown, so replacement is observable in a test. */
const FAST: SpawnConfig = { maxAds: 4, respawnDelayMs: 5_000 }

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  // Stored settings live in a module-level mirror that outlives a render, so
  // without this each test would inherit whatever the last one switched off.
  clearPersisted()
  resetRetired()
  vi.useFakeTimers()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Corner artwork, used only by the pop-up cadence test. */
const POPUPS: readonly AdCreative[] = [
  { id: 'p', width: 600, height: 400, shape: 'wide', weight: 1, alt: '广告弹窗', src: 'data:,' },
]

/** First-appearance and respawn delays for the corner cadence test. */
const POPUP_FIRST_MS = 10_000

/** The benchmark opens the corner's programme. */
const SPEED_FIRST_MS = 5_000

/** The security alert follows the benchmark into the same corner. */
const SCARE_DELAY_MS = 4_000
const RESPAWN_MS = 60_000

/**
 * Render the layer and let its first spawn tick run.
 * @param corners - mount the corner pop-up too; off by default so the gutter
 * tests are not perturbed by an extra timer.
 */
function mount(corners = false): void {
  act(() => {
    root.render(
      <AdLayer
        creatives={CREATIVES}
        popups={corners ? POPUPS : []}
        posters={[]}
        spawn={FAST}
        hitboxPx={7}
        popupFirstDelayMs={corners ? POPUP_FIRST_MS : 0}
        posterFirstDelayMs={0}
        respawnMs={RESPAWN_MS}
        speedFirstDelayMs={corners ? SPEED_FIRST_MS : 0}
        scareDelayMs={corners ? SCARE_DELAY_MS : 0}
        scareHref="https://github.com/example-owner/example-repo"
        chime={false}
      />,
    )
  })
  tick(3000)
}

/**
 * Advance the fake clock in slices, letting React flush between them.
 *
 * One long jump runs every timer that falls inside it *before* React has a
 * chance to process the state changes the earlier ones caused — so an effect
 * that should have cancelled a later timer never gets the chance, and the test
 * observes a sequence that cannot happen in real time.
 *
 * @param ms - total time to advance.
 * @param slice - granularity, in ms.
 */
function tick(ms: number, slice = 500): void {
  for (let done = 0; done < ms; done += slice) {
    const step = Math.min(slice, ms - done)
    act(() => { vi.advanceTimersByTime(step) })
  }
}

/** Seconds currently on the alert's countdown, if one is showing. */
function countdown(): number {
  return Number(/还剩\s*(\d+)\s*秒/.exec(document.body.textContent ?? '')?.[1] ?? 0)
}

/** The corner pop-up's image, if one is on screen. */
function popup(): HTMLImageElement | undefined {
  return [...document.querySelectorAll('img')].find((img) => img.alt === '广告弹窗')
}

/** Every banner image currently portalled onto the document. */
function banners(): HTMLImageElement[] {
  return [...document.querySelectorAll('img')].filter((img) => img.alt.startsWith('广告'))
}

/** The security alert's real (tiny) close target, if the alert is up. */
function closeScare(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')]
    .find((b) => b.getAttribute('aria-label') === '关闭安全提示')
}

/**
 * Type into the alert's GitHub-id field the way a user would.
 *
 * React tracks controlled inputs through its own value setter, so a plain
 * `input.value = x` is invisible to it; going through the prototype's native
 * setter before dispatching `input` is the standard way to make jsdom typing
 * register as a change event.
 *
 * @param value - the id to type.
 */
function typeGithubId(value: string): void {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="GitHub ID"]')
  expect(input).not.toBeNull()
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setValue?.call(input, value)
    input?.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Submit the alert's verify row and let the (mocked) stargazer fetch settle. */
async function submitVerify(): Promise<void> {
  const form = document.querySelector('input[aria-label="GitHub ID"]')?.closest('form')
  expect(form).not.toBeNull()
  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

/** The benchmark window's real (tiny) close target, if it is up. */
function closeSpeed(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')]
    .find((b) => b.getAttribute('aria-label') === '关闭跑分结果')
}

/**
 * Mount the host's settings page in its own React root and flip one switch.
 *
 * The switches live in the settings dialog, a different tree from the layer;
 * driving them from here is the only way to test what a user actually does,
 * and it exercises the storage broadcast that keeps the two trees agreeing.
 *
 * @param label - the switch's accessible name.
 */
function flipSwitch(label: string): void {
  const panel = document.createElement('div')
  document.body.append(panel)
  const settingsRoot = createRoot(panel)
  act(() => { settingsRoot.render(<AdsSection />) })
  act(() => {
    [...panel.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === label)?.click()
  })
  act(() => { settingsRoot.unmount() })
  panel.remove()
}

/**
 * Press the settings page's "close everything for now" button.
 *
 * It lives in the host's settings dialog, not over the transcript: nothing of
 * this plugin's own floats there any more.
 */
function pressNuke(): void {
  const panel = document.createElement('div')
  document.body.append(panel)
  const settingsRoot = createRoot(panel)
  act(() => { settingsRoot.render(<AdsSection />) })
  act(() => {
    [...panel.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('立刻关闭所有广告'))?.click()
  })
  act(() => { settingsRoot.unmount() })
  panel.remove()
}

describe('AdLayer', () => {
  it('reserves one full-width English skyscraper for each ad tier', () => {
    const sponsoredTall: AdCreative = { id: 'sponsor-tall', width: 300, height: 480, shape: 'tall', weight: 1, alt: 's', src: 'data:,', sponsor: 'dsh-external/example' }
    const builtinTall: AdCreative = { id: 'builtin-tall', width: 300, height: 480, shape: 'tall', weight: 1, alt: 'b', src: 'data:,' }
    const horizontal: AdCreative = { id: 'wide', width: 720, height: 148, shape: 'wide', weight: 1, alt: 'w', src: 'data:,' }
    const pool = [sponsoredTall, builtinTall, horizontal]
    const place = (creative: AdCreative, key: string): PlacedAd => ({ key, creative, side: 'left', row: 0, seed: 0, bornAt: 0 })

    expect(englishGutterCandidates(pool, [])).toEqual([sponsoredTall])
    expect(englishGutterCandidates(pool, [place(sponsoredTall, 's1')])).toEqual([builtinTall])
    expect(englishGutterCandidates(pool, [
      place(sponsoredTall, 's1'),
      place(builtinTall, 'b1'),
    ])).toEqual([horizontal])
  })

  it('opens at full strength instead of ramping up', () => {
    mount()
    expect(banners()).toHaveLength(FAST.maxAds)
  })

  it('retires for the rest of the page load when 关闭所有广告 is pressed', () => {
    mount()
    expect(banners().length).toBeGreaterThan(0)
    pressNuke()
    expect(banners()).toHaveLength(0)
    // The growth ticker must not resurrect anything: this control is the one
    // honest exit, so a later tick bringing banners back would be the bug.
    tick(600_000)
    expect(banners()).toHaveLength(0)
  })

  it('opens the takeover when the banner body is clicked instead of the real hitbox', () => {
    mount()
    const banner = banners()[0]
    expect(banner).toBeDefined()
    act(() => { banner?.parentElement?.click() })
    expect(document.body.textContent).toContain('秒后可跳过')
  })

  it('removes that banner without opening the takeover when the real hitbox is hit', () => {
    mount()
    const close = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '关闭广告')
    const banner = close?.closest('div')
    expect(banner).toBeDefined()
    act(() => { close?.click() })
    expect(banner?.isConnected).toBe(false)
    expect(document.body.textContent).not.toContain('秒后可跳过')
  })

  it('opens the security alert first and makes the pop-up wait for the corner', () => {
    mount(true)
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    expect(document.body.textContent).toContain(LEVELS[0]!.headline)
    // Two windows stacked in one corner reads as a rendering fault, so the
    // pop-up must not arrive on its own schedule while the alert is up.
    tick(POPUP_FIRST_MS * 3)
    expect(popup()).toBeUndefined()
    act(() => { closeScare()?.click() })
    tick(POPUP_FIRST_MS)
    expect(popup()).toBeDefined()
  })

  it('restarts the alert countdown instead of ever finishing it', () => {
    const first = LEVELS[0]!
    mount(true)
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    // Advance by what the alert actually has left, not by the level's full
    // limit: it has been counting since it opened, and overshooting would sail
    // past the failure notice into the next countdown.
    const started = countdown()
    expect(started).toBeGreaterThan(0)
    tick(started * 1000)
    expect(document.body.textContent).toContain('清除失败')
    // Back to the top: the countdown is the joke, so it must never resolve.
    tick(2500)
    expect(countdown()).toBeGreaterThan(first.seconds - 5)
  })

  it('escalates when the alert is declined, and stops offering the way out', () => {
    mount(true)
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    const decline = () => [...document.querySelectorAll('button')]
      .find((b) => b.textContent === '暂不处理')
    expect(decline()).toBeDefined()
    act(() => { decline()?.click() })
    // Still on screen, louder, and the polite option is gone — the only
    // remaining buttons are the repo link and the decoy ✕.
    expect(document.body.textContent).toContain(LEVELS[1]!.headline)
    expect(decline()).toBeUndefined()
    expect(document.body.textContent).toContain(`${LEVELS[1]!.seconds} 秒`)
  })

  it('verifies through the host login without any typed id when the host can answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ verdict: 'starred' }) })))
    mount(true)
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    await submitVerify()
    expect(document.body.textContent).toContain('修复成功')
  })

  it('flips the alert to the protection report once a star is verified', async () => {
    // A host without gh or a token answers unavailable, which is what pushes
    // the alert onto the anonymous stargazer walk this test exercises.
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) =>
      String(url).includes('star-check.json')
        ? { ok: true, json: async () => ({ verdict: 'unavailable' }) }
        : { ok: true, json: async () => [{ login: 'jesse' }] }))
    mount(true)
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    expect(document.body.textContent).toContain(LEVELS[0]!.headline)
    typeGithubId('jesse')
    await submitVerify()
    expect(document.body.textContent).toContain('修复成功')
    act(() => {
      [...document.querySelectorAll('button')].find((b) => b.textContent === '完成')?.click()
    })
    expect(document.body.textContent).not.toContain('修复成功')
    // The verdict must survive a "reload", and it converts rather than
    // removes: the corner slot now delivers the protection report, whose
    // every control honestly closes it, and the pop-up still queues behind it.
    act(() => root.unmount())
    root = createRoot(host)
    mount(true)
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    expect(document.body.textContent).not.toContain(LEVELS[0]!.headline)
    expect(document.body.textContent).toContain('已拦截 1 次高危攻击')
    act(() => {
      [...document.querySelectorAll('button')].find((b) => b.textContent === '知道了')?.click()
    })
    expect(document.body.textContent).not.toContain('已拦截 1 次高危攻击')
    tick(POPUP_FIRST_MS)
    expect(popup()).toBeDefined()
  })

  it('keeps the alert exactly as it was when verification misses', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) =>
      String(url).includes('star-check.json')
        ? { ok: true, json: async () => ({ verdict: 'unavailable' }) }
        : { ok: true, json: async () => [{ login: 'someone-else' }] }))
    mount(true)
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    typeGithubId('jesse')
    await submitVerify()
    // A miss adds a failure line and nothing else: same level, no escalation,
    // and the escape hatches all still there.
    expect(document.body.textContent).toContain('修复失败')
    expect(document.body.textContent).toContain(LEVELS[0]!.headline)
    expect(closeScare()).toBeDefined()
  })

  it('still lets the honest control end an escalated alert', () => {
    // The escalation drops the decline button, so 关闭所有广告 has to remain a
    // real exit or the joke turns into a trap.
    mount(true)
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    act(() => {
      [...document.querySelectorAll('button')].find((b) => b.textContent === '暂不处理')?.click()
    })
    pressNuke()
    expect(document.body.textContent).not.toContain(LEVELS[1]!.headline)
  })

  it('holds the corner pop-up on screen until it is closed, then brings it back', () => {
    mount(true)
    expect(popup()).toBeUndefined()
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    act(() => { closeScare()?.click() })
    tick(POPUP_FIRST_MS)
    expect(popup()).toBeDefined()
    // It must not retract on its own: an ad that leaves unprompted is a
    // notification, and the whole joke is that you have to hit the ✕.
    tick(5 * 60_000)
    expect(popup()).toBeDefined()
    const close = [...document.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === '关闭弹窗广告')
    act(() => { close?.click() })
    expect(popup()).toBeUndefined()
    tick(RESPAWN_MS / 2)
    expect(popup()).toBeUndefined()
    tick(RESPAWN_MS)
    expect(popup()).toBeDefined()
  })

  it('closes the corner pop-up when its own takeover is skipped, then brings it back', () => {
    mount(true)
    tick(SPEED_FIRST_MS + SCARE_DELAY_MS)
    act(() => { closeScare()?.click() })
    tick(POPUP_FIRST_MS)
    expect(popup()).toBeDefined()
    // A takeover launched from a gutter banner must not pay for the pop-up.
    act(() => { banners().find((img) => img !== popup())?.parentElement?.click() })
    tick(4000)
    const skip = () => [...document.querySelectorAll('button')].find((b) => b.textContent === '跳过广告')
    act(() => { skip()?.click() })
    expect(popup()).toBeDefined()
    // Misfiring on the pop-up itself and skipping the takeover is its honest
    // exit: the corner clears, and the ordinary respawn cadence still applies.
    act(() => { popup()?.parentElement?.click() })
    expect(document.body.textContent).toContain('秒后可跳过')
    tick(4000)
    act(() => { skip()?.click() })
    expect(popup()).toBeUndefined()
    tick(RESPAWN_MS / 2)
    expect(popup()).toBeUndefined()
    tick(RESPAWN_MS)
    expect(popup()).toBeDefined()
  })

  it('clears a placement the moment its switch goes off, and refills on the way back', () => {
    mount()
    expect(banners().length).toBeGreaterThan(0)
    flipSwitch('两侧广告栏')
    // Immediately, not whenever the next tick notices: a switch that takes
    // effect "eventually" reads as broken.
    expect(banners()).toHaveLength(0)
    tick(30_000)
    expect(banners()).toHaveLength(0)
    flipSwitch('两侧广告栏')
    tick(3000)
    expect(banners().length).toBeGreaterThan(0)
  })

  it('remembers which placements are switched off', () => {
    // The whole point of moving these into storage: a gutter switched off has
    // to stay off, including across the layer being torn down and remounted.
    mount()
    flipSwitch('两侧广告栏')
    expect(banners()).toHaveLength(0)
    act(() => root.unmount())
    root = createRoot(host)
    mount()
    expect(banners()).toHaveLength(0)
  })

  it('gets out of the way while a host dialog is open', async () => {
    mount()
    const layer = () => banners()[0]?.closest('div[style*="visibility"]') as HTMLElement | null
    expect(layer()?.style.visibility).toBe('visible')
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    // The observer reports on a microtask, so the assertion has to let one run.
    await act(async () => { document.body.append(dialog) })
    expect(layer()?.style.visibility).toBe('hidden')
    // And comes back, still holding its state rather than restarting.
    await act(async () => { dialog.remove() })
    expect(layer()?.style.visibility).toBe('visible')
  })

  it('puts nothing of its own over the transcript', () => {
    // Every control moved into the host's settings dialog or the poster's own
    // title bar. A floating strip of the plugin's chrome was the one thing on
    // screen that was neither an advertisement nor part of the app.
    mount()
    expect(document.body.textContent).not.toContain('关闭所有广告')
    expect(document.body.textContent).not.toContain('广告设置')
  })

  it('leaves the slot empty for the cooldown, then refills it', () => {
    mount()
    const before = banners().length
    const close = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '关闭广告')
    act(() => { close?.click() })
    // Still short-handed while the cooldown runs: dismissing must buy real,
    // observable quiet, or the ✕ feels like it did nothing at all.
    tick(FAST.respawnDelayMs / 2)
    expect(banners().length).toBe(before - 1)
    tick(FAST.respawnDelayMs)
    expect(banners().length).toBe(before)
  })
})

describe('GamePoster settings popover', () => {
  /** Artwork stub; the popover behaviour does not depend on the image. */
  const CREATIVE: AdCreative = {
    id: 'poster', width: 300, height: 480, shape: 'tall', weight: 1, alt: '海报', src: 'data:,',
  }

  /** Mount the poster with its menu closed. */
  function mountPoster(): void {
    act(() => {
      root.render(
        <GamePoster
          creative={CREATIVE}
          seed={0.4}
          chime={false}
          anchor={{ left: 12, bottom: 12 }}
          onMove={() => {}}
          collapsed={false}
          onToggleCollapse={() => {}}
          onClose={() => {}}
          onMisfire={() => {}}
          controls={{ settings: DEFAULT_SETTINGS, onChange: () => {}, onNuke: () => {} }}
        />,
      )
    })
  }

  /** The ⚙ that opens the menu. */
  function gear(): HTMLButtonElement | undefined {
    return [...document.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === '广告设置')
  }

  /** Whether the menu is on screen. */
  function menuOpen(): boolean {
    return document.body.textContent?.includes('显示哪些广告') === true
  }

  it('closes when the click lands anywhere else', () => {
    mountPoster()
    act(() => { gear()?.click() })
    expect(menuOpen()).toBe(true)
    // A popover whose only exit is the control that opened it is the same trap
    // as the decoy ✕, and the honest controls do not play that game.
    // A plain Event, not a PointerEvent: jsdom does not implement the latter,
    // and the handler only reads `target`.
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(menuOpen()).toBe(false)
  })

  it('stays open while the click is inside it', () => {
    mountPoster()
    act(() => { gear()?.click() })
    act(() => {
      gear()?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(menuOpen()).toBe(true)
  })

  it('closes on Escape', () => {
    mountPoster()
    act(() => { gear()?.click() })
    act(() => { dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(menuOpen()).toBe(false)
  })
})
