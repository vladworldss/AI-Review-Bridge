/**
 * Minimal dispatch helper for the in-memory store. Mirrors the
 * application/DispatchTask use-case but skips the repository — the store
 * mutates the aggregate in place.
 */

import {
  buildPromptEnvelope,
  renderEnvelopeAsText,
  type PromptEnvelope,
} from '../contexts/ai-dispatch/domain'
import { BrowserClipboardAdapter } from '../contexts/ai-dispatch/infrastructure/BrowserClipboardAdapter'
import type { AgentTarget, ReviewTaskSnapshot } from '../contexts/task-management/domain'
import type { InMemoryReviewTaskStore } from './reviewTaskMapper'

export type ClipboardWriter = (text: string) => Promise<void>

export type DispatchResult = {
  envelope: PromptEnvelope
  payload: string
  dispatchId: string
  snapshot: ReviewTaskSnapshot
}

export class DispatchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'DispatchError'
  }
}

const defaultClipboard: ClipboardWriter = (() => {
  let adapter: BrowserClipboardAdapter | null = null
  return async (text) => {
    adapter ??= new BrowserClipboardAdapter()
    await adapter.write(text)
  }
})()

export async function dispatchFromStore(
  store: InMemoryReviewTaskStore,
  discussionId: string,
  options: {
    agent?: AgentTarget
    clipboard?: ClipboardWriter
    now?: () => string
  } = {},
): Promise<DispatchResult> {
  const task = store.getEntity(discussionId)
  if (!task) {
    throw new DispatchError(`No task for discussion ${discussionId}`)
  }

  const agent: AgentTarget = options.agent ?? 'clipboard'
  const now = options.now?.() ?? new Date().toISOString()
  const clipboard = options.clipboard ?? defaultClipboard

  const dispatch = task.dispatch(agent)

  const envelope = buildPromptEnvelope({
    task: task.toSnapshot(),
    agent,
    now,
  })
  const payload = renderEnvelopeAsText(envelope)

  try {
    await clipboard(payload)
    task.markDispatchSucceeded(dispatch.id)
  } catch (err) {
    task.markDispatchFailed(dispatch.id, errorMessage(err))
    throw new DispatchError(`Failed to copy payload: ${errorMessage(err)}`, err)
  }

  return {
    envelope,
    payload,
    dispatchId: dispatch.id,
    snapshot: task.toSnapshot(),
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
