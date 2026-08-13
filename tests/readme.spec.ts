/** README showcase coverage. */

import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readmes = [
  readFileSync(new URL('../README.md', import.meta.url), 'utf8'),
  readFileSync(new URL('../README.en.md', import.meta.url), 'utf8'),
]

const localShowcaseAssets = [
  'assets/screenshot.webp',
  'assets/english-mode.png',
  'assets/reward-gate.png',
  'assets/settings.webp',
  'assets/poster-blue-whale-small.gif',
  'assets/startup-score.png',
]

const visualizeDemo = ['assets/visualize-demo.webp', 'assets/visualize-demo.mp4']

describe('README showcase', () => {
  it('keeps every shipped campaign visible in both languages', () => {
    for (const asset of localShowcaseAssets) {
      expect(existsSync(new URL(`../${asset}`, import.meta.url)), asset).toBe(true)
      for (const readme of readmes) expect(readme, asset).toContain(asset)
    }

    for (const asset of visualizeDemo) {
      expect(existsSync(new URL(`../${asset}`, import.meta.url)), asset).toBe(true)
      for (const readme of readmes) expect(readme, asset).toContain(asset)
    }
  })

  it('keeps the language switch visible', () => {
    expect(readmes[0]).toContain('README.en.md')
    expect(readmes[1]).toContain('README.md')
  })

  it('keeps the disclaimer visible without expanding a disclosure', () => {
    for (const [index, title] of ['免责声明', 'Disclaimer'].entries()) {
      expect(readmes[index]).toContain(`## ${title}`)
      expect(readmes[index]).not.toContain(`<summary>${title}</summary>`)
    }
  })
})
