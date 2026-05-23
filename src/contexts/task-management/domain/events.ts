import type { AgentTarget } from './AgentDispatch'

type BaseEvent = {
  taskId: string
  occurredAt: string
}

export type ReviewTaskCreated = BaseEvent & {
  type: 'ReviewTaskCreated'
  mrId: string
  discussionId: string
  commentId: string
}

export type ReviewTaskDispatched = BaseEvent & {
  type: 'ReviewTaskDispatched'
  dispatchId: string
  agent: AgentTarget
}

export type ReviewTaskResolved = BaseEvent & {
  type: 'ReviewTaskResolved'
}

export type DispatchFailed = BaseEvent & {
  type: 'DispatchFailed'
  dispatchId: string
  reason: string
}

export type ReviewTaskIgnored = BaseEvent & {
  type: 'ReviewTaskIgnored'
}

export type DomainEvent =
  | ReviewTaskCreated
  | ReviewTaskDispatched
  | ReviewTaskResolved
  | DispatchFailed
  | ReviewTaskIgnored
