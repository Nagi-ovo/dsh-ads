// @vitest-environment jsdom

/** The inference gate conceals presentation only; the session keeps rendering behind it. */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  InferenceRewardGate, REWARD_GATE_DELAY_MS, REWARD_WATCH_SECONDS,
} from '../src/client/InferenceRewardGate.tsx'
import type { AdCreative } from '../src/client/types.ts'
import { clearPersisted } from '../src/client/persist.ts'
import { resetRetired } from '../src/client/retire.ts'

// React 18 asks non-Jest DOM runners to opt into act() diagnostics explicitly.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Artwork content is irrelevant to DOM concealment. */
const CREATIVE: AdCreative = {
  id: 'reward', width: 1280, height: 768, shape: 'wide', weight: 1, alt: '现金红包', src: 'data:,',
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

/** Advance recursive one-second countdown timers with React commits between ticks. */
function finishCountdown(): void {
  for (let second = 0; second < REWARD_WATCH_SECONDS; second += 1) {
    act(() => { vi.advanceTimersByTime(1_000) })
  }
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

    act(() => { root.render(<InferenceRewardGate creative={CREATIVE} />) })
    act(() => { vi.advanceTimersByTime(REWARD_GATE_DELAY_MS) })

    expect(document.body.textContent).toContain('这一次，你一定要提现')
    expect(assistant.dataset.dshRewardLocked).toBe('true')
    expect(assistant.style.overflow).toBe('hidden')
    expect(tool.style.display).toBe('none')

    // New output still lands in the DOM; the plugin only clips and hides it.
    streaming.append('。后台继续产生内容')
    const laterTool = row('tool-call', 'tool-2')
    laterTool.textContent = '后续工具调用'
    flow.append(laterTool)
    await flushObserver()
    expect(streaming.textContent).toContain('后台继续产生内容')
    expect(laterTool.isConnected).toBe(true)
    expect(laterTool.style.display).toBe('none')

    act(() => {
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('放弃提现'))?.click()
    })
    expect(document.querySelector('[data-dsh-reward-gate]')).toBeNull()
    expect(assistant.dataset.dshRewardLocked).toBeUndefined()
    expect(assistant.style.overflow).toBe('')
    expect(tool.style.display).toBe('')
    expect(laterTool.style.display).toBe('')
  })

  it('reveals the accumulated tail after the rewarded-ad countdown', () => {
    const assistant = row('assistant-step', 'assistant-1')
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    assistant.append(streaming)
    const tool = row('tool-call', 'tool-1')
    flow.append(assistant, tool)

    act(() => { root.render(<InferenceRewardGate creative={CREATIVE} />) })
    act(() => { vi.advanceTimersByTime(REWARD_GATE_DELAY_MS) })
    finishCountdown()
    const claim = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('领取 0.01 元并继续推理'))
    expect(claim?.disabled).toBe(false)
    act(() => { claim?.click() })
    expect(tool.style.display).toBe('')
    expect(document.body.textContent).not.toContain('还差 ¥0.01')
  })

  it('does not interrupt a response that finishes before the opening delay', () => {
    const assistant = row('assistant-step', 'assistant-1')
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    assistant.append(streaming)
    flow.append(assistant)

    act(() => { root.render(<InferenceRewardGate creative={CREATIVE} />) })
    delete streaming.dataset.streaming
    act(() => { vi.advanceTimersByTime(REWARD_GATE_DELAY_MS) })
    expect(document.querySelector('[data-dsh-reward-gate]')).toBeNull()
    expect(assistant.dataset.dshRewardLocked).toBeUndefined()
  })

  it('shows at most once during one mounted session', () => {
    const assistant = row('assistant-step', 'assistant-1')
    const streaming = document.createElement('div')
    streaming.dataset.streaming = 'true'
    assistant.append(streaming)
    flow.append(assistant)

    act(() => { root.render(<InferenceRewardGate creative={CREATIVE} delayMs={0} watchSeconds={0} />) })
    act(() => { vi.advanceTimersByTime(0) })
    act(() => {
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('领取 0.01 元并继续推理'))?.click()
    })
    const next = row('assistant-step', 'assistant-2')
    const nextStreaming = document.createElement('div')
    nextStreaming.dataset.streaming = 'true'
    next.append(nextStreaming)
    flow.append(next)
    act(() => { vi.advanceTimersByTime(0) })
    expect(document.querySelector('[data-dsh-reward-gate]')).toBeNull()
  })
})
