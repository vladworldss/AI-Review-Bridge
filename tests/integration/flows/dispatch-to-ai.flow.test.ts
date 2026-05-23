/**
 * Runtime view §6.2 — Dispatch to AI
 *
 *   User clicks Send to Agent
 *   -> PromptEnvelope generated
 *   -> Payload copied
 *   -> Task state updated
 *
 * Test cases §15:
 *   - Dispatch Task                 (this file)
 *   - Edge: large discussion trim   (parser test covers trimming; this file covers envelope respects it)
 */

import { describe, expect, it } from 'vitest'

import { dispatchTask } from '../../../src/contexts/ai-dispatch/application/DispatchTask'
import { NotImplementedError } from '../../../src/shared/errors'
import { InMemoryReviewTaskRepository, RecordingClipboard, makeClock } from './test-helpers'

describe('§6 Dispatch to AI flow', () => {
  it('Given the user clicks dispatch, When the use-case runs, Then payload is copied and task state updated', async () => {
    const deps = {
      repo: new InMemoryReviewTaskRepository(),
      clipboard: new RecordingClipboard(),
      clock: makeClock(),
    }

    await expect(
      dispatchTask({ taskId: 'task-1', agent: 'claude-code' }, deps),
    ).rejects.toBeInstanceOf(NotImplementedError)
  })

  it.todo(
    'Given a NEW task, When dispatched, Then envelope contains mr.title, review.comment, context.file/line/diffHunk',
  )

  it.todo('Given a successful clipboard write, Then task transitions NEW → DISPATCHED')

  it.todo(
    'Given the clipboard adapter throws, Then task transitions to FAILED and DispatchFailed is emitted',
  )

  it.todo(
    'Given a thread larger than the cap, When envelope is built, Then it carries the trimmed thread',
  )

  it.todo(
    'Given a task in RESOLVED state, When dispatch is attempted, Then it is rejected (terminal state)',
  )
})
