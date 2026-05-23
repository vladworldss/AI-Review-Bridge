export type CommentContext = {
  filePath: string
  line: number
  diffHunk: string
  surroundingLines: { before: string[]; after: string[] }
  discussionThread: DiscussionMessage[]
  mrTitle: string
}

export type DiscussionMessage = {
  author: string
  body: string
  createdAt: string
}
