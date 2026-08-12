/**
 * Turning a real community plugin into a fake 2005 advertisement.
 *
 * Nobody is going to draw 160 banners by hand, and requiring artwork before a
 * plugin can be advertised would mean advertising the four people who felt
 * like opening an image editor. So the dynamic tier draws its own: an SVG data
 * URI built from the repository's name and one-line description, with the
 * palette and copy template chosen by a hash of the slug — the same plugin
 * therefore always looks the same, which is what makes it recognisable rather
 * than merely loud.
 *
 * SVG rather than DOM because everything downstream — gutter layout, the decoy
 * close button, the takeover, the in-transcript feed ad — already speaks
 * {@link AdCreative}, and a second rendering path would have to re-earn all of
 * it. Declarative `<animate>` runs inside an `<img>`; script does not, which
 * is exactly the sandbox an untrusted-ish string belongs in.
 *
 * @module
 */

import type { SponsoredPlugin } from '../protocol.ts'
import { EN_SPONSORED_PLUGIN_TEMPLATES } from './builtin-ads.ts'
import { hashString } from './stable-hash.ts'
import type { AdCreative, AdLocale } from './types.ts'

/** Rendered size of an auto-drawn horizontal banner, in SVG user units. */
const WIDE = { width: 720, height: 148 } as const

/** Rendered size of an auto-drawn skyscraper, in SVG user units. */
const TALL = { width: 300, height: 480 } as const

/** The garish half of the palette: background pair, plus text and trim. */
interface Palette {
  /** Gradient start. */
  readonly from: string
  /** Gradient end. */
  readonly to: string
  /** Headline fill. */
  readonly ink: string
  /** Headline outline and border. */
  readonly edge: string
  /** Body-copy fill. */
  readonly body: string
  /** Call-to-action fill. */
  readonly button: string
  /** Call-to-action label. */
  readonly buttonInk: string
}

/**
 * Six colour schemes, none of them defensible.
 *
 * Chosen by hash rather than at random so a plugin keeps its look between
 * sessions: recognising "the purple one" is the closest thing this tier has
 * to branding.
 */
const PALETTES: readonly Palette[] = [
  { from: '#d40000', to: '#ff8a00', ink: '#fff23a', edge: '#5c0000', body: '#fff6d5', button: '#fff23a', buttonInk: '#a00000' },
  { from: '#0033a0', to: '#00c2ff', ink: '#ffe600', edge: '#001f5c', body: '#e6f7ff', button: '#ff2d55', buttonInk: '#ffffff' },
  { from: '#6a00b8', to: '#ff00a8', ink: '#b6ff00', edge: '#33005c', body: '#ffe3f7', button: '#b6ff00', buttonInk: '#3d0057' },
  { from: '#007a2f', to: '#a6ff00', ink: '#ffffff', edge: '#0b3d1c', body: '#0d2b12', button: '#ff1e1e', buttonInk: '#ffffff' },
  { from: '#101010', to: '#8b0000', ink: '#ffcc33', edge: '#000000', body: '#ffd9a0', button: '#ffcc33', buttonInk: '#3d0000' },
  { from: '#ff2e88', to: '#ff9a00', ink: '#ffffff', edge: '#8a0038', body: '#fff0f6', button: '#00e5ff', buttonInk: '#003b45' },
]

/** Headline templates; `{name}` is the repository. */
const HEADLINES: Readonly<Record<AdLocale, readonly string[]>> = {
  zh: [
    '【{name}】震撼上线',
    '独家！{name} 内部体验版',
    '{name} 限时免费 手慢无',
    '你的 DSH 还差一个 {name}',
    '装了 {name} 的都说好',
    '{name} 今日开放 名额告急',
    '别再手动了！{name} 一键搞定',
  ],
  en: [
    'Meet {name}',
    '{name}, now in the DSH ecosystem',
    'Your next run could use {name}',
    'Add {name} to your agent stack',
    '{name} just shipped',
    'Still working without {name}?',
    'A community pick: {name}',
  ],
}

/** Top-left flashing tag. */
const BADGES: Readonly<Record<AdLocale, readonly string[]>> = {
  zh: ['刚刚更新', '本站强推', '今日热门', '新版首发', '强烈推荐', '独家发布'],
  en: ['JUST UPDATED', 'COMMUNITY PICK', 'TRENDING', 'NEW RELEASE', 'POPULAR', 'FEATURED'],
}

/** Call-to-action labels. */
const BUTTONS: Readonly<Record<AdLocale, readonly string[]>> = {
  zh: ['立即安装', '一键装上', '点我领取', '马上试试', '免费获取'],
  en: ['VIEW PLUGIN', 'OPEN REPO', 'ADD TO DSH', 'SEE DETAILS', 'TRY PLUGIN'],
}

/** Escape the five characters that would otherwise close an SVG element. */
function xml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Approximate rendered width, in ems.
 *
 * SVG has no text metrics before layout, so wrapping has to be estimated.
 * Counting CJK as a full em and everything else as a bit over half is close
 * enough for copy that is allowed to be a little ragged.
 *
 * @param text - the string to measure.
 * @returns width in ems.
 */
function ems(text: string): number {
  let total = 0
  for (const char of text) total += /[⺀-鿿＀-｠]/.test(char) ? 1 : 0.55
  return total
}

/**
 * Clamp a string to a width, with an ellipsis when it does not fit.
 * @param text - the copy.
 * @param maxEms - budget in ems.
 * @returns the clamped string.
 */
function clamp(text: string, maxEms: number): string {
  if (ems(text) <= maxEms) return text
  let out = ''
  for (const char of text) {
    if (ems(out + char) > maxEms - 1) break
    out += char
  }
  return `${out}…`
}

/** Characters a line may break after, inside an otherwise unbreakable run. */
const BREAK_AFTER = /[-_/\s\u3001\uff0c\u3002\uff1a\uff1b\uff01\uff1f]/

/**
 * Split copy into pieces a line break is allowed to fall between.
 *
 * CJK breaks anywhere, so each character is its own piece. Latin does not:
 * splitting `dsh-external-research` mid-word reads as a rendering fault rather
 * than as wrapping, so runs stay whole and only give way at their hyphens.
 *
 * @param text - the copy.
 * @returns the pieces, in order, concatenating back to `text`.
 */
function pieces(text: string): readonly string[] {
  const out: string[] = []
  let run = ''
  for (const char of text) {
    if (/[\u2e80-\u9fff\uff00-\uff60]/.test(char)) {
      if (run !== '') out.push(run)
      run = ''
      out.push(char)
      continue
    }
    run += char
    if (BREAK_AFTER.test(char)) {
      out.push(run)
      run = ''
    }
  }
  if (run !== '') out.push(run)
  return out
}

/**
 * Break copy into lines of at most `maxEms`, up to `maxLines`.
 *
 * A piece wider than the whole line is force-split rather than allowed to
 * overflow: some repository names really are longer than a 300px skyscraper.
 *
 * @param text - the copy.
 * @param maxEms - line budget in ems.
 * @param maxLines - how many lines are allowed.
 * @returns the wrapped lines, the last one clamped when copy was dropped.
 */
function wrap(text: string, maxEms: number, maxLines: number): readonly string[] {
  const all: string[] = []
  let line = ''
  for (const piece of pieces(text)) {
    if (ems(line + piece) <= maxEms) {
      line += piece
      continue
    }
    if (line !== '') all.push(line)
    line = ''
    if (ems(piece) <= maxEms) {
      line = piece
      continue
    }
    for (const char of piece) {
      if (ems(line + char) > maxEms) {
        all.push(line)
        line = ''
      }
      line += char
    }
  }
  if (line !== '') all.push(line)
  const trimmed = all.map((entry) => entry.trimEnd())
  if (trimmed.length <= maxLines) return trimmed
  const kept = trimmed.slice(0, maxLines)
  kept[maxLines - 1] = clamp(`${kept[maxLines - 1] ?? ''}\u2026`, maxEms)
  return kept
}

/** Font stack; single-quoted so it survives inside a double-quoted attribute. */
const FONT = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Heiti SC',system-ui,sans-serif"

/**
 * A headline in outlined WordArt, the way every banner of the era set type.
 * @param text - the copy.
 * @param at - baseline position.
 * @param size - font size in user units.
 * @param palette - colours.
 * @param anchor - text anchor.
 * @returns the `<text>` element.
 */
function headline(
  text: string,
  at: { x: number; y: number },
  size: number,
  palette: Palette,
  anchor: 'start' | 'middle' = 'start',
): string {
  return `<text x="${at.x}" y="${at.y}" font-family="${FONT}" font-size="${size}" font-weight="900"`
    + ` text-anchor="${anchor}" fill="${palette.ink}" stroke="${palette.edge}" stroke-width="${Math.round(size / 7)}"`
    + ` paint-order="stroke" stroke-linejoin="round">${xml(text)}</text>`
}

/**
 * The flashing corner tag.
 *
 * SMIL rather than CSS because it is the one animation technique that runs
 * identically in an `<img>`-embedded document across browsers, and a badge
 * that does not blink is not a badge.
 *
 * @param text - the tag copy.
 * @param at - top-left corner.
 * @returns the tag group.
 */
function badge(text: string, at: { x: number; y: number }): string {
  const width = Math.round(ems(text) * 13) + 14
  return `<g transform="translate(${at.x},${at.y})">`
    + `<rect width="${width}" height="20" rx="2" fill="#ffe600" stroke="#a00" stroke-width="1.5">`
    + '<animate attributeName="opacity" values="1;0.2;1" dur="0.9s" repeatCount="indefinite"/></rect>'
    + `<text x="${width / 2}" y="14.5" font-family="${FONT}" font-size="12" font-weight="700"`
    + ` text-anchor="middle" fill="#c40000">${xml(text)}</text></g>`
}

/**
 * The call-to-action.
 * @param text - the label.
 * @param box - position and size.
 * @param palette - colours.
 * @returns the button group.
 */
function cta(text: string, box: { x: number; y: number; w: number; h: number }, palette: Palette): string {
  const size = Math.min(28, Math.round(box.h * 0.42))
  return `<g transform="translate(${box.x},${box.y})">`
    + `<rect width="${box.w}" height="${box.h}" rx="4" fill="${palette.button}" stroke="#fff" stroke-width="2"/>`
    + `<text x="${box.w / 2}" y="${box.h / 2 + size * 0.36}" font-family="${FONT}" font-size="${size}" font-weight="900"`
    + ` text-anchor="middle" fill="${palette.buttonInk}">${xml(text)}</text></g>`
}

/** Gradient plus the diagonal hatch every one of these banners had. */
function backdrop(size: { width: number; height: number }, palette: Palette): string {
  return '<defs>'
    + `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${palette.from}"/><stop offset="1" stop-color="${palette.to}"/></linearGradient>`
    + '<pattern id="s" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
    + '<rect width="9" height="18" fill="#ffffff" opacity="0.14"/></pattern>'
    + '</defs>'
    + `<rect width="${size.width}" height="${size.height}" fill="url(#g)"/>`
    + `<rect width="${size.width}" height="${size.height}" fill="url(#s)"/>`
    + `<rect x="1.5" y="1.5" width="${size.width - 3}" height="${size.height - 3}" fill="none"`
    + ` stroke="${palette.edge}" stroke-width="3"/>`
}

/** The repository slug, small, so the ad is also findable. */
function slugLine(slug: string, at: { x: number; y: number }, palette: Palette, anchor: 'start' | 'middle' | 'end'): string {
  return `<text x="${at.x}" y="${at.y}" font-family="${FONT}" font-size="11" text-anchor="${anchor}"`
    + ` fill="${palette.body}" opacity="0.85">${xml(slug)}</text>`
}

/** Copy that a contributor may override; every field is optional. */
export interface AdCopy {
  /** Replaces the generated headline. */
  readonly headline?: string
  /** Replaces the plugin's own description as body copy. */
  readonly sub?: string
  /** Replaces the flashing corner tag. */
  readonly badge?: string
  /** Replaces the call-to-action label. */
  readonly button?: string
  /** Forces a palette index; out-of-range values wrap. */
  readonly palette?: number
}

/** Everything the two layouts need, already chosen. */
interface Draft {
  readonly seed: number
  readonly palette: Palette
  readonly headline: string
  readonly sub: string
  readonly badge: string
  readonly button: string
}

/**
 * Resolve copy and colours for one plugin.
 * @param plugin - the subject.
 * @param copy - contributor overrides.
 * @returns the resolved draft.
 */
function draft(plugin: SponsoredPlugin, copy: AdCopy, locale: AdLocale): Draft {
  const seed = hashString(plugin.slug)
  const paletteIndex = copy.palette ?? seed
  const headlines = HEADLINES[locale]
  const badges = BADGES[locale]
  const buttons = BUTTONS[locale]
  const englishSubs = [
    'Community-built extension for DeepSeek Harness',
    'Add a new capability to your agent setup',
    'Open-source plugin for the DSH ecosystem',
  ]
  return {
    seed,
    palette: PALETTES[Math.abs(paletteIndex) % PALETTES.length] as Palette,
    headline: copy.headline ?? (headlines[(seed >>> 3) % headlines.length] as string).replace('{name}', plugin.name),
    // English plugin descriptions in the registry may still be Chinese. The
    // sponsor slug remains visible and clickable, while the ad body uses a
    // deliberately generic Western clickbait proof line instead of leaking a
    // mixed-language paragraph into English mode.
    sub: copy.sub ?? (locale === 'en'
      ? englishSubs[(seed >>> 13) % englishSubs.length] as string
      : plugin.description),
    badge: copy.badge ?? (badges[(seed >>> 7) % badges.length] as string),
    button: copy.button ?? (buttons[(seed >>> 11) % buttons.length] as string),
  }
}

/** Raster source plus a directional shade that keeps live copy readable. */
function englishRaster(template: AdCreative, size: { width: number; height: number }, copySide: 'left' | 'right' | 'bottom'): string {
  const gradient = copySide === 'bottom'
    ? '<linearGradient id="copy-shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".54" stop-color="#080817" stop-opacity="0"/><stop offset=".72" stop-color="#080817" stop-opacity=".82"/><stop offset="1" stop-color="#080817" stop-opacity=".98"/></linearGradient>'
    : `<linearGradient id="copy-shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#071426" stop-opacity="${copySide === 'left' ? '.96' : '.04'}"/><stop offset=".48" stop-color="#071426" stop-opacity=".55"/><stop offset="1" stop-color="#071426" stop-opacity="${copySide === 'right' ? '.96' : '.04'}"/></linearGradient>`
  return `<defs>${gradient}</defs><image href="${template.src}" width="${size.width}" height="${size.height}" preserveAspectRatio="xMidYMid slice"/>`
    + `<rect width="${size.width}" height="${size.height}" fill="url(#copy-shade)"/>`
}

/** A compact live-text button over imagegen artwork. */
function englishButton(text: string, box: { x: number; y: number; w: number; h: number }): string {
  return `<g transform="translate(${box.x},${box.y})"><rect width="${box.w}" height="${box.h}" rx="6" fill="#f9dc4b" stroke="#fff" stroke-width="2"/>`
    + `<text x="${box.w / 2}" y="${box.h * 0.68}" font-family="${FONT}" font-size="${Math.round(box.h * 0.43)}" font-weight="900" text-anchor="middle" fill="#11182b">${xml(text)}  →</text></g>`
}

/** Select one generated raster template while preserving the requested shape. */
function englishTemplate(shape: 'wide' | 'tall', seed: number): AdCreative {
  const matching = EN_SPONSORED_PLUGIN_TEMPLATES.filter((template) => template.shape === shape)
  const template = matching[Math.abs(seed) % matching.length]
  if (template === undefined) throw new Error(`missing English sponsored-plugin ${shape} artwork`)
  return template
}

/** English sponsored-plugin banner over an imagegen source. */
function drawEnglishWide(plugin: SponsoredPlugin, spec: Draft): string {
  const template = englishTemplate('wide', spec.seed)
  const left = template.id === 'plugin-pitch'
  const x = left ? 20 : 382
  const anchor = left ? 'start' : 'start'
  return dataUri(WIDE, englishRaster(template, WIDE, left ? 'left' : 'right')
    + `<text x="${x}" y="25" font-family="system-ui,sans-serif" font-size="13" font-weight="850" letter-spacing="1.6" fill="#9ff7ff">SPONSORED PLUGIN</text>`
    + `<text x="${x}" y="64" font-family="${FONT}" font-size="29" font-weight="900" text-anchor="${anchor}" fill="#fff" stroke="#071426" stroke-width="3" paint-order="stroke">${xml(clamp(plugin.name, 17))}</text>`
    + `<text x="${x}" y="88" font-family="${FONT}" font-size="14" font-weight="650" fill="#d9eef7">${xml(clamp(spec.sub, 30))}</text>`
    + englishButton(spec.button, { x, y: 103, w: 154, h: 33 })
    + `<text x="700" y="139" font-family="system-ui,sans-serif" font-size="8" text-anchor="end" fill="#fff" opacity=".72">${xml(plugin.slug)} · PARODY AD</text>`)
}

/** English skyscraper over a dedicated imagegen portrait source. */
function drawEnglishTall(plugin: SponsoredPlugin, spec: Draft): string {
  const template = englishTemplate('tall', spec.seed)
  const title = wrap(plugin.name, 13, 2)
    .map((line, index) => `<text x="150" y="${365 + index * 31}" font-family="${FONT}" font-size="27" font-weight="900" text-anchor="middle" fill="#fff">${xml(line)}</text>`)
    .join('')
  return dataUri(TALL, englishRaster(template, TALL, 'bottom')
    + '<text x="150" y="337" font-family="system-ui,sans-serif" font-size="12" font-weight="850" letter-spacing="1.4" text-anchor="middle" fill="#9ff7ff">SPONSORED PLUGIN</text>'
    + title
    + englishButton(spec.button, { x: 49, y: 422, w: 202, h: 39 })
    + '<text x="150" y="475" font-family="system-ui,sans-serif" font-size="7" text-anchor="middle" fill="#fff" opacity=".65">ADVERTISEMENT · UNAFFILIATED PARODY</text>')
}

/** Wrap a body into an SVG data URI. */
function dataUri(size: { width: number; height: number }, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"`
    + ` viewBox="0 0 ${size.width} ${size.height}">${body}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Draw the horizontal banner.
 *
 * Two lines of body copy, not one. Plugin descriptions are a full sentence
 * about what the thing does, and a single 33-em line cut most of them off
 * mid-clause — in the feed, where this shape does its real work, that was the
 * only text a reader had to go on.
 */
function drawWide(plugin: SponsoredPlugin, spec: Draft): string {
  const { palette } = spec
  const headSize = ems(spec.headline) > 16 ? 26 : 32
  const sub = wrap(spec.sub, 33, 2)
    .map((line, i) => `<text x="20" y="${96 + i * 24}" font-family="${FONT}" font-size="16"`
      + ` fill="${palette.body}">${xml(line)}</text>`)
    .join('')
  return dataUri(WIDE, backdrop(WIDE, palette)
    + badge(spec.badge, { x: 12, y: 12 })
    + headline(clamp(spec.headline, 20), { x: 20, y: 70 }, headSize, palette)
    + sub
    + cta(spec.button, { x: WIDE.width - 166, y: 48, w: 146, h: 52 }, palette)
    + slugLine(plugin.slug, { x: WIDE.width - 20, y: 24 }, palette, 'end'))
}

/**
 * Draw the skyscraper.
 *
 * Set larger than the horizontal banner and given far less to say. It occupies
 * a full gutter by itself, so the layout spends its height on a handful of big
 * words instead of repeating the full plugin description.
 */
function drawTall(plugin: SponsoredPlugin, spec: Draft): string {
  const { palette } = spec
  const head = wrap(spec.headline, 6, 3)
  const sub = wrap(spec.sub, 11, 3)
  const headLines = head
    .map((line, i) => headline(line, { x: TALL.width / 2, y: 118 + i * 46 }, 38, palette, 'middle'))
    .join('')
  const subLines = sub
    .map((line, i) => `<text x="${TALL.width / 2}" y="${278 + i * 30}" font-family="${FONT}" font-size="22"`
      + ` font-weight="700" text-anchor="middle" fill="${palette.body}">${xml(line)}</text>`)
    .join('')
  return dataUri(TALL, backdrop(TALL, palette)
    + badge(spec.badge, { x: 12, y: 12 })
    + `<text x="${TALL.width / 2}" y="66" font-family="${FONT}" font-size="21" font-weight="700"`
    + ` text-anchor="middle" fill="${palette.ink}">★ ${xml(clamp(plugin.name, 12))} ★</text>`
    + headLines
    + subLines
    + cta(spec.button, { x: 40, y: TALL.height - 104, w: 220, h: 60 }, palette)
    + slugLine(plugin.slug, { x: TALL.width / 2, y: TALL.height - 18 }, palette, 'middle'))
}

/**
 * Draw one plugin as a banner.
 * @param plugin - the subject.
 * @param shape - which gutter family to draw for.
 * @param copy - contributor overrides, if any.
 * @param locale - language of generated chrome and headline templates.
 * @returns the creative, carrying the repository URL as its takeover link.
 */
export function pluginCreative(
  plugin: SponsoredPlugin,
  shape: 'wide' | 'tall',
  copy: AdCopy = {},
  locale: AdLocale = 'zh',
): AdCreative {
  const spec = draft(plugin, copy, locale)
  const size = shape === 'tall' ? TALL : WIDE
  return {
    id: `hub-${locale}-${shape}-${plugin.slug}`,
    width: size.width,
    height: size.height,
    shape,
    weight: 1,
    alt: locale === 'en'
      ? `Sponsored plugin: ${plugin.name} — ${spec.headline}`
      : `${spec.headline} — ${spec.sub}`,
    src: locale === 'en'
      ? (shape === 'tall' ? drawEnglishTall(plugin, spec) : drawEnglishWide(plugin, spec))
      : (shape === 'tall' ? drawTall(plugin, spec) : drawWide(plugin, spec)),
    href: plugin.url,
    sponsor: plugin.slug,
  }
}
