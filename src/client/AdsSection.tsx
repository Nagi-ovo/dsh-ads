/**
 * The plugin's page in the host's own settings dialog.
 *
 * The poster's ⚙ menu is part of the joke — a settings panel living inside an
 * advertisement — but it is a terrible place to *find* settings, and it
 * disappears entirely once you switch the poster off. This page is the real
 * home: it sits in the settings nav beside 通用设置 and 模型, and it writes the
 * same stored object, so the two stay in step through the persistence layer's
 * same-document broadcast.
 *
 * Styled with inline rules rather than the shell's CSS modules, whose class
 * names are per-build hashes and not importable from outside. Every colour is
 * either inherited or a neutral alpha, so the page follows the host's light
 * and dark themes without knowing which one is on.
 *
 * @module
 */

import type { CSSProperties } from 'react'
import { PLACEMENTS, useAdSettings, type AdSettings } from './settings.ts'

/** What each switch actually turns off, in the user's terms. */
const BLURBS: Readonly<Record<string, string>> = {
  gutter: '正文左右两侧的广告栏',
  feed: '对话里每隔几轮插入的插件推荐，是唯一能点进仓库的广告',
  popup: '右下角滑出的图片弹窗',
  speed: '启动时报告本次加载耗时，并给你一个编造的全国排名',
  scare: '假的病毒告警，点「暂不处理」会变本加厉',
  poster: '左下角的游戏海报，可以拖动和折叠',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  padding: '14px 0',
  borderTop: '1px solid rgba(128, 128, 128, 0.22)',
}

const labelStyle: CSSProperties = { fontSize: 15, lineHeight: 1.4 }

const blurbStyle: CSSProperties = { fontSize: 13, lineHeight: 1.5, opacity: 0.55, marginTop: 2 }

/** Props for one switch. */
interface ToggleProps {
  /** Whether it is on. */
  readonly on: boolean
  /** Accessible name. */
  readonly label: string
  /** Flip it. */
  readonly onToggle: () => void
}

/**
 * A pill switch.
 * @param props - see {@link ToggleProps}.
 * @returns the switch button.
 */
function Toggle({ on, label, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      style={{
        flex: '0 0 auto',
        position: 'relative',
        width: 44,
        height: 26,
        padding: 0,
        border: 0,
        borderRadius: 13,
        background: on ? '#2f6fed' : 'rgba(128, 128, 128, 0.35)',
        transition: 'background 160ms ease',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
          transition: 'left 160ms ease',
        }}
      />
    </button>
  )
}

/**
 * Draw the settings page.
 * @returns the section content column.
 */
export function AdsSection() {
  const [settings, setSettings] = useAdSettings()
  const set = (patch: Partial<AdSettings>) => setSettings({ ...settings, ...patch })
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...blurbStyle, marginBottom: 6, opacity: 0.6 }}>
        选择哪些广告位继续出现。这里的选择会记住，下次启动依然生效。
      </div>
      {PLACEMENTS.map((row) => (
        <div key={row.key} style={rowStyle}>
          <div>
            <div style={labelStyle}>{row.icon} {row.label}</div>
            <div style={blurbStyle}>{BLURBS[row.key]}</div>
          </div>
          <Toggle
            on={settings[row.key]}
            label={row.label}
            onToggle={() => set({ [row.key]: !settings[row.key] })}
          />
        </div>
      ))}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>🔊 提示音</div>
          <div style={blurbStyle}>弹窗和海报出现时的「叮」一声，由 Web Audio 现场合成</div>
        </div>
        <Toggle
          on={!settings.muted}
          label="提示音"
          onToggle={() => set({ muted: !settings.muted })}
        />
      </div>
      <div style={{ ...blurbStyle, marginTop: 18 }}>
        全部关掉这个插件就没有任何显示了，但它还装着 —— 想彻底移除请卸载插件本身。
      </div>
    </div>
  )
}
