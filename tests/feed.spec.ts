// @vitest-environment jsdom

/**
 * The feed is where the fairness promise is actually kept: every plugin in the
 * hub gets shown before any gets shown twice, and no ad changes under a reader
 * who is scrolling. Those two pull against each other, so both are pinned here.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { feedAd, resetFeed, setFeedPlugins } from '../src/client/feed.ts'
import type { SponsoredPlugin } from '../src/protocol.ts'
import type { AdCreative } from '../src/client/types.ts'

/** Two shipped banners, standing in for the eight the plugin really carries. */
const BUILTINS: readonly AdCreative[] = [
  { id: 'builtin-a', width: 900, height: 120, shape: 'wide', weight: 1, alt: '甲', src: 'data:,' },
  { id: 'builtin-b', width: 900, height: 120, shape: 'wide', weight: 1, alt: '乙', src: 'data:,' },
  { id: 'builtin-tall', width: 300, height: 600, shape: 'tall', weight: 1, alt: '丙', src: 'data:,' },
]

/** A hub larger than one conversation could ever get through. */
const PLUGINS: readonly SponsoredPlugin[] = Array.from({ length: 30 }, (_, i) => ({
  slug: `dsh-external/plugin-${i}`,
  name: `plugin-${i}`,
  description: '插件简介',
  url: `https://github.com/dsh-external/plugin-${i}`,
  pushedAt: '2026-08-01T00:00:00Z',
  tags: [],
}))

beforeEach(() => {
  resetFeed()
  setFeedPlugins(PLUGINS)
})

/** Identify whatever a turn was given: a repository, or a shipped banner. */
function shown(key: string): string {
  const creative = feedAd(key, BUILTINS)
  return creative?.sponsor ?? creative?.id ?? 'none'
}

describe('feedAd', () => {
  it('gives a turn the same ad however often it re-renders', () => {
    const first = shown('session:4')
    expect(shown('session:4')).toBe(first)
    expect(shown('session:4')).toBe(first)
  })

  it('works through the whole topic before repeating anyone', () => {
    // Roughly half the turns go to community plugins, so the run has to be long enough
    // for its half to cover every plugin.
    const run = Array.from({ length: PLUGINS.length * 3 }, (_, i) => shown(`session:${i}`))
    const counts = new Map<string, number>()
    for (const id of run.filter((entry) => entry.startsWith('dsh-external/'))) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    expect(counts.size).toBe(PLUGINS.length)
    const tallies = [...counts.values()]
    expect(Math.max(...tallies) - Math.min(...tallies)).toBeLessThanOrEqual(1)
  })

  it('keeps the hand-drawn banners visible against a much larger hub', () => {
    // Roughly half the feed, not eight-in-a-hundred-and-seventy: pooling the
    // two tiers would bury the artwork under the auto-generated banners.
    const run = Array.from({ length: 40 }, (_, i) => shown(`s:${i}`))
    const house = run.filter((id) => id.startsWith('builtin-')).length
    expect(house).toBeGreaterThan(8)
    expect(run.filter((id) => id.startsWith('dsh-external/')).length).toBeGreaterThan(8)
  })

  it('falls back to the house banners when topic discovery is unreachable', () => {
    setFeedPlugins([])
    expect(shown('offline:2')).toMatch(/^builtin-/)
  })

  it('gives different turns different ads', () => {
    expect(shown('session:2')).not.toBe(shown('session:6'))
  })

  it('separates turns of different conversations that share a seq', () => {
    // Sequence numbers restart per conversation, so the key has to carry the
    // session or the second conversation would inherit the first one's ads.
    expect(shown('other-session:4')).not.toBe(shown('another-session:4'))
  })

  it('never puts a skyscraper in the reading column', () => {
    // The feed slot is a narrow column; a 2:5 banner scaled into it becomes a
    // wall that pushes the rest of the turn off screen.
    const run = Array.from({ length: 60 }, (_, i) => shown(`s:${i}`))
    expect(run).not.toContain('builtin-tall')
  })

  it('shows nothing at all when there is no inventory', () => {
    setFeedPlugins([])
    expect(feedAd('empty:2', [])).toBeUndefined()
  })
})
