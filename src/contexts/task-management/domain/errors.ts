import type { TaskState } from './TaskState'

export class IllegalTaskTransitionError extends Error {
  constructor(
    public readonly from: TaskState,
    public readonly to: TaskState,
  ) {
    super(`Cannot transition ReviewTask from ${from} to ${to}`)
    this.name = 'IllegalTaskTransitionError'
  }
}

export class UnknownDispatchError extends Error {
  constructor(public readonly dispatchId: string) {
    super(`Dispatch ${dispatchId} not found on ReviewTask`)
    this.name = 'UnknownDispatchError'
  }
}
