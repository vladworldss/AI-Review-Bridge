import type { ReviewTaskRepository } from '../../task-management/application/ReviewTaskRepository'
import {
  publishTaskEvents,
  type TaskEventBus,
} from '../../task-management/application/TaskEventBus'
import type { AgentTarget, Clock } from '../../task-management/domain'
import {
  buildPromptEnvelope,
  renderEnvelopeAsText,
  type BuildEnvelopeOptions,
  type PromptEnvelope,
} from '../domain'
import type { ClipboardPort } from './ClipboardPort'

export type DispatchTaskInput = {
  taskId: string
  agent: AgentTarget
  envelopeOptions?: BuildEnvelopeOptions
}

export type DispatchTaskDeps = {
  repo: ReviewTaskRepository
  clipboard: ClipboardPort
  eventBus?: TaskEventBus
  clock?: Clock
}

export type DispatchTaskResult = {
  envelope: PromptEnvelope
  dispatchId: string
  payload: string
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`ReviewTask ${taskId} not found`)
    this.name = 'TaskNotFoundError'
  }
}

export async function dispatchTask(
  input: DispatchTaskInput,
  deps: DispatchTaskDeps,
): Promise<DispatchTaskResult> {
  const task = await deps.repo.findById(input.taskId)
  if (!task) throw new TaskNotFoundError(input.taskId)

  const dispatch = task.dispatch(input.agent)

  const envelope = buildPromptEnvelope({
    task: task.toSnapshot(),
    agent: input.agent,
    now: (deps.clock ?? (() => new Date().toISOString()))(),
    ...(input.envelopeOptions ? { options: input.envelopeOptions } : {}),
  })
  const payload = renderEnvelopeAsText(envelope)

  try {
    await deps.clipboard.write(payload)
    task.markDispatchSucceeded(dispatch.id)
  } catch (err) {
    task.markDispatchFailed(dispatch.id, errorMessage(err))
    await deps.repo.save(task)
    if (deps.eventBus) await publishTaskEvents(task, deps.eventBus)
    throw err
  }

  await deps.repo.save(task)
  if (deps.eventBus) await publishTaskEvents(task, deps.eventBus)

  return { envelope, dispatchId: dispatch.id, payload }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
