/**
 * Runtime view §6.1 — Extract Review Task
 *
 *   User opens MR
 *   -> Extension parses discussions
 *   -> ReviewTask created
 *   -> Inbox updated
 *
 * Test cases §15:
 *   - Parse GitLab Discussion       (covered by GitLabDomParser.test.ts)
 *   - Build Review Task             (this file)
 *   - Edge: deleted comments        (covered by parser test)
 *   - Edge: missing diff context    (this file — flow-level assertion)
 */

import { describe, expect, it } from 'vitest'

import { extractDiscussions } from '../../../src/contexts/gitlab-integration/application/ExtractDiscussions'
import { createTaskFromDiscussion } from '../../../src/contexts/task-management/application/CreateTaskFromDiscussion'
import { NotImplementedError } from '../../../src/shared/errors'
import {
  InMemoryReviewTaskRepository,
  MR_URL_BASIC,
  loadFixture,
  makeClock,
  makeIdGen,
} from './test-helpers'

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

    const deps = {
      repo: new InMemoryReviewTaskRepository(),
      clock: makeClock(),
      newId: makeIdGen('task'),
    }

    // Use-case is intentionally a stub until CreateTaskFromDiscussion is implemented.
    // Asserting the contract: NotImplementedError until then, otherwise the assertions below.
    await expect(
      createTaskFromDiscussion({ mr: mr!, discussion }, deps),
    ).rejects.toBeInstanceOf(NotImplementedError)
  })

  it.todo(
    'Given an existing task for the same discussion, When create runs again, Then no duplicate is created',
  )

  it.todo(
    'Given a discussion with no diff context, When create runs, Then a task is still created and flagged',
  )

  it.todo(
    'Given multiple discussions on the MR, When extract+create runs, Then the inbox lists one task per discussion',
  )
})
