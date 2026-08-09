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

/** Render the layer and let its first spawn tick run. */
function mount(): void {
  act(() => {
    root.render(
      <AdLayer
        creatives={CREATIVES}
        popups={[]}
        posters={[]}
        spawn={FAST}
        hitboxPx={7}
        popupIntervalMs={0}
        posterIntervalMs={0}
        chime={false}
      />,
    )
  })
  act(() => { vi.advanceTimersByTime(3000) })
}

/** Every banner image currently portalled onto the document. */
function banners(): HTMLImageElement[] {
  return [...document.querySelectorAll('img')].filter((img) => img.alt.startsWith('广告'))
}

/** The layer's own "关闭所有广告" control, if it is mounted. */
function nukeButton(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find((b) => b.textContent === '关闭所有广告')
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
