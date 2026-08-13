/**
 * Discovering community plugins through GitHub's `dsh-plugin` topic.
 *
 * Repository ownership is deliberately irrelevant: a plugin remains visible
 * after a transfer between an organisation and a personal account. The host
 * tries its authenticated `gh` session first, then a token, then GitHub's
 * anonymous public API. A generated snapshot keeps the ad layer useful while
 * GitHub is unavailable or rate-limited.
 *
 * @module
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { RegistryPayload, SponsoredPlugin } from './protocol.ts'
import { CATALOG_SNAPSHOT } from './catalog-snapshot.ts'

const execFileAsync = promisify(execFile)

/** GitHub topic that opts a public repository into DSH plugin discovery. */
export const PLUGIN_TOPIC = 'dsh-plugin'

/** GitHub repository-search expression shared by every live discovery path. */
export const SEARCH_QUERY = `topic:${PLUGIN_TOPIC} is:public archived:false`

/** GitHub's maximum repository-search page size. */
const PAGE_SIZE = 100

/** GitHub repository search exposes at most its first 1,000 matches. */
const MAX_SEARCH_PAGES = 10

/** Bound stdout from a credentialed multi-page `gh api` search. */
const MAX_SEARCH_BYTES = 32 * 1024 * 1024

/** One repository returned by GitHub's search API. */
interface GitHubRepo {
  readonly full_name?: unknown
  readonly name?: unknown
  readonly html_url?: unknown
  readonly description?: unknown
  readonly pushed_at?: unknown
  readonly topics?: unknown
  readonly archived?: unknown
  readonly disabled?: unknown
  readonly fork?: unknown
}

/** One page returned by GitHub's repository-search API. */
interface GitHubSearchPage {
  readonly total_count?: unknown
  readonly items?: unknown
}

/**
 * Narrow one search record into a sponsor, or reject it.
 *
 * @param raw - one item from GitHub's repository-search response.
 * @returns the sponsor, or undefined when the repository is not eligible.
 */
function toSponsor(raw: unknown): SponsoredPlugin | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const repo = raw as GitHubRepo
  if (repo.archived === true || repo.disabled === true || repo.fork === true) return undefined
  const slug = typeof repo.full_name === 'string' ? repo.full_name : ''
  const name = typeof repo.name === 'string' ? repo.name : ''
  const url = typeof repo.html_url === 'string' ? repo.html_url : ''
  const topics = Array.isArray(repo.topics)
    ? repo.topics.filter((topic): topic is string => typeof topic === 'string')
    : []
  if (slug.split('/').length !== 2 || name === '' || url === '' || !topics.includes(PLUGIN_TOPIC)) return undefined
  return {
    slug,
    name,
    description: typeof repo.description === 'string' ? repo.description : '',
    url,
    pushedAt: typeof repo.pushed_at === 'string' ? repo.pushed_at : '',
    tags: topics.filter((topic) => topic !== PLUGIN_TOPIC),
  }
}

/**
 * Parse one GitHub search response or `gh api --slurp` page array.
 *
 * @param text - raw JSON from GitHub or `gh`.
 * @returns eligible public DSH plugins in search order.
 */
export function parseSearchResults(text: string): readonly SponsoredPlugin[] {
  const parsed: unknown = JSON.parse(text)
  const pages = Array.isArray(parsed) ? parsed : [parsed]
  const out: SponsoredPlugin[] = []
  const seen = new Set<string>()
  for (const page of pages) {
    if (typeof page !== 'object' || page === null) continue
    const items = (page as GitHubSearchPage).items
    if (!Array.isArray(items)) continue
    for (const item of items) {
      const sponsor = toSponsor(item)
      if (sponsor === undefined || seen.has(sponsor.slug.toLowerCase())) continue
      seen.add(sponsor.slug.toLowerCase())
      out.push(sponsor)
    }
  }
  return out
}

/**
 * Keep plugins pushed within the freshness window.
 *
 * The window is anchored to the newest push in the list rather than the wall
 * clock, so an older offline snapshot still yields its own latest fortnight.
 *
 * @param plugins - candidates.
 * @param freshDays - window width in days; zero or less keeps everything.
 * @param excludeSlug - plugin to drop, normally this ad layer itself.
 * @returns the eligible subset.
 */
export function selectFresh(
  plugins: readonly SponsoredPlugin[],
  freshDays: number,
  excludeSlug: string,
): readonly SponsoredPlugin[] {
  const excluded = excludeSlug.toLowerCase()
  const dated = plugins
    .filter((plugin) => plugin.slug.toLowerCase() !== excluded)
    .map((plugin) => ({ plugin, pushed: Date.parse(plugin.pushedAt) }))
    .filter((entry) => Number.isFinite(entry.pushed))
  if (freshDays <= 0) return dated.map((entry) => entry.plugin)
  let newest = -Infinity
  for (const entry of dated) newest = Math.max(newest, entry.pushed)
  const floor = newest - freshDays * 86_400_000
  return dated.filter((entry) => entry.pushed >= floor).map((entry) => entry.plugin)
}

/**
 * Search through the authenticated `gh` CLI.
 *
 * @returns all exposed result pages as a JSON array.
 * @throws when `gh` is absent, unauthenticated, or GitHub rejects the search.
 */
async function readViaGh(): Promise<string> {
  const { stdout } = await execFileAsync(
    'gh',
    [
      'api', '--paginate', '--slurp', '--method', 'GET', 'search/repositories',
      '-f', `q=${SEARCH_QUERY}`, '-f', 'sort=updated', '-f', 'order=desc', '-f', `per_page=${PAGE_SIZE}`,
    ],
    { maxBuffer: MAX_SEARCH_BYTES, timeout: 20_000 },
  )
  return stdout
}

/**
 * Search GitHub directly, with or without a token.
 *
 * @param token - optional GitHub token used only as an Authorization header.
 * @returns all exposed result pages as a JSON array.
 * @throws when GitHub rejects a page or returns invalid pagination metadata.
 */
async function readViaGitHub(token: string): Promise<string> {
  const pages: unknown[] = []
  for (let page = 1; page <= MAX_SEARCH_PAGES; page += 1) {
    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', SEARCH_QUERY)
    url.searchParams.set('sort', 'updated')
    url.searchParams.set('order', 'desc')
    url.searchParams.set('per_page', String(PAGE_SIZE))
    url.searchParams.set('page', String(page))
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'user-agent': 'dsh-ads',
      'x-github-api-version': '2022-11-28',
    }
    if (token !== '') headers.authorization = `Bearer ${token}`
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`GitHub responded ${response.status}`)
    const body: unknown = await response.json()
    pages.push(body)
    if (typeof body !== 'object' || body === null) throw new Error('GitHub returned a non-object search page')
    const searchPage = body as GitHubSearchPage
    if (!Array.isArray(searchPage.items)) throw new Error('GitHub returned no search items')
    const total = typeof searchPage.total_count === 'number' ? searchPage.total_count : searchPage.items.length
    if (page * PAGE_SIZE >= total || searchPage.items.length < PAGE_SIZE) break
  }
  return JSON.stringify(pages)
}

/**
 * Assemble the payload consumed by the browser half.
 *
 * Never throws: the generated snapshot is the final fallback.
 *
 * @param nowMs - current epoch time.
 * @param freshDays - freshness window in days.
 * @param excludeSlug - plugin to leave out of its own rotation.
 * @returns the sponsor list and its discovery source.
 */
export async function loadRegistry(
  nowMs: number,
  freshDays: number,
  excludeSlug: string,
): Promise<RegistryPayload> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? ''
  const attempts: readonly { source: RegistryPayload['source']; read: () => Promise<string> }[] = [
    { source: 'gh-cli', read: readViaGh },
    ...(token === '' ? [] : [{ source: 'github-token' as const, read: () => readViaGitHub(token) }]),
    { source: 'github-public', read: () => readViaGitHub('') },
  ]
  for (const attempt of attempts) {
    try {
      const plugins = parseSearchResults(await attempt.read())
      if (plugins.length === 0) continue
      return {
        generated: new Date(nowMs).toISOString(),
        source: attempt.source,
        freshDays,
        plugins: selectFresh(plugins, freshDays, excludeSlug),
      }
    } catch {
      // Swallow one failed discovery channel and continue to the next. Missing
      // credentials, API rate limits, and offline hosts must not break an ad.
      continue
    }
  }
  return {
    generated: new Date(nowMs).toISOString(),
    source: 'snapshot',
    freshDays,
    plugins: selectFresh(CATALOG_SNAPSHOT, freshDays, excludeSlug),
  }
}
