import type {
  AgentTarget,
  CommentContext,
  ReviewTaskSnapshot,
} from '../../task-management/domain'

export type PromptEnvelope = {
  taskId: string
  agent: AgentTarget
  mr: { id: string; title: string }
  review: { comment: string; thread: ThreadMessage[] }
  context: { file: string; line: number; diffHunk: string }
  generatedAt: string
}

export type ThreadMessage = {
  author: string
  body: string
}

export const ENVELOPE_DEFAULTS = {
  maxThreadMessages: 10,
  maxCommentChars: 4_000,
  maxDiffHunkChars: 8_000,
} as const

export type BuildEnvelopeOptions = {
  maxThreadMessages?: number
  maxCommentChars?: number
  maxDiffHunkChars?: number
}

export type BuildEnvelopeInput = {
  task: ReviewTaskSnapshot
  agent: AgentTarget
  now: string
  options?: BuildEnvelopeOptions
}

export function buildPromptEnvelope(input: BuildEnvelopeInput): PromptEnvelope {
  const { task, agent, now } = input
  const opts = { ...ENVELOPE_DEFAULTS, ...input.options }
  const ctx = task.context

  const { reviewComment, thread } = splitThread(ctx, opts.maxThreadMessages)

  return {
    taskId: task.id,
    agent,
    mr: { id: task.mrId, title: ctx.mrTitle },
    review: {
      comment: clamp(reviewComment, opts.maxCommentChars),
      thread: thread.map((m) => ({
        author: m.author,
        body: clamp(m.body, opts.maxCommentChars),
      })),
    },
    context: {
      file: ctx.filePath,
      line: ctx.line,
      diffHunk: clamp(ctx.diffHunk, opts.maxDiffHunkChars),
    },
    generatedAt: now,
  }
}

function splitThread(
  ctx: CommentContext,
  maxMessages: number,
): { reviewComment: string; thread: { author: string; body: string }[] } {
  const messages = ctx.discussionThread
  if (messages.length === 0) {
    return { reviewComment: '', thread: [] }
  }
  const [head, ...rest] = messages
  const thread = rest.slice(-Math.max(0, maxMessages - 1))
  return { reviewComment: head!.body, thread }
}

function clamp(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

export function renderEnvelopeAsText(envelope: PromptEnvelope): string {
  const lines: string[] = []
  lines.push(`# Review task ${envelope.taskId}`)
  lines.push(`MR: ${envelope.mr.title} (id=${envelope.mr.id})`)
  lines.push(`File: ${envelope.context.file}:${envelope.context.line}`)
  lines.push('')
  lines.push('## Review comment')
  lines.push(envelope.review.comment)
  if (envelope.review.thread.length > 0) {
    lines.push('')
    lines.push('## Thread')
    for (const m of envelope.review.thread) {
      lines.push(`- @${m.author}: ${m.body}`)
    }
  }
  lines.push('')
  lines.push('## Diff hunk')
  lines.push('```')
  lines.push(envelope.context.diffHunk)
  lines.push('```')
  return lines.join('\n')
}
