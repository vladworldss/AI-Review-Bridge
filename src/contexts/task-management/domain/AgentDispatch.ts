export type AgentTarget = 'claude-code' | 'codex' | 'vscode' | 'clipboard'

export type DispatchOutcome = 'PENDING' | 'SUCCESS' | 'FAILED'

export type AgentDispatch = {
  id: string
  agent: AgentTarget
  dispatchedAt: string
  outcome: DispatchOutcome
  failureReason?: string
}
