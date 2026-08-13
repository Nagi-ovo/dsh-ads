/**
 * The wire between the two halves of the dynamic ad tier.
 *
 * The built-in banners are baked into the browser bundle and need no host at
 * all. The dynamic tier asks the host to search GitHub's `dsh-plugin` topic so
 * repository transfers do not affect discovery. The browser receives only a
 * trimmed, already-filtered list rather than calling GitHub itself.
 *
 * @module
 */

/** Host route serving the sponsor list. */
export const REGISTRY_ROUTE = '/dsh-ads/registry.json'

/** Host route answering "has the host's own GitHub user starred this plugin". */
export const STAR_ROUTE = '/dsh-ads/star-check.json'

/** Payload of {@link STAR_ROUTE}. */
export interface StarCheckPayload {
  /**
   * `starred` and `absent` are definitive answers about the GitHub account
   * the host is logged in as (via `gh` or a token) — they work while the
   * repository is still private and need no typed username. `unavailable`
   * means the host has no credentialed channel, and the browser should fall
   * back to the anonymous public check.
   */
  readonly verdict: 'starred' | 'absent' | 'unavailable'
}

/** One community plugin, trimmed to what an advertisement needs. */
export interface SponsoredPlugin {
  /** `<owner>/<repo>`; stable identity for the fairness ledger. */
  readonly slug: string
  /** Repository name, used as the headline subject. */
  readonly name: string
  /** One-line description, used as the ad copy. Empty when the repo has none. */
  readonly description: string
  /** Repository URL, offered as a real link from the takeover. */
  readonly url: string
  /** Last push, ISO-8601; drives the freshness window. */
  readonly pushedAt: string
  /** GitHub topics, shown as the banner's little category flag. */
  readonly tags: readonly string[]
}

/** Payload of {@link REGISTRY_ROUTE}. */
export interface RegistryPayload {
  /** When the served list was assembled, ISO-8601. */
  readonly generated: string
  /** Where it came from, for the client to report when nothing shows up. */
  readonly source: 'gh-cli' | 'github-token' | 'github-public' | 'snapshot'
  /** The freshness window that was applied, in days. */
  readonly freshDays: number
  /** The eligible plugins, most recently updated first. */
  readonly plugins: readonly SponsoredPlugin[]
}
