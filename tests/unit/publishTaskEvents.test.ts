import { describe, expect, it, vi } from 'vitest'

import {
  createInMemoryTaskEventBus,
  publishTaskEvents,
} from '../../src/contexts/task-management/application/TaskEventBus'
import {
  ReviewTask,
  type CommentContext,
  type DomainEvent,
} from '../../src/contexts/task-management/domain'

const context: CommentContext = {
  filePath: 'auth/service.ts',
  line: 182,
  diffHunk: '@@',
  surroundingLines: { before: [], after: [] },
  discussionThread: [
    { author: 'r', body: 'race condition', createdAt: '2026-05-23T09:00:00Z' },
  ],
  mrTitle: 'Refactor auth',
}

function makeDeps() {
  let t = 0
  let n = 0
  return {
    clock: () => new Date(1_700_000_000_000 + ++t * 1000).toISOString(),
    newId: () => `dispatch-${++n}`,
  }
}

function newTask() {
  return ReviewTask.create(
    { id: 'task-1', mrId: 'mr-1', discussionId: 'd-1', commentId: 'c-1', context },
    makeDeps(),
  )
}

describe('publishTaskEvents', () => {
  it('drains the aggregate event buffer', async () => {
    const task = newTask()
    const bus = createInMemoryTaskEventBus()

    await publishTaskEvents(task, bus)

    expect(task.pullEvents()).toHaveLength(0)
  })

  it('publishes ReviewTaskCreated after create()', async () => {
    const task = newTask()
    const bus = createInMemoryTaskEventBus()
    const seen: DomainEvent[] = []
    bus.onAny((e) => {
      seen.push(e)
    })

    await publishTaskEvents(task, bus)

    expect(seen.map((e) => e.type)).toEqual(['ReviewTaskCreated'])
  })

  it('publishes events from a full lifecycle in order', async () => {
    const task = newTask()
    const bus = createInMemoryTaskEventBus()
    const types: string[] = []
    bus.onAny((e) => {
      types.push(e.type)
    })

    await publishTaskEvents(task, bus) // ReviewTaskCreated
    task.dispatch('claude-code')
    task.markInProgress()
    task.resolve()
    await publishTaskEvents(task, bus)

    expect(types).toEqual([
      'ReviewTaskCreated',
      'ReviewTaskDispatched',
      'ReviewTaskResolved',
    ])
  })

  it('publishes DispatchFailed when a dispatch fails', async () => {
    const task = newTask()
    const bus = createInMemoryTaskEventBus()
    const onFailed = vi.fn()
    bus.on('DispatchFailed', onFailed)

    await publishTaskEvents(task, bus) // drain Created
    const dispatch = task.dispatch('claude-code')
    task.markDispatchFailed(dispatch.id, 'clipboard blocked')
    await publishTaskEvents(task, bus)

    expect(onFailed).toHaveBeenCalledTimes(1)
    expect(onFailed.mock.calls[0]?.[0]).toMatchObject({
      type: 'DispatchFailed',
      taskId: 'task-1',
      dispatchId: dispatch.id,
      reason: 'clipboard blocked',
    })
  })

  it('returns the published events for the caller', async () => {
    const task = newTask()
    const bus = createInMemoryTaskEventBus()

    const events = await publishTaskEvents(task, bus)

    expect(events.map((e) => e.type)).toEqual(['ReviewTaskCreated'])
  })
})
