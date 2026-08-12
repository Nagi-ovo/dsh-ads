/**
 * Drawing a stranger's repository description into an SVG.
 *
 * Two things matter here. The copy comes from someone else's README, so it has
 * to be escaped — an unescaped `<` would not merely look wrong, it would end
 * the element. And the same plugin has to look the same every time, or the
 * "recognise the purple one" story is not true.
 */

import { describe, expect, it } from 'vitest'
import { pluginCreative } from '../src/client/plugin-banner.ts'
import type { SponsoredPlugin } from '../src/protocol.ts'

/** A plugin whose description is doing its best to break the drawing. */
const HOSTILE: SponsoredPlugin = {
  slug: 'dsh-external/evil',
  name: 'evil',
  description: '</text><script>alert("x")</script> & "quoted" \'copy\'',
  url: 'https://github.com/dsh-external/evil',
  pushedAt: '2026-08-01T00:00:00Z',
  tags: [],
}

/** An ordinary plugin with a long hyphenated name. */
const PLAIN: SponsoredPlugin = {
  slug: 'dsh-external/dsh-external-research',
  name: 'dsh-external-research',
  description: '生态情报与 mainline 兼容性监控：每 8 小时对比全部仓库接口差异',
  url: 'https://github.com/dsh-external/dsh-external-research',
  pushedAt: '2026-08-01T00:00:00Z',
  tags: ['web-ui'],
}

/** Decode the data URI back into SVG source. */
function svg(src: string): string {
  return decodeURIComponent(src.replace('data:image/svg+xml;charset=utf-8,', ''))
}

describe('pluginCreative', () => {
  it('escapes copy instead of letting it close the element', () => {
    const source = svg(pluginCreative(HOSTILE, 'wide').src)
    expect(source).not.toContain('<script')
    expect(source).not.toContain('</script>')
    // The payload survives verbatim, entity-encoded — escaped, not stripped,
    // so a description containing angle brackets still reads as itself.
    expect(source).toContain('&lt;/text&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
  })

  it('draws the same plugin identically every time', () => {
    expect(pluginCreative(PLAIN, 'wide').src).toBe(pluginCreative(PLAIN, 'wide').src)
  })

  it('gives the two shapes the sizes their gutters expect', () => {
    const wide = pluginCreative(PLAIN, 'wide')
    const tall = pluginCreative(PLAIN, 'tall')
    expect(wide.width).toBeGreaterThan(wide.height * 4)
    expect(tall.height).toBeGreaterThan(tall.width)
  })

  it('carries the repository through, so the takeover can link to it', () => {
    const creative = pluginCreative(PLAIN, 'wide')
    expect(creative.href).toBe(PLAIN.url)
    expect(creative.sponsor).toBe(PLAIN.slug)
  })

  it('breaks a long name at its hyphens rather than mid-word', () => {
    const source = svg(pluginCreative(PLAIN, 'tall').src)
    expect(source).toContain('dsh-')
    // A break inside `research` would leave a fragment that is neither the
    // whole word nor ends at a hyphen; the copy is allowed to be truncated,
    // never chopped.
    expect(source).not.toMatch(/>resea<|>rch</)
  })

  it('lets a contributor override the generated copy', () => {
    const source = svg(pluginCreative(PLAIN, 'wide', { headline: '我自己写的标题', button: '快点我' }).src)
    expect(source).toContain('我自己写的标题')
    expect(source).toContain('快点我')
  })

  it('keeps English sponsor banners free of untranslated registry prose', () => {
    const source = svg(pluginCreative(PLAIN, 'wide', {}, 'en').src)
    expect(source).not.toContain('生态情报')
    expect(source).toContain('SPONSORED PLUGIN')
    expect(source).toContain(PLAIN.slug)
  })

  it('draws an explicit English sponsored-plugin skyscraper', () => {
    const creative = pluginCreative(PLAIN, 'tall', {}, 'en')
    const source = svg(creative.src)
    expect(creative.alt).toMatch(/^Sponsored plugin:/)
    expect(source).toContain('SPONSORED PLUGIN')
    expect(source).toContain('ADVERTISEMENT · UNAFFILIATED PARODY')
  })
})
