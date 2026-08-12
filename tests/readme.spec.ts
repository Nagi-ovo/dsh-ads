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
]

const visualizeDemo =
  'https://github.com/user-attachments/assets/93ff08ef-cf32-4a87-bf63-274c1a0a71e2'

describe('README showcase', () => {
  it('keeps every shipped campaign visible in both languages', () => {
    for (const asset of localShowcaseAssets) {
      expect(existsSync(new URL(`../${asset}`, import.meta.url)), asset).toBe(true)
      for (const readme of readmes) expect(readme, asset).toContain(asset)
    }

    for (const readme of readmes) expect(readme, 'visualize demo').toContain(visualizeDemo)
  })

  it('keeps the language switch visible', () => {
    expect(readmes[0]).toContain('README.en.md')
    expect(readmes[1]).toContain('README.md')
  })
})
