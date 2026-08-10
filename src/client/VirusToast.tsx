/**
 * The fake security alert.
 *
 * The one piece of inventory here that is not an image, because two of its
 * jokes have to actually run: a countdown that ticks down and then *fails* and
 * starts over, and a "not now" button that does the opposite of what it says.
 *
 * Declining escalates. That is the whole gag — the 2000s corner alert never
 * accepted no for an answer — so the second level is louder, shakier, faster,
 * and quietly drops the decline button altogether. The honest exits survive at
 * every level: "关闭所有广告" still ends the layer, and the real (tiny) close
 * hitbox is still there for anyone who can find it.
 *
 * The threat is nonsense on its face — a rival model as a virus, symptoms made
 * of writing tics — so nothing here can be mistaken for a real warning. An
 * alert that read as genuine would not be a joke about scareware, it would be
 * scareware.
 *
 * @module
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { resolveHitbox } from './hitbox.ts'
import { playChime } from './sound.ts'

/** Side of the alert's real close hitbox, in CSS pixels. */
const TOAST_HITBOX_PX = 5

/** Visual size of the alert's ✕ glyph box, in CSS pixels. */
const TOAST_CLOSE_PX = 16

/** How long the failure notice shows before the countdown restarts, in ms. */
const FAILURE_MS = 1600

/** How loud the alert currently is. */
interface Level {
  /** Rendered width, in CSS pixels. */
  readonly width: number
  /** Title-bar text. */
  readonly title: string
  /** Headline above the detail table. */
  readonly headline: string
  /** Grey line under the headline. */
  readonly subhead: string
  /** Detail rows, label then value. */
  readonly rows: readonly (readonly [string, string])[]
  /** Seconds the countdown starts from. */
  readonly seconds: number
  /** What the countdown is counting down to. */
  readonly countdownLabel: string
  /** Whether the window shakes. */
  readonly shake: boolean
  /** Whether the decline button is still offered. */
  readonly decline: boolean
}

/**
 * The escalation ladder.
 *
 * Two rungs, not more: a third would stop being a punchline and start being a
 * hostage situation, and the plugin's one rule is that the user can always
 * actually leave.
 */
export const LEVELS: readonly Level[] = [
  {
    width: 340,
    title: '⚠ DSH 安全中心',
    headline: '发现 1 个高危感染',
    subhead: '已扫描 47,219 个权重分片，耗时 0.3 秒',
    rows: [
      ['病毒名', 'Gemini.Worm.Nano'],
      ['感染对象', 'DeepSeek-V4 模型权重'],
      ['主要危害', '幻觉率飙升'],
      ['危险等级', '极高'],
    ],
    seconds: 30,
    countdownLabel: '距离你的模型开始编 API 还剩',
    shake: false,
    decline: true,
  },
  {
    width: 400,
    title: '⚠⚠⚠ 紧急：幻觉正在扩散 ⚠⚠⚠',
    headline: '感染已扩散至全部会话',
    subhead: '你刚才点了「暂不处理」，幻觉率还在涨',
    rows: [
      ['当前症状', '开始编不存在的 API'],
      ['当前症状', '编错了还特别自信'],
      ['当前症状', '让它改 A，它去改了 B'],
      ['当前症状', '删完你的代码说声抱歉'],
      ['实时幻觉率', '87% ↑'],
    ],
    seconds: 10,
    countdownLabel: '距离幻觉率突破 99% 还剩',
    shake: true,
    decline: false,
  },
]

/** Props for the fake security alert. */
export interface VirusToastProps {
  /** Frozen randomness driving the decoy hitbox, in [0, 1). */
  readonly seed: number
  /** Whether to chime on arrival. */
  readonly chime: boolean
  /** Where "立即修复" sends the user. */
  readonly href: string
  /** Called when the real hitbox is hit, or the user finally "fixes" it. */
  readonly onClose: () => void
}

/** Keyframes for the escalated level; inline styles cannot declare these. */
const SHAKE_CSS = `
@keyframes dsh-ads-shake {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(-3px, 1px) rotate(-0.4deg); }
  40% { transform: translate(3px, -1px) rotate(0.4deg); }
  60% { transform: translate(-2px, -1px) rotate(-0.3deg); }
  80% { transform: translate(2px, 1px) rotate(0.3deg); }
}
@keyframes dsh-ads-alarm {
  0%, 100% { border-color: #8c1a12; }
  50% { border-color: #ffd400; }
}
`

const bodyStyle: CSSProperties = {
  padding: '12px 14px 14px',
  background: '#f6f6f4',
  color: '#333',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  lineHeight: 1.6,
}

const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8 }

const buttonStyle: CSSProperties = {
  flex: 1,
  padding: '7px 0',
  border: '1px solid #b9b9b4',
  borderRadius: 3,
  background: 'linear-gradient(#fff, #e8e8e4)',
  color: '#444',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  cursor: 'pointer',
}

/** The one the layout wants you to press. */
const fixButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: '1px solid #8c1a12',
  background: 'linear-gradient(#e8483c, #b8231a)',
  color: '#fff',
  fontWeight: 700,
  textAlign: 'center',
  textDecoration: 'none',
  lineHeight: '18px',
}

/**
 * Draw the alert.
 * @param props - see {@link VirusToastProps}.
 * @returns the fixed-position alert window.
 */
export function VirusToast({ seed, chime, href, onClose }: VirusToastProps) {
  const [entered, setEntered] = useState(false)
  const [rung, setRung] = useState(0)
  const level = LEVELS[Math.min(rung, LEVELS.length - 1)] as Level
  const [left, setLeft] = useState(level.seconds)
  const [failed, setFailed] = useState(false)
  const hit = resolveHitbox(seed, TOAST_HITBOX_PX)

  useEffect(() => {
    if (chime) playChime()
    const raise = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(raise)
  }, [chime])

  // Escalating restarts the clock at the new level's much shorter limit.
  useEffect(() => {
    setFailed(false)
    setLeft(level.seconds)
  }, [level.seconds])

  // The countdown reaching zero is the punchline, so it must resolve to
  // nothing: the cleanup "fails", the notice shows for a moment, and the timer
  // goes back to the top. This runs until the user closes the window.
  useEffect(() => {
    if (failed) {
      const restart = setTimeout(() => {
        setFailed(false)
        setLeft(level.seconds)
      }, FAILURE_MS)
      return () => clearTimeout(restart)
    }
    const tick = setInterval(() => {
      setLeft((seconds) => {
        if (seconds > 1) return seconds - 1
        setFailed(true)
        return 0
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [failed, level.seconds])

  const chromeStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 22,
    padding: '0 4px 0 8px',
    background: 'linear-gradient(#e03a2f, #a81d15)',
    color: '#fff',
    fontSize: level.shake ? 11 : 12,
    fontWeight: 700,
    fontFamily: 'system-ui, sans-serif',
    userSelect: 'none',
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        width: level.width,
        zIndex: 2_147_450_000,
        boxShadow: '0 2px 14px rgba(0, 0, 0, 0.45)',
        border: level.shake ? '3px solid #8c1a12' : '1px solid #8c1a12',
        pointerEvents: 'auto',
        // Entrance and escalation are different animations on the same box, so
        // only one of them can own `transform` at a time: the slide-in wins
        // until it has finished, then the shake takes over.
        ...(entered
          ? level.shake
            ? { animation: 'dsh-ads-shake 0.42s infinite, dsh-ads-alarm 0.6s infinite' }
            : {}
          : { transform: 'translateY(260px)', transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)' }),
      }}
    >
      <style>{SHAKE_CSS}</style>
      <div style={chromeStyle}>
        <span>{level.title}</span>
        <span style={{ position: 'relative', width: TOAST_CLOSE_PX, height: TOAST_CLOSE_PX, flex: '0 0 auto' }}>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ✕
          </span>
          <button
            type="button"
            aria-label="关闭安全提示"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: hit.top,
              right: TOAST_CLOSE_PX - hit.size - hit.left,
              width: hit.size,
              height: hit.size,
              padding: 0,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
            }}
          />
        </span>
      </div>
      <div style={bodyStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1 }}>☣️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#b8231a' }}>{level.headline}</div>
            <div style={{ color: '#666' }}>{level.subhead}</div>
          </div>
        </div>
        <div style={{ margin: '10px 0 8px', padding: '8px 10px', background: '#fff', border: '1px solid #e0ddd6' }}>
          {level.rows.map(([label, value], index) => (
            <div key={`${label}-${index}`} style={rowStyle}>
              <span>{label}</span>
              <strong style={{ color: index === level.rows.length - 1 ? '#b8231a' : undefined }}>{value}</strong>
            </div>
          ))}
        </div>
        {/* A full red bar that never moves: the scan is "done", the problem is
            you, and there is nothing left for a progress bar to do. */}
        <div style={{ height: 8, background: '#e6e3dc', border: '1px solid #d2cec5' }}>
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(#f0574a, #b8231a)' }} />
        </div>
        <div style={{ margin: '8px 0 10px', textAlign: 'center', color: failed ? '#b8231a' : '#555' }}>
          {failed
            ? '清除失败，正在重新计时…'
            : <>{level.countdownLabel} <strong style={{ fontSize: 15, color: '#b8231a' }}>{left}</strong> 秒</>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            style={fixButtonStyle}
            onClick={onClose}
          >
            立即修复（去点 Star）
          </a>
          {level.decline && (
            <button type="button" style={buttonStyle} onClick={() => setRung((current) => current + 1)}>
              暂不处理
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
