/**
 * The credentialed half of star verification.
 *
 * `GET /user/starred/{owner}/{repo}` answers for the GitHub account the host
 * is logged in as — which is exactly the person sitting in front of the ad
 * layer — and it works while the repository is still private, where the
 * browser's anonymous stargazer walk sees only a 404. Channels mirror
 * [catalog.ts](./catalog.ts): the `gh` CLI first, an environment token for
 * headless hosts second, and `unavailable` (never a throw) when neither can
 * answer, so the browser knows to fall back rather than to give up.
 *
 * @module
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { StarCheckPayload } from './protocol.ts'

const execFileAsync = promisify(execFile)

/** How long one `gh` invocation may take before it counts as unavailable. */
const GH_TIMEOUT_MS = 20_000

/**
 * Classify a failed `gh api user/starred/…` call from its stderr.
 *
 * `gh` exits non-zero both when the answer is "not starred" (HTTP 404) and
 * when it has no usable login; the status line it prints is the only thing
 * that tells the two apart.
 *
 * @param stderr - the failed invocation's stderr.
 * @returns `absent` for a definitive 404, `unavailable` for everything else.
 */
export function classifyGhFailure(stderr: string): StarCheckPayload['verdict'] {
  return stderr.includes('HTTP 404') ? 'absent' : 'unavailable'
}

/**
 * Classify the star endpoint's HTTP status.
 * @param status - response status from `GET /user/starred/{repo}`.
 * @returns the verdict the status proves; bad credentials and rate limits are
 * `unavailable` because they say nothing about the star.
 */
export function classifyStarStatus(status: number): StarCheckPayload['verdict'] {
  if (status === 204) return 'starred'
  if (status === 404) return 'absent'
  return 'unavailable'
}

/**
 * Ask `gh` whether its logged-in user starred the repository.
 * @param repo - `owner/repo` slug.
 * @returns the verdict; `unavailable` when `gh` is missing or logged out.
 */
async function viaGh(repo: string): Promise<StarCheckPayload['verdict']> {
  try {
    await execFileAsync('gh', ['api', `user/starred/${repo}`, '--silent'], { timeout: GH_TIMEOUT_MS })
    return 'starred'
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr
    return classifyGhFailure(typeof stderr === 'string' ? stderr : '')
  }
}

/**
 * Ask the API directly with a token from the environment.
 * @param repo - `owner/repo` slug.
 * @param token - a GitHub token; must belong to the user being asked about.
 * @returns the verdict; `unavailable` when the network or the token fails.
 */
async function viaToken(repo: string, token: string): Promise<StarCheckPayload['verdict']> {
  try {
    const response = await fetch(`https://api.github.com/user/starred/${repo}`, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` },
    })
    return classifyStarStatus(response.status)
  } catch {
    // Swallowed: an offline host answers "no channel", not an error — the
    // browser still has its anonymous fallback to try.
    return 'unavailable'
  }
}

/**
 * Resolve the host's star verdict through the first channel that can answer.
 * @param repo - `owner/repo` slug to check.
 * @returns the payload for the star route; never throws.
 */
export async function checkHostStarred(repo: string): Promise<StarCheckPayload> {
  const gh = await viaGh(repo)
  if (gh !== 'unavailable') return { verdict: gh }
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? ''
  if (token !== '') {
    const viaApi = await viaToken(repo, token)
    if (viaApi !== 'unavailable') return { verdict: viaApi }
  }
  return { verdict: 'unavailable' }
}
