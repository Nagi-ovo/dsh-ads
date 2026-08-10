/**
 * The stargazer check's contract: it only ever says "starred" on a real hit or
 * an unenumerable list, and everything that goes wrong collapses to a verdict
 * the alert can render — never a thrown error in the middle of a joke window.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkHostStar, checkStarred, repoFromHref } from '../src/client/star-check.ts'

/** One stargazers page as the API returns it. */
function page(logins: readonly string[]): { ok: true; json: () => Promise<unknown> } {
  return { ok: true, json: async () => logins.map((login) => ({ login })) }
}

/** A full page of nobody-we-want, to drive pagination. */
const FULL = page(Array.from({ length: 100 }, (_, i) => `stranger-${i}`))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('repoFromHref', () => {
  it('extracts owner/repo from a repository URL', () => {
    expect(repoFromHref('https://github.com/dsh-external/dsh-ads')).toBe('dsh-external/dsh-ads')
  })

  it('rejects non-GitHub hosts, ownerless paths, and garbage', () => {
    expect(repoFromHref('https://gitlab.com/a/b')).toBeUndefined()
    expect(repoFromHref('https://github.com/dsh-external')).toBeUndefined()
    expect(repoFromHref('not a url')).toBeUndefined()
  })
})

describe('checkStarred', () => {
  it('finds the username on the first page, case-insensitively', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => page(['Someone', 'JesseZhang'])))
    await expect(checkStarred('o/r', '  jessezhang ')).resolves.toBe('starred')
  })

  it('pages forward until it finds a late stargazer', async () => {
    const fetch = vi.fn(async () => FULL)
    fetch.mockResolvedValueOnce(FULL).mockResolvedValueOnce(page(['late-star']))
    vi.stubGlobal('fetch', fetch)
    await expect(checkStarred('o/r', 'late-star')).resolves.toBe('starred')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reports absent when the full list ends without a hit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => page(['someone-else'])))
    await expect(checkStarred('o/r', 'me')).resolves.toBe('absent')
  })

  it('reports absent for a blank id without touching the network', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(checkStarred('o/r', '   ')).resolves.toBe('absent')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('gives up as overflow once the page budget is spent', async () => {
    const fetch = vi.fn(async () => FULL)
    vi.stubGlobal('fetch', fetch)
    await expect(checkStarred('o/r', 'me')).resolves.toBe('overflow')
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('reports missing on 404: a private or deleted repository can never answer anonymously', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })))
    await expect(checkStarred('o/r', 'me')).resolves.toBe('missing')
  })

  it('collapses HTTP failures, network failures, and non-array payloads to error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    await expect(checkStarred('o/r', 'me')).resolves.toBe('error')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(checkStarred('o/r', 'me')).resolves.toBe('error')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ message: 'rate limited' }) })))
    await expect(checkStarred('o/r', 'me')).resolves.toBe('error')
  })
})

describe('checkHostStar', () => {
  it('relays a definitive host verdict', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ verdict: 'starred' }) })))
    await expect(checkHostStar()).resolves.toBe('starred')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ verdict: 'absent' }) })))
    await expect(checkHostStar()).resolves.toBe('absent')
  })

  it('collapses a missing route, a dead network, and junk payloads to unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })))
    await expect(checkHostStar()).resolves.toBe('unavailable')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(checkHostStar()).resolves.toBe('unavailable')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ verdict: 'weird' }) })))
    await expect(checkHostStar()).resolves.toBe('unavailable')
  })
})
