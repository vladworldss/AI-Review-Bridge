/**
 * Fetch + normalize GitLab MR discussions from /-/merge_requests/<iid>/discussions.json.
 *
 * Why JSON, not DOM:
 *  - resolved/resolvable flags are explicit (not buried in i18n text)
 *  - file_path and line numbers come pre-attached to each note
 *  - works in Overview tab without depending on diff DOM being rendered
 *  - survives GitLab UI redesigns (the JSON contract is stable across versions)
 *
 * Shape is defensive — every field treated as optional and validated at runtime.
 */

export type FetchedDiscussion = {
  discussionId: string
  resolved: boolean
  resolvable: boolean
  filePath: string | null
  line: number | null
  hasDiffContext: boolean
  notes: FetchedNote[]
}

export type FetchedNote = {
  noteId: string
  author: string
  body: string
  createdAt: string | null
  isSystem: boolean
}

export type FetchResult = {
  mrIid: string
  discussions: FetchedDiscussion[]
}

export class FetchDiscussionsError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'FetchDiscussionsError'
  }
}

const MR_URL_PATTERN = /\/-\/merge_requests\/(\d+)(?:\/|$|\?|#)/

/**
 * Given any URL on an MR page, returns the discussions.json URL.
 * `https://host/group/project/-/merge_requests/40` →
 * `https://host/group/project/-/merge_requests/40/discussions.json`.
 */
export function discussionsUrlFor(mrUrl: string, page = 1, perPage = 100): string | null {
  try {
    const u = new URL(mrUrl)
    const m = u.pathname.match(/^(.*\/-\/merge_requests\/\d+)/)
    if (!m) return null
    u.pathname = `${m[1]}/discussions.json`
    // GitLab paginates discussions (default per_page=20). Without paging we
    // only ever saw the first 20, so newer threads — including comments that
    // landed after a rebase — silently fell off the list. We request large
    // pages (per_page=100) so a typical MR fits in one round-trip, and the
    // fetch loop still walks further pages if the server signals more.
    //
    // Note: this instance returns no X-Next-Page / Link headers, so the loop
    // relies on its length-based fallback (stop when a page is empty). The
    // header path is kept for GitLab deployments that do paginate by offset.
    u.search = `?per_page=${perPage}&page=${page}`
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

export function extractMrIid(mrUrl: string): string | null {
  const m = mrUrl.match(MR_URL_PATTERN)
  return m ? (m[1] ?? null) : null
}

// Page budget. 3 × 100 = 300 discussions, which covers essentially every MR.
// GitLab orders discussions oldest→newest, so OPEN threads (the ones the user
// acts on) sit at the tail — the cap must be generous enough not to clip them.
// Beyond 300 we stop; a future "load more" button can extend this if needed.
const MAX_PAGES = 3

// Page size. Big enough that any normal MR fits in a single request — the
// server-side latency per request (~1.3s on self-hosted) dwarfs the extra
// payload, so one fat request beats several thin ones.
const PER_PAGE = 100

export async function fetchGitLabDiscussions(
  mrUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResult> {
  const iid = extractMrIid(mrUrl)
  if (!iid || !discussionsUrlFor(mrUrl)) {
    throw new FetchDiscussionsError(`Not a GitLab MR URL: ${mrUrl}`)
  }

  const discussions: FetchedDiscussion[] = []
  let page = 1

  for (let i = 0; i < MAX_PAGES; i++) {
    const url = discussionsUrlFor(mrUrl, page, PER_PAGE)!

    const res = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
      cache: 'no-store',
    })

    if (!res.ok) {
      throw new FetchDiscussionsError(
        `Failed to fetch discussions: HTTP ${res.status}`,
        res.status,
      )
    }

    const raw = (await res.json()) as unknown
    const batch = normalizeDiscussions(raw)
    discussions.push(...batch)

    // Decide whether to fetch another page:
    //  - header present with a number → that's the next page
    //  - header present but empty → GitLab says this was the last page → stop
    //  - header absent (this instance) → a short page (fewer than PER_PAGE) is
    //    the last one, so we DON'T pay for a wasted +1 request just to see an
    //    empty page. Only a brim-full page implies there may be more.
    const pageLen = Array.isArray(raw) ? raw.length : 0
    const next = nextPageFrom(res.headers)
    if (next === 'absent') {
      if (pageLen < PER_PAGE) break
      page += 1
    } else if (next === null) {
      break // present-but-empty / invalid → no more pages
    } else {
      if (next <= page) break
      page = next
    }
  }

  return { mrIid: iid, discussions }
}

/**
 * Reads X-Next-Page, distinguishing "header absent" from "header present but
 * empty" — they mean different things (fall back to length-paging vs. stop).
 */
function nextPageFrom(headers: Headers): number | null | 'absent' {
  const raw = headers.get?.('X-Next-Page')
  if (raw === null || raw === undefined) return 'absent'
  if (raw === '') return null
  const n = Number.parseInt(raw, 10)
  return Number.isNaN(n) || n <= 0 ? null : n
}

export function normalizeDiscussions(raw: unknown): FetchedDiscussion[] {
  if (!Array.isArray(raw)) return []
  const out: FetchedDiscussion[] = []
  for (const item of raw) {
    const norm = normalizeDiscussion(item)
    if (norm) out.push(norm)
  }
  return out
}

function normalizeDiscussion(raw: unknown): FetchedDiscussion | null {
  if (!isRecord(raw)) return null
  const discussionId = strOrNull(raw.id) ?? strOrNull(raw.discussion_id)
  if (!discussionId) return null

  const notesRaw = Array.isArray(raw.notes) ? raw.notes : []
  const notes = notesRaw
    .map((n) => normalizeNote(n))
    .filter((n): n is FetchedNote => n !== null)

  // Resolved/resolvable can live on the discussion or be derived from notes.
  const resolvable =
    boolOrFalse(raw.resolvable) ||
    notesRaw.some((n) => isRecord(n) && n.resolvable === true)

  const resolved =
    boolOrFalse(raw.resolved) ||
    (resolvable && notesRaw.length > 0 && notesRaw.every((n) => isRecord(n) && n.resolved === true))

  // Diff context (file/line) is on the first non-system note's position.
  const firstWithPosition = notesRaw.find(
    (n) => isRecord(n) && isRecord(n.position) && !n.system,
  )
  const position = firstWithPosition && isRecord(firstWithPosition)
    ? firstWithPosition.position
    : null

  let filePath: string | null = null
  let line: number | null = null
  if (isRecord(position)) {
    filePath = strOrNull(position.new_path) ?? strOrNull(position.old_path)
    line = numOrNull(position.new_line) ?? numOrNull(position.old_line)
  }

  return {
    discussionId,
    resolved,
    resolvable,
    filePath,
    line,
    hasDiffContext: filePath !== null,
    notes,
  }
}

function normalizeNote(raw: unknown): FetchedNote | null {
  if (!isRecord(raw)) return null
  const noteId = strOrNull(raw.id)
  if (!noteId) return null

  const author = isRecord(raw.author)
    ? (strOrNull(raw.author.username) ?? strOrNull(raw.author.name) ?? 'unknown')
    : 'unknown'

  // GitLab returns 'note' (raw markdown) and sometimes 'note_html'.
  // Prefer the raw text — UI can render markdown later if needed.
  const body = strOrNull(raw.note) ?? stripHtml(strOrNull(raw.note_html)) ?? ''

  return {
    noteId,
    author,
    body,
    createdAt: strOrNull(raw.created_at),
    isSystem: boolOrFalse(raw.system),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strOrNull(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v
  if (typeof v === 'number') return String(v)
  return null
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function boolOrFalse(v: unknown): boolean {
  return v === true
}

function stripHtml(html: string | null): string | null {
  if (!html) return null
  return html.replace(/<[^>]+>/g, '').trim()
}
