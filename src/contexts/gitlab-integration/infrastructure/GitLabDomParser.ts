import type {
  ParsedComment,
  ParsedDiscussion,
  ParsedMergeRequest,
} from '../domain/ParsedDiscussion'
import type { ParseWarning } from '../domain/ParseError'
import { MAX_DIFF_HUNK_LINES, MAX_DISCUSSION_NOTES, SELECTORS } from './selectors'

export type ParseResult = {
  mr: ParsedMergeRequest | null
  warnings: ParseWarning[]
}

export type ParseOptions = {
  maxNotesPerDiscussion?: number
  maxDiffHunkLines?: number
}

export function parseMergeRequestPage(
  doc: Document,
  url: string,
  options: ParseOptions = {},
): ParseResult {
  const warnings: ParseWarning[] = []
  const maxNotes = options.maxNotesPerDiscussion ?? MAX_DISCUSSION_NOTES
  const maxHunk = options.maxDiffHunkLines ?? MAX_DIFF_HUNK_LINES

  const mrId = extractMrId(url)
  if (!mrId) return { mr: null, warnings }

  const title = extractTitle(doc)
  const discussionEls = doc.querySelectorAll<HTMLElement>(SELECTORS.discussion)
  const discussions: ParsedDiscussion[] = []

  for (const el of Array.from(discussionEls)) {
    const parsed = parseDiscussion(el, warnings, maxNotes, maxHunk)
    if (parsed) discussions.push(parsed)
  }

  return {
    mr: { mrId, title, url, discussions },
    warnings,
  }
}

function extractMrId(url: string): string | null {
  const m = url.match(/\/merge_requests\/(\d+)/)
  return m ? (m[1] ?? null) : null
}

function extractTitle(doc: Document): string {
  const el = doc.querySelector(SELECTORS.mrTitle)
  return el?.textContent?.trim() ?? ''
}

function parseDiscussion(
  el: HTMLElement,
  warnings: ParseWarning[],
  maxNotes: number,
  maxHunk: number,
): ParsedDiscussion | null {
  const discussionId = el.getAttribute('data-discussion-id')
  if (!discussionId) {
    warnings.push({ kind: 'unknown-discussion-id' })
    return null
  }

  const resolved = isResolved(el)
  const { filePath, line, diffHunk } = extractDiffContext(el, warnings, discussionId, maxHunk)
  const comments = parseComments(el, warnings, discussionId, maxNotes)

  return { discussionId, resolved, filePath, line, diffHunk, comments }
}

function isResolved(el: HTMLElement): boolean {
  const attr = el.getAttribute(SELECTORS.resolvedAttr)
  if (attr === 'true') return true
  if (attr === 'false') return false
  return el.querySelector(SELECTORS.resolvedBadge) !== null
}

function extractDiffContext(
  el: HTMLElement,
  warnings: ParseWarning[],
  discussionId: string,
  maxHunk: number,
): { filePath: string | null; line: number | null; diffHunk: string | null } {
  const fileEl = el.closest(SELECTORS.diffFile) ?? findAncestorDiffFile(el)
  const filePath = fileEl?.getAttribute(SELECTORS.diffFilePath) ?? null
  if (!filePath) warnings.push({ kind: 'missing-file-path', discussionId })

  const line = extractLineNumber(el)
  if (line === null) warnings.push({ kind: 'missing-line', discussionId })

  const diffHunk = fileEl ? extractDiffHunk(fileEl, line, maxHunk) : null
  if (!diffHunk) warnings.push({ kind: 'missing-diff-hunk', discussionId })

  return { filePath, line, diffHunk }
}

function findAncestorDiffFile(el: HTMLElement): Element | null {
  let node: (Node & { classList?: DOMTokenList; parentNode: Node | null }) | null = el
  while (node && node.nodeType === 1) {
    const e = node as unknown as Element
    if (e.classList?.contains('diff-file')) return e
    node = node.parentNode as typeof node
  }
  return null
}

function extractLineNumber(discussionEl: HTMLElement): number | null {
  const explicit = discussionEl.getAttribute('data-line-number')
  if (explicit) {
    const n = Number.parseInt(explicit, 10)
    if (!Number.isNaN(n)) return n
  }
  const row = discussionEl.closest('.line_holder') ?? discussionEl.previousElementSibling
  const numEl = row?.querySelector?.('[data-linenumber]')
  const raw = numEl?.getAttribute('data-linenumber')
  if (raw) {
    const n = Number.parseInt(raw, 10)
    if (!Number.isNaN(n)) return n
  }
  return null
}

function extractDiffHunk(
  fileEl: Element,
  targetLine: number | null,
  maxHunk: number,
): string | null {
  const rows = Array.from(fileEl.querySelectorAll<HTMLElement>(SELECTORS.diffLine))
  if (rows.length === 0) return null

  let pivot = 0
  if (targetLine !== null) {
    const idx = rows.findIndex((row) => {
      const raw = row.querySelector('[data-linenumber]')?.getAttribute('data-linenumber')
      return raw !== null && Number.parseInt(raw ?? '', 10) === targetLine
    })
    if (idx >= 0) pivot = idx
  }

  const half = Math.floor(maxHunk / 2)
  const start = Math.max(0, pivot - half)
  const end = Math.min(rows.length, start + maxHunk)
  return rows
    .slice(start, end)
    .map((row) => row.textContent?.replace(/\s+$/g, '') ?? '')
    .join('\n')
}

function parseComments(
  el: HTMLElement,
  warnings: ParseWarning[],
  discussionId: string,
  maxNotes: number,
): ParsedComment[] {
  const noteEls = Array.from(el.querySelectorAll<HTMLElement>(SELECTORS.note))
  if (noteEls.length > maxNotes) {
    warnings.push({
      kind: 'truncated-thread',
      discussionId,
      detail: `${noteEls.length} notes, kept ${maxNotes}`,
    })
  }
  const kept = noteEls.slice(0, maxNotes)
  return kept
    .map((noteEl) => parseComment(noteEl, warnings, discussionId))
    .filter((c): c is ParsedComment => c !== null)
}

function parseComment(
  el: HTMLElement,
  warnings: ParseWarning[],
  discussionId: string,
): ParsedComment | null {
  const commentId = el.getAttribute('data-note-id')
  if (!commentId) return null

  const isDeleted = el.matches(SELECTORS.noteDeleted) || /this comment was deleted/i.test(el.textContent ?? '')
  if (isDeleted) {
    warnings.push({ kind: 'deleted-comment', discussionId, commentId })
  }

  const author = el.querySelector(SELECTORS.noteAuthor)?.textContent?.trim() ?? 'unknown'
  const body = el.querySelector(SELECTORS.noteBody)?.textContent?.trim() ?? ''
  const createdAt = el.querySelector(SELECTORS.noteTime)?.getAttribute('datetime') ?? null

  return { commentId, author, body, createdAt, isDeleted }
}
