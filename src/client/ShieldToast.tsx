/**
 * The protected variant of the corner security alert, shown once the user's
 * star is verified.
 *
 * The deal the verify row offers is not "no more theatre" but "the theatre
 * switches sides": the same infection arrives on the same schedule, and the
 * suite now proudly reports it repelled. Everything predatory about the
 * alert is dropped here on purpose — the ✕ is full-size and honest, there is
 * no countdown, no escalation, no misfire — because this window is the
 * loyalty programme, and a loyalty programme that still traps its members
 * would give the whole joke away.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { playChime } from './sound.ts'

/** Rendered width of the report, in CSS pixels; matches the level-one alert. */
const SHIELD_WIDTH = 340

/** Side of the honest close target, in CSS pixels. */
const SHIELD_CLOSE_PX = 16

/** Props for the protection report. */
export interface ShieldToastProps {
  /** Whether to chime on arrival. */
  readonly chime: boolean
  /** Dismiss the report; every control here really does this. */
  readonly onClose: () => void
}

const chromeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 22,
  padding: '0 4px 0 8px',
  background: 'linear-gradient(#3fa564, #1d7a2f)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'system-ui, sans-serif',
  userSelect: 'none',
}

const bodyStyle: CSSProperties = {
  padding: '12px 14px 14px',
  background: '#f4f8f4',
  color: '#333',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  lineHeight: 1.6,
}

const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8 }

const okButtonStyle: CSSProperties = {
  width: '100%',
  marginTop: 10,
  padding: '7px 0',
  border: '1px solid #1d7a2f',
  borderRadius: 3,
  background: 'linear-gradient(#4cb872, #2b8c44)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'system-ui, sans-serif',
  cursor: 'pointer',
}

/**
 * Draw the protection report.
 * @param props - see {@link ShieldToastProps}.
 * @returns the fixed-position report window.
 */
export function ShieldToast({ chime, onClose }: ShieldToastProps) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (chime) playChime()
    const raise = setTimeout(() => setEntered(true), 16)
    return () => clearTimeout(raise)
  }, [chime])
  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        width: SHIELD_WIDTH,
        zIndex: 2_147_450_000,
        transform: entered ? 'none' : 'translateY(260px)',
        transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 2px 14px rgba(0, 0, 0, 0.45)',
        border: '1px solid #1d7a2f',
        pointerEvents: 'auto',
      }}
    >
      <div style={chromeStyle}>
        <span>🛡 DSH 安全中心 · Star 尊享版</span>
        <button
          type="button"
          aria-label="关闭防护通报"
          onClick={onClose}
          style={{
            width: SHIELD_CLOSE_PX,
            height: SHIELD_CLOSE_PX,
            padding: 0,
            border: 0,
            background: 'transparent',
            color: '#fff',
            fontSize: 12,
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      <div style={bodyStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1d7a2f' }}>已拦截 1 次高危攻击</div>
            <div style={{ color: '#666' }}>尊贵的 Star 用户，防护已自动生效</div>
          </div>
        </div>
        <div style={{ margin: '10px 0 8px', padding: '8px 10px', background: '#fff', border: '1px solid #d8e4d8' }}>
          <div style={rowStyle}>
            <span>病毒名</span>
            <strong>Gemini.Worm.Nano</strong>
          </div>
          <div style={rowStyle}>
            <span>攻击目标</span>
            <strong>您的会话</strong>
          </div>
          <div style={rowStyle}>
            <span>处理结果</span>
            <strong style={{ color: '#1d7a2f' }}>已自动清除，无需操作</strong>
          </div>
        </div>
        {/* A full green bar that never moves, same joke as the red one: the
            scan is "done" and the bar has nothing left to do but gloat. */}
        <div style={{ height: 8, background: '#e0eae0', border: '1px solid #c8d8c8' }}>
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(#4cb872, #1d7a2f)' }} />
        </div>
        <button type="button" style={okButtonStyle} onClick={onClose}>
          知道了
        </button>
      </div>
    </div>
  )
}
