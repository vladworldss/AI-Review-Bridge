import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { JSDOM } from 'jsdom'

import type { ReviewTask, ReviewTaskSnapshot } from '../../../src/contexts/task-management/domain'
import type { ReviewTaskRepository } from '../../../src/contexts/task-management/application/ReviewTaskRepository'
import type { ClipboardPort } from '../../../src/contexts/ai-dispatch/application/ClipboardPort'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures')

export function loadFixture(name: string): Document {
  const html = readFileSync(join(fixturesDir, name), 'utf8')
  return new JSDOM(html).window.document
}

export function makeClock(start = 1_700_000_000_000) {
  let t = 0
  return () => new Date(start + ++t * 1000).toISOString()
}

export function makeIdGen(prefix = 'id') {
  let n = 0
  return () => `${prefix}-${++n}`
}

export class InMemoryReviewTaskRepository implements ReviewTaskRepository {
  private byId = new Map<string, ReviewTask>()
  private byDiscussion = new Map<string, string>()
  private byMr = new Map<string, Set<string>>()

  async save(task: ReviewTask): Promise<void> {
    const snap = task.toSnapshot()
    this.byId.set(snap.id, task)
    this.byDiscussion.set(snap.discussionId, snap.id)
    const mrSet = this.byMr.get(snap.mrId) ?? new Set<string>()
    mrSet.add(snap.id)
    this.byMr.set(snap.mrId, mrSet)
  }

  async findById(id: string): Promise<ReviewTask | null> {
    return this.byId.get(id) ?? null
  }

  async findByDiscussionId(discussionId: string): Promise<ReviewTask | null> {
    const id = this.byDiscussion.get(discussionId)
    return id ? (this.byId.get(id) ?? null) : null
  }

  async listByMr(mrId: string): Promise<ReviewTaskSnapshot[]> {
    const ids = this.byMr.get(mrId) ?? new Set<string>()
    return [...ids]
      .map((id) => this.byId.get(id))
      .filter((t): t is ReviewTask => t !== undefined)
      .map((t) => t.toSnapshot())
  }
}

export class RecordingClipboard implements ClipboardPort {
  public writes: string[] = []
  public shouldFail = false

  async write(payload: string): Promise<void> {
    if (this.shouldFail) throw new Error('clipboard blocked')
    this.writes.push(payload)
  }
}

export const MR_URL_BASIC = 'https://gitlab.com/acme/repo/-/merge_requests/42'
