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
import { AdLayer } from '../src/client/AdLayer.tsx'
import type { AdCreative } from '../src/client/types.ts'
import type { SpawnConfig } from '../src/client/schedule.ts'
import { LEVELS } from '../src/client/VirusToast.tsx'

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
})

/** Corner artwork, used only by the pop-up cadence test. */
const POPUPS: readonly AdCreative[] = [
  { id: 'p', width: 600, height: 400, shape: 'wide', weight: 1, alt: '广告弹窗', src: 'data:,' },
]

/** First-appearance and respawn delays for the corner cadence test. */
const POPUP_FIRST_MS = 10_000

/** The security alert opens before the pop-up and holds the same corner. */
const SCARE_FIRST_MS = 5_000
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
        scareFirstDelayMs={corners ? SCARE_FIRST_MS : 0}
        scareHref="https://example.invalid/repo"
        chime={false}
      />,
    )
  })
  act(() => { vi.advanceTimersByTime(3000) })
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

/** The layer's own "关闭所有广告" control, if it is mounted. */
function nukeButton(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('关闭所有广告'))
}

describe('AdLayer', () => {
  it('opens at full strength instead of ramping up', () => {
    mount()
    expect(banners()).toHaveLength(FAST.maxAds)
  })

  it('retires for the rest of the page load when 关闭所有广告 is clicked', () => {
    mount()
    expect(banners().length).toBeGreaterThan(0)
    act(() => { nukeButton()?.click() })
    expect(banners()).toHaveLength(0)
    expect(nukeButton()).toBeUndefined()
    // The growth ticker must not resurrect anything: this control is the one
    // honest exit, so a later tick bringing banners back would be the bug.
    act(() => { vi.advanceTimersByTime(600_000) })
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
    act(() => { vi.advanceTimersByTime(SCARE_FIRST_MS) })
    expect(document.body.textContent).toContain(LEVELS[0]!.headline)
    // Two windows stacked in one corner reads as a rendering fault, so the
    // pop-up must not arrive on its own schedule while the alert is up.
    act(() => { vi.advanceTimersByTime(POPUP_FIRST_MS * 3) })
    expect(popup()).toBeUndefined()
    act(() => { closeScare()?.click() })
    act(() => { vi.advanceTimersByTime(POPUP_FIRST_MS) })
    expect(popup()).toBeDefined()
  })

  it('restarts the alert countdown instead of ever finishing it', () => {
    const first = LEVELS[0]!
    mount(true)
    act(() => { vi.advanceTimersByTime(SCARE_FIRST_MS) })
    expect(document.body.textContent).toContain(`${first.seconds} 秒`)
    act(() => { vi.advanceTimersByTime(first.seconds * 1000) })
    expect(document.body.textContent).toContain('清除失败')
    // Back to the top: the countdown is the joke, so it must never resolve.
    act(() => { vi.advanceTimersByTime(2000) })
    expect(document.body.textContent).toContain(`${first.seconds} 秒`)
  })

  it('escalates when the alert is declined, and stops offering the way out', () => {
    mount(true)
    act(() => { vi.advanceTimersByTime(SCARE_FIRST_MS) })
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

  it('still lets the honest control end an escalated alert', () => {
    // The escalation drops the decline button, so 关闭所有广告 has to remain a
    // real exit or the joke turns into a trap.
    mount(true)
    act(() => { vi.advanceTimersByTime(SCARE_FIRST_MS) })
    act(() => {
      [...document.querySelectorAll('button')].find((b) => b.textContent === '暂不处理')?.click()
    })
    act(() => { nukeButton()?.click() })
    expect(document.body.textContent).not.toContain(LEVELS[1]!.headline)
  })

  it('holds the corner pop-up on screen until it is closed, then brings it back', () => {
    mount(true)
    expect(popup()).toBeUndefined()
    act(() => { vi.advanceTimersByTime(SCARE_FIRST_MS) })
    act(() => { closeScare()?.click() })
    act(() => { vi.advanceTimersByTime(POPUP_FIRST_MS) })
    expect(popup()).toBeDefined()
    // It must not retract on its own: an ad that leaves unprompted is a
    // notification, and the whole joke is that you have to hit the ✕.
    act(() => { vi.advanceTimersByTime(5 * 60_000) })
    expect(popup()).toBeDefined()
    const close = [...document.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === '关闭弹窗广告')
    act(() => { close?.click() })
    expect(popup()).toBeUndefined()
    act(() => { vi.advanceTimersByTime(RESPAWN_MS / 2) })
    expect(popup()).toBeUndefined()
    act(() => { vi.advanceTimersByTime(RESPAWN_MS) })
    expect(popup()).toBeDefined()
  })

  it('drops every other ad in solo mode and puts them back on the way out', () => {
    mount()
    expect(banners().length).toBeGreaterThan(0)
    const solo = () => [...document.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('只留蓝鲸') || b.textContent?.includes('恢复全部广告'))
    act(() => { solo()?.click() })
    expect(banners()).toHaveLength(0)
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(banners()).toHaveLength(0)
    act(() => { solo()?.click() })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(banners().length).toBeGreaterThan(0)
  })

  it('keeps the controls reachable while the poster is off screen', () => {
    // The poster hosts the controls in its title bar; with no poster mounted,
    // the bottom bar has to stand in, or a user who closed it is stuck with
    // whatever mode they were in.
    mount()
    expect(nukeButton()).toBeDefined()
  })

  it('mutes and unmutes from the control bar', () => {
    mount()
    const mute = () => [...document.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('静音'))
    expect(mute()?.textContent).toContain('静音广告')
    act(() => { mute()?.click() })
    expect(mute()?.textContent).toContain('取消静音')
  })

  it('leaves the slot empty for the cooldown, then refills it', () => {
    mount()
    const before = banners().length
    const close = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '关闭广告')
    act(() => { close?.click() })
    // Still short-handed while the cooldown runs: dismissing must buy real,
    // observable quiet, or the ✕ feels like it did nothing at all.
    act(() => { vi.advanceTimersByTime(FAST.respawnDelayMs / 2) })
    expect(banners().length).toBe(before - 1)
    act(() => { vi.advanceTimersByTime(FAST.respawnDelayMs) })
    expect(banners().length).toBe(before)
  })
})
