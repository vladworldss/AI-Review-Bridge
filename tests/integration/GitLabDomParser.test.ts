import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

import { parseMergeRequestPage } from '../../src/contexts/gitlab-integration/infrastructure/GitLabDomParser'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')

function loadDoc(name: string): Document {
  const html = readFileSync(join(fixturesDir, name), 'utf8')
  return new JSDOM(html).window.document
}

const URL_BASIC = 'https://gitlab.com/acme/repo/-/merge_requests/42'

describe('parseMergeRequestPage — basic fixture', () => {
  const result = parseMergeRequestPage(loadDoc('mr-basic.html'), URL_BASIC)

  it('extracts MR id from URL and title from DOM', () => {
    expect(result.mr?.mrId).toBe('42')
    expect(result.mr?.title).toBe('Refactor auth middleware')
    expect(result.mr?.url).toBe(URL_BASIC)
  })

  it('finds both discussions', () => {
    expect(result.mr?.discussions.map((d) => d.discussionId)).toEqual(['abc123', 'def456'])
  })

  it('attaches file path, line, and diff hunk to each discussion', () => {
    const first = result.mr?.discussions.at(0)!
    expect(first.filePath).toBe('auth/service.ts')
    expect(first.line).toBe(182)
    expect(first.diffHunk).toContain('return validate(session.token)')
  })

  it('reads resolved flag from data attribute', () => {
    const [unresolved, resolved] = result.mr!.discussions
    expect(unresolved!.resolved).toBe(false)
    expect(resolved!.resolved).toBe(true)
  })

  it('parses comments with author, body, timestamp', () => {
    const comments = result.mr!.discussions.at(0)!.comments
    expect(comments).toHaveLength(2)
    expect(comments.at(0)).toMatchObject({
      commentId: 'n1',
      author: 'reviewer-alice',
      createdAt: '2026-05-23T09:00:00Z',
      isDeleted: false,
    })
    expect(comments.at(0)?.body).toMatch(/race condition/)
  })

  it('produces no warnings for a clean MR', () => {
    expect(result.warnings).toEqual([])
  })
})

describe('parseMergeRequestPage — edge cases', () => {
  const result = parseMergeRequestPage(
    loadDoc('mr-edge-cases.html'),
    'https://gitlab.com/acme/repo/-/merge_requests/7',
    { maxNotesPerDiscussion: 3 },
  )

  it('warns when a discussion has no diff context', () => {
    const orphan = result.mr?.discussions.find((d) => d.discussionId === 'orphan-1')!
    expect(orphan.filePath).toBeNull()
    expect(orphan.line).toBeNull()
    const kinds = result.warnings
      .filter((w) => w.discussionId === 'orphan-1')
      .map((w) => w.kind)
    expect(kinds).toContain('missing-file-path')
    expect(kinds).toContain('missing-line')
    expect(kinds).toContain('missing-diff-hunk')
  })

  it('flags deleted comments but still includes them', () => {
    const del = result.mr?.discussions.find((d) => d.discussionId === 'del-1')!
    expect(del.comments.map((c) => c.commentId)).toEqual(['n20', 'n21'])
    expect(del.comments.at(0)?.isDeleted).toBe(true)
    expect(
      result.warnings.some((w) => w.kind === 'deleted-comment' && w.commentId === 'n20'),
    ).toBe(true)
  })

  it('truncates oversized threads and records a warning', () => {
    const big = result.mr?.discussions.find((d) => d.discussionId === 'big-thread')!
    expect(big.comments).toHaveLength(3)
    expect(
      result.warnings.some(
        (w) => w.kind === 'truncated-thread' && w.discussionId === 'big-thread',
      ),
    ).toBe(true)
  })
})

describe('parseMergeRequestPage — defensive', () => {
  it('returns null mr when URL is not an MR', () => {
    const dom = new JSDOM('<html><body></body></html>').window.document
    const result = parseMergeRequestPage(dom, 'https://gitlab.com/acme/repo')
    expect(result.mr).toBeNull()
  })

  it('handles empty MR page with no discussions', () => {
    const dom = new JSDOM('<html><body><h1 class="title">Empty MR</h1></body></html>').window.document
    const result = parseMergeRequestPage(dom, 'https://gitlab.com/acme/repo/-/merge_requests/1')
    expect(result.mr?.discussions).toEqual([])
    expect(result.warnings).toEqual([])
  })
})
