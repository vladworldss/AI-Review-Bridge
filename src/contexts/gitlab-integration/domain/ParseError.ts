export class ParseError extends Error {
  constructor(
    message: string,
    public readonly element?: string,
  ) {
    super(message)
    this.name = 'ParseError'
  }
}

export type ParseWarning = {
  kind:
    | 'missing-file-path'
    | 'missing-line'
    | 'missing-diff-hunk'
    | 'deleted-comment'
    | 'truncated-thread'
    | 'unknown-discussion-id'
  discussionId?: string
  commentId?: string
  detail?: string
}
