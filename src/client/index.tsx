/**
 * dsh-ads, browser half. Two registrations, deliberately different in kind:
 *
 * - The composer's input dock mounts the floating layer. That entry renders
 *   nothing inline — it is only a slot with a React lifecycle scoped to an
 *   open session, which is exactly the lifetime the layer should have — and
 *   everything visible is portalled onto `document.body`.
 * - The chat view's turn-tail chain mounts the feed ad *inside* the
 *   transcript, so the reading column carries inventory without anything
 *   floating over it.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the `conversation.input.dock` and `conversation.chat.turnTail`
// SlotMap declarations.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { AdLayer } from './AdLayer.tsx'
import { InlineAd, turnCarriesAd } from './InlineAd.tsx'
import { BUILTIN_ADS, BUILTIN_POPUPS, BUILTIN_POSTERS } from './builtin-ads.ts'
import { DEFAULT_SPAWN } from './schedule.ts'
import { DEFAULT_HITBOX_PX } from './hitbox.ts'

export const name = 'dsh-ads'

export const inject = ['slots']

/** Gap between corner pop-ups at zero banner pressure, in ms. */
const DEFAULT_POPUP_INTERVAL_MS = 45_000

/** Gap between bottom-left posters, in ms — the rarest, heaviest slot. */
const DEFAULT_POSTER_INTERVAL_MS = 120_000

/** Dock entry: zero inline footprint, all output goes through the portal. */
function AdDockEntry() {
  return (
    <AdLayer
      creatives={BUILTIN_ADS}
      popups={BUILTIN_POPUPS}
      posters={BUILTIN_POSTERS}
      spawn={DEFAULT_SPAWN}
      hitboxPx={DEFAULT_HITBOX_PX}
      popupIntervalMs={DEFAULT_POPUP_INTERVAL_MS}
      posterIntervalMs={DEFAULT_POSTER_INTERVAL_MS}
      chime
    />
  )
}

/**
 * Chain selector for the turn tail: decline every turn that does not carry an
 * ad, so the chain falls through to whatever else wants the seat.
 *
 * Declining by returning `undefined` (rather than mounting a component that
 * returns null) is what the chain contract asks for — an all-declined chain
 * renders nothing at all.
 *
 * @param owner - the turn-tail owner currency.
 * @returns the matched turn's seq, or undefined to decline this turn.
 */
function selectInlineAd(owner: { seq: number }): number | undefined {
  return turnCarriesAd(owner.seq) ? owner.seq : undefined
}

/**
 * Register both mount points.
 *
 * Waiting on each hole's declaration mirrors the official registrants: entry
 * application order is loader-driven, and a direct register racing the
 * declaration fails boot. The turn-tail entry takes a high `priority` so any
 * other registrant that wants that seat outranks an advertisement.
 *
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
    { name: 'conversation.input.dock', id: 'dsh-ads-layer', order: 90 },
    AdDockEntry,
  ))
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register(
    {
      name: 'conversation.chat.turnTail',
      priority: 1000,
      select: selectInlineAd,
      inject: () => ({ pool: BUILTIN_ADS }),
    },
    InlineAd,
  ))
}
