/**
 * The host star check's two classification seams. The `gh` and token
 * invocations themselves follow catalog.ts in staying untested — they are
 * one-line calls into audited tools — but the mapping from their raw answers
 * to a verdict is this plugin's own logic, and a wrong mapping here turns
 * "not starred" into "no channel" silently.
 */

import { describe, expect, it } from 'vitest'
import { classifyGhFailure, classifyStarStatus } from '../src/star-host.ts'

describe('classifyGhFailure', () => {
  it('reads a 404 status line as a definitive not-starred', () => {
    expect(classifyGhFailure('gh: Not Found (HTTP 404)')).toBe('absent')
  })

  it('reads a missing login, or nothing at all, as no usable channel', () => {
    expect(classifyGhFailure('To get started with GitHub CLI, please run:  gh auth login')).toBe('unavailable')
    expect(classifyGhFailure('')).toBe('unavailable')
  })
})

describe('classifyStarStatus', () => {
  it('maps the API contract: 204 starred, 404 absent, everything else unavailable', () => {
    expect(classifyStarStatus(204)).toBe('starred')
    expect(classifyStarStatus(404)).toBe('absent')
    expect(classifyStarStatus(401)).toBe('unavailable')
    expect(classifyStarStatus(500)).toBe('unavailable')
  })
})
