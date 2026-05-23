/**
 * Runtime view §6.3 — Resolve Task
 *
 *   Developer fixes issue
 *   -> Discussion resolved
 *   -> Task marked resolved
 */

import { describe, expect, it } from 'vitest'

import { extractDiscussions } from '../../../src/contexts/gitlab-integration/application/ExtractDiscussions'
import { createTaskFromDiscussion } from '../../../src/contexts/task-management/application/CreateTaskFromDiscussion'
import { syncResolvedDiscussions } from '../../../src/contexts/task-management/application/SyncResolvedDiscussions'
import {
  createInMemoryTaskEventBus,
  type TaskEventBus,
} from '../../../src/contexts/task-management/application/TaskEventBus'
import type { DomainEvent } from '../../../src/contexts/task-management/domain'
import type { ParsedMergeRequest as GitLabMr } from '../../../src/contexts/gitlab-integration/domain'
import {
  InMemoryReviewTaskRepository,
  MR_URL_BASIC,
  loadFixture,
  makeClock,
  makeIdGen,
} from './test-helpers'

async function seedTasksFromBasicFixture(opts: { eventBus?: TaskEventBus } = {}) {
  const { mr } = extractDiscussions({
    document: loadFixture('mr-basic.html'),
    url: MR_URL_BASIC,
  })
  const repo = new InMemoryReviewTaskRepository()
  const deps = {
    repo,
    clock: makeClock(),
    newId: makeIdGen('task'),
    ...(opts.eventBus ? { eventBus: opts.eventBus } : {}),
  }
  for (const d of mr!.discussions) {
    await createTaskFromDiscussion({ mr: mr!, discussion: d }, deps)
  }
  return { repo, mr: mr! }
}

function mutateResolved(
  mr: GitLabMr,
  discussionId: string,
  resolved: boolean,
): GitLabMr {
  return {
    ...mr,
    discussions: mr.discussions.map((d) =>
      d.discussionId === discussionId ? { ...d, resolved } : d,
    ),
  }
}

describe('§6 Resolve Task flow', () => {
  it('Given a resolved discussion, When the extension syncs, Then the matching task is marked resolved', async () => {
    const eventBus = createInMemoryTaskEventBus()
    const seen: DomainEvent[] = []
    eventBus.onAny((e) => {
      seen.push(e)
    })
    const { repo, mr } = await seedTasksFromBasicFixture({ eventBus })

    const { resolvedTaskIds } = await syncResolvedDiscussions(
      { mr },
      { repo, eventBus, clock: makeClock(1_800_000_000_000) },
    )

    expect(resolvedTaskIds).toHaveLength(1)
    const tasks = await repo.listByMr(mr.mrId)
    const resolved = tasks.find((t) => t.discussionId === 'def456')
    expect(resolved?.state).toBe('RESOLVED')
    expect(seen.some((e) => e.type === 'ReviewTaskResolved')).toBe(true)
  })

  it('Given an unresolved discussion on the MR, When sync runs, Then the matching task stays in its current state', async () => {
    const { repo, mr } = await seedTasksFromBasicFixture()

    await syncResolvedDiscussions(
      { mr },
      { repo, clock: makeClock(1_800_000_000_000) },
    )

    const tasks = await repo.listByMr(mr.mrId)
    const stillOpen = tasks.find((t) => t.discussionId === 'abc123')
    expect(stillOpen?.state).toBe('NEW')
  })

  it('Given a discussion that disappears from the MR, When sync runs, Then the orphan task is NOT auto-resolved', async () => {
    const { repo, mr } = await seedTasksFromBasicFixture()

    const partial: GitLabMr = {
      ...mr,
      discussions: mr.discussions.filter((d) => d.discussionId !== 'abc123'),
    }
    await syncResolvedDiscussions(
      { mr: partial },
      { repo, clock: makeClock(1_800_000_000_000) },
    )

    const tasks = await repo.listByMr(mr.mrId)
    const orphan = tasks.find((t) => t.discussionId === 'abc123')
    expect(orphan?.state).toBe('NEW')
  })

  it('Given a resolved discussion with no matching task, When sync runs, Then no task is created and no error is thrown', async () => {
    const repo = new InMemoryReviewTaskRepository()
    const { mr } = extractDiscussions({
      document: loadFixture('mr-basic.html'),
      url: MR_URL_BASIC,
    })

    const { resolvedTaskIds } = await syncResolvedDiscussions(
      { mr: mr! },
      { repo, clock: makeClock(1_800_000_000_000) },
    )

    expect(resolvedTaskIds).toEqual([])
    expect(await repo.listByMr(mr!.mrId)).toEqual([])
  })

  it('Given sync runs twice on the same resolved discussion, Then ReviewTaskResolved is emitted only once', async () => {
    const eventBus = createInMemoryTaskEventBus()
    const resolved: DomainEvent[] = []
    eventBus.on('ReviewTaskResolved', (e) => {
      resolved.push(e)
    })
    const { repo, mr } = await seedTasksFromBasicFixture({ eventBus })

    await syncResolvedDiscussions(
      { mr },
      { repo, eventBus, clock: makeClock(1_800_000_000_000) },
    )
    await syncResolvedDiscussions(
      { mr },
      { repo, eventBus, clock: makeClock(1_800_000_000_001) },
    )

    expect(resolved).toHaveLength(1)
  })

  it('Given a previously-resolved discussion that becomes unresolved, Then the task stays RESOLVED (terminal)', async () => {
    const { repo, mr } = await seedTasksFromBasicFixture()
    await syncResolvedDiscussions(
      { mr },
      { repo, clock: makeClock(1_800_000_000_000) },
    )

    const reopened = mutateResolved(mr, 'def456', false)
    await syncResolvedDiscussions(
      { mr: reopened },
      { repo, clock: makeClock(1_800_000_000_001) },
    )

    const tasks = await repo.listByMr(mr.mrId)
    const t = tasks.find((x) => x.discussionId === 'def456')
    expect(t?.state).toBe('RESOLVED')
  })
})
