import type { AgentDispatch, AgentTarget } from './AgentDispatch'
import type { CommentContext } from './CommentContext'
import type { DomainEvent } from './events'
import { IllegalTaskTransitionError, UnknownDispatchError } from './errors'
import { TaskState, canTransition, isTerminal } from './TaskState'

export type ReviewTaskSnapshot = {
  id: string
  mrId: string
  discussionId: string
  commentId: string
  state: TaskState
  context: CommentContext
  dispatches: AgentDispatch[]
  createdAt: string
  lastUpdatedAt: string
}

export type Clock = () => string
export type IdGenerator = () => string

const defaultClock: Clock = () => new Date().toISOString()

export class ReviewTask {
  private readonly events: DomainEvent[] = []

  private constructor(
    private snapshot: ReviewTaskSnapshot,
    private readonly clock: Clock,
    private readonly newId: IdGenerator,
  ) {}

  static create(
    input: {
      id: string
      mrId: string
      discussionId: string
      commentId: string
      context: CommentContext
    },
    deps: { clock?: Clock; newId: IdGenerator },
  ): ReviewTask {
    const clock = deps.clock ?? defaultClock
    const now = clock()
    const task = new ReviewTask(
      {
        id: input.id,
        mrId: input.mrId,
        discussionId: input.discussionId,
        commentId: input.commentId,
        state: TaskState.NEW,
        context: input.context,
        dispatches: [],
        createdAt: now,
        lastUpdatedAt: now,
      },
      clock,
      deps.newId,
    )
    task.record({
      type: 'ReviewTaskCreated',
      taskId: input.id,
      mrId: input.mrId,
      discussionId: input.discussionId,
      commentId: input.commentId,
      occurredAt: now,
    })
    return task
  }

  static rehydrate(
    snapshot: ReviewTaskSnapshot,
    deps: { clock?: Clock; newId: IdGenerator },
  ): ReviewTask {
    return new ReviewTask(
      { ...snapshot, dispatches: [...snapshot.dispatches] },
      deps.clock ?? defaultClock,
      deps.newId,
    )
  }

  get id(): string {
    return this.snapshot.id
  }
  get state(): TaskState {
    return this.snapshot.state
  }
  get isTerminal(): boolean {
    return isTerminal(this.snapshot.state)
  }

  toSnapshot(): ReviewTaskSnapshot {
    return { ...this.snapshot, dispatches: [...this.snapshot.dispatches] }
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length)
  }

  dispatch(agent: AgentTarget): AgentDispatch {
    this.transitionTo(TaskState.DISPATCHED)
    const now = this.clock()
    const dispatch: AgentDispatch = {
      id: this.newId(),
      agent,
      dispatchedAt: now,
      outcome: 'PENDING',
    }
    this.snapshot.dispatches.push(dispatch)
    this.snapshot.lastUpdatedAt = now
    this.record({
      type: 'ReviewTaskDispatched',
      taskId: this.snapshot.id,
      dispatchId: dispatch.id,
      agent,
      occurredAt: now,
    })
    return dispatch
  }

  markInProgress(): void {
    this.transitionTo(TaskState.IN_PROGRESS)
    this.snapshot.lastUpdatedAt = this.clock()
  }

  markDispatchSucceeded(dispatchId: string): void {
    const dispatch = this.requireDispatch(dispatchId)
    dispatch.outcome = 'SUCCESS'
    this.snapshot.lastUpdatedAt = this.clock()
  }

  markDispatchFailed(dispatchId: string, reason: string): void {
    const dispatch = this.requireDispatch(dispatchId)
    dispatch.outcome = 'FAILED'
    dispatch.failureReason = reason
    this.transitionTo(TaskState.FAILED)
    const now = this.clock()
    this.snapshot.lastUpdatedAt = now
    this.record({
      type: 'DispatchFailed',
      taskId: this.snapshot.id,
      dispatchId,
      reason,
      occurredAt: now,
    })
  }

  resolve(): void {
    this.transitionTo(TaskState.RESOLVED)
    const now = this.clock()
    this.snapshot.lastUpdatedAt = now
    this.record({
      type: 'ReviewTaskResolved',
      taskId: this.snapshot.id,
      occurredAt: now,
    })
  }

  ignore(): void {
    this.transitionTo(TaskState.IGNORED)
    const now = this.clock()
    this.snapshot.lastUpdatedAt = now
    this.record({
      type: 'ReviewTaskIgnored',
      taskId: this.snapshot.id,
      occurredAt: now,
    })
  }

  private transitionTo(next: TaskState): void {
    if (this.snapshot.state === next) return
    if (!canTransition(this.snapshot.state, next)) {
      throw new IllegalTaskTransitionError(this.snapshot.state, next)
    }
    this.snapshot.state = next
  }

  private requireDispatch(dispatchId: string): AgentDispatch {
    const dispatch = this.snapshot.dispatches.find((d) => d.id === dispatchId)
    if (!dispatch) throw new UnknownDispatchError(dispatchId)
    return dispatch
  }

  private record(event: DomainEvent): void {
    this.events.push(event)
  }
}
