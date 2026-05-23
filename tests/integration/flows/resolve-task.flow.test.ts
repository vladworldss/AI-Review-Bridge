/**
 * Runtime view §6.3 — Resolve Task
 *
 *   Developer fixes issue
 *   -> Discussion resolved
 *   -> Task marked resolved
 *
 * Test cases §15:
 *   - Resolve Discussion (sync)     (this file)
 */

import { describe, expect, it } from 'vitest'

import { extractDiscussions } from '../../../src/contexts/gitlab-integration/application/ExtractDiscussions'
import { syncResolvedDiscussions } from '../../../src/contexts/task-management/application/SyncResolvedDiscussions'
import { NotImplementedError } from '../../../src/shared/errors'
import {
  InMemoryReviewTaskRepository,
  MR_URL_BASIC,
  loadFixture,
  makeClock,
} from './test-helpers'

describe('§6 Resolve Task flow', () => {
  it('Given a resolved discussion, When the extension syncs, Then the matching task is marked resolved', async () => {
    const { mr } = extractDiscussions({
      document: loadFixture('mr-basic.html'),
      url: MR_URL_BASIC,
    })

    const deps = {
      repo: new InMemoryReviewTaskRepository(),
      clock: makeClock(),
    }

    await expect(
      syncResolvedDiscussions({ mr: mr! }, deps),
    ).rejects.toBeInstanceOf(NotImplementedError)
  })

  it.todo(
    'Given an unresolved discussion on the MR, When sync runs, Then the matching task stays in its current state',
  )

  it.todo(
    'Given a discussion that disappears from the MR, When sync runs, Then the orphan task is NOT auto-resolved',
  )

  it.todo(
    'Given a resolved discussion with no matching task, When sync runs, Then no task is created and no error is thrown',
  )

  it.todo(
    'Given sync runs twice on the same resolved discussion, Then ReviewTaskResolved is emitted only once',
  )
})
