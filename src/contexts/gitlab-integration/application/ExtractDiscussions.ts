import type { ParseWarning } from '../domain/ParseError'
import type { ParsedMergeRequest } from '../domain/ParsedDiscussion'
import { parseMergeRequestPage, type ParseOptions } from '../infrastructure/GitLabDomParser'

export type ExtractDiscussionsInput = {
  document: Document
  url: string
  options?: ParseOptions
}

export type ExtractDiscussionsResult = {
  mr: ParsedMergeRequest | null
  warnings: ParseWarning[]
}

export function extractDiscussions(
  input: ExtractDiscussionsInput,
): ExtractDiscussionsResult {
  return parseMergeRequestPage(input.document, input.url, input.options)
}
