import { NotImplementedError } from '../../../shared/errors'
import type { ReviewTaskRepository } from '../../task-management/application/ReviewTaskRepository'
import type { AgentTarget, Clock } from '../../task-management/domain'
import type { PromptEnvelope } from '../domain'
import type { ClipboardPort } from './ClipboardPort'

export type DispatchTaskInput = {
  taskId: string
  agent: AgentTarget
}

export type DispatchTaskDeps = {
  repo: ReviewTaskRepository
  clipboard: ClipboardPort
  clock?: Clock
}

export type DispatchTaskResult = {
  envelope: PromptEnvelope
  dispatchId: string
}

export async function dispatchTask(
  _input: DispatchTaskInput,
  _deps: DispatchTaskDeps,
): Promise<DispatchTaskResult> {
  throw new NotImplementedError('dispatchTask')
}
