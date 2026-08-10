/**
 * Reading the hub, and the one decision that could quietly break the tier:
 * the freshness window is anchored to the catalog's own newest push, not to
 * the clock. Get that wrong and the baked snapshot returns nothing forever.
 */

import { describe, expect, it } from 'vitest'
import { parseCatalog, selectFresh } from '../src/catalog.ts'
import type { SponsoredPlugin } from '../src/protocol.ts'

/** Days between the oldest and newest fixture push. */
const SPAN_DAYS = 40

/** One plugin, `daysAgo` days behind the fixture's newest push. */
function plugin(name: string, daysAgo: number): SponsoredPlugin {
  const at = Date.UTC(2026, 0, 1 + SPAN_DAYS - daysAgo)
  return {
    slug: `dsh-external/${name}`,
    name,
    description: '',
    url: `https://github.com/dsh-external/${name}`,
    pushedAt: new Date(at).toISOString(),
    tags: [],
  }
}

describe('parseCatalog', () => {
  it('prefers the hub note over the repository description', () => {
    const text = JSON.stringify({
      repos: [{ name: 'a', url: 'u', description: 'repo blurb', note: 'hub blurb', pushedAt: '', tags: [] }],
    })
    expect(parseCatalog(text, 'dsh-external')[0]?.description).toBe('hub blurb')
  })

  it('drops entries the hub already marks as unshowable', () => {
    const text = JSON.stringify({
      repos: [
        { name: 'shown', url: 'u' },
        { name: 'hidden', url: 'u', hide: true },
        { name: 'blank', url: 'u', empty: true },
        { name: 'nameless', url: '' },
        'not an object',
      ],
    })
    expect(parseCatalog(text, 'dsh-external').map((p) => p.name)).toEqual(['shown'])
  })

  it('yields nothing for a document without a repos array', () => {
    expect(parseCatalog('{"stats":{}}', 'dsh-external')).toEqual([])
  })
})

describe('selectFresh', () => {
  const pool = [plugin('new', 0), plugin('recent', 10), plugin('old', 30)]

  it('keeps the window open relative to the newest push, not the clock', () => {
    // The fixture is dated 2026 and will keep ageing; anchoring on wall-clock
    // time would make this return nothing, which is exactly the bug that would
    // make the offline snapshot useless.
    expect(selectFresh(pool, 14, '').map((p) => p.name)).toEqual(['new', 'recent'])
  })

  it('keeps everything when the window is disabled', () => {
    expect(selectFresh(pool, 0, '')).toHaveLength(3)
  })

  it('leaves the ad layer out of its own rotation', () => {
    expect(selectFresh(pool, 0, 'dsh-external/new').map((p) => p.name)).toEqual(['recent', 'old'])
  })

  it('drops entries with no usable push date', () => {
    expect(selectFresh([...pool, plugin('undated', 0)].map(
      (p) => p.name === 'undated' ? { ...p, pushedAt: '' } : p,
    ), 0, '').map((p) => p.name)).toEqual(['new', 'recent', 'old'])
  })
})
