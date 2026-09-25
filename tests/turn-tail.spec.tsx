// @vitest-environment jsdom

/**
 * The turn tail changed kind under the plugin: dsh 0.1.5 and earlier declare a
 * chain (register requires `select`, the selector gates each turn), 0.1.6
 * onward a list (register requires `id`, every entry mounts on every turn).
 * One registration has to satisfy both hosts, and the ad must still skip the
 * turns the chain selector would have declined.
 */

import { act, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.tsx'
import { selectInlineAd, turnCarriesAd } from '../src/client/InlineAd.tsx'
import { clearPersisted } from '../src/client/persist.ts'

/** Locale snapshot pinned to Chinese; the gate does not depend on language. */
const SNAPSHOT = { active: 'zh', revision: 0 } as const

/** Static locale source with the DSH getSnapshot/subscribe face. */
const locale = {
  getSnapshot: () => SNAPSHOT,
  subscribe: () => () => undefined,
}

/** What the fake host captured for the turn tail. */
interface Captured {
  readonly options: Record<string, unknown>
  readonly component: ComponentType<Record<string, unknown>>
}

/**
 * Run the client apply against a fake slot service and keep the turn-tail registration.
 * @returns the captured options and component.
 */
function captureTurnTail(): Captured {
  let captured: Captured | undefined
  const slots = {
    inject(_name: string, install: () => void) { install() },
    register(options: Record<string, unknown>, component: ComponentType<Record<string, unknown>>) {
      if (options.name === 'conversation.chat.turnTail') captured = { options, component }
      return () => undefined
    },
  }
  apply({ locale, slots } as unknown as Parameters<typeof apply>[0])
  if (captured === undefined) throw new Error('turn tail was not registered')
  return captured
}

/**
 * Mount the turn-tail entry for one turn, as a list host would.
 * @param component - the registered entry.
 * @param seq - the turn's sequence number.
 * @returns the rendered text, then unmounts.
 */
function renderTurn(component: ComponentType<Record<string, unknown>>, seq: number): string {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const Entry = component
  act(() => {
    root.render(
      <Entry
        seq={seq}
        sessionId="session-1"
        turn={{ seq }}
        openFile={() => undefined}
        useLocale={<S,>(selector: (snapshot: typeof SNAPSHOT) => S) => selector(SNAPSHOT)}
      />,
    )
  })
  const html = host.innerHTML
  act(() => { root.unmount() })
  host.remove()
  return html
}

beforeEach(() => { clearPersisted() })
afterEach(() => { clearPersisted() })

describe('turn-tail registration', () => {
  it('carries the fields both the chain and the list register require', () => {
    const { options } = captureTurnTail()
    expect(options.select).toBe(selectInlineAd)
    expect(typeof options.id).toBe('string')
  })

  it('declines ad-free turns on a chain host', () => {
    expect(selectInlineAd({ seq: 1 })).toBeUndefined()
    expect(selectInlineAd({ seq: 2 })).toBe(2)
  })

  it('renders nothing on ad-free turns when a list host mounts it on every turn', () => {
    const { component } = captureTurnTail()
    for (const seq of [0, 1, 2, 3, 4]) {
      const html = renderTurn(component, seq)
      if (turnCarriesAd(seq)) expect(html).not.toBe('')
      else expect(html).toBe('')
    }
  })
})
