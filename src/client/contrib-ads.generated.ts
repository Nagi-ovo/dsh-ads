/**
 * Contributed ads, generated from `contrib/` by `scripts/build-contrib.mjs`.
 *
 * Do not edit by hand — add a file under `contrib/` and run `pnpm run assets`.
 * See [contrib/README.md](../../contrib/README.md).
 *
 * @module
 */

import type { AdCopy } from './plugin-banner.ts'
import type { AdShape } from './types.ts'

/** One plugin author's override of their generated banner. */
export interface ContribAd {
  /** `<owner>/<repo>` this entry applies to. */
  readonly slug: string
  /** Copy overrides; an empty object keeps every generated line. */
  readonly copy: AdCopy
  /** Supplied artwork, replacing the generated drawing entirely. */
  readonly art?: {
    /** Inlined image as a `data:` URI. */
    readonly src: string
    /** Intrinsic width in pixels. */
    readonly width: number
    /** Intrinsic height in pixels. */
    readonly height: number
    /** Placement family, derived from the aspect ratio. */
    readonly shape: AdShape
  }
}

/** Every contributed entry, by file order. */
export const CONTRIB_ADS: readonly ContribAd[] = [
  {
    "slug": "dsh-external/dsh-visualize",
    "copy": {
      "headline": "模型直接给你画界面",
      "sub": "对话里长出可交互卡片，不是贴一段代码",
      "badge": "本站强推",
      "button": "立即安装",
      "palette": 2
    }
  }
]
