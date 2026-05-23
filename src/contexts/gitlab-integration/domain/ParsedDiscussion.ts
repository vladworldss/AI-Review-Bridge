export type ParsedDiscussion = {
  discussionId: string
  resolved: boolean
  filePath: string | null
  line: number | null
  diffHunk: string | null
  comments: ParsedComment[]
}

export type ParsedComment = {
  commentId: string
  author: string
  body: string
  createdAt: string | null
  isDeleted: boolean
}

export type ParsedMergeRequest = {
  mrId: string
  title: string
  url: string
  discussions: ParsedDiscussion[]
}
