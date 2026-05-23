import type { ParsedMergeRequest } from '../../gitlab-integration/domain'
import { TaskState, type Clock } from '../domain'
import type { ReviewTaskRepository } from './ReviewTaskRepository'
import { publishTaskEvents, type TaskEventBus } from './TaskEventBus'

export type SyncResolvedDiscussionsInput = {
  mr: ParsedMergeRequest
}

export type SyncResolvedDiscussionsDeps = {
  repo: ReviewTaskRepository
  eventBus?: TaskEventBus
  clock?: Clock
}

export type SyncResolvedDiscussionsResult = {
  resolvedTaskIds: string[]
}

export async function syncResolvedDiscussions(
  input: SyncResolvedDiscussionsInput,
  deps: SyncResolvedDiscussionsDeps,
): Promise<SyncResolvedDiscussionsResult> {
  const resolvedTaskIds: string[] = []

  for (const discussion of input.mr.discussions) {
    if (!discussion.resolved) continue

    const task = await deps.repo.findByDiscussionId(discussion.discussionId)
    if (!task) continue
    if (task.state === TaskState.RESOLVED) continue
    if (task.isTerminal) continue

    task.resolve()
    await deps.repo.save(task)
    if (deps.eventBus) await publishTaskEvents(task, deps.eventBus)

    resolvedTaskIds.push(task.id)
  }

  return { resolvedTaskIds }
}
