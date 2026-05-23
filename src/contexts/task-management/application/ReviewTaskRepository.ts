import type { ReviewTask, ReviewTaskSnapshot } from '../domain'

export interface ReviewTaskRepository {
  save(task: ReviewTask): Promise<void>
  findById(id: string): Promise<ReviewTask | null>
  findByDiscussionId(discussionId: string): Promise<ReviewTask | null>
  listByMr(mrId: string): Promise<ReviewTaskSnapshot[]>
}
