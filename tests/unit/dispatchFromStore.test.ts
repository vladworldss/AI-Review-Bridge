import { describe, expect, it, vi } from 'vitest'

import { dispatchFromStore, DispatchError } from '../../src/lib/dispatchFromStore'
import { InMemoryReviewTaskStore } from '../../src/lib/reviewTaskMapper'
import type { FetchedDiscussion } from '../../src/lib/fetchGitLabDiscussions'

function fixedClock(start = 1_700_000_000_000) {
  let t = 0
  return () => new Date(start + ++t * 1000).toISOString()
}
function idGen(prefix = 'task') {
  let n = 0
  return () => `${prefix}-${++n}`
}

function discussion(over: Partial<FetchedDiscussion> = {}): FetchedDiscussion {
  return {
    discussionId: 'd-1',
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
    ],
    ...over,
  }
}

function seededStore() {
  const store = new InMemoryReviewTaskStore(fixedClock(), idGen())
  store.syncFromDiscussions({ iid: '40', title: 'Refactor auth' }, [discussion()])
  return store
}

describe('dispatchFromStore', () => {
  it('copies payload, marks dispatch SUCCESS, transitions NEW → DISPATCHED', async () => {
    const store = seededStore()
    const clipboard = vi.fn().mockResolvedValue(undefined)

    const result = await dispatchFromStore(store, 'd-1', {
      clipboard,
      now: () => '2026-05-24T10:00:00Z',
    })

    expect(clipboard).toHaveBeenCalledTimes(1)
    expect(clipboard.mock.calls[0]?.[0]).toBe(result.payload)
    expect(result.envelope.taskId).toBe('task-1')
    expect(result.envelope.agent).toBe('clipboard')

    const snap = store.get('d-1')!
    expect(snap.state).toBe('DISPATCHED')
    expect(snap.dispatches.at(0)?.outcome).toBe('SUCCESS')
  })

  it('envelope carries mr title, reviewer comment, and file/line', async () => {
    const store = seededStore()
    const clipboard = vi.fn().mockResolvedValue(undefined)

    const { envelope } = await dispatchFromStore(store, 'd-1', { clipboard })

    expect(envelope.mr.title).toBe('Refactor auth')
    expect(envelope.review.comment).toBe('race condition?')
    expect(envelope.context.file).toBe('auth/service.go')
    expect(envelope.context.line).toBe(182)
  })

  it('payload is the rendered markdown text', async () => {
    const store = seededStore()
    const clipboard = vi.fn().mockResolvedValue(undefined)

    const { payload } = await dispatchFromStore(store, 'd-1', { clipboard })
    expect(payload).toContain('# Review task task-1')
    expect(payload).toContain('Refactor auth')
    expect(payload).toContain('race condition?')
  })

  it('throws DispatchError and marks task FAILED when clipboard write rejects', async () => {
    const store = seededStore()
    const clipboard = vi.fn().mockRejectedValue(new Error('not allowed'))

    await expect(
      dispatchFromStore(store, 'd-1', { clipboard }),
    ).rejects.toBeInstanceOf(DispatchError)

    const snap = store.get('d-1')!
    expect(snap.state).toBe('FAILED')
    expect(snap.dispatches.at(0)).toMatchObject({
      outcome: 'FAILED',
      failureReason: 'not allowed',
    })
  })

  it('throws when the discussion is not in the store', async () => {
    const store = seededStore()
    await expect(
      dispatchFromStore(store, 'does-not-exist', {
        clipboard: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(DispatchError)
  })

  it('allows redispatch from FAILED', async () => {
    const store = seededStore()
    const flakyClipboard = vi
      .fn()
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValue(undefined)

    await expect(
      dispatchFromStore(store, 'd-1', { clipboard: flakyClipboard }),
    ).rejects.toBeInstanceOf(DispatchError)
    expect(store.get('d-1')?.state).toBe('FAILED')

    await dispatchFromStore(store, 'd-1', { clipboard: flakyClipboard })
    expect(store.get('d-1')?.state).toBe('DISPATCHED')
    expect(store.get('d-1')?.dispatches).toHaveLength(2)
  })
})
