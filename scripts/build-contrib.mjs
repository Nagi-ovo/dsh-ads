/**
 * Inline the contributed ads under `contrib/` into the browser bundle.
 *
 * One JSON file per plugin, optionally paired with an image of the same
 * basename. Copy-only entries are the common case and need no artwork at all,
 * which is the point: the bar for advertising your own plugin should be one
 * small file, not an afternoon in an image editor.
 *
 * Generates `src/client/contrib-ads.generated.ts`; run via `pnpm run assets`.
 */

import { execFileSync } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'contrib')
const out = join(root, 'src', 'client', 'contrib-ads.generated.ts')

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.gif': 'image/gif' }

/** Copy fields a contributor may set; anything else in the file is ignored. */
const COPY_FIELDS = ['headline', 'sub', 'badge', 'button', 'palette']

const present = await readdir(dir)
const entries = []

for (const file of present.filter((name) => name.endsWith('.json')).sort()) {
  const spec = JSON.parse(await readFile(join(dir, file), 'utf8'))
  if (typeof spec.repo !== 'string' || !spec.repo.includes('/')) {
    throw new Error(`contrib/${file}: "repo" must be "<owner>/<name>"`)
  }
  const copy = {}
  for (const field of COPY_FIELDS) if (spec[field] !== undefined) copy[field] = spec[field]

  let art
  if (typeof spec.image === 'string') {
    const ext = extname(spec.image)
    const mime = MIME[ext]
    if (mime === undefined) throw new Error(`contrib/${file}: unsupported image type ${ext}`)
    if (!present.includes(spec.image)) throw new Error(`contrib/${file}: missing image ${spec.image}`)
    const bytes = await readFile(join(dir, spec.image))
    // Frame-pinned: `identify` on an animated image reports every frame, and
    // the intrinsic size is the first one.
    const geom = execFileSync('magick', ['identify', '-format', '%w %h', `${join(dir, spec.image)}[0]`], { encoding: 'utf8' })
    const [width, height] = geom.trim().split(/\s+/).map(Number)
    art = {
      src: `data:${mime};base64,${bytes.toString('base64')}`,
      width,
      height,
      shape: width >= height * 2 ? 'wide' : 'tall',
    }
    console.log(`contrib ${spec.repo}: ${width}×${height} ${(bytes.length / 1024).toFixed(0)} KB`)
  } else {
    console.log(`contrib ${spec.repo}: copy only`)
  }
  entries.push({ slug: spec.repo, copy, ...(art === undefined ? {} : { art }) })
}

const body = `/**
 * Contributed ads, generated from \`contrib/\` by \`scripts/build-contrib.mjs\`.
 *
 * Do not edit by hand — add a file under \`contrib/\` and run \`pnpm run assets\`.
 * See [contrib/README.md](../../contrib/README.md).
 *
 * @module
 */

import type { AdCopy } from './plugin-banner.ts'
import type { AdShape } from './types.ts'

/** One plugin author's override of their generated banner. */
export interface ContribAd {
  /** \`<owner>/<repo>\` this entry applies to. */
  readonly slug: string
  /** Copy overrides; an empty object keeps every generated line. */
  readonly copy: AdCopy
  /** Supplied artwork, replacing the generated drawing entirely. */
  readonly art?: {
    /** Inlined image as a \`data:\` URI. */
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
export const CONTRIB_ADS: readonly ContribAd[] = ${JSON.stringify(entries, null, 2)}
`

await writeFile(out, body, 'utf8')
console.log(`contrib-ads.generated.ts: ${entries.length} entries`)
