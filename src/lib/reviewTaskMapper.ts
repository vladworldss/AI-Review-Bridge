/**
 * Minimal mapper from fetched GitLab discussions to ReviewTask aggregates,
 * plus an in-memory store. No repository, no persistence — designed for
 * the content-script UI layer.
 *
 * Rules:
 *  - Any discussion with at least one human (non-system) note becomes a
 *    ReviewTask. We do NOT require `resolvable` — general MR comments and
 *    discussions whose diff position went stale after a rebase are reported by
 *    GitLab as resolvable:false, yet they're still real review feedback the
 *    user needs to see. (Pure system-note threads are still ignored as noise.)
 *  - sync() is upsert: new tasks are created; existing ones get their thread
 *    refreshed (new replies pulled in) and task.resolve() called when GitLab
 *    reports the discussion as resolved.
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
  updated: ReviewTaskSnapshot[]
  resolved: ReviewTaskSnapshot[]
  removed: ReviewTaskSnapshot[]
  skipped: number
}

/** A discussion is worth tracking if it carries at least one human note. */
function hasHumanNote(d: FetchedDiscussion): boolean {
  return d.notes.some((n) => !n.isSystem)
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
    const updated: ReviewTaskSnapshot[] = []
    const resolved: ReviewTaskSnapshot[] = []
    const removed: ReviewTaskSnapshot[] = []
    let skipped = 0

    // Track which discussions GitLab still reports as resolvable, so we can
    // prune tasks whose discussion was deleted/unresolvabled since last sync.
    // Without this, a comment deleted in GitLab lingers in the sidebar until
    // a full page reload rebuilds the store from scratch.
    const seen = new Set<string>()

    for (const d of discussions) {
      // Skip pure system-note threads (e.g. "changed the description") — they
      // carry no human feedback. We intentionally do NOT filter on `resolvable`:
      // general comments and rebase-staled diff notes come back as
      // resolvable:false but are still real review feedback.
      if (!hasHumanNote(d)) {
        skipped++
        continue
      }
      seen.add(d.discussionId)

      const existing = this.byDiscussionId.get(d.discussionId)
      if (existing) {
        // Pull in new replies that arrived since the task was created.
        if (existing.refreshContext(toCommentContext(mr.title, d))) {
          updated.push(existing.toSnapshot())
        }
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

    return { created, updated, resolved, removed, skipped }
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
