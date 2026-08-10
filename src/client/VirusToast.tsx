/**
 * The fake security alert.
 *
 * The one piece of inventory here that is not an image, because its whole joke
 * is a countdown that has to actually tick — and then, at zero, fail and start
 * over. Nothing is ever cleaned up, nothing is ever at risk, and the "high-risk
 * item" it has detected is that you have not starred the repository.
 *
 * It is written to be unmistakable as a parody: the threat is named in plain
 * language, the remedy is a link to a GitHub page, and nothing on it asks for
 * anything. A scare popup that could be mistaken for a real one would not be
 * funny, it would be the thing it is making fun of.
 *
 * @module
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { resolveHitbox } from './hitbox.ts'
import { playChime } from './sound.ts'

/** Rendered width of the alert window, in CSS pixels. */
const TOAST_WIDTH = 340

/** Side of the alert's real close hitbox, in CSS pixels. */
const TOAST_HITBOX_PX = 5

/** Visual size of the alert's ✕ glyph box, in CSS pixels. */
const TOAST_CLOSE_PX = 16

/** Seconds the countdown starts from, and returns to when it fails. */
export const SCARE_SECONDS = 30

/** How long the failure notice shows before the countdown restarts, in ms. */
const FAILURE_MS = 1600

/** Props for the fake security alert. */
export interface VirusToastProps {
  /** Frozen randomness driving the decoy hitbox, in [0, 1). */
  readonly seed: number
  /** Whether to chime on arrival. */
  readonly chime: boolean
  /** Where "立即修复" sends the user. */
  readonly href: string
  /** Called when the real hitbox is hit, or the user declines. */
  readonly onClose: () => void
}

const chromeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 22,
  padding: '0 4px 0 8px',
  background: 'linear-gradient(#e03a2f, #a81d15)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'system-ui, sans-serif',
  userSelect: 'none',
}

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
  const [left, setLeft] = useState(SCARE_SECONDS)
  const [failed, setFailed] = useState(false)
  const hit = resolveHitbox(seed, TOAST_HITBOX_PX)

  useEffect(() => {
    if (chime) playChime()
    const raise = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(raise)
  }, [chime])

  // The countdown reaching zero is the punchline, so it must resolve to
  // nothing: the cleanup "fails", the notice shows for a moment, and the timer
  // goes back to the top. This runs until the user closes the window.
  useEffect(() => {
    if (failed) {
      const restart = setTimeout(() => {
        setFailed(false)
        setLeft(SCARE_SECONDS)
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
  }, [failed])

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        width: TOAST_WIDTH,
        zIndex: 2_147_450_000,
        transform: entered ? 'none' : 'translateY(260px)',
        transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 2px 14px rgba(0, 0, 0, 0.45)',
        border: '1px solid #8c1a12',
        pointerEvents: 'auto',
      }}
    >
      <div style={chromeStyle}>
        <span>⚠ DSH 安全中心</span>
        <span style={{ position: 'relative', width: TOAST_CLOSE_PX, height: TOAST_CLOSE_PX }}>
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
            <div style={{ fontSize: 14, fontWeight: 700, color: '#b8231a' }}>发现 1 个高危风险项</div>
            <div style={{ color: '#666' }}>已扫描 47,219 个文件，耗时 0.3 秒</div>
          </div>
        </div>
        <div style={{ margin: '10px 0 8px', padding: '8px 10px', background: '#fff', border: '1px solid #e0ddd6' }}>
          <div style={rowStyle}><span>风险项</span><strong>未对本插件点 Star</strong></div>
          <div style={rowStyle}><span>危险等级</span><strong style={{ color: '#b8231a' }}>极高</strong></div>
          <div style={rowStyle}><span>感染范围</span><strong>本机全部会话</strong></div>
        </div>
        {/* A full red bar that never moves: the scan is "done", the problem is
            you, and there is nothing left for a progress bar to do. */}
        <div style={{ height: 8, background: '#e6e3dc', border: '1px solid #d2cec5' }}>
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(#f0574a, #b8231a)' }} />
        </div>
        <div style={{ margin: '8px 0 10px', textAlign: 'center', color: failed ? '#b8231a' : '#555' }}>
          {failed
            ? '清除失败，正在重新计时…'
            : <>距离自动清除还剩 <strong style={{ fontSize: 15, color: '#b8231a' }}>{left}</strong> 秒</>}
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
          <button type="button" style={buttonStyle} onClick={onClose}>暂不处理</button>
        </div>
      </div>
    </div>
  )
}
