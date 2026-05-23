/**
 * Pragmatic GitLab MR discussion extractor.
 *
 * Designed to keep working when GitLab's markup drifts. Every field is
 * best-effort — missing data returns null, never throws. Add new selectors
 * to the *_SELECTORS arrays as new GitLab versions appear; first match wins.
 */

export type Discussion = {
  discussionId: string | null
  filePath: string | null
  line: number | null
  resolved: boolean | null
  comments: Comment[]
}

export type Comment = {
  commentId: string | null
  author: string | null
  body: string
  createdAt: string | null
}

const DISCUSSION_SELECTORS = [
  '[data-discussion-id]',
  '.discussion-notes[data-discussion]',
  '.discussion[data-discussion-id]',
  '[data-qa-selector="discussion_container"]',
]

const NOTE_SELECTORS = [
  '[data-note-id]',
  '.note[id^="note_"]',
  'li.note',
  '[data-qa-selector="noteable_note_container"]',
]

const AUTHOR_SELECTORS = [
  '.note-header-author-name',
  '.note-header-info a.author-link',
  '.note-header a.author-link',
  '.author-link .author',
  'a.author-link',
  '[data-qa-selector="note_author"]',
  'a[data-username]',
]

const BODY_SELECTORS = [
  '.note-text',
  '.note-body .md',
  '.note-body',
  '.md',
  '[data-qa-selector="note_content"]',
]

const TIME_SELECTORS = ['time[datetime]', 'time']

const FILE_PATH_ATTRS = ['data-path', 'data-original-path', 'data-file-path']
const FILE_PATH_SELECTORS = [
  '.file-title-name',
  '.file-header-content .file-title-name',
  '[data-qa-selector="file_name_content"]',
]

const LINE_ATTRS = [
  'data-line-number',
  'data-linenumber',
  'data-line',
  'data-position-new-line',
  'data-position-old-line',
]

const RESOLVED_TRUE = ['true', 'resolved']
const RESOLVED_BADGE = '.line-resolve-btn[data-state="true"], .discussion-resolved'

export function extractGitLabDiscussions(doc: Document = document): Discussion[] {
  const seen = new Set<Element>()
  const out: Discussion[] = []

  for (const sel of DISCUSSION_SELECTORS) {
    for (const el of Array.from(doc.querySelectorAll<HTMLElement>(sel))) {
      if (seen.has(el)) continue
      seen.add(el)
      const d = extractDiscussion(el)
      if (d) out.push(d)
    }
  }

  // Fallback: if nothing matched, treat each note as a single-comment discussion.
  if (out.length === 0) {
    const seenNotes = new Set<Element>()
    for (const sel of NOTE_SELECTORS) {
      for (const noteEl of Array.from(doc.querySelectorAll<HTMLElement>(sel))) {
        if (seenNotes.has(noteEl)) continue
        seenNotes.add(noteEl)
        const comment = extractComment(noteEl)
        if (!comment) continue
        out.push({
          discussionId: null,
          filePath: nearestFilePath(noteEl),
          line: nearestLine(noteEl),
          resolved: null,
          comments: [comment],
        })
      }
    }
  }

  return out
}

function extractDiscussion(el: HTMLElement): Discussion | null {
  const discussionId =
    el.getAttribute('data-discussion-id') ??
    el.getAttribute('data-discussion') ??
    null

  const comments: Comment[] = []
  for (const sel of NOTE_SELECTORS) {
    for (const noteEl of Array.from(el.querySelectorAll<HTMLElement>(sel))) {
      const c = extractComment(noteEl)
      if (c) comments.push(c)
    }
    if (comments.length > 0) break
  }

  if (comments.length === 0 && !discussionId) return null

  return {
    discussionId,
    filePath: nearestFilePath(el),
    line: nearestLine(el),
    resolved: extractResolved(el),
    comments,
  }
}

function extractComment(el: HTMLElement): Comment | null {
  const commentId =
    el.getAttribute('data-note-id') ??
    extractIdFromAttr(el.getAttribute('id')) ??
    null

  const body = textFromAny(el, BODY_SELECTORS)
  if (!body && !commentId) return null

  return {
    commentId,
    author: textFromAny(el, AUTHOR_SELECTORS),
    body: body ?? '',
    createdAt: timestampFromAny(el, TIME_SELECTORS),
  }
}

function extractIdFromAttr(id: string | null): string | null {
  if (!id) return null
  const m = id.match(/note[_-]?(\d+)/i)
  return m ? (m[1] ?? null) : null
}

function nearestFilePath(el: Element): string | null {
  let node: Element | null = el
  while (node) {
    for (const attr of FILE_PATH_ATTRS) {
      const v = node.getAttribute?.(attr)
      if (v) return v
    }
    node = node.parentElement
  }
  // Fallback: look at the closest diff-file container's title.
  const fileContainer = el.closest('.diff-file, .file-holder, [data-path]')
  if (fileContainer) {
    for (const sel of FILE_PATH_SELECTORS) {
      const titleEl = fileContainer.querySelector(sel)
      const text = titleEl?.textContent?.trim()
      if (text) return text
    }
  }
  return null
}

function nearestLine(el: Element): number | null {
  // Try line number from the element itself or its container.
  const fromEl = readLineAttr(el)
  if (fromEl !== null) return fromEl

  // Walk up to nearest line_holder / row.
  const row =
    el.closest('.line_holder') ??
    el.closest('tr[data-line]') ??
    el.closest('[data-line-number]')
  if (row) {
    const fromRow = readLineAttr(row)
    if (fromRow !== null) return fromRow
    const child = row.querySelector('[data-linenumber], [data-line-number]')
    if (child) {
      const fromChild = readLineAttr(child)
      if (fromChild !== null) return fromChild
    }
  }
  return null
}

function readLineAttr(el: Element): number | null {
  for (const attr of LINE_ATTRS) {
    const raw = el.getAttribute?.(attr)
    if (!raw) continue
    const n = Number.parseInt(raw, 10)
    if (!Number.isNaN(n)) return n
  }
  return null
}

function extractResolved(el: HTMLElement): boolean | null {
  const attr =
    el.getAttribute('data-resolved') ?? el.getAttribute('data-discussion-resolved')
  if (attr !== null) {
    if (RESOLVED_TRUE.includes(attr.toLowerCase())) return true
    if (attr.toLowerCase() === 'false') return false
  }
  if (el.querySelector(RESOLVED_BADGE)) return true
  if (el.classList.contains('resolved-discussion')) return true
  return null
}

function textFromAny(scope: Element, selectors: string[]): string | null {
  for (const sel of selectors) {
    const found = scope.querySelector(sel)
    const text = found?.textContent?.trim()
    if (text) return text
  }
  return null
}

function timestampFromAny(scope: Element, selectors: string[]): string | null {
  for (const sel of selectors) {
    const found = scope.querySelector(sel)
    const dt = found?.getAttribute?.('datetime') ?? found?.getAttribute?.('title')
    if (dt) return dt
  }
  return null
}
