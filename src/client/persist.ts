/**
 * The few pieces of layer state worth surviving a reload.
 *
 * Almost nothing here is persistent by design — dismissals, the retire flag
 * and the spawn clock all reset on refresh, because a joke you have to opt
 * back into every morning stops being funny. The exceptions are the choices a
 * user makes *about* the layer rather than against it: keeping only the poster,
 * and where they dragged it to. Those are preferences, and a preference that
 * forgets itself is just a bug.
 */

import { useCallback, useEffect, useState } from 'react'

/**
 * Same-document change notification.
 *
 * The native `storage` event only fires in *other* tabs, but the two halves of
 * this plugin — the floating layer and the in-transcript ad — live in separate
 * React trees in the same document and must agree on solo mode. This event
 * carries the change across them.
 */
const CHANGED = 'dsh-ads:persist-changed'

/**
 * Last written value per key, kept in memory.
 *
 * Storage is not always writable — private-mode Safari, sandboxed frames, a
 * jsdom run — and without this the broadcast below would hand every listener
 * the *stored* value, i.e. roll the setting straight back to its default the
 * instant it was changed. The memory layer keeps the two React trees agreeing
 * even when nothing can be persisted; only durability across reloads is lost.
 */
const memory = new Map<string, unknown>()

/**
 * Where a draggable widget sits, in CSS pixels from the viewport's edges.
 *
 * Anchored to the *bottom* edge, not the top: the widget folds by dropping its
 * body, so a top anchor would leave the collapsed title bar stranded wherever
 * the full card's head happened to be. Pinning the bottom makes it collapse
 * down onto its own corner and expand upward, which is how every real
 * corner widget behaves.
 */
export interface Anchor {
  /** Distance from the left edge. */
  readonly left: number
  /** Distance from the bottom edge. */
  readonly bottom: number
}

/**
 * A `useState` that mirrors into `localStorage` under `dsh-ads:<key>`.
 *
 * Reads and writes are individually guarded: storage throws in private-mode
 * Safari and in sandboxed frames, and an ad layer must never be the reason a
 * session fails to render. A failed read falls back to `initial`, a failed
 * write just means the preference does not outlive the tab.
 *
 * @param key - suffix of the storage key.
 * @param initial - value used when nothing is stored or storage is unavailable.
 * @returns the current value and a setter, same shape as `useState`.
 */
export function usePersisted<T>(key: string, initial: T): [T, (next: T) => void] {
  const read = useCallback((): T => {
    if (memory.has(key)) return memory.get(key) as T
    try {
      const raw = localStorage.getItem(`dsh-ads:${key}`)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      // Swallowed: unavailable or corrupt storage means "no preference yet",
      // which `initial` already expresses.
      return initial
    }
    // `initial` is intentionally not a dependency: re-reading because a caller
    // passed a fresh object literal would clobber the stored value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const [value, setValue] = useState<T>(read)
  const store = useCallback((next: T) => {
    memory.set(key, next)
    setValue(next)
    try {
      localStorage.setItem(`dsh-ads:${key}`, JSON.stringify(next))
    } catch {
      // Swallowed: the preference stays in memory for this tab, which is the
      // whole of what a failed write costs.
    }
    dispatchEvent(new CustomEvent(CHANGED, { detail: key }))
  }, [key])
  // Follow writes made by other hook instances on the same key.
  useEffect(() => {
    const onChanged = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) setValue(read())
    }
    addEventListener(CHANGED, onChanged)
    return () => removeEventListener(CHANGED, onChanged)
  }, [key, read])
  return [value, store]
}

/**
 * Forget every stored preference.
 *
 * The honest counterpart to {@link usePersisted}'s setter: without it there is
 * no way back to a clean slate, because the in-memory mirror survives even
 * where storage does not. Tests need one, and so would any future "reset to
 * defaults" control.
 */
export function clearPersisted(): void {
  for (const key of memory.keys()) {
    try {
      localStorage.removeItem(`dsh-ads:${key}`)
    } catch {
      // Swallowed: storage that cannot be written cannot be holding anything
      // to clear either, and the memory mirror below is the real state.
    }
  }
  memory.clear()
  dispatchEvent(new CustomEvent(CHANGED, { detail: '' }))
}
