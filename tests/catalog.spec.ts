/** Topic discovery and freshness filtering for community plugin ads. */

import { describe, expect, it } from 'vitest'
import { parseSearchResults, selectFresh } from '../src/catalog.ts'
import type { SponsoredPlugin } from '../src/protocol.ts'

/** Days between the oldest and newest fixture push. */
const SPAN_DAYS = 40

/** One plugin, `daysAgo` days behind the fixture's newest push. */
function plugin(name: string, daysAgo: number): SponsoredPlugin {
  const at = Date.UTC(2026, 0, 1 + SPAN_DAYS - daysAgo)
  return {
    slug: `owner/${name}`,
    name,
    description: '',
    url: `https://github.com/owner/${name}`,
    pushedAt: new Date(at).toISOString(),
    tags: [],
  }
}

/** One GitHub repository-search record. */
function searchRepo(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    full_name: `owner/${name}`,
    name,
    html_url: `https://github.com/owner/${name}`,
    description: `${name} blurb`,
    pushed_at: '2026-08-13T12:00:00Z',
    topics: ['dsh-plugin', 'visualization'],
    archived: false,
    disabled: false,
    fork: false,
    ...overrides,
  }
}

describe('parseSearchResults', () => {
  it('combines paginated gh output and keeps repository ownership', () => {
    const text = JSON.stringify([
      { items: [searchRepo('one')] },
      { items: [searchRepo('two', { full_name: 'another/two', html_url: 'https://github.com/another/two' })] },
    ])
    expect(parseSearchResults(text).map((repo) => repo.slug)).toEqual(['owner/one', 'another/two'])
    expect(parseSearchResults(text)[0]?.tags).toEqual(['visualization'])
  })

  it('drops forks, archived repositories, disabled repositories, and untagged records', () => {
    const text = JSON.stringify({
      items: [
        searchRepo('shown'),
        searchRepo('fork', { fork: true }),
        searchRepo('archived', { archived: true }),
        searchRepo('disabled', { disabled: true }),
        searchRepo('untagged', { topics: ['dsh'] }),
        { name: 'missing-fields', topics: ['dsh-plugin'] },
      ],
    })
    expect(parseSearchResults(text).map((repo) => repo.name)).toEqual(['shown'])
  })

  it('deduplicates case-insensitive repository identities across pages', () => {
    const text = JSON.stringify([
      { items: [searchRepo('one')] },
      { items: [searchRepo('one', { full_name: 'OWNER/ONE' })] },
    ])
    expect(parseSearchResults(text)).toHaveLength(1)
  })

  it('yields nothing for a document without result pages', () => {
    expect(parseSearchResults('{"total_count":0}')).toEqual([])
  })
})

describe('selectFresh', () => {
  const pool = [plugin('new', 0), plugin('recent', 10), plugin('old', 30)]

  it('keeps the window open relative to the newest push, not the clock', () => {
    expect(selectFresh(pool, 14, '').map((repo) => repo.name)).toEqual(['new', 'recent'])
  })

  it('keeps everything when the window is disabled', () => {
    expect(selectFresh(pool, 0, '')).toHaveLength(3)
  })

  it('leaves the ad layer out of its own rotation case-insensitively', () => {
    expect(selectFresh(pool, 0, 'OWNER/NEW').map((repo) => repo.name)).toEqual(['recent', 'old'])
  })

  it('drops entries with no usable push date', () => {
    expect(selectFresh([...pool, plugin('undated', 0)].map(
      (repo) => repo.name === 'undated' ? { ...repo, pushedAt: '' } : repo,
    ), 0, '').map((repo) => repo.name)).toEqual(['new', 'recent', 'old'])
  })
})
