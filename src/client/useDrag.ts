/**
 * Dragging a widget by its title bar.
 *
 * The catch this solves: the poster is also a click target (clicking it opens
 * the takeover), so a drag that ends over the artwork must not also read as a
 * click. The hook therefore reports whether the pointer actually moved past a
 * small threshold, and the caller suppresses its click when it did.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Anchor } from './persist.ts'

/** Pointer travel, in CSS pixels, past which a press counts as a drag. */
const DRAG_THRESHOLD = 4

/** What {@link useDrag} hands back. */
export interface DragHandle {
  /** Attach to the drag handle's `onPointerDown`. */
  readonly onPointerDown: (event: React.PointerEvent) => void
  /** True while a drag is in progress. */
  readonly dragging: boolean
  /**
   * True if the last gesture moved past the threshold. Read it inside a click
   * handler to tell "the user dragged me here" from "the user clicked me".
   */
  readonly moved: () => boolean
}

/**
 * Make an element draggable, reporting its new anchor.
 *
 * Movement is clamped so the widget can never be dragged fully off-screen —
 * a widget you cannot reach again is indistinguishable from one you lost.
 *
 * @param anchor - current position.
 * @param onMove - called with the new position when a drag ends.
 * @param size - the widget's rendered size, for clamping.
 * @param leftFloor - leftmost the widget may sit, in CSS pixels. The host's
 * sidebar lives here; parking an ad on top of the session list covers real
 * navigation rather than the transcript, which is the one thing the layer is
 * not allowed to do. Defaults to 0 for hosts with no sidebar.
 * @returns handlers and state for the drag handle.
 */
export function useDrag(
  anchor: Anchor,
  onMove: (next: Anchor) => void,
  size: { width: number; height: number },
  leftFloor = 0,
): DragHandle {
  const [dragging, setDragging] = useState(false)
  const origin = useRef<{ x: number; y: number; left: number; bottom: number } | undefined>(undefined)
  const travelled = useRef(false)
  const latest = useRef(anchor)
  latest.current = anchor

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    origin.current = { x: event.clientX, y: event.clientY, left: latest.current.left, bottom: latest.current.bottom }
    travelled.current = false
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMoveEvent = (event: PointerEvent) => {
      const from = origin.current
      if (from === undefined) return
      const dx = event.clientX - from.x
      const dy = event.clientY - from.y
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) travelled.current = true
      // Keep at least a sliver on screen on every edge — a widget dragged
      // fully off-screen is indistinguishable from one that is gone — and
      // never let it settle over the sidebar.
      const left = Math.max(leftFloor, Math.min(innerWidth - 40, from.left + dx))
      // Bottom-anchored, so downward pointer movement *decreases* it.
      const bottom = Math.max(0, Math.min(innerHeight - size.height, from.bottom - dy))
      onMove({ left, bottom })
    }
    const onUp = () => setDragging(false)
    addEventListener('pointermove', onMoveEvent)
    addEventListener('pointerup', onUp)
    return () => {
      removeEventListener('pointermove', onMoveEvent)
      removeEventListener('pointerup', onUp)
    }
  }, [dragging, onMove, size.width, size.height, leftFloor])

  // Clamping on drag alone is not enough: a position saved before the floor
  // moved — a persisted anchor from an older build, or the sidebar expanding
  // under a widget parked to its left — stays out of bounds forever, because
  // nothing re-checks it until the user drags again. Re-clamp whenever the
  // bounds themselves change, which also covers window resizes.
  useEffect(() => {
    const settle = () => {
      const at = latest.current
      const left = Math.max(leftFloor, Math.min(innerWidth - 40, at.left))
      const bottom = Math.max(0, Math.min(Math.max(0, innerHeight - size.height), at.bottom))
      if (left !== at.left || bottom !== at.bottom) onMove({ left, bottom })
    }
    settle()
    addEventListener('resize', settle)
    return () => removeEventListener('resize', settle)
  }, [leftFloor, onMove, size.height])

  const moved = useCallback(() => travelled.current, [])
  return { onPointerDown, dragging, moved }
}
