export const SELECTORS = {
  mrTitle: '.merge-request-details .title, h1.title, [data-qa-selector="title_content"]',
  discussion: '[data-discussion-id]',
  resolvedAttr: 'data-resolved',
  resolvedBadge: '.line-resolve-btn[data-state="true"], .discussion-resolved',
  diffFile: '.diff-file',
  diffFilePath: 'data-path',
  diffLine: '.line_holder',
  diffLineNumber: '.diff-line-num.new[data-linenumber], .diff-line-num[data-linenumber]',
  diffHunk: '.diff-content table, .diff-content',
  note: '[data-note-id]',
  noteAuthor: '.note-header-author-name, .note-header-info a.author-link',
  noteBody: '.note-text, .md',
  noteTime: 'time[datetime]',
  noteDeleted: '.system-note, .deleted-note',
} as const

export const MAX_DISCUSSION_NOTES = 20
export const MAX_DIFF_HUNK_LINES = 40
