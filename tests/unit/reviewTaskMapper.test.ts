import { describe, expect, it } from 'vitest'

import {
  InMemoryReviewTaskStore,
  summarizeStore,
  toReviewTask,
} from '../../src/lib/reviewTaskMapper'
import { TaskState } from '../../src/contexts/task-management/domain'
import type { FetchedDiscussion } from '../../src/lib/fetchGitLabDiscussions'

function fixedClock(start = 1_700_000_000_000) {
  let t = 0
  return () => new Date(start + ++t * 1000).toISOString()
}
function idGen(prefix = 'task') {
  let n = 0
  return () => `${prefix}-${++n}`
}

function makeDiscussion(over: Partial<FetchedDiscussion> = {}): FetchedDiscussion {
  return {
    discussionId: 'd-abc',
    resolved: false,
    resolvable: true,
    filePath: 'auth/service.go',
    line: 182,
    hasDiffContext: true,
    notes: [
      {
        noteId: 'n1',
        author: 'alice',
        body: 'race condition?',
        createdAt: '2026-05-23T09:00:00Z',
        isSystem: false,
      },
      {
        noteId: 'n2',
        author: 'bob',
        body: 'good catch',
        createdAt: '2026-05-23T09:05:00Z',
        isSystem: false,
      },
    ],
    ...over,
  }
}

describe('toReviewTask', () => {
  it('produces a NEW task with mr + discussion ids and context', () => {
    const task = toReviewTask({
      mr: { iid: '40', title: 'Refactor auth' },
      discussion: makeDiscussion(),
      id: 'task-1',
      now: '2026-05-23T10:00:00Z',
    })

    const snap = task.toSnapshot()
    expect(snap.id).toBe('task-1')
    expect(snap.mrId).toBe('40')
    expect(snap.discussionId).toBe('d-abc')
    expect(snap.commentId).toBe('n1')
    expect(snap.state).toBe(TaskState.NEW)
    expect(snap.context).toMatchObject({
      filePath: 'auth/service.go',
      line: 182,
      mrTitle: 'Refactor auth',
    })
    expect(snap.context.discussionThread).toHaveLength(2)
  })

  it('falls back to discussionId when no comments exist', () => {
    const task = toReviewTask({
      mr: { iid: '40', title: 't' },
      discussion: makeDiscussion({ notes: [] }),
      id: 'task-1',
      now: '2026-05-23T10:00:00Z',
    })
    expect(task.toSnapshot().commentId).toBe('d-abc')
  })

  it('filters out system notes from the thread', () => {
    const task = toReviewTask({
      mr: { iid: '40', title: 't' },
      discussion: makeDiscussion({
        notes: [
          {
            noteId: 'sys',
            author: 'gitlab',
            body: 'marked as resolved',
            createdAt: null,
            isSystem: true,
          },
          {
            noteId: 'n1',
            author: 'alice',
            body: 'real',
            createdAt: null,
            isSystem: false,
          },
        ],
      }),
      id: 'task-1',
      now: '2026-05-23T10:00:00Z',
    })
    const thread = task.toSnapshot().context.discussionThread
    expect(thread).toHaveLength(1)
    expect(thread.at(0)?.body).toBe('real')
    // commentId still points at the first human note
    expect(task.toSnapshot().commentId).toBe('n1')
  })

  it('handles missing file path / line gracefully', () => {
    const task = toReviewTask({
      mr: { iid: '40', title: 't' },
      discussion: makeDiscussion({ filePath: null, line: null, hasDiffContext: false }),
      id: 'task-1',
      now: '2026-05-23T10:00:00Z',
    })
    expect(task.toSnapshot().context.filePath).toBe('')
    expect(task.toSnapshot().context.line).toBe(0)
  })
})

describe('InMemoryReviewTaskStore.syncFromDiscussions', () => {
  const mr = { iid: '40', title: 'Refactor auth' }

  it('creates ReviewTasks only for resolvable discussions', () => {
    const store = new InMemoryReviewTaskStore(fixedClock(), idGen())
    const result = store.syncFromDiscussions(mr, [
      makeDiscussion({ discussionId: 'd1', resolvable: true }),
      makeDiscussion({ discussionId: 'd2', resolvable: false }),
      makeDiscussion({ discussionId: 'd3', resolvable: true }),
    ])

    expect(store.size()).toBe(2)
    expect(result.created).toHaveLength(2)
    expect(result.skipped).toBe(1)
    expect(store.list().map((t) => t.discussionId).sort()).toEqual(['d1', 'd3'])
  })

  it('is idempotent on repeat sync — does not duplicate tasks', () => {
    const store = new InMemoryReviewTaskStore(fixedClock(), idGen())
    const list = [makeDiscussion({ discussionId: 'd1' })]

    const first = store.syncFromDiscussions(mr, list)
    const second = store.syncFromDiscussions(mr, list)

    expect(first.created).toHaveLength(1)
    expect(second.created).toHaveLength(0)
    expect(store.size()).toBe(1)
  })

  it('auto-resolves a task when GitLab reports the discussion as resolved', () => {
    const store = new InMemoryReviewTaskStore(fixedClock(), idGen())
    store.syncFromDiscussions(mr, [makeDiscussion({ discussionId: 'd1', resolved: false })])
    expect(store.get('d1')?.state).toBe(TaskState.NEW)

    const result = store.syncFromDiscussions(mr, [
      makeDiscussion({ discussionId: 'd1', resolved: true }),
    ])
    expect(result.resolved).toHaveLength(1)
    expect(store.get('d1')?.state).toBe(TaskState.RESOLVED)
  })

  it('emits ReviewTaskResolved only once across multiple syncs', () => {
    const store = new InMemoryReviewTaskStore(fixedClock(), idGen())
    store.syncFromDiscussions(mr, [makeDiscussion({ discussionId: 'd1', resolved: false })])
    const a = store.syncFromDiscussions(mr, [
      makeDiscussion({ discussionId: 'd1', resolved: true }),
    ])
    const b = store.syncFromDiscussions(mr, [
      makeDiscussion({ discussionId: 'd1', resolved: true }),
    ])
    expect(a.resolved).toHaveLength(1)
    expect(b.resolved).toHaveLength(0)
  })

  it('treats first-sync resolved=true as immediate-resolved task', () => {
    const store = new InMemoryReviewTaskStore(fixedClock(), idGen())
    const result = store.syncFromDiscussions(mr, [
      makeDiscussion({ discussionId: 'd1', resolved: true }),
    ])

    expect(result.created).toHaveLength(0)
    expect(result.resolved).toHaveLength(1)
    expect(store.get('d1')?.state).toBe(TaskState.RESOLVED)
  })

  it('orphans (discussions that disappear) are left alone', () => {
    const store = new InMemoryReviewTaskStore(fixedClock(), idGen())
    store.syncFromDiscussions(mr, [
      makeDiscussion({ discussionId: 'd1' }),
      makeDiscussion({ discussionId: 'd2' }),
    ])

    store.syncFromDiscussions(mr, [makeDiscussion({ discussionId: 'd1' })])

    expect(store.size()).toBe(2)
    expect(store.get('d2')?.state).toBe(TaskState.NEW)
  })
})

describe('summarizeStore', () => {
  it('counts open vs resolved tasks', () => {
    const store = new InMemoryReviewTaskStore(fixedClock(), idGen())
    store.syncFromDiscussions({ iid: '40', title: 't' }, [
      makeDiscussion({ discussionId: 'd1', resolved: false }),
      makeDiscussion({ discussionId: 'd2', resolved: true }),
      makeDiscussion({ discussionId: 'd3', resolved: false }),
    ])
    expect(summarizeStore(store)).toEqual({ total: 3, open: 2, resolved: 1 })
  })
})
