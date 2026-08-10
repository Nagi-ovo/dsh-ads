/**
 * The three honest controls: mute, solo, and the one button that really does
 * close everything.
 *
 * Shared by two hosts in two shapes. Inside the poster's ⚙ they render as a
 * proper popover menu — one item per row, room for a label — because three
 * buttons crammed across a 300px title bar is unreadable. When the poster is
 * off-screen the layer falls back to a compact row along the bottom edge.
 * Either way they stay reachable, which is the point: a mute button you cannot
 * find is not a mute button.
 */

import { useState, type CSSProperties } from 'react'

/** How the cluster is laid out. */
export type ControlsLayout = 'menu' | 'row'

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

/** One row of the menu. */
interface Item {
  /** Leading glyph. */
  readonly icon: string
  /** Row label. */
  readonly label: string
  /** Row action. */
  readonly onClick: () => void
}

const rowButtonStyle: CSSProperties = {
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
 * Menu rows wear the poster's own chrome — gold on oxblood, square corners,
 * heavy type. A tasteful system menu hanging off a 火爆开服 title bar looked
 * like a different application had leaked into the ad.
 */
const menuItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '7px 11px',
  border: 0,
  borderTop: '1px solid rgba(201, 162, 39, 0.28)',
  background: 'transparent',
  color: '#ffd76a',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 700,
  lineHeight: '16px',
  whiteSpace: 'nowrap',
  textAlign: 'left',
  cursor: 'pointer',
}

/**
 * Draw the controls.
 * @param props - the control state and callbacks, plus the layout to use.
 * @returns the menu rows or the compact button row.
 */
export function AdControls(props: AdControlsProps & { readonly layout: ControlsLayout }) {
  const { muted, onToggleMute, solo, onToggleSolo, onNuke, layout } = props
  const [hovered, setHovered] = useState(-1)
  const items: readonly Item[] = [
    { icon: muted ? '🔇' : '🔊', label: muted ? '取消静音' : '静音广告', onClick: onToggleMute },
    { icon: '🐋', label: solo ? '恢复全部广告' : '只留蓝鲸', onClick: onToggleSolo },
    { icon: '🚫', label: '关闭所有广告', onClick: onNuke },
  ]
  if (layout === 'row') {
    return (
      <>
        {items.map((item) => (
          <button key={item.label} type="button" style={rowButtonStyle} onClick={item.onClick}>
            {item.icon} {item.label}
          </button>
        ))}
      </>
    )
  }
  return (
    <>
      {items.map((item, index) => (
        <button
          key={item.label}
          type="button"
          style={{
            ...menuItemStyle,
            // The first row sits straight under the panel's own border.
            borderTop: index === 0 ? 0 : menuItemStyle.borderTop,
            background: hovered === index ? 'rgba(201, 162, 39, 0.24)' : 'transparent',
            // The destructive one reads as destructive.
            color: index === items.length - 1 ? '#ff9a7a' : menuItemStyle.color,
          }}
          onMouseEnter={() => setHovered(index)}
          onMouseLeave={() => setHovered(-1)}
          onClick={item.onClick}
        >
          <span aria-hidden="true" style={{ width: 16 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </>
  )
}
