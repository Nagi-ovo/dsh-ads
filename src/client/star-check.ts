/**
 * The "did you star us" check behind the security alert's 验证修复 row.
 *
 * Anonymous on purpose: `api.github.com` allows CORS from anywhere and serves
 * the public stargazer list without credentials, so verification needs neither
 * `gh` nor a token — only the GitHub id the user types in. It is therefore an
 * honour system with a receipt: anyone can type an id that already starred,
 * and that is fine for a joke plugin. The only request this module ever makes
 * is the one the user explicitly asks for by pressing the verify button.
 */

import { STAR_ROUTE, type StarCheckPayload } from '../protocol.ts'

/** GitHub REST API origin. */
const API_BASE = 'https://api.github.com'

/** Stargazers fetched per page — the API's documented maximum. */
const PER_PAGE = 100

/**
 * Pages enumerated before the check gives up. Beyond this the repository has
 * too many stars to page through anonymously, and the verdict degrades to
 * `overflow` — the caller treats that as verified, because a list too long to
 * search must not punish the people it can no longer prove.
 */
const MAX_PAGES = 4

/**
 * Outcome of one anonymous verification attempt. `missing` is the API's 404 —
 * the repository is private or gone, so no amount of anonymous paging can
 * ever answer; it gets its own verdict so the alert can say "channel not open
 * yet" instead of pretending the network hiccuped.
 */
export type StarVerdict = 'starred' | 'absent' | 'overflow' | 'missing' | 'error'

/**
 * Extract `owner/repo` from a GitHub repository URL.
 *
 * The alert's call-to-action link is the single source of where "go star us"
 * points, so the verification target is derived from it rather than configured
 * twice and allowed to drift.
 *
 * @param href - the alert's 立即修复 destination.
 * @returns the `owner/repo` slug, or undefined when the URL is not a GitHub
 * repository page — which hides the verify row rather than checking the wrong
 * thing.
 */
export function repoFromHref(href: string): string | undefined {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    // Swallowed: an unparseable href names no repository, and `undefined`
    // already expresses "nothing to verify against".
    return undefined
  }
  if (url.hostname !== 'github.com') return undefined
  const [owner, repo] = url.pathname.split('/').filter((part) => part !== '')
  return owner !== undefined && repo !== undefined ? `${owner}/${repo}` : undefined
}

/**
 * Ask the host whether its own logged-in GitHub user starred the plugin.
 *
 * This is the preferred channel: it needs no typed username, and it works
 * while the repository is still private. The host answers through `gh` or an
 * environment token ([star-host.ts](../star-host.ts)); a host without the
 * node half, or without credentials, comes back `unavailable` and the caller
 * falls through to {@link checkStarred}.
 *
 * @returns the host's verdict; `unavailable` when the route is absent,
 * broken, or answers with something unrecognisable.
 */
export async function checkHostStar(): Promise<StarCheckPayload['verdict']> {
  try {
    const response = await fetch(STAR_ROUTE, { cache: 'no-store' })
    if (!response.ok) return 'unavailable'
    const payload = await response.json() as StarCheckPayload
    return payload.verdict === 'starred' || payload.verdict === 'absent' ? payload.verdict : 'unavailable'
  } catch {
    // Swallowed: a TUI-less host or a dropped connection both just mean this
    // channel has nothing to say.
    return 'unavailable'
  }
}

/**
 * Look for a username in a repository's public stargazer list.
 *
 * Comparison is case-insensitive because GitHub logins are; the anonymous rate
 * limit (60 requests/hour/IP) comfortably covers the at-most-{@link MAX_PAGES}
 * requests a single attempt makes.
 *
 * @param repo - `owner/repo` slug to check.
 * @param username - GitHub login to look for; surrounding whitespace ignored.
 * @returns `starred` when found, `absent` when the full list was searched
 * without a hit, `overflow` when the list is too long to finish, and `error`
 * when the API could not be reached or answered abnormally.
 */
export async function checkStarred(repo: string, username: string): Promise<StarVerdict> {
  const wanted = username.trim().toLowerCase()
  if (wanted === '') return 'absent'
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await fetch(
        `${API_BASE}/repos/${repo}/stargazers?per_page=${PER_PAGE}&page=${page}`,
        { headers: { Accept: 'application/vnd.github+json' } },
      )
      if (response.status === 404) return 'missing'
      if (!response.ok) return 'error'
      // Wire boundary: a rate-limited or proxied answer can be a bare object
      // instead of an array, in which case `.some` throws into the catch below.
      const stargazers = (await response.json()) as readonly { readonly login?: string }[]
      if (stargazers.some((user) => user.login?.toLowerCase() === wanted)) return 'starred'
      if (stargazers.length < PER_PAGE) return 'absent'
    }
    return 'overflow'
  } catch {
    // Swallowed: offline, CORS and malformed-payload failures all mean the
    // same thing to the caller — the check could not run, nothing is known.
    return 'error'
  }
}
