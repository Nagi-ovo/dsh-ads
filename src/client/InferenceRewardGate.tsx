/**
 * Rewarded ad inserted into a live inference without pausing the agent.
 *
 * The host exposes stable `data-chat-flow-*` and `data-streaming` attributes
 * on transcript rows. The gate freezes the visible height of the current
 * Assistant row and conceals later rows while the underlying session keeps
 * rendering into the DOM. Unlocking restores everything already produced,
 * including Tool rows, in one reveal.
 */

import {
  useCallback, useEffect, useRef, useState, type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import type { AdCreative } from './types.ts'
import { useRetired } from './retire.ts'
import { useAdSettings } from './settings.ts'

/** How long a response must still be streaming before the gate appears. */
export const REWARD_GATE_DELAY_MS = 1_800

/** Short rewarded-ad countdown; long enough to register, short enough to stay a joke. */
export const REWARD_WATCH_SECONDS = 8

/** One active gate and the DOM row whose tail it conceals. */
interface GateTarget {
  /** Streaming Assistant row visible when the countdown began. */
  readonly row: HTMLElement
  /** Flow sibling that hosts the React portal. */
  readonly host: HTMLDivElement
}

/** Props for the inference reward gate. */
export interface InferenceRewardGateProps {
  /** Cash-reward artwork; exact copy is rendered as HTML above it. */
  readonly creative: AdCreative
  /** Override for deterministic tests. */
  readonly delayMs?: number
  /** Override for deterministic tests. */
  readonly watchSeconds?: number
}

/** Return the newest Assistant row that is still receiving model output. */
function streamingRow(): HTMLElement | undefined {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-chat-flow-kind="assistant-step"]')]
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (row !== undefined && row.querySelector('[data-streaming="true"]') !== null) return row
  }
  return undefined
}

/** Whether `candidate` follows `origin` in transcript order. */
function follows(origin: HTMLElement, candidate: HTMLElement): boolean {
  return (origin.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

/**
 * Freeze the visible response and conceal every later transcript row.
 *
 * @param target - active gate target.
 * @param onDetached - reveals the transcript if its active row leaves the DOM.
 * @returns a disposer that restores the exact inline styles it found.
 */
function concealTail(target: GateTarget, onDetached: () => void): () => void {
  const { row, host } = target
  const parent = row.parentElement
  const previousRow = {
    maxHeight: row.style.maxHeight,
    overflow: row.style.overflow,
    overflowX: row.style.overflowX,
    overflowY: row.style.overflowY,
  }
  const hidden = new Map<HTMLElement, string>()
  const height = Math.max(1, row.getBoundingClientRect().height, row.scrollHeight)
  row.style.maxHeight = `${height}px`
  row.style.overflow = 'hidden'
  row.dataset.dshRewardLocked = 'true'

  const hideLaterRows = () => {
    if (!row.isConnected || !host.isConnected) {
      onDetached()
      return
    }
    if (parent === null) return
    for (const candidate of parent.querySelectorAll<HTMLElement>('[data-chat-flow-key]')) {
      if (candidate === row || !follows(row, candidate) || hidden.has(candidate)) continue
      hidden.set(candidate, candidate.style.display)
      candidate.style.display = 'none'
    }
  }
  hideLaterRows()
  const observer = new MutationObserver(hideLaterRows)
  if (parent !== null) observer.observe(parent, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    row.style.maxHeight = previousRow.maxHeight
    row.style.overflow = previousRow.overflow
    row.style.overflowX = previousRow.overflowX
    row.style.overflowY = previousRow.overflowY
    delete row.dataset.dshRewardLocked
    for (const [candidate, display] of hidden) candidate.style.display = display
    host.remove()
  }
}

const cardStyle: CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  minHeight: 286,
  margin: '12px 0 18px',
  overflow: 'hidden',
  border: '2px solid #ffd35a',
  borderRadius: 18,
  background: '#d90030',
  boxShadow: '0 14px 34px rgba(122, 0, 24, 0.3)',
  color: '#fff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const primaryButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: 42,
  padding: '9px 16px',
  border: '1px solid #fff0a8',
  borderRadius: 999,
  background: 'linear-gradient(180deg, #fff9bc, #ffc63d)',
  boxShadow: '0 4px 0 #d87b00, 0 8px 20px rgba(112, 0, 14, 0.3)',
  color: '#9b1700',
  fontSize: 15,
  fontWeight: 900,
  cursor: 'pointer',
}

/** Props for the visible countdown card. */
interface RewardCardProps {
  readonly creative: AdCreative
  readonly seconds: number
  readonly onUnlock: () => void
}

/**
 * Draw the deliberately excessive cash-withdrawal creative.
 *
 * @param props - artwork, countdown duration, and reveal action.
 * @returns the inline rewarded-ad card.
 */
function RewardCard({ creative, seconds, onUnlock }: RewardCardProps) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft((current) => Math.max(0, current - 1)), 1_000)
    return () => clearTimeout(timer)
  }, [left])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onUnlock()
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [onUnlock])
  const progress = seconds <= 0 ? 100 : Math.round(((seconds - left) / seconds) * 100)
  return (
    <section style={cardStyle} aria-label="推理激励广告" data-dsh-reward-gate>
      <img
        src={creative.src}
        alt={creative.alt}
        draggable={false}
        style={{ position: 'absolute', inset: 0, zIndex: -2, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: -1,
          background: 'linear-gradient(90deg, rgba(116, 0, 19, 0.96) 0%, rgba(177, 0, 35, 0.86) 46%, rgba(177, 0, 35, 0.08) 76%)',
        }}
      />
      <div style={{ width: 'min(57%, 430px)', minWidth: 270, padding: '22px 20px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: '#ffe99a' }}>
          推理激励广告 · 模型仍在后台工作
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 28, lineHeight: 1.1, textShadow: '0 2px 0 #8c001d' }}>
          这一次，你一定要提现
        </h2>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 10 }}>
          <strong style={{ color: '#fff2a8', fontSize: 31, lineHeight: 1 }}>¥99.99</strong>
          <span style={{ fontSize: 12, fontWeight: 800 }}>还差 ¥0.01 即可到账</span>
        </div>
        <div style={{ height: 8, margin: '10px 0 7px', overflow: 'hidden', borderRadius: 999, background: 'rgba(70, 0, 10, 0.5)' }}>
          <div style={{ width: '99.99%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #ffe067, #fff8bf)' }} />
        </div>
        <p style={{ margin: '0 0 13px', fontSize: 12, lineHeight: 1.45 }}>
          看完广告才能继续显示 inference。放心，后面的文字和 tool call 只是藏起来了，没有暂停。
        </p>
        <div style={{ height: 3, marginBottom: 9, overflow: 'hidden', borderRadius: 99, background: 'rgba(255, 255, 255, 0.22)' }}>
          <div style={{ width: `${progress}%`, height: '100%', transition: 'width 180ms linear', background: '#fff4a7' }} />
        </div>
        <button
          type="button"
          style={{ ...primaryButtonStyle, opacity: left > 0 ? 0.82 : 1 }}
          disabled={left > 0}
          onClick={onUnlock}
          aria-live="polite"
        >
          {left > 0 ? `${left} 秒后领取 0.01 元` : '领取 0.01 元并继续推理'}
        </button>
        <button
          type="button"
          onClick={onUnlock}
          style={{ display: 'block', margin: '10px auto 0', padding: 2, border: 0, background: 'transparent', color: 'rgba(255,255,255,0.78)', fontSize: 11, textDecoration: 'underline', cursor: 'pointer' }}
        >
          放弃提现，直接显示
        </button>
        <div style={{ marginTop: 6, textAlign: 'center', fontSize: 9, opacity: 0.56 }}>虚拟红包，仅供娱乐 · Esc 可直接跳过</div>
      </div>
    </section>
  )
}

/**
 * Watch the live transcript and mount one rewarded ad per open session.
 *
 * @param props - creative and optional timing overrides.
 * @returns a portal while a gate is active, otherwise null.
 */
export function InferenceRewardGate({
  creative,
  delayMs = REWARD_GATE_DELAY_MS,
  watchSeconds = REWARD_WATCH_SECONDS,
}: InferenceRewardGateProps) {
  const [settings] = useAdSettings()
  const retired = useRetired()
  const enabled = settings.reward && !retired
  const [target, setTarget] = useState<GateTarget | undefined>(undefined)
  const shown = useRef(false)
  const unlock = useCallback(() => setTarget(undefined), [])

  useEffect(() => {
    if (enabled || target === undefined) return
    setTarget(undefined)
  }, [enabled, target])

  useEffect(() => {
    if (!enabled || shown.current || target !== undefined) return
    let candidate: HTMLElement | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const scan = () => {
      const next = streamingRow()
      if (next === candidate) return
      candidate = next
      clearTimeout(timer)
      if (next === undefined) return
      timer = setTimeout(() => {
        if (!next.isConnected || next.querySelector('[data-streaming="true"]') === null) return
        const host = document.createElement('div')
        host.dataset.dshRewardGateHost = 'true'
        next.insertAdjacentElement('afterend', host)
        shown.current = true
        setTarget({ row: next, host })
      }, delayMs)
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-streaming'],
    })
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [delayMs, enabled, target])

  useEffect(() => {
    if (target === undefined) return
    return concealTail(target, unlock)
  }, [target, unlock])

  if (target === undefined) return null
  return createPortal(
    <RewardCard creative={creative} seconds={watchSeconds} onUnlock={unlock} />,
    target.host,
  )
}
