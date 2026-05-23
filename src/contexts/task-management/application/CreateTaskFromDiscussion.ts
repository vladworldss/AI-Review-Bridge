import type {
  ParsedDiscussion,
  ParsedMergeRequest,
} from '../../gitlab-integration/domain'
import {
  ReviewTask,
  type Clock,
  type CommentContext,
  type DiscussionMessage,
  type IdGenerator,
} from '../domain'
import type { ReviewTaskRepository } from './ReviewTaskRepository'
import { publishTaskEvents, type TaskEventBus } from './TaskEventBus'

export type CreateTaskFromDiscussionInput = {
  mr: ParsedMergeRequest
  discussion: ParsedDiscussion
}

export type CreateTaskFromDiscussionDeps = {
  repo: ReviewTaskRepository
  eventBus?: TaskEventBus
  clock?: Clock
  newId: IdGenerator
}

export type CreateTaskFromDiscussionResult = {
  task: ReviewTask
  created: boolean
}

export async function createTaskFromDiscussion(
  input: CreateTaskFromDiscussionInput,
  deps: CreateTaskFromDiscussionDeps,
): Promise<CreateTaskFromDiscussionResult> {
  const { mr, discussion } = input
  const existing = await deps.repo.findByDiscussionId(discussion.discussionId)
  if (existing) {
    return { task: existing, created: false }
  }

  const commentId = discussion.comments.at(0)?.commentId ?? discussion.discussionId
  const context = toCommentContext(mr, discussion)

  const task = ReviewTask.create(
    {
      id: deps.newId(),
      mrId: mr.mrId,
      discussionId: discussion.discussionId,
      commentId,
      context,
    },
    deps.clock ? { clock: deps.clock, newId: deps.newId } : { newId: deps.newId },
  )

  await deps.repo.save(task)
  if (deps.eventBus) await publishTaskEvents(task, deps.eventBus)

  return { task, created: true }
}

function toCommentContext(
  mr: ParsedMergeRequest,
  d: ParsedDiscussion,
): CommentContext {
  const thread: DiscussionMessage[] = d.comments.map((c) => ({
    author: c.author,
    body: c.body,
    createdAt: c.createdAt ?? '',
  }))
  return {
    filePath: d.filePath ?? '',
    line: d.line ?? 0,
    diffHunk: d.diffHunk ?? '',
    surroundingLines: { before: [], after: [] },
    discussionThread: thread,
    mrTitle: mr.title,
  }
}
