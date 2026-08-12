/**
 * dsh-ads, browser half. Three registrations, deliberately different in kind:
 *
 * - The composer's input dock mounts the floating layer and inference reward
 *   gate. That entry renders nothing at the dock — it only supplies a React
 *   lifecycle scoped to an open session. Visible output is portalled onto
 *   `document.body` or beside the active transcript row.
 * - The chat view's turn-tail chain mounts the feed ad *inside* the
 *   transcript, so the reading column carries inventory without anything
 *   floating over it.
 * - The settings dialog gets a page of its own, which is where the placement
 *   switches actually live; the in-ad ⚙ menu is a joke, not a control panel.
 */

import { useMemo } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `conversation.input.dock` and `conversation.chat.turnTail`
// SlotMap declarations.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the `settings.section` SlotMap declaration.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { AdLayer } from './AdLayer.tsx'
import { AdsSection } from './AdsSection.tsx'
import { InferenceRewardGate } from './InferenceRewardGate.tsx'
import { InlineAd, turnCarriesAd } from './InlineAd.tsx'
import { BUILTIN_ADS, BUILTIN_POPUPS, BUILTIN_POSTERS, BUILTIN_REWARDS } from './builtin-ads.ts'
import { useSponsoredAds } from './registry.ts'
import { DEFAULT_SPAWN } from './schedule.ts'
import { DEFAULT_HITBOX_PX } from './hitbox.ts'
import type { AdCreative } from './types.ts'

export const name = 'dsh-ads'

export const inject = ['slots']

/** Delay before the corner pop-up first appears, in ms. */
const DEFAULT_POPUP_FIRST_DELAY_MS = 10_000

/** Delay before the bottom-left poster first appears, in ms. */
const DEFAULT_POSTER_FIRST_DELAY_MS = 20_000

/** Delay before a closed pop-up or poster returns, in ms. */
const DEFAULT_RESPAWN_MS = 60_000

/**
 * Delay before the benchmark result appears, in ms — first of everything, and
 * barely a delay at all: it reports the startup time, so it belongs at startup.
 * Just long enough for the app's own first paint to land first.
 */
const DEFAULT_SPEED_FIRST_DELAY_MS = 400

/** Where the alert's and the benchmark's calls to action send the user. */
const SCARE_HREF = 'https://github.com/dsh-external/dsh-ads'

/** Gap between the benchmark leaving and the security alert landing, in ms. */
const DEFAULT_SCARE_DELAY_MS = 4_000

/**
 * Resolve the reward creative and fail at module load when the asset build omitted it.
 * @returns the shipped cash-reward artwork.
 */
function rewardCreative(): AdCreative {
  const creative = BUILTIN_REWARDS[0]
  if (creative === undefined) throw new Error('dsh-ads has no inference reward creative')
  return creative
}

/** The one cash-reward creative shipped with the client. */
const REWARD_CREATIVE = rewardCreative()

/**
 * Dock entry: zero inline footprint, all output goes through the portal.
 *
 * The session id is what makes the dynamic tier rotate per conversation —
 * switching sessions reshuffles which community plugins get the slots, which
 * is the only pacing that does not depend on the user happening to be online
 * when someone pushed.
 *
 * @param props - the dock's session-scoped standard kit.
 * @returns the portalled ad layer.
 */
function AdDockEntry({ sessionId }: PropsRuntime<'conversation.input.dock'>) {
  const sponsored = useSponsoredAds(sessionId)
  const creatives = useMemo(() => [...BUILTIN_ADS, ...sponsored], [sponsored])
  return (
    <>
      <AdLayer
        creatives={creatives}
        popups={BUILTIN_POPUPS}
        posters={BUILTIN_POSTERS}
        spawn={DEFAULT_SPAWN}
        hitboxPx={DEFAULT_HITBOX_PX}
        popupFirstDelayMs={DEFAULT_POPUP_FIRST_DELAY_MS}
        posterFirstDelayMs={DEFAULT_POSTER_FIRST_DELAY_MS}
        respawnMs={DEFAULT_RESPAWN_MS}
        speedFirstDelayMs={DEFAULT_SPEED_FIRST_DELAY_MS}
        scareDelayMs={DEFAULT_SCARE_DELAY_MS}
        scareHref={SCARE_HREF}
        chime
      />
      <InferenceRewardGate creative={REWARD_CREATIVE} />
    </>
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
  // A page of its own in the host's settings dialog, beside 通用设置 and 模型.
  // The poster's ⚙ is part of the joke, but it is the wrong place to *find*
  // settings — and it vanishes the moment the poster is switched off.
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    // Labelled as third-party in the nav itself: this page sits between two
    // first-party ones, and a settings entry that reads as official is the one
    // place this plugin's joke would stop being obviously a joke.
    { name: 'settings.section', id: 'dsh-ads', order: 90, label: () => '广告（非官方）' },
    AdsSection,
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
