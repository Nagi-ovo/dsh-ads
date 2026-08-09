/**
 * The in-transcript ad.
 *
 * Registered on the chat view's turn-tail chain, so it renders *inside* the
 * conversation — between a closing assistant message's body and its action
 * footer — rather than floating over it. This is the feed ad: content, ad,
 * content, ad, exactly the rhythm of a Chinese content portal, and the reason
 * the gutters can leave the reading column alone.
 *
 * Which turns carry an ad is a pure function of the turn's `seq`, so the
 * decision is stable across re-renders and scroll: an ad that appeared and
 * vanished as the transcript re-rendered would be a bug, not inventory.
 */

import { useState, type CSSProperties } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `conversation.chat.turnTail` SlotMap declaration.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { AdCreative } from './types.ts'
import { resolveHitbox, VISUAL_CLOSE_PX } from './hitbox.ts'
import { usePersisted } from './persist.ts'

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

/**
 * Pick the creative for a turn, deterministically.
 * @param seq - the closing assistant message's sequence number.
 * @param pool - the creative pool.
 * @returns the creative for this turn, or undefined when the pool is empty.
 */
export function creativeForTurn(seq: number, pool: readonly AdCreative[]): AdCreative | undefined {
  if (pool.length === 0) return undefined
  return pool[Math.floor(seq / INLINE_EVERY_N_TURNS) % pool.length]
}

/** Business props injected by the registration, beside the owner currency. */
export interface InlineAdInjected {
  /** The creative pool this entry rotates through. */
  readonly pool: readonly AdCreative[]
}

/** Full props: the turn-tail owner currency plus the injected pool. */
export type InlineAdProps = PropsRuntime<'conversation.chat.turnTail'> & InlineAdInjected

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
export function InlineAd({ seq, pool }: InlineAdProps) {
  const [closed, setClosed] = useState(false)
  // Solo mode is set on the floating layer, in a different React tree; the
  // preference is shared through storage so "keep only the poster" really does
  // mean only the poster.
  const [solo] = usePersisted('solo', false)
  const creative = creativeForTurn(seq, pool)
  if (solo || closed || creative === undefined) return null
  // Seed from seq so the hitbox is stable per turn without any stored state.
  const hit = resolveHitbox((seq * 0.618_033) % 1)
  return (
    <div style={{ margin: '8px 0 4px', maxWidth: 420 }}>
      <div style={labelStyle}>广告</div>
      <div style={{ position: 'relative' }}>
        <img
          src={creative.src}
          alt={creative.alt}
          draggable={false}
          style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid rgba(0, 0, 0, 0.2)' }}
        />
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
          aria-label="关闭广告"
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
