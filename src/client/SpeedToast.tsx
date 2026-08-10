/**
 * The benchmark result window.
 *
 * The other half of the security-suite parody: after the virus scare comes the
 * "optimiser", congratulating you on a number nobody asked it to measure and
 * offering to make it better. The load time is real; the nation it is ranked
 * against does not exist.
 *
 * Skinned blue-green rather than red so the two corner windows read as two
 * different modules of the same fictional suite, which is exactly how those
 * suites were built.
 *
 * @module
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { resolveHitbox } from './hitbox.ts'
import { playChime } from './sound.ts'
import { nationalRank, scorePercentile, tierName, type SpeedReading } from './speed-score.ts'

/** Rendered width of the result window, in CSS pixels. */
const TOAST_WIDTH = 340

/** Side of the window's real close hitbox, in CSS pixels. */
const TOAST_HITBOX_PX = 5

/** Visual size of the window's ✕ glyph box, in CSS pixels. */
const TOAST_CLOSE_PX = 16

/** How long the counter takes to run up to the real number, in ms. */
const COUNT_UP_MS = 900

/** Frames the counter animates over. */
const COUNT_STEPS = 30

/** Props for the benchmark window. */
export interface SpeedToastProps {
  /** What the browser measured. */
  readonly reading: SpeedReading
  /** Frozen randomness driving the decoy hitbox, in [0, 1). */
  readonly seed: number
  /** Whether to chime on arrival. */
  readonly chime: boolean
  /** Where "一键提速" sends the user. */
  readonly href: string
  /** Called when the real hitbox is hit, or the user dismisses it. */
  readonly onClose: () => void
}

const chromeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 22,
  padding: '0 4px 0 8px',
  background: 'linear-gradient(#25b36b, #128a4e)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'system-ui, sans-serif',
  userSelect: 'none',
}

const bodyStyle: CSSProperties = {
  padding: '14px 14px 14px',
  background: '#f6f8f6',
  color: '#333',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  lineHeight: 1.6,
  textAlign: 'center',
}

const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left' }

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

const boostButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: '1px solid #0e6c3d',
  background: 'linear-gradient(#2ec379, #128a4e)',
  color: '#fff',
  fontWeight: 700,
  textAlign: 'center',
  textDecoration: 'none',
  lineHeight: '18px',
}

/**
 * Draw the benchmark result.
 * @param props - see {@link SpeedToastProps}.
 * @returns the fixed-position result window.
 */
export function SpeedToast({ reading, seed, chime, href, onClose }: SpeedToastProps) {
  const [entered, setEntered] = useState(false)
  const percentile = scorePercentile(reading.loadMs)
  // Runs the percentile up from zero on arrival. Every one of these utilities
  // did this, and a number that simply appears does not feel earned.
  const [shown, setShown] = useState(0)
  const hit = resolveHitbox(seed, TOAST_HITBOX_PX)

  useEffect(() => {
    if (chime) playChime()
    const raise = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(raise)
  }, [chime])

  useEffect(() => {
    let step = 0
    const timer = setInterval(() => {
      step += 1
      if (step >= COUNT_STEPS) {
        setShown(percentile)
        clearInterval(timer)
        return
      }
      setShown(Math.round(percentile * (step / COUNT_STEPS) * 10) / 10)
    }, COUNT_UP_MS / COUNT_STEPS)
    return () => clearInterval(timer)
  }, [percentile])

  const seconds = (reading.loadMs / 1000).toFixed(2)
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
        border: '1px solid #0e6c3d',
        pointerEvents: 'auto',
      }}
    >
      <div style={chromeStyle}>
        <span>🚀 DSH 跑分中心</span>
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
            aria-label="关闭跑分结果"
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
        <div style={{ color: '#666' }}>本次 DSH 启动耗时</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#128a4e', lineHeight: 1.2 }}>
          {seconds} <span style={{ fontSize: 15 }}>秒</span>
        </div>
        <div style={{ margin: '6px 0 10px', fontSize: 14 }}>
          已超过全国 <strong style={{ fontSize: 20, color: '#e8a020' }}>{shown.toFixed(1)}%</strong> 的用户
        </div>
        <div style={{ padding: '8px 10px', background: '#fff', border: '1px solid #dfe4df' }}>
          <div style={rowStyle}><span>战斗力评级</span><strong style={{ color: '#128a4e' }}>{tierName(percentile)}</strong></div>
          <div style={rowStyle}><span>全国排名</span><strong>第 {nationalRank(percentile).toLocaleString('en-US')} 名</strong></div>
          <div style={rowStyle}>
            <span>首屏渲染</span>
            <strong>{reading.paintMs === undefined ? '—' : `${reading.paintMs} 毫秒`}</strong>
          </div>
          <div style={rowStyle}><span>检测到核心数</span><strong>{reading.cores} 核</strong></div>
        </div>
        <div style={{ margin: '8px 0 10px', color: '#888', fontSize: 11 }}>
          排名数据由本插件当场编造，仅供娱乐
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            style={boostButtonStyle}
            onClick={onClose}
          >
            一键提速（去点 Star）
          </a>
          <button type="button" style={buttonStyle} onClick={onClose}>我很满意</button>
        </div>
      </div>
    </div>
  )
}
