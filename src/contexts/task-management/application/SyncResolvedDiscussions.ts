import { NotImplementedError } from '../../../shared/errors'
import type { ParsedMergeRequest } from '../../gitlab-integration/domain'
import type { Clock } from '../domain'
import type { ReviewTaskRepository } from './ReviewTaskRepository'

export type SyncResolvedDiscussionsInput = {
  mr: ParsedMergeRequest
}

export type SyncResolvedDiscussionsDeps = {
  repo: ReviewTaskRepository
  clock?: Clock
}

export type SyncResolvedDiscussionsResult = {
  resolvedTaskIds: string[]
}

export async function syncResolvedDiscussions(
  _input: SyncResolvedDiscussionsInput,
  _deps: SyncResolvedDiscussionsDeps,
): Promise<SyncResolvedDiscussionsResult> {
  throw new NotImplementedError('syncResolvedDiscussions')
}
