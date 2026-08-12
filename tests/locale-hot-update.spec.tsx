// @vitest-environment jsdom

/** Locale changes must update every mounted advertisement without a reload. */

import { act, useSyncExternalStore, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.tsx'

/** Minimal locale snapshot used by the client service. */
interface LocaleSnapshot {
  readonly active: 'zh' | 'en'
  readonly revision: number
}

/** Observable locale source with the same getSnapshot/subscribe face as DSH. */
function localeSource() {
  let snapshot: LocaleSnapshot = { active: 'zh', revision: 0 }
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(active: LocaleSnapshot['active']) {
      snapshot = { active, revision: snapshot.revision + 1 }
      for (const listener of listeners) listener()
    },
  }
}

describe('client locale hot update', () => {
  it('subscribes mounted slot entries and redraws the settings page in English', () => {
    const locale = localeSource()
    const entries = new Map<string, {
      readonly component: ComponentType<Record<string, unknown>>
      readonly inject: () => Record<string, unknown>
    }>()
    const slots = {
      inject(_name: string, install: () => void) { install() },
      register(options: { name: string; inject?: () => Record<string, unknown> }, component: ComponentType<Record<string, unknown>>) {
        entries.set(options.name, {
          component,
          inject: options.inject ?? (() => ({})),
        })
        return () => undefined
      },
    }
    apply({ locale, slots } as unknown as Parameters<typeof apply>[0])

    expect([...entries.keys()]).toEqual([
      'conversation.input.dock',
      'settings.section',
      'conversation.chat.turnTail',
    ])
    for (const entry of entries.values()) {
      expect(entry.inject()).toEqual({ hooks: { locale } })
    }
    const settingsEntry = entries.get('settings.section')
    expect(settingsEntry).toBeDefined()

    function useLocale<S>(selector: (snapshot: LocaleSnapshot) => S): S {
      return selector(useSyncExternalStore(locale.subscribe, locale.getSnapshot))
    }

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const Entry = settingsEntry!.component
    act(() => { root.render(<Entry useLocale={useLocale} close={() => undefined} />) })
    expect(host.textContent).toContain('本页由社区插件')

    act(() => { locale.set('en') })
    expect(host.textContent).toContain('This page is provided by the community plugin')
    expect(host.textContent).not.toContain('本页由社区插件')

    act(() => { root.unmount() })
    host.remove()
  })
})
