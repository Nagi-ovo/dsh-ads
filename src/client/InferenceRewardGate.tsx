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
import { hashString } from './stable-hash.ts'

/** How long a response must still be streaming before the gate appears. */
export const REWARD_GATE_DELAY_MS = 1_800

/** Total component progress needed to assemble the advertised model. */
export const REWARD_PROGRESS_TARGET = 100

/** Full-speed wheel animation duration. */
export const REWARD_SPIN_DURATION_MS = 2_600

/** Controls how often a conversation turn receives one draw. */
export interface RewardSchedule {
  /** Opening turns that never receive the disruptive placement. */
  readonly initialTurnsToSkip: number
  /** Stable per-turn chance after the opening turns, as an integer percent. */
  readonly appearancePercent: number
  /** Distance between offered draws, including the two offered turns. */
  readonly minimumTurnGap: number
  /** Distance that forces an offer after a run of unlucky eligibility rolls. */
  readonly pityTurnGap: number
}

/** Low-frequency schedule: no early interruption, no adjacent reward gates, no endless drought. */
export const DEFAULT_REWARD_SCHEDULE: RewardSchedule = {
  initialTurnsToSkip: 2,
  appearancePercent: 20,
  minimumTurnGap: 3,
  pityTurnGap: 8,
}

/** Fake unlock work shown one stage at a time. */
const V4_UNLOCK_STAGES = [
  '正式版资格匹配',
  'V4 Pro 权重下载',
  '超高速通道排队',
  '尊贵身份激活',
] as const

/** One wheel prize and the model-assembly progress it contributes. */
export interface WheelPrize {
  readonly label: string
  readonly progress: number
}

/** Model-themed prizes handed out by the God-of-Wealth whale. */
const WHEEL_PRIZES = [
  { label: '谢谢参与', progress: 0 },
  { label: '权重碎片', progress: 12 },
  { label: 'Attention Head', progress: 16 },
  { label: 'KV Cache', progress: 14 },
  { label: 'Transformer 层', progress: 20 },
  { label: 'MoE 专家', progress: 24 },
  { label: '1B 参数', progress: 18 },
  { label: 'V4 Pro', progress: REWARD_PROGRESS_TARGET },
] as const satisfies readonly WheelPrize[]

/** The grand prize is assembled from component prizes rather than drawn early. */
const COMPONENT_PRIZES: readonly WheelPrize[] = WHEEL_PRIZES.slice(0, -1)

/** One active gate and the DOM row whose tail it conceals. */
interface GateTarget {
  /** Streaming Assistant row visible when the countdown began. */
  readonly row: HTMLElement
  /** Flow sibling that hosts the React portal. */
  readonly host: HTMLDivElement
  /** Stable seed for the one draw owned by this Assistant turn. */
  readonly drawSeed: string
}

/** Props for the inference reward gate. */
export interface InferenceRewardGateProps {
  /** God-of-Wealth whale artwork; exact copy is rendered as HTML above it. */
  readonly creative: AdCreative
  /** Conversation identity used to make the random schedule stable across renders. */
  readonly sessionId: string
  /** Override for deterministic tests. */
  readonly delayMs?: number
  /** Override for deterministic tests. */
  readonly schedule?: RewardSchedule
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
  minHeight: 456,
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

/** Percentage for one sequential unlock stage. */
function stageProgress(progress: number, index: number): number {
  const stageSize = REWARD_PROGRESS_TARGET / V4_UNLOCK_STAGES.length
  const raw = ((progress - (index * stageSize)) / stageSize) * 100
  return Math.round(Math.max(0, Math.min(100, raw)))
}

/** Pick a stable model component, promoting a winning component to the grand prize. */
export function drawPrize(seed: string, progress: number): WheelPrize {
  const prize = COMPONENT_PRIZES[hashString(seed) % COMPONENT_PRIZES.length]
    ?? COMPONENT_PRIZES[0]
  if (prize === undefined) throw new Error('dsh-ads has no component prizes')
  if (prize.progress > 0 && progress + prize.progress >= REWARD_PROGRESS_TARGET) {
    return WHEEL_PRIZES[WHEEL_PRIZES.length - 1] as WheelPrize
  }
  return prize
}

/** Decide whether one observed turn receives a draw without re-rolling on renders. */
export function rewardTurnEligible(
  sessionId: string,
  rowKey: string,
  turnNumber: number,
  lastOfferedTurn: number,
  schedule: RewardSchedule = DEFAULT_REWARD_SCHEDULE,
): boolean {
  if (turnNumber <= schedule.initialTurnsToSkip) return false
  const gap = lastOfferedTurn === 0 ? turnNumber : turnNumber - lastOfferedTurn
  if (lastOfferedTurn > 0 && gap < schedule.minimumTurnGap) return false
  if (gap >= schedule.pityTurnGap) return true
  const chance = Math.max(0, Math.min(100, Math.trunc(schedule.appearancePercent)))
  return hashString(`${sessionId}:${rowKey}:reward-gate`) % 100 < chance
}

/** Props for the visible prize-wheel card. */
interface RewardCardProps {
  readonly creative: AdCreative
  readonly drawSeed: string
  readonly progress: number
  readonly onPrize: (prize: WheelPrize) => void
  readonly onUnlock: () => void
}

/** Prize waiting for the wheel's transform transition to finish. */
interface PendingDraw {
  readonly prize: WheelPrize
}

/**
 * Draw the deliberately excessive V4 prize-wheel creative.
 *
 * @param props - artwork, accumulated progress, this turn's seed, and reveal actions.
 * @returns the inline rewarded-ad card.
 */
function RewardCard({ creative, drawSeed, progress, onPrize, onUnlock }: RewardCardProps) {
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<WheelPrize | undefined>(undefined)
  const [pending, setPending] = useState<PendingDraw | undefined>(undefined)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onUnlock()
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [onUnlock])
  const unlocked = progress >= REWARD_PROGRESS_TARGET
  const spinning = pending !== undefined
  const drawn = result !== undefined
  const spin = () => {
    if (spinning || drawn || unlocked) return
    const prize = drawPrize(drawSeed, progress)
    const segment = WHEEL_PRIZES.findIndex((candidate) => candidate.label === prize.label)
    const nextRotation = (Math.ceil(rotation / 360) * 360) + 1_800 + ((360 - (segment * 45)) % 360)
    setPending({ prize })
    setRotation(nextRotation)
  }
  const settleSpin = () => {
    if (pending === undefined) return
    setResult(pending.prize)
    onPrize(pending.prize)
    setPending(undefined)
  }
  return (
    <section style={cardStyle} aria-label="V4 Pro 正式版限时解锁" data-dsh-reward-gate>
      <style>{`
        .dsh-reward-layout {
          display: grid;
          grid-template-columns: minmax(0, 460px) 230px;
          gap: 18px;
          align-items: center;
          justify-content: space-between;
          padding: 22px 20px 18px;
        }
        .dsh-prize-wheel {
          transition: transform ${REWARD_SPIN_DURATION_MS}ms cubic-bezier(.12,.68,.12,1);
          will-change: transform;
        }
        @keyframes dsh-unlock-shine {
          from { transform: translateX(-120%); }
          to { transform: translateX(320%); }
        }
        .dsh-wheel-button:active { transform: translate(-50%, -48%) scale(.97); }
        @media (max-width: 600px) {
          .dsh-reward-layout { grid-template-columns: 1fr; padding: 18px 16px 16px; }
          .dsh-wheel-panel { order: -1; }
          .dsh-prize-wheel-wrap { width: 206px !important; height: 206px !important; }
          .dsh-wheel-label { transform-origin: center 82px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dsh-prize-wheel { transition-duration: 1ms; }
          .dsh-progress-shine { display: none; }
        }
      `}</style>
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
          background: 'linear-gradient(90deg, rgba(116, 0, 19, 0.98) 0%, rgba(177, 0, 35, 0.92) 54%, rgba(116, 0, 19, 0.16) 76%, rgba(116, 0, 19, 0.06) 100%)',
        }}
      />
      <div className="dsh-reward-layout">
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: '#ffe99a' }}>
            DeepSeek V4 Pro 正式版 财神鲸专场
          </div>
          <h2 style={{ margin: '6px 0 0', maxWidth: 430, fontSize: 26, lineHeight: 1.12, textShadow: '0 2px 0 #8c001d' }}>
            转到 V4 Pro 正式版才算你赢
          </h2>
          <p style={{ margin: '7px 0 0', fontSize: 12, fontWeight: 700, color: '#fff2bd' }}>
            每轮对话只有 1 次机会，抽中模型组件才能涨进度
          </p>
          <div aria-live="polite" style={{ minHeight: 45, marginTop: 11, padding: '8px 11px', border: '1px solid rgba(255, 232, 134, 0.65)', borderRadius: 12, background: 'rgba(103, 0, 15, 0.62)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#ffd96a' }}>本轮结果</div>
            <strong data-dsh-draw-result style={{ display: 'block', marginTop: 2, fontSize: 15 }}>
              {spinning
                ? '财神鲸正在打捞模型组件…'
                : result === undefined
                  ? '本轮抽奖资格已到账'
                  : result.label === 'V4 Pro'
                    ? '抽中 V4 Pro 正式版'
                    : result.progress === 0
                      ? '谢谢参与，本轮进度一动不动'
                      : `抽中 ${result.label}，解锁进度 +${result.progress}%`}
            </strong>
          </div>
          <div style={{ marginTop: 11, padding: '10px 11px', borderRadius: 12, background: 'rgba(83, 0, 13, 0.56)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: 11, fontWeight: 900, color: '#fff1a9' }}>
              <span>V4 Pro 正式版解锁进度</span>
              <span data-dsh-reward-progress>{unlocked ? '全部完成' : `${progress}%`}</span>
            </div>
            <div style={{ display: 'grid', gap: 7 }}>
              {V4_UNLOCK_STAGES.map((label, index) => {
                const stage = stageProgress(progress, index)
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3, fontSize: 10 }}>
                      <span>{label}</span>
                      <strong>{stage === 100 ? '已完成' : stage === 0 ? '等待中' : `${stage}%`}</strong>
                    </div>
                    <div style={{ position: 'relative', height: 7, overflow: 'hidden', borderRadius: 999, background: 'rgba(39, 0, 7, 0.72)' }}>
                      <div
                        role="progressbar"
                        aria-label={label}
                        aria-valuenow={stage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        style={{ width: '100%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #ffb900, #fff6a5)', transform: `scaleX(${stage / 100})`, transformOrigin: 'left center', transition: 'transform 220ms ease-out' }}
                      />
                      {stage > 0 && stage < 100 && (
                        <span className="dsh-progress-shine" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '34%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent)', animation: 'dsh-unlock-shine 900ms linear infinite' }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {unlocked && (
            <div role="status" style={{ marginTop: 10, padding: '10px 11px', border: '1px solid #fff1a6', borderRadius: 12, background: 'linear-gradient(135deg, rgba(255,224,83,.98), rgba(255,171,25,.98))', boxShadow: '0 6px 22px rgba(72,0,8,.36)', color: '#951500', textAlign: 'center' }}>
              <strong style={{ display: 'block', marginBottom: 7, fontSize: 17 }}>您已解锁 V4 正式版</strong>
              <button type="button" style={primaryButtonStyle} onClick={onUnlock}>
                立即使用 DeepSeek V4 Pro
              </button>
            </div>
          )}
        </div>
        <div className="dsh-wheel-panel" style={{ textAlign: 'center' }}>
          <div className="dsh-prize-wheel-wrap" style={{ position: 'relative', width: 220, height: 220, margin: '0 auto' }}>
            <div aria-hidden="true" style={{ position: 'absolute', zIndex: 4, top: -7, left: '50%', width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '25px solid #fff2a8', filter: 'drop-shadow(0 2px 1px #8e1600)', transform: 'translateX(-50%)' }} />
            <div
              className="dsh-prize-wheel"
              data-dsh-prize-wheel
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget) settleSpin()
              }}
              style={{
                position: 'absolute', inset: 0, border: '8px solid #ffd252', borderRadius: '50%',
                background: 'conic-gradient(from -22.5deg, #ffe48a 0deg 45deg, #d92936 45deg 90deg, #ffe48a 90deg 135deg, #d92936 135deg 180deg, #ffe48a 180deg 225deg, #d92936 225deg 270deg, #ffe48a 270deg 315deg, #d92936 315deg 360deg)',
                boxShadow: 'inset 0 0 0 3px #9d120f, 0 8px 22px rgba(67,0,8,.38)',
                transform: `rotate(${rotation}deg)`,
              }}
            >
              {WHEEL_PRIZES.map((prize, index) => (
                <span
                  key={prize.label}
                  className="dsh-wheel-label"
                  style={{
                    position: 'absolute', top: 20, left: '50%', width: 58, marginLeft: -29,
                    color: index % 2 === 0 ? '#8f1400' : '#fff4bd', fontSize: 10, fontWeight: 950,
                    lineHeight: 1.08, textAlign: 'center', textShadow: index % 2 === 0 ? 'none' : '0 1px #8d0017',
                    transform: `rotate(${index * 45}deg)`, transformOrigin: 'center 82px',
                  }}
                >
                  {prize.label}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="dsh-wheel-button"
              data-dsh-spin-button
              onClick={spin}
              disabled={spinning || drawn || unlocked}
              aria-label={unlocked ? '已抽中 V4 Pro 正式版' : drawn ? '本轮抽奖资格已使用' : '使用本轮抽奖资格'}
              style={{
                position: 'absolute', zIndex: 3, top: '50%', left: '50%', width: 74, height: 74,
                border: '5px solid #ffd252', borderRadius: '50%', backgroundColor: '#ba001e',
                backgroundImage: `linear-gradient(180deg, transparent 38%, rgba(120,0,16,.88) 82%), url(${creative.src})`,
                backgroundSize: '74px 74px, 316px 190px', backgroundPosition: 'center, -190px -27px', backgroundRepeat: 'no-repeat',
                boxShadow: '0 4px 0 #b54a00, 0 7px 18px rgba(73,0,8,.36)', color: '#fff5b8', textShadow: '0 1px 2px #68000e',
                fontSize: 13, fontWeight: 950, lineHeight: 1.15, cursor: spinning || drawn || unlocked ? 'default' : 'pointer',
                transform: 'translate(-50%, -50%)', transition: 'transform 100ms ease, opacity 100ms ease',
                opacity: spinning || drawn || unlocked ? 0.76 : 1,
              }}
            >
              {unlocked ? '已中奖' : spinning ? '打捞中' : drawn ? <>本轮<br />已抽</> : <>鲸喜<br />抽奖</>}
            </button>
          </div>
          <div style={{ marginTop: 9, fontSize: 11, fontWeight: 900, color: '#fff0a1' }}>
            {drawn ? '本轮抽奖资格已使用' : '本轮剩余次数：1'}
          </div>
          <div style={{ marginTop: 4, fontSize: 10, opacity: 0.76 }}>
            {unlocked ? '财神鲸已抱着正式版上岸' : 'V4 Pro 正式版仍在深海奖池中'}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onUnlock}
        style={{ display: 'block', margin: '0 auto 5px', padding: 2, border: 0, background: 'transparent', color: 'rgba(255,255,255,0.78)', fontSize: 11, textDecoration: 'underline', cursor: 'pointer' }}
      >
        {drawn ? '继续对话' : '放弃本轮资格，继续对话'}
      </button>
      <div style={{ marginBottom: 9, textAlign: 'center', fontSize: 9, opacity: 0.56 }}>演示内容纯属虚构，按 Esc 退出</div>
    </section>
  )
}

/**
 * Watch the live transcript and occasionally offer one draw to an Assistant turn.
 *
 * @param props - creative and optional timing overrides.
 * @returns a portal while a gate is active, otherwise null.
 */
function SessionRewardGate({
  creative,
  sessionId,
  delayMs = REWARD_GATE_DELAY_MS,
  schedule = DEFAULT_REWARD_SCHEDULE,
}: InferenceRewardGateProps) {
  const [settings] = useAdSettings()
  const retired = useRetired()
  const enabled = settings.reward && !retired
  const [target, setTarget] = useState<GateTarget | undefined>(undefined)
  const [progress, setProgress] = useState(0)
  const evaluatedRows = useRef(new Set<string>())
  const turnNumber = useRef(0)
  const lastOfferedTurn = useRef(0)
  const unlock = useCallback(() => setTarget(undefined), [])
  const collectPrize = useCallback((prize: WheelPrize) => {
    setProgress((current) => prize.label === 'V4 Pro'
      ? REWARD_PROGRESS_TARGET
      : Math.min(REWARD_PROGRESS_TARGET, current + prize.progress))
  }, [])

  useEffect(() => {
    if (enabled || target === undefined) return
    setTarget(undefined)
  }, [enabled, target])

  useEffect(() => {
    if (!enabled || progress >= REWARD_PROGRESS_TARGET || target !== undefined) return
    let candidate: HTMLElement | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const scan = () => {
      const next = streamingRow()
      if (next === candidate) return
      candidate = next
      clearTimeout(timer)
      if (next === undefined) return
      const rowKey = next.dataset.chatFlowKey
      if (rowKey === undefined || evaluatedRows.current.has(rowKey)) return
      evaluatedRows.current.add(rowKey)
      turnNumber.current += 1
      const offeredTurn = turnNumber.current
      if (!rewardTurnEligible(sessionId, rowKey, offeredTurn, lastOfferedTurn.current, schedule)) return
      timer = setTimeout(() => {
        if (!next.isConnected || next.querySelector('[data-streaming="true"]') === null) return
        const host = document.createElement('div')
        host.dataset.dshRewardGateHost = 'true'
        next.insertAdjacentElement('afterend', host)
        lastOfferedTurn.current = offeredTurn
        setTarget({ row: next, host, drawSeed: `${sessionId}:${rowKey}` })
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
  }, [delayMs, enabled, progress, schedule, sessionId, target])

  useEffect(() => {
    if (target === undefined) return
    return concealTail(target, unlock)
  }, [target, unlock])

  if (target === undefined) return null
  return createPortal(
    <RewardCard
      creative={creative}
      drawSeed={target.drawSeed}
      progress={progress}
      onPrize={collectPrize}
      onUnlock={unlock}
    />,
    target.host,
  )
}

/**
 * Mount one independently keyed reward state machine for the active session.
 *
 * @param props - creative, session identity, and optional deterministic overrides.
 * @returns the active session's reward gate.
 */
export function InferenceRewardGate(props: InferenceRewardGateProps) {
  return <SessionRewardGate key={props.sessionId} {...props} />
}
