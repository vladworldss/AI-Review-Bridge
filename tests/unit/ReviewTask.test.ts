import { describe, expect, it } from 'vitest'

import {
  IllegalTaskTransitionError,
  ReviewTask,
  TaskState,
  UnknownDispatchError,
  type CommentContext,
} from '../../src/contexts/task-management/domain'

const context: CommentContext = {
  filePath: 'auth/service.ts',
  line: 182,
  diffHunk: '@@ -180,3 +180,5 @@',
  surroundingLines: { before: [], after: [] },
  discussionThread: [
    { author: 'reviewer', body: 'Potential race condition', createdAt: '2026-05-23T10:00:00Z' },
  ],
  mrTitle: 'Refactor auth middleware',
}

function makeDeps(start = 0) {
  let t = start
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

describe('ReviewTask.create', () => {
  it('starts in NEW and emits ReviewTaskCreated', () => {
    const task = newTask()
    expect(task.state).toBe(TaskState.NEW)
    const events = task.pullEvents()
    expect(events).toHaveLength(1)
    expect(events.at(0)?.type).toBe('ReviewTaskCreated')
  })

  it('pullEvents drains the buffer', () => {
    const task = newTask()
    task.pullEvents()
    expect(task.pullEvents()).toHaveLength(0)
  })
})

describe('ReviewTask.dispatch', () => {
  it('moves NEW → DISPATCHED, records dispatch and event', () => {
    const task = newTask()
    task.pullEvents()
    const dispatch = task.dispatch('claude-code')

    expect(task.state).toBe(TaskState.DISPATCHED)
    expect(dispatch.outcome).toBe('PENDING')
    expect(task.toSnapshot().dispatches).toHaveLength(1)
    const events = task.pullEvents()
    expect(events.at(0)).toMatchObject({ type: 'ReviewTaskDispatched', agent: 'claude-code' })
  })

  it('supports redispatch after failure', () => {
    const task = newTask()
    const first = task.dispatch('claude-code')
    task.markDispatchFailed(first.id, 'clipboard blocked')
    expect(task.state).toBe(TaskState.FAILED)

    const second = task.dispatch('codex')
    expect(task.state).toBe(TaskState.DISPATCHED)
    expect(task.toSnapshot().dispatches.map((d) => d.id)).toEqual([first.id, second.id])
  })
})

describe('ReviewTask lifecycle', () => {
  it('walks NEW → DISPATCHED → IN_PROGRESS → RESOLVED', () => {
    const task = newTask()
    task.dispatch('claude-code')
    task.markInProgress()
    expect(task.state).toBe(TaskState.IN_PROGRESS)
    task.resolve()
    expect(task.state).toBe(TaskState.RESOLVED)
    expect(task.isTerminal).toBe(true)
  })

  it('rejects illegal transitions', () => {
    const task = newTask()
    expect(() => task.markInProgress()).toThrow(IllegalTaskTransitionError)
  })

  it('allows direct NEW → RESOLVED for discussions resolved without dispatch', () => {
    const task = newTask()
    task.resolve()
    expect(task.state).toBe(TaskState.RESOLVED)
  })

  it('rejects transitions out of terminal states', () => {
    const task = newTask()
    task.ignore()
    expect(task.isTerminal).toBe(true)
    expect(() => task.dispatch('claude-code')).toThrow(IllegalTaskTransitionError)
  })

  it('emits ReviewTaskResolved exactly once', () => {
    const task = newTask()
    task.dispatch('claude-code')
    task.markInProgress()
    task.pullEvents()
    task.resolve()
    const events = task.pullEvents()
    expect(events.filter((e) => e.type === 'ReviewTaskResolved')).toHaveLength(1)
  })
})

describe('dispatch outcomes', () => {
  it('marks SUCCESS without changing task state', () => {
    const task = newTask()
    const dispatch = task.dispatch('claude-code')
    task.markDispatchSucceeded(dispatch.id)
    expect(task.state).toBe(TaskState.DISPATCHED)
    expect(task.toSnapshot().dispatches.at(0)?.outcome).toBe('SUCCESS')
  })

  it('marks FAILED and emits DispatchFailed', () => {
    const task = newTask()
    const dispatch = task.dispatch('claude-code')
    task.pullEvents()
    task.markDispatchFailed(dispatch.id, 'clipboard blocked')

    const snap = task.toSnapshot().dispatches.at(0)!
    expect(snap.outcome).toBe('FAILED')
    expect(snap.failureReason).toBe('clipboard blocked')
    expect(task.pullEvents().at(0)).toMatchObject({ type: 'DispatchFailed', reason: 'clipboard blocked' })
  })

  it('throws on unknown dispatch id', () => {
    const task = newTask()
    expect(() => task.markDispatchSucceeded('nope')).toThrow(UnknownDispatchError)
  })
})

describe('rehydrate', () => {
  it('round-trips snapshot without emitting events', () => {
    const task = newTask()
    task.dispatch('claude-code')
    task.markInProgress()
    const snap = task.toSnapshot()

    const restored = ReviewTask.rehydrate(snap, makeDeps(100))
    expect(restored.state).toBe(TaskState.IN_PROGRESS)
    expect(restored.pullEvents()).toHaveLength(0)
    expect(restored.toSnapshot()).toEqual(snap)
  })

  it('snapshot dispatches array is decoupled from internal state', () => {
    const task = newTask()
    task.dispatch('claude-code')
    const snap = task.toSnapshot()
    snap.dispatches.push({
      id: 'tampered',
      agent: 'codex',
      dispatchedAt: 'x',
      outcome: 'PENDING',
    })
    expect(task.toSnapshot().dispatches).toHaveLength(1)
  })
})
