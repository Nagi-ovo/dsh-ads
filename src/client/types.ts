/**
 * Shared shapes for the ad layer: what a banner is, where one got placed, and
 * the per-banner randomness that makes its close button hard to hit.
 */

/** The two locale ids shipped by DSH and by this plugin's artwork. */
export type AdLocale = 'zh' | 'en'

/**
 * Placement family of a banner image.
 * - `wide`  — a normal horizontal banner (roughly 5:1 … 10:1).
 * - `strip` — an extremely flat rule-like banner (>15:1); only ever spans a full edge.
 * - `tall`  — a vertical skyscraper for the left/right gutters.
 */
export type AdShape = 'wide' | 'strip' | 'tall'

/** One banner image plus the metadata that drives placement and draw odds. */
export interface AdCreative {
  /** Stable slug, unique within a set; also the React key seed. */
  readonly id: string
  /** Intrinsic pixel width of the artwork. */
  readonly width: number
  /** Intrinsic pixel height of the artwork. */
  readonly height: number
  /** Placement family. */
  readonly shape: AdShape
  /** Relative draw weight; higher appears more often. */
  readonly weight: number
  /** Accessible description — the banner's own slogan, verbatim. */
  readonly alt: string
  /** Image source; built-in banners carry a `data:` URI. */
  readonly src: string
  /**
   * Optional video source for the takeover. When present, clicking through to
   * the landing page plays this instead of enlarging the still — a game ad
   * that opens into a video is the whole point of a game ad.
   */
  readonly video?: string
  /**
   * Where the ad actually goes, when it goes anywhere.
   *
   * Built-in banners have none: their products do not exist. Banners for real
   * community plugins carry their repository, and the takeover offers it as a
   * plain link — the one honest thing in an otherwise entirely dishonest
   * layout, and the reason a plugin author gets anything out of being here.
   */
  readonly href?: string
  /**
   * `<owner>/<repo>` of the advertised plugin, for creatives that advertise
   * one. The fairness ledger counts impressions against this, so a plugin's
   * horizontal and vertical banners share one tally.
   */
  readonly sponsor?: string
}

/**
 * A banner that currently exists on screen. `seed` is drawn once at spawn and
 * never changes, so the decoy close button stays in the same wrong place for
 * as long as the banner lives — a hitbox that moved between attempts would
 * read as a rendering bug rather than as the joke.
 */
export interface PlacedAd {
  /** Instance identity; the same creative can be placed several times. */
  readonly key: string
  /** The artwork being shown. */
  readonly creative: AdCreative
  /** Which gutter this instance sits in. */
  readonly side: 'left' | 'right'
  /** Row index within the gutter, top first. */
  readonly row: number
  /** Frozen randomness for the hitbox skew, in [0, 1). */
  readonly seed: number
  /** Epoch ms when this banner appeared; drives the entrance animation. */
  readonly bornAt: number
}
