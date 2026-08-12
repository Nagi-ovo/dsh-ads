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
 * The one real cure: the 验证修复 row. It asks the host first, which answers
 * through its own GitHub login (`gh` or a token) and needs no typed id; a
 * host without credentials falls back to anonymously walking the public
 * stargazer list for the id in the field. A hit reports 修复成功 with an
 * honestly-sized button and permanently flips this browser's corner alert to
 * the protection report ([ShieldToast](./ShieldToast.tsx)); a miss changes
 * nothing — no escalation, the failure path stays exactly as annoying as
 * before, never more.
 *
 * @module
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { resolveHitbox } from './hitbox.ts'
import { playChime } from './sound.ts'
import { checkHostStar, checkStarred } from './star-check.ts'
import type { AdLocale } from './types.ts'

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
    title: '⚠⚠⚠ 紧急：Gemini 正在扩散 ⚠⚠⚠',
    headline: 'Gemini 感染已扩散至全部会话',
    subhead: '你刚才点了「暂不处理」，幻觉率还在涨',
    rows: [
      // The virus name is repeated here on purpose: the escalated window is
      // the one people actually read, and "感染已扩散" alone never said what
      // had spread.
      ['病毒名', 'Gemini.Worm.Nano'],
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

/** English scareware copy with the same escalation timings and dimensions. */
const EN_LEVELS: readonly Level[] = [
  {
    width: 340,
    title: '⚠ DSH SECURITY CENTER',
    headline: '1 CRITICAL INFECTION FOUND',
    subhead: 'Scanned 47,219 weight shards in 0.3 seconds',
    rows: [
      ['THREAT', 'Gemini.Worm.Nano'],
      ['INFECTED', 'DeepSeek-V4 model weights'],
      ['DAMAGE', 'Hallucinations increased'],
      ['RISK LEVEL', 'EXTREME'],
    ],
    seconds: 30,
    countdownLabel: 'Your model will invent an API in',
    shake: false,
    decline: true,
  },
  {
    width: 400,
    title: '⚠⚠⚠ CRITICAL: GEMINI IS SPREADING ⚠⚠⚠',
    headline: 'GEMINI HAS INFECTED EVERY SESSION',
    subhead: 'You clicked “Not now.” Hallucinations are still rising.',
    rows: [
      ['THREAT', 'Gemini.Worm.Nano'],
      ['SYMPTOM', 'Inventing APIs that do not exist'],
      ['SYMPTOM', 'Confidently defending the wrong answer'],
      ['SYMPTOM', 'Asked to edit A, changed B'],
      ['SYMPTOM', 'Deleted your code, then apologized'],
      ['LIVE HALLUCINATION RATE', '87% ↑'],
    ],
    seconds: 10,
    countdownLabel: 'Hallucination rate reaches 99% in',
    shake: true,
    decline: false,
  },
]

/** Props for the fake security alert. */
export interface VirusToastProps {
  /** Language used by the host UI. */
  readonly locale?: AdLocale
  /** Frozen randomness driving the decoy hitbox, in [0, 1). */
  readonly seed: number
  /** Whether to chime on arrival. */
  readonly chime: boolean
  /** Where "立即修复" sends the user. */
  readonly href: string
  /**
   * `owner/repo` whose stargazers can lift the alert, or undefined to hide
   * the 验证修复 row entirely.
   */
  readonly repo: string | undefined
  /** Last GitHub id the user submitted, prefilled into the verify row. */
  readonly username: string
  /**
   * Called after every completed check with the id tried and whether it
   * counts as starred, so the layer can remember both.
   */
  readonly onVerdict: (username: string, starred: boolean) => void
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

/** The verify row's text field — plain and honestly usable, unlike every ✕. */
const idInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '5px 8px',
  border: '1px solid #b9b9b4',
  borderRadius: 3,
  background: '#fff',
  color: '#333',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
}

/** How far one verification attempt has got. */
type VerifyPhase = 'idle' | 'checking' | 'starred' | 'absent' | 'missing' | 'need-id' | 'error'

/**
 * Draw the alert.
 * @param props - see {@link VirusToastProps}.
 * @returns the fixed-position alert window.
 */
export function VirusToast({ seed, chime, href, repo, username, onVerdict, onClose, locale = 'zh' }: VirusToastProps) {
  const [entered, setEntered] = useState(false)
  const [rung, setRung] = useState(0)
  const levels = locale === 'en' ? EN_LEVELS : LEVELS
  const level = levels[Math.min(rung, levels.length - 1)] as Level
  const [left, setLeft] = useState(level.seconds)
  const [failed, setFailed] = useState(false)
  const [id, setId] = useState(username)
  const [phase, setPhase] = useState<VerifyPhase>('idle')
  const hit = resolveHitbox(seed, TOAST_HITBOX_PX)

  /** Run one verification: the host's own GitHub login first, anonymous fallback. */
  const verify = async (): Promise<void> => {
    if (repo === undefined || phase === 'checking') return
    const trimmed = id.trim()
    setPhase('checking')
    const host = await checkHostStar()
    if (host !== 'unavailable') {
      onVerdict(trimmed, host === 'starred')
      setPhase(host)
      return
    }
    // No credentialed channel on this machine: the anonymous walk needs a
    // typed id before it can look for anyone.
    if (trimmed === '') {
      setPhase('need-id')
      return
    }
    const verdict = await checkStarred(repo, trimmed)
    // `overflow` honours the claim: a list too long to page through must not
    // punish the people it can no longer prove.
    const starred = verdict === 'starred' || verdict === 'overflow'
    onVerdict(trimmed, starred)
    setPhase(starred ? 'starred' : verdict === 'absent' || verdict === 'missing' ? verdict : 'error')
  }

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
        // until it has finished, then the shake takes over. A verified window
        // stops shaking: the cure worked, the theatrics are over.
        ...(entered
          ? level.shake && phase !== 'starred'
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
            aria-label={locale === 'en' ? 'Close security warning' : '关闭安全提示'}
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
      {phase === 'starred' && (
        <div style={bodyStyle}>
          <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#1d7a2f', margin: '8px 0 4px' }}>
            {locale === 'en' ? '✅ REPAIR COMPLETE' : '✅ 修复成功'}
          </div>
          <div style={{ textAlign: 'center', color: '#555' }}>
            {locale === 'en'
              ? 'Star authorization detected. Premium protection is active; the next attack will be blocked automatically.'
              : '已检测到您的 Star 授权，专属防护已开启：下次它再来，会被自动拦截。'}
          </div>
          {/* The one full-width, honestly clickable close in the plugin: the
              user did the thing, so the joke is over. */}
          <button type="button" style={{ ...buttonStyle, width: '100%', marginTop: 10 }} onClick={onClose}>
            {locale === 'en' ? 'DONE' : '完成'}
          </button>
        </div>
      )}
      {phase !== 'starred' && <div style={bodyStyle}>
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
            ? (locale === 'en' ? 'REMOVAL FAILED. RESTARTING TIMER…' : '清除失败，正在重新计时…')
            : <>{level.countdownLabel} <strong style={{ fontSize: 15, color: '#b8231a' }}>{left}</strong>{locale === 'en' ? ' seconds' : ' 秒'}</>}
        </div>
        {repo !== undefined && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void verify()
            }}
            style={{ display: 'flex', gap: 6, marginBottom: 8 }}
          >
            <input
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder={locale === 'en' ? 'GitHub ID for premium repair' : '输入您的 GitHub ID 领取专属修复'}
              aria-label="GitHub ID"
              style={idInputStyle}
            />
            <button
              type="submit"
              style={{ ...buttonStyle, flex: '0 0 auto', padding: '7px 10px' }}
              disabled={phase === 'checking'}
            >
              {phase === 'checking'
                ? (locale === 'en' ? 'CHECKING…' : '检测中…')
                : username === ''
                  ? (locale === 'en' ? 'VERIFY REPAIR' : '验证修复')
                  : (locale === 'en' ? 'CHECK AGAIN' : '重新检测')}
            </button>
          </form>
        )}
        {phase === 'absent' && (
          <div style={{ marginBottom: 8, color: '#b8231a' }}>
            {locale === 'en'
              ? 'REPAIR FAILED: authorization not found. Star the repository, then try again.'
              : '修复失败：未在官方渠道检测到您的授权，请先 Star 再重新检测'}
          </div>
        )}
        {phase === 'missing' && (
          <div style={{ marginBottom: 8, color: '#b8231a' }}>
            {locale === 'en'
              ? 'REPAIR CHANNEL OFFLINE: the repository is not public yet. A local gh login can verify early access.'
              : '修复通道尚未开通：仓库还未公开，本机登录 gh 后可提前验证'}
          </div>
        )}
        {phase === 'need-id' && (
          <div style={{ marginBottom: 8, color: '#b8231a' }}>
            {locale === 'en'
              ? 'No GitHub login found. Enter a GitHub ID for public verification.'
              : '本机没有可用的 GitHub 登录，请填写 GitHub ID 走公开验证'}
          </div>
        )}
        {phase === 'error' && (
          <div style={{ marginBottom: 8, color: '#b8231a' }}>
            {locale === 'en' ? 'REPAIR SERVICE UNREACHABLE. Please try again later.' : '修复服务暂时连不上，请稍后重试'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            style={fixButtonStyle}
            onClick={onClose}
          >
            {locale === 'en' ? 'REPAIR NOW (STAR REPO)' : '立即修复（去点 Star）'}
          </a>
          {level.decline && (
            <button type="button" style={buttonStyle} onClick={() => setRung((current) => current + 1)}>
              {locale === 'en' ? 'NOT NOW' : '暂不处理'}
            </button>
          )}
        </div>
      </div>}
    </div>
  )
}
