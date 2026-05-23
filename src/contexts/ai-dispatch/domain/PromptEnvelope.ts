import type { AgentTarget } from '../../task-management/domain'

export type PromptEnvelope = {
  taskId: string
  agent: AgentTarget
  mr: { id: string; title: string }
  review: { comment: string; thread: string[] }
  context: { file: string; line: number; diffHunk: string }
  generatedAt: string
}
