/**
 * Runtime view §6.1 — Extract Review Task
 *
 *   User opens MR
 *   -> Extension parses discussions
 *   -> ReviewTask created
 *   -> Inbox updated
 */

import { describe, expect, it } from 'vitest'

import { extractDiscussions } from '../../../src/contexts/gitlab-integration/application/ExtractDiscussions'
import { createTaskFromDiscussion } from '../../../src/contexts/task-management/application/CreateTaskFromDiscussion'
import {
  InMemoryReviewTaskRepository,
  MR_URL_BASIC,
  loadFixture,
  makeClock,
  makeIdGen,
} from './test-helpers'

function makeDeps(repo = new InMemoryReviewTaskRepository()) {
  return { repo, clock: makeClock(), newId: makeIdGen('task') }
}

describe('§6 Extract Review Task flow', () => {
  it('Given an MR page, When the extension loads, Then discussions are extracted', () => {
    const { mr, warnings } = extractDiscussions({
      document: loadFixture('mr-basic.html'),
      url: MR_URL_BASIC,
    })

    expect(mr).not.toBeNull()
    expect(mr?.discussions.length).toBeGreaterThan(0)
    expect(warnings).toEqual([])
  })

  it('Given a parsed discussion, When the builder executes, Then a ReviewTask is created', async () => {
    const { mr } = extractDiscussions({
      document: loadFixture('mr-basic.html'),
      url: MR_URL_BASIC,
    })
    const discussion = mr!.discussions.at(0)!

    const { task, created } = await createTaskFromDiscussion(
      { mr: mr!, discussion },
      makeDeps(),
    )

    expect(created).toBe(true)
    const snap = task.toSnapshot()
    expect(snap.state).toBe('NEW')
    expect(snap.discussionId).toBe(discussion.discussionId)
    expect(snap.mrId).toBe(mr!.mrId)
    expect(snap.context.filePath).toBe('auth/service.ts')
    expect(snap.context.line).toBe(182)
    expect(snap.context.discussionThread.at(0)?.body).toMatch(/race condition/)
  })

  it('Given an existing task for the same discussion, When create runs again, Then no duplicate is created', async () => {
    const { mr } = extractDiscussions({
      document: loadFixture('mr-basic.html'),
      url: MR_URL_BASIC,
    })
    const discussion = mr!.discussions.at(0)!
    const deps = makeDeps()

    const first = await createTaskFromDiscussion({ mr: mr!, discussion }, deps)
    const second = await createTaskFromDiscussion({ mr: mr!, discussion }, deps)

    expect(second.created).toBe(false)
    expect(second.task.id).toBe(first.task.id)
    const all = await deps.repo.listByMr(mr!.mrId)
    expect(all).toHaveLength(1)
  })

  it('Given a discussion with no diff context, When create runs, Then a task is still created and context fields are blank', async () => {
    const { mr } = extractDiscussions({
      document: loadFixture('mr-edge-cases.html'),
      url: 'https://gitlab.com/acme/repo/-/merge_requests/7',
    })
    const orphan = mr!.discussions.find((d) => d.discussionId === 'orphan-1')!

    const { task, created } = await createTaskFromDiscussion(
      { mr: mr!, discussion: orphan },
      makeDeps(),
    )

    expect(created).toBe(true)
    const snap = task.toSnapshot()
    expect(snap.context.filePath).toBe('')
    expect(snap.context.line).toBe(0)
    expect(snap.context.diffHunk).toBe('')
  })

  it('Given multiple discussions on the MR, When extract+create runs, Then the inbox lists one task per discussion', async () => {
    const { mr } = extractDiscussions({
      document: loadFixture('mr-basic.html'),
      url: MR_URL_BASIC,
    })
    const deps = makeDeps()

    for (const d of mr!.discussions) {
      await createTaskFromDiscussion({ mr: mr!, discussion: d }, deps)
    }

    const inbox = await deps.repo.listByMr(mr!.mrId)
    expect(inbox.map((t) => t.discussionId).sort()).toEqual(
      mr!.discussions.map((d) => d.discussionId).sort(),
    )
  })
})
