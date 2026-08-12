/**
 * The in-transcript ad.
 *
 * Registered on the chat view's turn-tail chain, so it renders *inside* the
 * conversation — between a closing assistant message's body and its action
 * footer — rather than floating over it. This is the feed ad: content, ad,
 * content, ad, exactly the rhythm of a Chinese content portal, and the reason
 * the gutters can leave the reading column alone.
 *
 * Which turns carry an ad is a pure function of the turn's `seq`. *Which* ad
 * they carry is decided once per turn by {@link feedAd} and then remembered,
 * which is what lets the feed work through the whole plugin hub without an ad
 * ever changing under a reader mid-scroll.
 */

import { useState, type CSSProperties, type ReactNode } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `conversation.chat.turnTail` SlotMap declaration.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { AdCreative, AdLocale } from './types.ts'
import { feedAd } from './feed.ts'
import { resolveHitbox, VISUAL_CLOSE_PX } from './hitbox.ts'
import { useAdSettings } from './settings.ts'

/** Show an ad after every Nth turn. */
export const INLINE_EVERY_N_TURNS = 2

/**
 * Whether a turn carries an inline ad.
 * @param seq - the closing assistant message's sequence number.
 * @returns true when this turn should render one.
 */
export function turnCarriesAd(seq: number): boolean {
  return seq > 0 && seq % INLINE_EVERY_N_TURNS === 0
}

/** Business props injected by the registration, beside the owner currency. */
export interface InlineAdInjected {
  /**
   * The shipped banner pool. The community plugins the feed also draws from
   * are held by {@link feedAd} itself, because there are far too many to hand
   * across on every render.
   */
  readonly pool: readonly AdCreative[]
  /** Active DSH language, used for chrome and dynamic plugin creatives. */
  readonly locale: AdLocale
}

/** Full props: the turn-tail owner currency plus the injected pool. */
export type InlineAdProps = PropsRuntime<'conversation.chat.turnTail'> & InlineAdInjected

/**
 * Wrap the artwork in a link, or leave it alone.
 *
 * A plain `<a>` around an `<img>` when there is somewhere to go, and the image
 * unwrapped when there is not — rather than an anchor with no `href`, which
 * still takes focus and still shows a pointer for a click that does nothing.
 *
 * @param props - the destination, if any, and the artwork.
 * @returns the artwork, linked or bare.
 */
function Frame({ href, children }: { readonly href: string | undefined; readonly children: ReactNode }) {
  if (href === undefined) return <>{children}</>
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" style={{ display: 'block' }}>
      {children}
    </a>
  )
}

const labelStyle: CSSProperties = {
  fontSize: 10,
  lineHeight: 1,
  color: 'rgba(128, 128, 128, 0.75)',
  fontFamily: 'system-ui, sans-serif',
  marginBottom: 3,
}

/**
 * Draw the in-transcript ad.
 *
 * Dismissing it hides it for the rest of the page load — the transcript is the
 * one surface where a banner reappearing under the user's cursor as they
 * scroll would be genuinely disorienting rather than funny. The ✕ is the same
 * decoy as everywhere else, but a miss here just does nothing.
 *
 * @param props - see {@link InlineAdProps}.
 * @returns the inline banner, or null once dismissed.
 */
export function InlineAd({ seq, sessionId, pool, locale }: InlineAdProps) {
  const [closed, setClosed] = useState(false)
  // The switch lives on the floating layer and on the host's settings page,
  // both in different React trees; the persistence layer's same-document
  // broadcast is what keeps this entry in step with them.
  const [settings] = useAdSettings()
  // Keyed by session as well as seq: sequence numbers restart per conversation,
  // and without the session two different turns would share one assignment.
  const creative = feedAd(`${sessionId}:${seq}`, pool, locale)
  if (!settings.feed || closed || creative === undefined) return null
  // Seed from seq so the hitbox is stable per turn without any stored state.
  const hit = resolveHitbox((seq * 0.618_033) % 1)
  return (
    <div style={{ margin: '8px 0 4px', maxWidth: 420 }}>
      <div style={labelStyle}>{locale === 'en' ? 'ADVERTISEMENT' : '广告'}</div>
      <div style={{ position: 'relative' }}>
        {/* Banners for real community plugins link to their repository; the
            built-ins advertise things that do not exist and stay inert. The
            feed is the placement people actually read, so this is where an
            advertised author gets something back for being here. */}
        <Frame href={creative.href}>
          <img
            src={creative.src}
            alt={creative.alt}
            draggable={false}
            style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid rgba(0, 0, 0, 0.2)' }}
          />
        </Frame>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: VISUAL_CLOSE_PX,
            height: VISUAL_CLOSE_PX,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 3,
            background: 'rgba(0, 0, 0, 0.5)',
            color: '#fff',
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          ✕
        </div>
        <button
          type="button"
          aria-label={locale === 'en' ? 'Close advertisement' : '关闭广告'}
          onClick={() => setClosed(true)}
          style={{
            position: 'absolute',
            top: 2 + hit.top,
            right: 2 + (VISUAL_CLOSE_PX - hit.size - hit.left),
            width: hit.size,
            height: hit.size,
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  )
}
