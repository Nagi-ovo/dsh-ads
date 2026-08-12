// @vitest-environment jsdom

/** The inference gate conceals presentation only; the session keeps rendering behind it. */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_REWARD_SCHEDULE,
  drawPrize,
  InferenceRewardGate,
  REWARD_GATE_DELAY_MS,
  REWARD_PROGRESS_TARGET,
  REWARD_SPIN_DURATION_MS,
  rewardTurnEligible,
  type RewardSchedule,
} from '../src/client/InferenceRewardGate.tsx'
import type { AdCreative } from '../src/client/types.ts'
import { clearPersisted } from '../src/client/persist.ts'
import { resetRetired } from '../src/client/retire.ts'

// React 18 asks non-Jest DOM runners to opt into act() diagnostics explicitly.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Artwork content is irrelevant to DOM concealment. */
const CREATIVE: AdCreative = {
  id: 'reward', width: 1280, height: 768, shape: 'wide', weight: 1, alt: '财神鲸模型组件奖池', src: 'data:,',
}

/** Deterministic component schedule used when a test is about the wheel itself. */
const EVERY_TURN: RewardSchedule = {
  initialTurnsToSkip: 0,
  appearancePercent: 100,
  minimumTurnGap: 1,
  pityTurnGap: 1,
}

let root: Root
let mountPoint: HTMLDivElement
let flow: HTMLDivElement

/** Create one transcript row with the host's stable data attributes. */
function row(kind: string, key: string): HTMLDivElement {
  const element = document.createElement('div')
  element.dataset.chatFlowKind = kind
  element.dataset.chatFlowKey = key
  return element
}

/** Let MutationObserver deliver its queued records. */
async function flushObserver(): Promise<void> {
  await act(async () => { await Promise.resolve() })
}

/** Click the wheel once and finish its state transition. */
function spinOnce(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-dsh-spin-button]')
  act(() => { button?.click() })
  const wheel = document.querySelector('[data-dsh-prize-wheel]')
  act(() => { wheel?.dispatchEvent(new Event('transitionend', { bubbles: true })) })
}

/** Find a stable row key whose draw has the requested prize property. */
function rowKeyFor(
  progress: number,
  predicate: (prize: ReturnType<typeof drawPrize>) => boolean,
  prefix = 'assistant',
  sessionId = 'test-session',
): string {
  for (let index = 0; index < 1_000; index += 1) {
    const key = `${prefix}-${index}`
    if (predicate(drawPrize(`${sessionId}:${key}`, progress))) return key
  }
  throw new Error('no matching deterministic reward row key')
}

/** Add a streaming Assistant turn and let its zero-delay reward gate open. */
async function openTurn(key: string): Promise<HTMLDivElement> {
  const assistant = row('assistant-step', key)
  const streaming = document.createElement('div')
  streaming.dataset.streaming = 'true'
  assistant.append(streaming)
  flow.append(assistant)
  await flushObserver()
  act(() => { vi.advanceTimersByTime(0) })
  return assistant
}

/** Leave a settled result and reveal the transcript before the next turn. */
function continueConversation(): void {
  act(() => {
    [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('继续对话'))?.click()
  })
}

beforeEach(() => {
  clearPersisted()
  resetRetired()
  vi.useFakeTimers()
  mountPoint = document.createElement('div')
  flow = document.createElement('div')
  document.body.append(flow, mountPoint)
  root = createRoot(mountPoint)
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('InferenceRewardGate', () => {
  it('conceals later inference and Tool rows while their DOM continues updating', async () => {
    const assistant = row('assistant-step', 'assistant-1')
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    streaming.textContent = '已显示的推理'
    assistant.append(streaming)
    const tool = row('tool-call', 'tool-1')
    tool.textContent = '正在调用工具'
    flow.append(assistant, tool)

    act(() => {
      root.render(<InferenceRewardGate creative={CREATIVE} sessionId="test-session" schedule={EVERY_TURN} />)
    })
    act(() => { vi.advanceTimersByTime(REWARD_GATE_DELAY_MS) })

    expect(document.body.textContent).toContain('转到 V4 Pro 正式版才算你赢')
    expect(document.body.textContent).not.toContain('tool call')
    expect(document.body.textContent).not.toContain('模型仍在后台工作')
    expect(assistant.dataset.dshRewardLocked).toBe('true')
    expect(assistant.style.overflow).toBe('hidden')
    expect(tool.style.display).toBe('none')

    // New output still lands in the DOM; the plugin only clips and hides it.
    streaming.append('。后台继续产生内容')
    const laterTool = row('tool-call', 'tool-2')
    laterTool.textContent = '后续工具调用'
    const recommendation = row('turn-tail', 'turn-tail-1')
    recommendation.textContent = '插件推荐广告'
    flow.append(laterTool, recommendation)
    await flushObserver()
    expect(streaming.textContent).toContain('后台继续产生内容')
    expect(laterTool.isConnected).toBe(true)
    expect(laterTool.style.display).toBe('none')
    expect(recommendation.isConnected).toBe(true)
    expect(recommendation.style.display).toBe('none')

    act(() => {
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('放弃本轮资格'))?.click()
    })
    expect(document.querySelector('[data-dsh-reward-gate]')).toBeNull()
    expect(assistant.dataset.dshRewardLocked).toBeUndefined()
    expect(assistant.style.overflow).toBe('')
    expect(tool.style.display).toBe('')
    expect(laterTool.style.display).toBe('')
    expect(recommendation.style.display).toBe('')
  })

  it('allows one draw per turn and gives no progress for 谢谢参与', async () => {
    const noPrizeKey = rowKeyFor(0, (prize) => prize.progress === 0)
    const assistant = row('assistant-step', noPrizeKey)
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    assistant.append(streaming)
    flow.append(assistant)

    act(() => {
      root.render(<InferenceRewardGate creative={CREATIVE} sessionId="test-session" delayMs={0} schedule={EVERY_TURN} />)
    })
    act(() => { vi.advanceTimersByTime(0) })
    const button = document.querySelector<HTMLButtonElement>('[data-dsh-spin-button]')
    act(() => { button?.click() })
    expect(button?.disabled).toBe(true)
    expect(document.querySelector('[data-dsh-draw-result]')?.textContent).toContain('财神鲸正在打捞')
    act(() => {
      document.querySelector('[data-dsh-prize-wheel]')
        ?.dispatchEvent(new Event('transitionend', { bubbles: true }))
    })
    expect(button?.disabled).toBe(true)
    expect(document.querySelector('[data-dsh-draw-result]')?.textContent).toContain('进度一动不动')
    expect(document.querySelector('[data-dsh-reward-progress]')?.textContent).toBe('0%')
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(document.querySelector('[data-dsh-reward-progress]')?.textContent).toBe('0%')
    expect(document.body.textContent).toContain('本轮抽奖资格已使用')
    continueConversation()

    const prizeKey = rowKeyFor(0, (prize) => prize.progress > 0 && prize.label !== 'V4 Pro')
    await openTurn(prizeKey)
    spinOnce()
    expect(document.querySelector('[data-dsh-reward-progress]')?.textContent).not.toBe('0%')
    expect(document.querySelector('[data-dsh-draw-result]')?.textContent).toContain('解锁进度 +')
  })

  it('carries component progress across turns until the whale yields V4 Pro', async () => {
    act(() => {
      root.render(<InferenceRewardGate creative={CREATIVE} sessionId="test-session" delayMs={0} schedule={EVERY_TURN} />)
    })
    let progress = 0
    let turn = 0
    while (progress < REWARD_PROGRESS_TARGET) {
      const key = rowKeyFor(progress, (prize) => prize.progress > 0, `turn-${turn}`)
      await openTurn(key)
      const prize = drawPrize(`test-session:${key}`, progress)
      spinOnce()
      progress = prize.label === 'V4 Pro'
        ? REWARD_PROGRESS_TARGET
        : Math.min(REWARD_PROGRESS_TARGET, progress + prize.progress)
      expect(document.querySelector('[data-dsh-reward-progress]')?.textContent)
        .toBe(progress === REWARD_PROGRESS_TARGET ? '全部完成' : `${progress}%`)
      if (progress < REWARD_PROGRESS_TARGET) continueConversation()
      turn += 1
      expect(turn).toBeLessThan(20)
    }
    const claim = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('立即使用 DeepSeek V4 Pro'))
    expect(claim?.disabled).toBe(false)
    expect(document.body.textContent).toContain('您已解锁 V4 正式版')
    expect(document.querySelector('[data-dsh-draw-result]')?.textContent).toContain('抽中 V4 Pro 正式版')
  })

  it('uses a visible multi-second spin and settles only on transition end', () => {
    const assistant = row('assistant-step', 'assistant-motion')
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    assistant.append(streaming)
    flow.append(assistant)
    act(() => {
      root.render(<InferenceRewardGate creative={CREATIVE} sessionId="test-session" delayMs={0} schedule={EVERY_TURN} />)
    })
    act(() => { vi.advanceTimersByTime(0) })
    const button = document.querySelector<HTMLButtonElement>('[data-dsh-spin-button]')
    act(() => { button?.click() })
    expect(REWARD_SPIN_DURATION_MS).toBeGreaterThanOrEqual(2_500)
    expect(document.querySelector('style')?.textContent).toContain(`${REWARD_SPIN_DURATION_MS}ms`)
    act(() => { vi.advanceTimersByTime(REWARD_SPIN_DURATION_MS + 1_000) })
    expect(button?.disabled).toBe(true)
    expect(document.querySelector('[data-dsh-draw-result]')?.textContent).toContain('财神鲸正在打捞')
    spinOnce()
    expect(document.querySelector('[data-dsh-draw-result]')?.textContent).not.toContain('正在打捞')
  })

  it('caps the desktop progress column so the whale artwork remains visible', () => {
    const assistant = row('assistant-step', 'assistant-layout')
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    assistant.append(streaming)
    flow.append(assistant)
    act(() => {
      root.render(<InferenceRewardGate creative={CREATIVE} sessionId="test-session" delayMs={0} schedule={EVERY_TURN} />)
    })
    act(() => { vi.advanceTimersByTime(0) })
    const styles = document.querySelector('style')?.textContent
    expect(styles).toContain('grid-template-columns: minmax(0, 460px) 230px')
    expect(styles).toContain('justify-content: space-between')
  })

  it('uses a stable sparse schedule with cooldown and a pity offer', () => {
    expect(rewardTurnEligible('session', 'turn-1', 1, 0)).toBe(false)
    expect(rewardTurnEligible('session', 'turn-2', 2, 0)).toBe(false)
    const first = rewardTurnEligible('session', 'turn-3', 3, 0)
    expect(rewardTurnEligible('session', 'turn-3', 3, 0)).toBe(first)
    expect(rewardTurnEligible('session', 'turn-4', 4, 3)).toBe(false)
    expect(rewardTurnEligible('session', 'turn-5', 5, 3)).toBe(false)
    expect(rewardTurnEligible('session', 'turn-11', 11, 3)).toBe(true)
    expect(DEFAULT_REWARD_SCHEDULE.appearancePercent).toBe(20)
  })

  it('does not reopen on the same streaming turn after a draw is dismissed', async () => {
    const assistant = row('assistant-step', 'assistant-one-draw')
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    assistant.append(streaming)
    flow.append(assistant)
    act(() => {
      root.render(<InferenceRewardGate creative={CREATIVE} sessionId="test-session" delayMs={0} schedule={EVERY_TURN} />)
    })
    act(() => { vi.advanceTimersByTime(0) })
    spinOnce()
    continueConversation()
    act(() => { streaming.append('还在流式输出') })
    await flushObserver()
    expect(document.querySelector('[data-dsh-reward-gate]')).toBeNull()
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(document.querySelector('[data-dsh-reward-gate]')).toBeNull()
  })

  it('resets progress and turn bookkeeping when the session changes', () => {
    const firstSession = 'session-a'
    const key = rowKeyFor(0, (prize) => prize.progress > 0, 'assistant', firstSession)
    const assistant = row('assistant-step', key)
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    assistant.append(streaming)
    flow.append(assistant)

    act(() => {
      root.render(<InferenceRewardGate creative={CREATIVE} sessionId={firstSession} delayMs={0} schedule={EVERY_TURN} />)
    })
    act(() => { vi.advanceTimersByTime(0) })
    spinOnce()
    expect(document.querySelector('[data-dsh-reward-progress]')?.textContent).not.toBe('0%')

    act(() => {
      root.render(<InferenceRewardGate creative={CREATIVE} sessionId="session-b" delayMs={0} schedule={EVERY_TURN} />)
    })
    act(() => { vi.advanceTimersByTime(0) })
    expect(document.querySelector('[data-dsh-reward-progress]')?.textContent).toBe('0%')
    expect(document.body.textContent).toContain('本轮剩余次数：1')
  })

  it('does not interrupt a response that finishes before the opening delay', () => {
    const assistant = row('assistant-step', 'assistant-1')
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    assistant.append(streaming)
    flow.append(assistant)

    act(() => {
      root.render(<InferenceRewardGate creative={CREATIVE} sessionId="test-session" schedule={EVERY_TURN} />)
    })
    delete streaming.dataset.streaming
    act(() => { vi.advanceTimersByTime(REWARD_GATE_DELAY_MS) })
    expect(document.querySelector('[data-dsh-reward-gate]')).toBeNull()
    expect(assistant.dataset.dshRewardLocked).toBeUndefined()
  })

})
