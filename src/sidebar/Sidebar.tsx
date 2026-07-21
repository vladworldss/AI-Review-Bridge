import { useMemo, useState } from 'react'

import type { ReviewTaskSnapshot } from '../contexts/task-management/domain'

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; tasks: ReviewTaskSnapshot[] }
  | { kind: 'error'; message: string }

export type DispatchOutcome = 'success' | 'error'
export type DispatchHandler = (taskId: string) => Promise<DispatchOutcome>

export type SidebarProps = {
  mrTitle: string
  loadState: LoadState
  onRefresh: () => void
  onDispatch: DispatchHandler
}

type DispatchUiState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'done'; at: number }
  | { kind: 'error'; message: string }

/**
 * Extension version, read from the loaded manifest so it always reflects what
 * Chrome actually has installed (not the source tree). Guarded so the sidebar
 * still renders under jsdom/tests where `chrome` is undefined.
 */
function extensionVersion(): string {
  try {
    return globalThis.chrome?.runtime?.getManifest?.().version ?? 'dev'
  } catch {
    return 'dev'
  }
}

export function Sidebar({ mrTitle, loadState, onRefresh, onDispatch }: SidebarProps) {
  const version = useMemo(extensionVersion, [])
  const [collapsed, setCollapsed] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [dispatchState, setDispatchState] = useState<Record<string, DispatchUiState>>({})

  const { openCount, resolvedCount, visible } = useMemo(() => {
    if (loadState.kind !== 'ok') {
      return { openCount: 0, resolvedCount: 0, visible: [] as ReviewTaskSnapshot[] }
    }
    const tasks = loadState.tasks
    const open = tasks.filter((t) => t.state !== 'RESOLVED' && t.state !== 'IGNORED')
    const resolved = tasks.filter((t) => t.state === 'RESOLVED')
    return {
      openCount: open.length,
      resolvedCount: resolved.length,
      visible: showResolved ? tasks : open,
    }
  }, [loadState, showResolved])

  const handleDispatch = async (taskId: string) => {
    setDispatchState((s) => ({ ...s, [taskId]: { kind: 'pending' } }))
    try {
      const outcome = await onDispatch(taskId)
      setDispatchState((s) => ({
        ...s,
        [taskId]:
          outcome === 'success'
            ? { kind: 'done', at: Date.now() }
            : { kind: 'error', message: 'Dispatch failed' },
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dispatch failed'
      setDispatchState((s) => ({ ...s, [taskId]: { kind: 'error', message } }))
    }
  }

  return (
    <aside className={`grb-sidebar ${collapsed ? 'grb-sidebar--collapsed' : ''}`}>
      <header className="grb-sidebar__header">
        <strong className="grb-sidebar__title">
          AI Review Bridge
          <span className="grb-sidebar__version" title={`Loaded build v${version}`}>
            v{version}
          </span>
        </strong>
        <div className="grb-sidebar__header-actions">
          {!collapsed && (
            <button
              type="button"
              className="grb-sidebar__icon-btn"
              aria-label="Refresh"
              title="Re-fetch discussions"
              onClick={onRefresh}
            >
              ↻
            </button>
          )}
          <button
            type="button"
            className="grb-sidebar__icon-btn grb-sidebar__icon-btn--collapse"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? '«' : '»'}
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="grb-sidebar__body">
          <div className="grb-sidebar__meta" title={mrTitle}>
            {mrTitle || 'Untitled MR'}
          </div>

          <SidebarStatus state={loadState} open={openCount} resolved={resolvedCount} />

          <label className="grb-sidebar__toggle-row">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            <span>Show resolved</span>
          </label>

          {loadState.kind === 'ok' &&
            (visible.length === 0 ? (
              <p className="grb-sidebar__muted">
                {showResolved ? 'No tasks on this MR.' : 'No open review tasks. 🎉'}
              </p>
            ) : (
              <ul className="grb-sidebar__list">
                {visible.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    dispatchState={dispatchState[t.id] ?? { kind: 'idle' }}
                    onDispatch={() => handleDispatch(t.id)}
                  />
                ))}
              </ul>
            ))}
        </div>
      )}
    </aside>
  )
}

function SidebarStatus({
  state,
  open,
  resolved,
}: {
  state: LoadState
  open: number
  resolved: number
}) {
  if (state.kind === 'loading') {
    return <div className="grb-sidebar__counts">Loading…</div>
  }
  if (state.kind === 'error') {
    return <div className="grb-sidebar__error">Failed to load: {state.message}</div>
  }
  return (
    <div className="grb-sidebar__counts">
      <span>{open} open</span>
      <span className="grb-sidebar__counts-sep">·</span>
      <span>{resolved} resolved</span>
    </div>
  )
}

function TaskItem({
  task,
  dispatchState,
  onDispatch,
}: {
  task: ReviewTaskSnapshot
  dispatchState: DispatchUiState
  onDispatch: () => void
}) {
  const head = task.context.discussionThread.at(0)
  const replyCount = Math.max(0, task.context.discussionThread.length - 1)
  const reviewer = head?.author ?? 'unknown'
  const preview = head?.body?.trim() || '(empty comment)'

  const stateBadge =
    task.state === 'NEW' ? null : (
      <span className={`grb-task__badge grb-task__badge--${task.state.toLowerCase()}`}>
        {task.state}
      </span>
    )

  return (
    <li
      className={[
        'grb-task',
        task.state === 'RESOLVED' ? 'grb-task--resolved' : '',
        task.state === 'FAILED' ? 'grb-task--failed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="grb-task__row">
        <span
          className={`grb-task__dot ${
            task.state === 'RESOLVED' ? 'grb-task__dot--resolved' : ''
          }`}
          aria-hidden
        />
        <span className="grb-task__file" title={task.context.filePath || 'no file context'}>
          {task.context.filePath || 'general thread'}
          {task.context.line > 0 && (
            <span className="grb-task__line">:{task.context.line}</span>
          )}
        </span>
        {stateBadge}
      </div>

      <div className="grb-task__author">
        <span className="grb-task__avatar" aria-hidden>
          {initials(reviewer)}
        </span>
        <span className="grb-task__author-name">@{reviewer}</span>
      </div>

      <div className="grb-task__preview">{preview}</div>
      {replyCount > 0 && (
        <div className="grb-task__replies">
          +{replyCount} {replyCount === 1 ? 'reply' : 'replies'}
        </div>
      )}

      <div className="grb-task__actions">
        <DispatchButton
          state={dispatchState}
          disabled={task.state === 'RESOLVED'}
          onClick={onDispatch}
        />
        {dispatchState.kind === 'error' && (
          <span className="grb-task__error" title={dispatchState.message}>
            ✗ {dispatchState.message}
          </span>
        )}
      </div>
    </li>
  )
}

function DispatchButton({
  state,
  disabled,
  onClick,
}: {
  state: DispatchUiState
  disabled: boolean
  onClick: () => void
}) {
  const label =
    state.kind === 'pending'
      ? 'Copying…'
      : state.kind === 'done'
        ? '✓ Copied'
        : 'Send to AI'
  return (
    <button
      type="button"
      className="grb-task__dispatch"
      onClick={onClick}
      disabled={disabled || state.kind === 'pending'}
      aria-label="Copy AI prompt for this discussion"
    >
      {label}
    </button>
  )
}

function initials(name: string): string {
  const parts = name.replace(/[@_.-]+/g, ' ').trim().split(/\s+/)
  const first = parts.at(0)?.charAt(0) ?? '?'
  const last = parts.length > 1 ? parts.at(-1)!.charAt(0) : ''
  return (first + last).toUpperCase()
}
