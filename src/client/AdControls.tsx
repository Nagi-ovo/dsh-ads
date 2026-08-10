/**
 * The settings menu inside the poster.
 *
 * The joke version: a real control panel living inside an advertisement, in
 * the poster's own oxblood-and-gold chrome. The findable version is the page
 * this plugin contributes to the host's settings dialog — see
 * [AdsSection.tsx](./AdsSection.tsx). Both write the same stored object, and
 * nothing of this plugin's own floats over the transcript any more.
 *
 * @module
 */

import { useState, type CSSProperties } from 'react'
import { PLACEMENTS, isSolo, toggleSolo, type AdSettings } from './settings.ts'

/** Props shared by the menu and the bar. */
export interface AdControlsProps {
  /** Current settings. */
  readonly settings: AdSettings
  /** Replace the settings. */
  readonly onChange: (next: AdSettings) => void
  /** Retire the layer for this page load. */
  readonly onNuke: () => void
}

const panelStyle: CSSProperties = {
  minWidth: 186,
  display: 'flex',
  flexDirection: 'column',
  // Same oxblood and gold as the poster's title bar, and square like its frame.
  background: 'linear-gradient(#6b1414, #3d0a0a)',
  border: '2px solid #c9a227',
  overflow: 'hidden',
}

const itemStyle: CSSProperties = {
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

const headingStyle: CSSProperties = {
  padding: '5px 11px 3px',
  color: 'rgba(255, 215, 106, 0.6)',
  fontSize: 10,
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 700,
  letterSpacing: 1,
  userSelect: 'none',
}

/** One row of the menu. */
interface Item {
  /** Leading glyph, or the checkbox state for a placement switch. */
  readonly icon: string
  /** Row label. */
  readonly label: string
  /** Row action. */
  readonly onClick: () => void
  /** Whether the row reads as destructive. */
  readonly danger?: boolean
}

/**
 * Draw the settings menu.
 *
 * @param props - see {@link AdControlsProps}; `onPick` fires after any row is
 * chosen, so a host popover can close itself.
 * @returns the panel.
 */
export function AdSettingsMenu({ settings, onChange, onNuke, onPick }: AdControlsProps & { readonly onPick?: () => void }) {
  const [hovered, setHovered] = useState('')
  const switches: readonly Item[] = PLACEMENTS.map((row) => ({
    icon: settings[row.key] ? '☑' : '☐',
    label: `${row.icon} ${row.label}`,
    onClick: () => onChange({ ...settings, [row.key]: !settings[row.key] }),
  }))
  const extras: readonly Item[] = [
    {
      icon: settings.muted ? '🔇' : '🔊',
      label: settings.muted ? '取消静音' : '静音广告',
      onClick: () => onChange({ ...settings, muted: !settings.muted }),
    },
    {
      icon: '🐋',
      label: isSolo(settings) ? '恢复全部广告' : '只留蓝鲸',
      onClick: () => onChange(toggleSolo(settings)),
    },
    { icon: '🚫', label: '关闭所有广告', onClick: onNuke, danger: true },
  ]
  const render = (item: Item, first: boolean) => (
    <button
      key={item.label}
      type="button"
      style={{
        ...itemStyle,
        borderTop: first ? 0 : itemStyle.borderTop,
        background: hovered === item.label ? 'rgba(201, 162, 39, 0.24)' : 'transparent',
        color: item.danger === true ? '#ff9a7a' : itemStyle.color,
      }}
      onMouseEnter={() => setHovered(item.label)}
      onMouseLeave={() => setHovered('')}
      onClick={() => {
        item.onClick()
        onPick?.()
      }}
    >
      <span aria-hidden="true" style={{ width: 14 }}>{item.icon}</span>
      {item.label}
    </button>
  )
  return (
    <div style={panelStyle}>
      {/* The placement switches persist; everything under them does not, so
          they are visually separated rather than mixed into one list. */}
      <div style={headingStyle}>显示哪些广告（会记住）</div>
      {switches.map((item) => render(item, false))}
      <div style={{ ...headingStyle, borderTop: '1px solid rgba(201, 162, 39, 0.4)', marginTop: 2 }}>本次会话</div>
      {extras.map((item) => render(item, false))}
    </div>
  )
}
