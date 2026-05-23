import { NotImplementedError } from '../../../shared/errors'
import type {
  ParsedDiscussion,
  ParsedMergeRequest,
} from '../../gitlab-integration/domain'
import type { Clock, IdGenerator, ReviewTask } from '../domain'
import type { ReviewTaskRepository } from './ReviewTaskRepository'

export type CreateTaskFromDiscussionInput = {
  mr: ParsedMergeRequest
  discussion: ParsedDiscussion
}

export type CreateTaskFromDiscussionDeps = {
  repo: ReviewTaskRepository
  clock?: Clock
  newId: IdGenerator
}

export type CreateTaskFromDiscussionResult = {
  task: ReviewTask
  created: boolean
}

export async function createTaskFromDiscussion(
  _input: CreateTaskFromDiscussionInput,
  _deps: CreateTaskFromDiscussionDeps,
): Promise<CreateTaskFromDiscussionResult> {
  throw new NotImplementedError('createTaskFromDiscussion')
}
