/**
 * Runtime view §6.2 — Dispatch to AI
 *
 *   User clicks Send to Agent
 *   -> PromptEnvelope generated
 *   -> Payload copied
 *   -> Task state updated
 */

import { describe, expect, it } from 'vitest'

import { extractDiscussions } from '../../../src/contexts/gitlab-integration/application/ExtractDiscussions'
import {
  TaskNotFoundError,
  dispatchTask,
} from '../../../src/contexts/ai-dispatch/application/DispatchTask'
import { createTaskFromDiscussion } from '../../../src/contexts/task-management/application/CreateTaskFromDiscussion'
import {
  createInMemoryTaskEventBus,
  type TaskEventBus,
} from '../../../src/contexts/task-management/application/TaskEventBus'
import type { DomainEvent } from '../../../src/contexts/task-management/domain'
import {
  InMemoryReviewTaskRepository,
  MR_URL_BASIC,
  RecordingClipboard,
  loadFixture,
  makeClock,
  makeIdGen,
} from './test-helpers'

async function seedTask(opts: { eventBus?: TaskEventBus } = {}) {
  const { mr } = extractDiscussions({
    document: loadFixture('mr-basic.html'),
    url: MR_URL_BASIC,
  })
  const discussion = mr!.discussions.at(0)!
  const repo = new InMemoryReviewTaskRepository()
  const deps = {
    repo,
    clock: makeClock(),
    newId: makeIdGen('task'),
    ...(opts.eventBus ? { eventBus: opts.eventBus } : {}),
  }
  const { task } = await createTaskFromDiscussion({ mr: mr!, discussion }, deps)
  return { repo, taskId: task.id, mr: mr! }
}

describe('§6 Dispatch to AI flow', () => {
  it('Given the user clicks dispatch, When the use-case runs, Then payload is copied and task state updated', async () => {
    const { repo, taskId } = await seedTask()
    const clipboard = new RecordingClipboard()
    const eventBus = createInMemoryTaskEventBus()

    const result = await dispatchTask(
      { taskId, agent: 'claude-code' },
      { repo, clipboard, eventBus, clock: makeClock(1_800_000_000_000) },
    )

    expect(clipboard.writes).toHaveLength(1)
    expect(clipboard.writes.at(0)).toBe(result.payload)
    const stored = await repo.findById(taskId)
    expect(stored?.state).toBe('DISPATCHED')
    expect(stored?.toSnapshot().dispatches.at(0)?.outcome).toBe('SUCCESS')
  })

  it('Given a NEW task, When dispatched, Then envelope contains mr.title, review.comment, context.file/line/diffHunk', async () => {
    const { repo, taskId } = await seedTask()

    const { envelope } = await dispatchTask(
      { taskId, agent: 'claude-code' },
      { repo, clipboard: new RecordingClipboard(), clock: makeClock(1_800_000_000_000) },
    )

    expect(envelope.mr.title).toBe('Refactor auth middleware')
    expect(envelope.review.comment).toMatch(/race condition/)
    expect(envelope.context.file).toBe('auth/service.ts')
    expect(envelope.context.line).toBe(182)
    expect(envelope.context.diffHunk).toContain('return validate(session.token)')
  })

  it('Given a successful clipboard write, Then task transitions NEW → DISPATCHED', async () => {
    const { repo, taskId } = await seedTask()

    await dispatchTask(
      { taskId, agent: 'claude-code' },
      { repo, clipboard: new RecordingClipboard(), clock: makeClock(1_800_000_000_000) },
    )

    const stored = await repo.findById(taskId)
    expect(stored?.state).toBe('DISPATCHED')
  })

  it('Given the clipboard adapter throws, Then task transitions to FAILED and DispatchFailed is emitted', async () => {
    const eventBus = createInMemoryTaskEventBus()
    const seen: DomainEvent[] = []
    eventBus.onAny((e) => {
      seen.push(e)
    })
    const { repo, taskId } = await seedTask({ eventBus })
    const clipboard = new RecordingClipboard()
    clipboard.shouldFail = true

    await expect(
      dispatchTask(
        { taskId, agent: 'claude-code' },
        { repo, clipboard, eventBus, clock: makeClock(1_800_000_000_000) },
      ),
    ).rejects.toThrow('clipboard blocked')

    const stored = await repo.findById(taskId)
    expect(stored?.state).toBe('FAILED')
    expect(stored?.toSnapshot().dispatches.at(0)).toMatchObject({
      outcome: 'FAILED',
      failureReason: 'clipboard blocked',
    })
    expect(seen.some((e) => e.type === 'DispatchFailed')).toBe(true)
  })

  it('Given a thread larger than the cap, When envelope is built, Then it carries the trimmed thread', async () => {
    const { repo, taskId } = await seedTask()

    const { envelope } = await dispatchTask(
      {
        taskId,
        agent: 'claude-code',
        envelopeOptions: { maxThreadMessages: 1 },
      },
      { repo, clipboard: new RecordingClipboard(), clock: makeClock(1_800_000_000_000) },
    )

    expect(envelope.review.thread).toHaveLength(0)
  })

  it('Given a task in RESOLVED state, When dispatch is attempted, Then it is rejected (terminal state)', async () => {
    const { repo, taskId } = await seedTask()
    const stored = await repo.findById(taskId)
    stored!.dispatch('claude-code')
    stored!.markInProgress()
    stored!.resolve()
    await repo.save(stored!)

    await expect(
      dispatchTask(
        { taskId, agent: 'claude-code' },
        { repo, clipboard: new RecordingClipboard(), clock: makeClock(1_800_000_000_000) },
      ),
    ).rejects.toThrow(/transition/i)
  })

  it('Given an unknown taskId, Then a TaskNotFoundError is thrown', async () => {
    await expect(
      dispatchTask(
        { taskId: 'does-not-exist', agent: 'claude-code' },
        {
          repo: new InMemoryReviewTaskRepository(),
          clipboard: new RecordingClipboard(),
          clock: makeClock(),
        },
      ),
    ).rejects.toBeInstanceOf(TaskNotFoundError)
  })
})
