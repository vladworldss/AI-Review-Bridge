export const TaskState = {
  NEW: 'NEW',
  DISPATCHED: 'DISPATCHED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  IGNORED: 'IGNORED',
  FAILED: 'FAILED',
} as const

export type TaskState = (typeof TaskState)[keyof typeof TaskState]

const transitions: Record<TaskState, ReadonlyArray<TaskState>> = {
  NEW: ['DISPATCHED', 'RESOLVED', 'IGNORED'],
  DISPATCHED: ['IN_PROGRESS', 'RESOLVED', 'FAILED', 'IGNORED'],
  IN_PROGRESS: ['RESOLVED', 'FAILED', 'IGNORED'],
  FAILED: ['DISPATCHED', 'RESOLVED', 'IGNORED'],
  RESOLVED: [],
  IGNORED: [],
}

export function canTransition(from: TaskState, to: TaskState): boolean {
  return transitions[from].includes(to)
}

export function isTerminal(state: TaskState): boolean {
  return transitions[state].length === 0
}
