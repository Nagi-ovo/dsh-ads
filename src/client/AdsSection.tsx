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

import type { CSSProperties, ReactNode } from 'react'
import {
  IconDataOutline16,
  IconNewChatOutline16,
  IconPanelLeftOutline16,
  IconPlayOutline16,
  IconRightUpOutline16,
  IconWarningOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { PLACEMENTS, useAdSettings, type AdSettings } from './settings.ts'

/**
 * The shell's own `ic_ds_*` glyphs, one per row.
 *
 * Not the emoji the in-ad menu uses: this page sits between two first-party
 * ones, and emoji next to the host's line icons is the single detail that made
 * it read as bolted on.
 */
const ICONS: Readonly<Record<string, ReactNode>> = {
  gutter: <IconPanelLeftOutline16 />,
  feed: <IconNewChatOutline16 />,
  popup: <IconRightUpOutline16 />,
  speed: <IconDataOutline16 />,
  scare: <IconWarningOutline16 />,
  poster: <IconPlayOutline16 />,
}

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

const labelStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, lineHeight: 1.4 }

/** Icons inherit the row's colour but sit a shade quieter than the label. */
const iconStyle: CSSProperties = { display: 'flex', flex: '0 0 auto', opacity: 0.75 }

const blurbStyle: CSSProperties = { fontSize: 13, lineHeight: 1.5, opacity: 0.55, marginTop: 2 }

/** Where the "who made this" line points. */
const REPO_URL = 'https://github.com/dsh-external/dsh-ads'

const sourceStyle: CSSProperties = {
  marginBottom: 14,
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(128, 128, 128, 0.12)',
  fontSize: 13,
  lineHeight: 1.6,
  opacity: 0.8,
}

const linkStyle: CSSProperties = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }

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
      {/* Provenance first. The page borrows the host's settings chrome, so it
          has to say plainly whose settings these are before anything else. */}
      <div style={sourceStyle}>
        <div>
          本页由社区插件{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener" style={linkStyle}>
            @dsh-external/dsh-ads
          </a>{' '}
          提供，非 DeepSeek 官方功能。
        </div>
        <div style={{ marginTop: 2 }}>广告内容纯属娱乐，均为虚构。</div>
      </div>
      <div style={{ ...blurbStyle, marginBottom: 6, opacity: 0.6 }}>
        选择哪些广告位继续出现。这里的选择会记住，下次启动依然生效。
      </div>
      {PLACEMENTS.map((row) => (
        <div key={row.key} style={rowStyle}>
          <div>
            <div style={labelStyle}>
              <span style={iconStyle} aria-hidden="true">{ICONS[row.key]}</span>
              {row.label}
            </div>
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
          {/* No glyph: the set has no speaker, and reusing a placement's icon
              here would say these rows are the same kind of thing. The gap
              reads as the separation it actually is. */}
          <div style={labelStyle}>提示音</div>
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
