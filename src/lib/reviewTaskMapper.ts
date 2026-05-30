/**
 * Minimal mapper from fetched GitLab discussions to ReviewTask aggregates,
 * plus an in-memory store. No repository, no persistence — designed for
 * the content-script UI layer.
 *
 * Rules:
 *  - Only resolvable discussions become ReviewTasks (general threads are ignored).
 *  - sync() is upsert: new tasks are created, existing ones get task.resolve()
 *    called when GitLab reports the discussion as resolved.
 *  - In-memory state (dispatches, FAILED, etc.) is preserved across syncs.
 */

import {
  ReviewTask,
  TaskState,
  type CommentContext,
  type DiscussionMessage,
  type ReviewTaskSnapshot,
} from '../contexts/task-management/domain'
import type { FetchedDiscussion } from './fetchGitLabDiscussions'

export type ReviewTaskMapInput = {
  mr: { iid: string; title: string }
  discussion: FetchedDiscussion
  id: string
  now: string
}

export function toReviewTask(input: ReviewTaskMapInput): ReviewTask {
  const firstHuman =
    input.discussion.notes.find((n) => !n.isSystem) ?? input.discussion.notes.at(0)
  const commentId = firstHuman?.noteId ?? input.discussion.discussionId

  return ReviewTask.create(
    {
      id: input.id,
      mrId: input.mr.iid,
      discussionId: input.discussion.discussionId,
      commentId,
      context: toCommentContext(input.mr.title, input.discussion),
    },
    {
      clock: () => input.now,
      newId: () => `${input.id}-d`,
    },
  )
}

function toCommentContext(mrTitle: string, d: FetchedDiscussion): CommentContext {
  const thread: DiscussionMessage[] = d.notes
    .filter((n) => !n.isSystem)
    .map((n) => ({
      author: n.author,
      body: n.body,
      createdAt: n.createdAt ?? '',
    }))
  return {
    filePath: d.filePath ?? '',
    line: d.line ?? 0,
    diffHunk: '',
    surroundingLines: { before: [], after: [] },
    discussionThread: thread,
    mrTitle,
  }
}

export type SyncResult = {
  created: ReviewTaskSnapshot[]
  resolved: ReviewTaskSnapshot[]
  removed: ReviewTaskSnapshot[]
  skipped: number
}

export class InMemoryReviewTaskStore {
  private byDiscussionId = new Map<string, ReviewTask>()
  private idSeed = 0

  constructor(
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = () => `task-${++this.idSeed}`,
  ) {}

  list(): ReviewTaskSnapshot[] {
    return [...this.byDiscussionId.values()].map((t) => t.toSnapshot())
  }

  get(discussionId: string): ReviewTaskSnapshot | null {
    return this.byDiscussionId.get(discussionId)?.toSnapshot() ?? null
  }

  /** Returns the live aggregate (for callers that need to mutate state). */
  getEntity(discussionId: string): ReviewTask | null {
    return this.byDiscussionId.get(discussionId) ?? null
  }

  size(): number {
    return this.byDiscussionId.size
  }

  clear(): void {
    this.byDiscussionId.clear()
  }

  syncFromDiscussions(
    mr: { iid: string; title: string },
    discussions: ReadonlyArray<FetchedDiscussion>,
  ): SyncResult {
    const created: ReviewTaskSnapshot[] = []
    const resolved: ReviewTaskSnapshot[] = []
    const removed: ReviewTaskSnapshot[] = []
    let skipped = 0

    // Track which discussions GitLab still reports as resolvable, so we can
    // prune tasks whose discussion was deleted/unresolvabled since last sync.
    // Without this, a comment deleted in GitLab lingers in the sidebar until
    // a full page reload rebuilds the store from scratch.
    const seen = new Set<string>()

    for (const d of discussions) {
      if (!d.resolvable) {
        skipped++
        continue
      }
      seen.add(d.discussionId)

      const existing = this.byDiscussionId.get(d.discussionId)
      if (existing) {
        if (d.resolved && !existing.isTerminal) {
          existing.resolve()
          resolved.push(existing.toSnapshot())
        }
        continue
      }

      const task = toReviewTask({
        mr,
        discussion: d,
        id: this.newId(),
        now: this.clock(),
      })
      // If GitLab already reports it as resolved at first sync, reflect that.
      if (d.resolved) {
        task.resolve()
        this.byDiscussionId.set(d.discussionId, task)
        resolved.push(task.toSnapshot())
        continue
      }
      this.byDiscussionId.set(d.discussionId, task)
      created.push(task.toSnapshot())
    }

    // Prune tasks for discussions GitLab no longer returns (deleted comments).
    for (const [discussionId, task] of this.byDiscussionId) {
      if (!seen.has(discussionId)) {
        this.byDiscussionId.delete(discussionId)
        removed.push(task.toSnapshot())
      }
    }

    return { created, resolved, removed, skipped }
  }
}

export function summarizeStore(store: InMemoryReviewTaskStore): {
  total: number
  open: number
  resolved: number
} {
  const snaps = store.list()
  let open = 0
  let resolved = 0
  for (const s of snaps) {
    if (s.state === TaskState.RESOLVED) resolved++
    else open++
  }
  return { total: snaps.length, open, resolved }
}
