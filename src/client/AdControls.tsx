/**
 * The three honest controls: mute, solo, and the one button that really does
 * close everything.
 *
 * Shared by two hosts. Normally they live inside the poster's title bar, so
 * they cost no screen space of their own; when the poster is off-screen — the
 * minute after it is closed, or before it first appears — the layer falls back
 * to a small bar along the bottom edge. Either way they are always reachable,
 * which is the point: a mute button you cannot find is not a mute button.
 */

import type { CSSProperties } from 'react'

/** Props for the control cluster. */
export interface AdControlsProps {
  /** Whether pop-up sounds are currently suppressed. */
  readonly muted: boolean
  /** Toggle sound. */
  readonly onToggleMute: () => void
  /** Whether only the poster is being shown. */
  readonly solo: boolean
  /** Toggle solo mode. */
  readonly onToggleSolo: () => void
  /** Retire the layer for this page load. */
  readonly onNuke: () => void
}

const buttonStyle: CSSProperties = {
  padding: '2px 8px',
  border: '1px solid rgba(128, 128, 128, 0.5)',
  borderRadius: 3,
  background: 'rgba(240, 240, 240, 0.94)',
  color: '#444',
  fontSize: 11,
  fontFamily: 'system-ui, sans-serif',
  lineHeight: '16px',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

/**
 * Draw the three controls in a row.
 * @param props - see {@link AdControlsProps}.
 * @returns the button cluster.
 */
export function AdControls({ muted, onToggleMute, solo, onToggleSolo, onNuke }: AdControlsProps) {
  return (
    <>
      <button
        type="button"
        style={{ ...buttonStyle, padding: '2px 6px' }}
        aria-label={muted ? '取消静音' : '静音广告'}
        title={muted ? '取消静音' : '静音广告'}
        onClick={onToggleMute}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <button
        type="button"
        style={buttonStyle}
        title={solo ? '把其它广告放回来' : '只保留《贪玩蓝鲸》，其它全部关掉'}
        onClick={onToggleSolo}
      >
        {solo ? '恢复全部广告' : '只留蓝鲸'}
      </button>
      <button type="button" style={buttonStyle} onClick={onNuke}>关闭所有广告</button>
    </>
  )
}
