import { describe, expect, it } from 'vitest'

import {
  discussionsUrlFor,
  extractMrIid,
  fetchGitLabDiscussions,
  normalizeDiscussions,
} from '../../src/lib/fetchGitLabDiscussions'

describe('discussionsUrlFor', () => {
  it('derives a paginated discussions.json URL from a clean MR URL', () => {
    expect(
      discussionsUrlFor('https://gitlab.example.com/cp/instantbox_jobs/-/merge_requests/40'),
    ).toBe(
      'https://gitlab.example.com/cp/instantbox_jobs/-/merge_requests/40/discussions.json?per_page=100&page=1',
    )
  })

  it('strips trailing path and hash but adds pagination params', () => {
    expect(
      discussionsUrlFor(
        'https://gitlab.example.com/cp/instantbox_jobs/-/merge_requests/40/diffs?tab=foo#note_123',
      ),
    ).toBe(
      'https://gitlab.example.com/cp/instantbox_jobs/-/merge_requests/40/discussions.json?per_page=100&page=1',
    )
  })

  it('encodes the requested page number', () => {
    expect(
      discussionsUrlFor('https://gitlab.com/a/b/-/merge_requests/40', 3),
    ).toBe('https://gitlab.com/a/b/-/merge_requests/40/discussions.json?per_page=100&page=3')
  })

  it('returns null for non-MR URLs', () => {
    expect(discussionsUrlFor('https://gitlab.com/foo/bar')).toBeNull()
    expect(discussionsUrlFor('not a url')).toBeNull()
  })
})

describe('fetchGitLabDiscussions — pagination', () => {
  const MR = 'https://gitlab.com/a/b/-/merge_requests/40'

  function note(id: string, body: string) {
    return { id, note: body, resolvable: true, resolved: false, author: { username: 'u' } }
  }
  function disc(id: string, body: string) {
    return { id, notes: [note(id, body)] }
  }
  function jsonResponse(body: unknown, nextPage: string) {
    return {
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h === 'X-Next-Page' ? nextPage : null) },
      json: async () => body,
    } as unknown as Response
  }

  it('walks every page via X-Next-Page and concatenates discussions', async () => {
    const pages = [
      jsonResponse([disc('d1', 'first')], '2'),
      jsonResponse([disc('d2', 'second')], '3'),
      jsonResponse([disc('d3', 'rebase comment')], ''), // last page: empty next
    ]
    const calls: string[] = []
    const fakeFetch = (async (url: string) => {
      calls.push(url)
      return pages.shift()!
    }) as unknown as typeof fetch

    const result = await fetchGitLabDiscussions(MR, fakeFetch)

    expect(result.discussions.map((d) => d.discussionId)).toEqual(['d1', 'd2', 'd3'])
    expect(calls).toEqual([
      'https://gitlab.com/a/b/-/merge_requests/40/discussions.json?per_page=100&page=1',
      'https://gitlab.com/a/b/-/merge_requests/40/discussions.json?per_page=100&page=2',
      'https://gitlab.com/a/b/-/merge_requests/40/discussions.json?per_page=100&page=3',
    ])
  })

  it('stops on a single page when X-Next-Page is empty', async () => {
    let n = 0
    const fakeFetch = (async () => {
      n++
      return jsonResponse([disc('d1', 'only')], '')
    }) as unknown as typeof fetch

    const result = await fetchGitLabDiscussions(MR, fakeFetch)
    expect(n).toBe(1)
    expect(result.discussions).toHaveLength(1)
  })

  it('makes only ONE request when the first page is short (no header, < per_page)', async () => {
    // The common case on instances without pagination headers: a 43-discussion
    // MR comes back in one page < 100, so we must NOT fire a wasted page 2.
    let n = 0
    const fakeFetch = (async () => {
      n++
      const items = Array.from({ length: 43 }, (_, i) => disc(`d${i}`, 'x'))
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => items } as unknown as Response
    }) as unknown as typeof fetch

    const result = await fetchGitLabDiscussions(MR, fakeFetch)
    expect(n).toBe(1)
    expect(result.discussions).toHaveLength(43)
  })

  it('falls back to length-based paging when X-Next-Page is absent', async () => {
    // A brim-full page (exactly PER_PAGE=100) means "there may be more", so we
    // advance; the next short page ends it.
    const full = Array.from({ length: 100 }, (_, i) => disc(`d${i}`, 'x'))
    const pages = [
      { ok: true, status: 200, headers: { get: () => null }, json: async () => full },
      { ok: true, status: 200, headers: { get: () => null }, json: async () => [disc('tail', 'last')] },
    ] as unknown as Response[]
    const fakeFetch = (async () => pages.shift()!) as unknown as typeof fetch

    const result = await fetchGitLabDiscussions(MR, fakeFetch)
    expect(result.discussions).toHaveLength(101)
    expect(result.discussions.at(-1)?.discussionId).toBe('tail')
  })

  it('throws on a non-OK response', async () => {
    const fakeFetch = (async () =>
      ({ ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch
    await expect(fetchGitLabDiscussions(MR, fakeFetch)).rejects.toThrow('HTTP 404')
  })
})

describe('extractMrIid', () => {
  it('returns the numeric IID', () => {
    expect(extractMrIid('https://gitlab.com/a/b/-/merge_requests/40')).toBe('40')
    expect(extractMrIid('https://gitlab.com/a/b/-/merge_requests/40/diffs')).toBe('40')
  })

  it('returns null when no MR segment', () => {
    expect(extractMrIid('https://gitlab.com/a/b')).toBeNull()
  })
})

describe('normalizeDiscussions — resolved-flag handling', () => {
  it('treats a discussion as resolved when every resolvable note is resolved', () => {
    const result = normalizeDiscussions([
      {
        id: 'abc',
        notes: [
          { id: '1', resolvable: true, resolved: true, note: 'first', author: { username: 'u1' } },
          { id: '2', resolvable: true, resolved: true, note: 'reply', author: { username: 'u2' } },
        ],
      },
    ])
    expect(result.at(0)?.resolved).toBe(true)
    expect(result.at(0)?.resolvable).toBe(true)
  })

  it('treats a discussion as unresolved when any resolvable note is unresolved', () => {
    const result = normalizeDiscussions([
      {
        id: 'abc',
        notes: [
          { id: '1', resolvable: true, resolved: true, note: 'first', author: { username: 'u1' } },
          { id: '2', resolvable: true, resolved: false, note: 'reply', author: { username: 'u2' } },
        ],
      },
    ])
    expect(result.at(0)?.resolved).toBe(false)
  })

  it('honors an explicit discussion-level resolved=true', () => {
    const result = normalizeDiscussions([
      {
        id: 'abc',
        resolved: true,
        resolvable: true,
        notes: [{ id: '1', note: 'x', author: { username: 'u' } }],
      },
    ])
    expect(result.at(0)?.resolved).toBe(true)
  })

  it('general (non-resolvable) discussions are neither resolved nor resolvable', () => {
    const result = normalizeDiscussions([
      {
        id: 'abc',
        notes: [{ id: '1', note: 'just a comment', author: { username: 'u' } }],
      },
    ])
    expect(result.at(0)?.resolvable).toBe(false)
    expect(result.at(0)?.resolved).toBe(false)
  })
})

describe('normalizeDiscussions — diff context', () => {
  it('extracts file path and line from the first note position', () => {
    const result = normalizeDiscussions([
      {
        id: 'abc',
        notes: [
          {
            id: '1',
            note: 'race condition',
            author: { username: 'reviewer' },
            position: { new_path: 'auth/service.go', new_line: 182 },
          },
        ],
      },
    ])
    const d = result.at(0)!
    expect(d.filePath).toBe('auth/service.go')
    expect(d.line).toBe(182)
    expect(d.hasDiffContext).toBe(true)
  })

  it('falls back to old_path / old_line when new_* is missing', () => {
    const result = normalizeDiscussions([
      {
        id: 'abc',
        notes: [
          {
            id: '1',
            note: 'comment on removed line',
            author: { username: 'u' },
            position: { old_path: 'legacy/file.go', old_line: 10 },
          },
        ],
      },
    ])
    expect(result.at(0)?.filePath).toBe('legacy/file.go')
    expect(result.at(0)?.line).toBe(10)
  })

  it('marks general threads as having no diff context', () => {
    const result = normalizeDiscussions([
      {
        id: 'abc',
        notes: [{ id: '1', note: 'overall feedback', author: { username: 'u' } }],
      },
    ])
    expect(result.at(0)?.hasDiffContext).toBe(false)
    expect(result.at(0)?.filePath).toBeNull()
    expect(result.at(0)?.line).toBeNull()
  })

  it('skips position from system notes when looking for context', () => {
    const result = normalizeDiscussions([
      {
        id: 'abc',
        notes: [
          {
            id: '1',
            note: 'system event',
            system: true,
            author: { username: 'gitlab-bot' },
            position: { new_path: 'wrong/path.go', new_line: 1 },
          },
          {
            id: '2',
            note: 'real comment',
            author: { username: 'reviewer' },
            position: { new_path: 'real/path.go', new_line: 42 },
          },
        ],
      },
    ])
    expect(result.at(0)?.filePath).toBe('real/path.go')
    expect(result.at(0)?.line).toBe(42)
  })
})

describe('normalizeDiscussions — notes', () => {
  it('uses raw note text; falls back to stripped note_html', () => {
    const result = normalizeDiscussions([
      {
        id: 'd1',
        notes: [
          { id: '1', note: 'plain text', author: { username: 'u1' } },
          { id: '2', note_html: '<p>html only</p>', author: { username: 'u2' } },
        ],
      },
    ])
    const notes = result.at(0)?.notes ?? []
    expect(notes.at(0)?.body).toBe('plain text')
    expect(notes.at(1)?.body).toBe('html only')
  })

  it('extracts username, then name, then "unknown"', () => {
    const result = normalizeDiscussions([
      {
        id: 'd1',
        notes: [
          { id: '1', note: 'a', author: { username: 'alice', name: 'Alice' } },
          { id: '2', note: 'b', author: { name: 'Bob' } },
          { id: '3', note: 'c', author: {} },
        ],
      },
    ])
    expect(result.at(0)?.notes.map((n) => n.author)).toEqual(['alice', 'Bob', 'unknown'])
  })

  it('preserves isSystem flag', () => {
    const result = normalizeDiscussions([
      {
        id: 'd1',
        notes: [
          { id: '1', note: 'human', author: { username: 'u' } },
          { id: '2', note: 'mention added', system: true, author: { username: 'gitlab' } },
        ],
      },
    ])
    expect(result.at(0)?.notes.map((n) => n.isSystem)).toEqual([false, true])
  })
})

describe('normalizeDiscussions — tolerance', () => {
  it('returns empty array on non-array input', () => {
    expect(normalizeDiscussions(null)).toEqual([])
    expect(normalizeDiscussions({})).toEqual([])
    expect(normalizeDiscussions('garbage')).toEqual([])
  })

  it('skips entries without an id', () => {
    expect(normalizeDiscussions([{ notes: [] }, { id: 'ok', notes: [] }])).toHaveLength(1)
  })

  it('handles a discussion with no notes', () => {
    const result = normalizeDiscussions([{ id: 'empty', notes: [] }])
    expect(result).toHaveLength(1)
    expect(result.at(0)?.notes).toEqual([])
  })
})
