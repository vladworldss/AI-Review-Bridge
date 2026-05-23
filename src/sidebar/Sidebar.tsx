import { useMemo, useState } from 'react'

import type { FetchedDiscussion } from '../lib/fetchGitLabDiscussions'

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; discussions: FetchedDiscussion[] }
  | { kind: 'error'; message: string }

export type SidebarProps = {
  mrTitle: string
  loadState: LoadState
  onRefresh: () => void
}

export function Sidebar({ mrTitle, loadState, onRefresh }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showGeneral, setShowGeneral] = useState(false)

  const { open, resolved, visible } = useMemo(() => {
    if (loadState.kind !== 'ok') {
      return { open: 0, resolved: 0, visible: [] as FetchedDiscussion[] }
    }
    // "Open" = резолвабельный тред в нерезолвленном состоянии (это и есть
    // активный комментарий ревьюера). Общие треды и системные события
    // не считаются "open" — это устраняет фантомные 5 open из багрепорта.
    const filtered = showGeneral
      ? loadState.discussions
      : loadState.discussions.filter((d) => d.resolvable)

    const open = filtered.filter((d) => d.resolvable && !d.resolved).length
    const resolved = filtered.filter((d) => d.resolved).length
    return { open, resolved, visible: filtered }
  }, [loadState, showGeneral])

  return (
    <aside className={`grb-sidebar ${collapsed ? 'grb-sidebar--collapsed' : ''}`}>
      <header className="grb-sidebar__header">
        <strong className="grb-sidebar__title">AI Review Bridge</strong>
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
            className="grb-sidebar__icon-btn"
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

          <SidebarStatus state={loadState} open={open} resolved={resolved} />

          <label className="grb-sidebar__toggle-row">
            <input
              type="checkbox"
              checked={showGeneral}
              onChange={(e) => setShowGeneral(e.target.checked)}
            />
            <span>Show general threads</span>
          </label>

          {loadState.kind === 'ok' &&
            (visible.length === 0 ? (
              <p className="grb-sidebar__muted">
                {showGeneral
                  ? 'No discussions on this MR.'
                  : 'No code review threads. Toggle “Show general threads” to see general comments.'}
              </p>
            ) : (
              <ul className="grb-sidebar__list">
                {visible.map((d) => (
                  <DiscussionItem key={d.discussionId} discussion={d} />
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

function DiscussionItem({ discussion }: { discussion: FetchedDiscussion }) {
  const firstHuman = discussion.notes.find((n) => !n.isSystem) ?? discussion.notes.at(0)
  const replyCount = Math.max(
    0,
    discussion.notes.filter((n) => !n.isSystem).length - 1,
  )
  const isGeneral = !discussion.resolvable

  return (
    <li
      className={[
        'grb-item',
        discussion.resolved ? 'grb-item--resolved' : '',
        isGeneral ? 'grb-item--general' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="grb-item__row">
        <span
          className={`grb-item__dot ${
            discussion.resolved
              ? 'grb-item__dot--resolved'
              : isGeneral
                ? 'grb-item__dot--general'
                : ''
          }`}
          aria-hidden
        />
        <span className="grb-item__file" title={discussion.filePath ?? ''}>
          {isGeneral
            ? 'general thread'
            : discussion.filePath ?? 'no file context'}
          {discussion.line !== null && (
            <span className="grb-item__line">:{discussion.line}</span>
          )}
        </span>
      </div>
      {firstHuman ? (
        <div className="grb-item__body">
          <span className="grb-item__author">@{firstHuman.author}</span>{' '}
          <span className="grb-item__text">
            {firstHuman.body || '(empty comment)'}
          </span>
        </div>
      ) : (
        <div className="grb-item__body grb-item__body--muted">(no comments)</div>
      )}
      {replyCount > 0 && (
        <div className="grb-item__replies">+{replyCount} more</div>
      )}
    </li>
  )
}
