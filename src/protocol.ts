/**
 * The wire between the two halves of the dynamic ad tier.
 *
 * The built-in banners are baked into the browser bundle and need no host at
 * all. The dynamic tier does: the plugin hub is a private repository, so the
 * catalog can only be read through the user's own GitHub credentials, which
 * live on the host side. The browser half therefore asks the host for a
 * trimmed, already-filtered list rather than talking to GitHub itself.
 *
 * @module
 */

/** Host route serving the sponsor list. */
export const REGISTRY_ROUTE = '/dsh-ads/registry.json'

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
  /** Hub tags, shown as the banner's little category flag. */
  readonly tags: readonly string[]
}

/** Payload of {@link REGISTRY_ROUTE}. */
export interface RegistryPayload {
  /** When the served list was assembled, ISO-8601. */
  readonly generated: string
  /** Where it came from, for the client to report when nothing shows up. */
  readonly source: 'gh-cli' | 'github-token' | 'snapshot'
  /** The freshness window that was applied, in days. */
  readonly freshDays: number
  /** The eligible plugins, hub order preserved. */
  readonly plugins: readonly SponsoredPlugin[]
}
