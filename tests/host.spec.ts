/** Host registration follows the web server service name exposed by DSH. */

import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/index.ts'
import { REGISTRY_ROUTE, STAR_ROUTE } from '../src/protocol.ts'

describe('host plugin', () => {
  it('injects webServer and registers both routes on it', () => {
    const paths: string[] = []
    const register = (route: { path: string }) => {
      paths.push(route.path)
      return () => undefined
    }

    expect(inject).toEqual(['webServer'])
    apply({
      webServer: { register },
      effect(callback) { callback() },
    })

    expect(paths).toEqual([
      REGISTRY_ROUTE,
      STAR_ROUTE,
    ])
  })
})
