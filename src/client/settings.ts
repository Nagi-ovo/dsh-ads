/**
 * Which placements are switched on, and remembered between sessions.
 *
 * The layer used to have one persistent choice — "keep only the poster" — and
 * that turned out to be the special case of a more useful thing: some people
 * want the benchmark window and the whale poster and nothing else, some want
 * the in-transcript feed but a clean margin. So every placement gets its own
 * switch, and solo mode becomes a shortcut that flips the rest off.
 *
 * "关闭所有广告" is deliberately *not* stored here. It means "not this time",
 * and a persisted version of it would turn one stray click into an uninstall
 * nobody could undo without knowing where the storage key lives.
 *
 * @module
 */

import { usePersisted } from './persist.ts'

/** Every switchable placement. */
export interface AdSettings {
  /** Banner columns either side of the reading column. */
  readonly gutter: boolean
  /** Ads inside the transcript, between turns. */
  readonly feed: boolean
  /** Rewarded ad that temporarily conceals the live transcript tail. */
  readonly reward: boolean
  /** The bottom-right image pop-up. */
  readonly popup: boolean
  /** The startup benchmark window. */
  readonly speed: boolean
  /** The fake security alert. */
  readonly scare: boolean
  /** The bottom-left game poster. */
  readonly poster: boolean
  /** Whether arrival sounds are suppressed. */
  readonly muted: boolean
}

/** Everything on, sound on: the plugin is a joke about excess. */
export const DEFAULT_SETTINGS: AdSettings = {
  gutter: true,
  feed: true,
  reward: true,
  popup: true,
  speed: true,
  scare: true,
  poster: true,
  muted: false,
}

/** A placement as the settings menu presents it. */
export interface PlacementRow {
  /** Which switch it drives. */
  readonly key: Exclude<keyof AdSettings, 'muted'>
  /**
   * Leading glyph for the in-ad menu only.
   *
   * The host's settings page uses the shell's own `ic_ds_*` icons instead, so
   * that it looks like the rest of the dialog; emoji stay where the surrounding
   * chrome is already a 2005 advertisement and they are in keeping.
   */
  readonly icon: string
  /** Menu label. */
  readonly label: string
}

/** The menu, in the order the placements appear on screen. */
export const PLACEMENTS: readonly PlacementRow[] = [
  { key: 'gutter', icon: '🧱', label: '两侧广告栏' },
  { key: 'feed', icon: '📰', label: '对话里的推荐' },
  { key: 'reward', icon: '🪙', label: '推理激励广告' },
  { key: 'popup', icon: '🔔', label: '右下角弹窗' },
  { key: 'speed', icon: '🚀', label: '跑分中心' },
  { key: 'scare', icon: '☣️', label: '安全中心' },
  { key: 'poster', icon: '🐋', label: '贪玩蓝鲸' },
]

/** Storage key holding {@link AdSettings}. */
const SETTINGS_KEY = 'settings'

/**
 * Whether only the whale poster is switched on.
 * @param settings - current settings.
 * @returns true when the poster is the only live placement.
 */
export function isSolo(settings: AdSettings): boolean {
  return settings.poster && PLACEMENTS.every((row) => row.key === 'poster' || !settings[row.key])
}

/**
 * Turn everything except the whale poster off, or put it all back.
 * @param settings - current settings.
 * @returns the toggled settings.
 */
export function toggleSolo(settings: AdSettings): AdSettings {
  if (isSolo(settings)) return { ...settings, ...DEFAULT_SETTINGS, muted: settings.muted }
  const off = Object.fromEntries(PLACEMENTS.map((row) => [row.key, false]))
  return { ...settings, ...off, poster: true } as AdSettings
}

/**
 * Read and write the stored settings.
 *
 * Missing keys fall back to their default, so a stored object written before a
 * placement existed still loads — the alternative is a user whose settings
 * silently reset the first time the plugin grows a new window.
 *
 * @returns the settings and a setter, same shape as `useState`.
 */
export function useAdSettings(): [AdSettings, (next: AdSettings) => void] {
  const [stored, store] = usePersisted<Partial<AdSettings>>(SETTINGS_KEY, DEFAULT_SETTINGS)
  return [{ ...DEFAULT_SETTINGS, ...stored }, store]
}
