import { describe, expect, it } from 'vitest'

import {
  buildPromptEnvelope,
  renderEnvelopeAsText,
} from '../../src/contexts/ai-dispatch/domain'
import type {
  CommentContext,
  ReviewTaskSnapshot,
} from '../../src/contexts/task-management/domain'

function makeContext(overrides: Partial<CommentContext> = {}): CommentContext {
  return {
    filePath: 'auth/service.ts',
    line: 182,
    diffHunk: '@@ -180,3 +180,5 @@\nconst session = req.session\nif (!session) return null\nreturn validate(session.token)',
    surroundingLines: { before: [], after: [] },
    discussionThread: [
      { author: 'reviewer-alice', body: 'Potential race condition here', createdAt: '2026-05-23T09:00:00Z' },
      { author: 'dev-bob', body: 'Will wrap in try/catch', createdAt: '2026-05-23T09:10:00Z' },
    ],
    mrTitle: 'Refactor auth middleware',
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<ReviewTaskSnapshot> = {}): ReviewTaskSnapshot {
  return {
    id: 'task-001',
    mrId: '123',
    discussionId: 'd-1',
    commentId: 'c-1',
    state: 'NEW',
    context: makeContext(),
    dispatches: [],
    createdAt: '2026-05-23T09:00:00Z',
    lastUpdatedAt: '2026-05-23T09:00:00Z',
    ...overrides,
  }
}

describe('buildPromptEnvelope', () => {
  it('matches the §11 dispatch payload shape', () => {
    const env = buildPromptEnvelope({
      task: makeSnapshot(),
      agent: 'claude-code',
      now: '2026-05-23T10:00:00Z',
    })

    expect(env).toMatchObject({
      taskId: 'task-001',
      mr: { id: '123', title: 'Refactor auth middleware' },
      review: { comment: 'Potential race condition here' },
      context: { file: 'auth/service.ts', line: 182 },
    })
    expect(env.generatedAt).toBe('2026-05-23T10:00:00Z')
    expect(env.agent).toBe('claude-code')
  })

  it('treats the first thread message as the review comment, rest as thread replies', () => {
    const env = buildPromptEnvelope({
      task: makeSnapshot(),
      agent: 'claude-code',
      now: '2026-05-23T10:00:00Z',
    })

    expect(env.review.comment).toBe('Potential race condition here')
    expect(env.review.thread).toEqual([
      { author: 'dev-bob', body: 'Will wrap in try/catch' },
    ])
  })

  it('handles empty discussion thread', () => {
    const env = buildPromptEnvelope({
      task: makeSnapshot({ context: makeContext({ discussionThread: [] }) }),
      agent: 'clipboard',
      now: '2026-05-23T10:00:00Z',
    })

    expect(env.review.comment).toBe('')
    expect(env.review.thread).toEqual([])
  })

  it('respects maxThreadMessages and keeps the most recent replies', () => {
    const thread = Array.from({ length: 10 }, (_, i) => ({
      author: `u${i}`,
      body: `m${i}`,
      createdAt: '2026-05-23T09:00:00Z',
    }))
    const env = buildPromptEnvelope({
      task: makeSnapshot({ context: makeContext({ discussionThread: thread }) }),
      agent: 'claude-code',
      now: '2026-05-23T10:00:00Z',
      options: { maxThreadMessages: 3 },
    })

    expect(env.review.comment).toBe('m0')
    expect(env.review.thread.map((m) => m.body)).toEqual(['m8', 'm9'])
  })

  it('clamps oversized comment and diff hunk per context-window policy', () => {
    const huge = 'x'.repeat(20_000)
    const env = buildPromptEnvelope({
      task: makeSnapshot({
        context: makeContext({
          diffHunk: huge,
          discussionThread: [
            { author: 'alice', body: huge, createdAt: '2026-05-23T09:00:00Z' },
          ],
        }),
      }),
      agent: 'claude-code',
      now: '2026-05-23T10:00:00Z',
      options: { maxCommentChars: 50, maxDiffHunkChars: 100 },
    })

    expect(env.review.comment).toHaveLength(50)
    expect(env.review.comment.endsWith('…')).toBe(true)
    expect(env.context.diffHunk).toHaveLength(100)
    expect(env.context.diffHunk.endsWith('…')).toBe(true)
  })

  it('does not mutate the source task snapshot', () => {
    const snap = makeSnapshot()
    const before = JSON.stringify(snap)
    buildPromptEnvelope({ task: snap, agent: 'claude-code', now: '2026-05-23T10:00:00Z' })
    expect(JSON.stringify(snap)).toBe(before)
  })
})

describe('renderEnvelopeAsText', () => {
  it('produces a clipboard-friendly markdown payload', () => {
    const env = buildPromptEnvelope({
      task: makeSnapshot(),
      agent: 'claude-code',
      now: '2026-05-23T10:00:00Z',
    })
    const text = renderEnvelopeAsText(env)

    expect(text).toContain('# Review task task-001')
    expect(text).toContain('MR: Refactor auth middleware (id=123)')
    expect(text).toContain('File: auth/service.ts:182')
    expect(text).toContain('## Review comment')
    expect(text).toContain('Potential race condition here')
    expect(text).toContain('## Thread')
    expect(text).toContain('- @dev-bob: Will wrap in try/catch')
    expect(text).toContain('## Diff hunk')
    expect(text).toContain('return validate(session.token)')
  })

  it('omits the thread section when there are no replies', () => {
    const env = buildPromptEnvelope({
      task: makeSnapshot({
        context: makeContext({
          discussionThread: [
            { author: 'alice', body: 'one comment only', createdAt: '2026-05-23T09:00:00Z' },
          ],
        }),
      }),
      agent: 'claude-code',
      now: '2026-05-23T10:00:00Z',
    })
    expect(renderEnvelopeAsText(env)).not.toContain('## Thread')
  })
})
