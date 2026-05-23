import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

import { extractGitLabDiscussions } from '../../src/lib/extractGitLabDiscussions'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')

function loadDoc(name: string): Document {
  return new JSDOM(readFileSync(join(fixturesDir, name), 'utf8')).window.document
}

describe('extractGitLabDiscussions — happy path', () => {
  const result = extractGitLabDiscussions(loadDoc('mr-basic.html'))

  it('finds every discussion on the page', () => {
    expect(result.map((d) => d.discussionId).sort()).toEqual(['abc123', 'def456'])
  })

  it('attaches file path and line to each discussion', () => {
    const first = result.find((d) => d.discussionId === 'abc123')!
    expect(first.filePath).toBe('auth/service.ts')
    expect(first.line).toBe(182)
  })

  it('extracts every comment with author and body', () => {
    const first = result.find((d) => d.discussionId === 'abc123')!
    expect(first.comments).toHaveLength(2)
    expect(first.comments.at(0)).toMatchObject({
      commentId: 'n1',
      author: 'reviewer-alice',
      createdAt: '2026-05-23T09:00:00Z',
    })
    expect(first.comments.at(0)?.body).toMatch(/race condition/)
  })

  it('reads resolved flag from data attribute', () => {
    const unresolved = result.find((d) => d.discussionId === 'abc123')!
    const resolved = result.find((d) => d.discussionId === 'def456')!
    expect(unresolved.resolved).toBe(false)
    expect(resolved.resolved).toBe(true)
  })
})

describe('extractGitLabDiscussions — tolerance', () => {
  it('returns empty array on an empty document', () => {
    const dom = new JSDOM('<html><body></body></html>').window.document
    expect(extractGitLabDiscussions(dom)).toEqual([])
  })

  it('handles a discussion without a parent diff file', () => {
    const dom = new JSDOM(`
      <html><body>
        <div data-discussion-id="orphan">
          <li data-note-id="n99">
            <a class="author-link">someone</a>
            <div class="note-text">just a comment</div>
          </li>
        </div>
      </body></html>
    `).window.document

    const result = extractGitLabDiscussions(dom)
    expect(result).toHaveLength(1)
    expect(result.at(0)).toMatchObject({
      discussionId: 'orphan',
      filePath: null,
      line: null,
      resolved: null,
    })
    expect(result.at(0)?.comments.at(0)?.body).toBe('just a comment')
  })

  it('extracts a comment even when author is missing', () => {
    const dom = new JSDOM(`
      <html><body>
        <div data-discussion-id="x">
          <li data-note-id="n1">
            <div class="note-text">anonymous body</div>
          </li>
        </div>
      </body></html>
    `).window.document

    const result = extractGitLabDiscussions(dom)
    expect(result.at(0)?.comments.at(0)).toMatchObject({
      author: null,
      body: 'anonymous body',
    })
  })

  it('falls back to bare notes when no discussion wrapper is present', () => {
    const dom = new JSDOM(`
      <html><body>
        <li id="note_555" class="note">
          <a class="author-link">solo</a>
          <div class="md">stray comment</div>
        </li>
      </body></html>
    `).window.document

    const result = extractGitLabDiscussions(dom)
    expect(result).toHaveLength(1)
    expect(result.at(0)).toMatchObject({
      discussionId: null,
      comments: [
        {
          commentId: '555',
          author: 'solo',
          body: 'stray comment',
        },
      ],
    })
  })

  it('reads file path from data-original-path when data-path is missing', () => {
    const dom = new JSDOM(`
      <html><body>
        <div class="diff-file" data-original-path="src/new.ts">
          <div data-discussion-id="d1" data-line-number="7">
            <li data-note-id="n1"><div class="note-text">hi</div></li>
          </div>
        </div>
      </body></html>
    `).window.document

    const result = extractGitLabDiscussions(dom)
    expect(result.at(0)?.filePath).toBe('src/new.ts')
    expect(result.at(0)?.line).toBe(7)
  })

  it('never throws on malformed markup', () => {
    const dom = new JSDOM('<html><body><div data-discussion-id=""></div></body></html>').window.document
    expect(() => extractGitLabDiscussions(dom)).not.toThrow()
  })
})
