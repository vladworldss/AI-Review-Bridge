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
export function discussionsUrlFor(mrUrl: string): string | null {
  try {
    const u = new URL(mrUrl)
    const m = u.pathname.match(/^(.*\/-\/merge_requests\/\d+)/)
    if (!m) return null
    u.pathname = `${m[1]}/discussions.json`
    u.search = ''
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

export async function fetchGitLabDiscussions(
  mrUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResult> {
  const url = discussionsUrlFor(mrUrl)
  const iid = extractMrIid(mrUrl)
  if (!url || !iid) {
    throw new FetchDiscussionsError(`Not a GitLab MR URL: ${mrUrl}`)
  }

  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
  })

  if (!res.ok) {
    throw new FetchDiscussionsError(
      `Failed to fetch discussions: HTTP ${res.status}`,
      res.status,
    )
  }

  const raw = (await res.json()) as unknown
  return { mrIid: iid, discussions: normalizeDiscussions(raw) }
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
