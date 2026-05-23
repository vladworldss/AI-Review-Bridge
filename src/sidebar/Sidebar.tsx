import { useState } from 'react'

import type { ParsedDiscussion } from '../contexts/gitlab-integration/domain'

export type SidebarProps = {
  mrTitle: string
  discussions: ParsedDiscussion[]
  onRefresh: () => void
}

export function Sidebar({ mrTitle, discussions, onRefresh }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const unresolved = discussions.filter((d) => !d.resolved)
  const resolved = discussions.filter((d) => d.resolved)

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
              title="Re-parse the page"
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
          <div className="grb-sidebar__counts">
            <span>{unresolved.length} open</span>
            <span className="grb-sidebar__counts-sep">·</span>
            <span>{resolved.length} resolved</span>
          </div>

          {discussions.length === 0 ? (
            <p className="grb-sidebar__muted">
              No discussions found on this MR.
            </p>
          ) : (
            <ul className="grb-sidebar__list">
              {discussions.map((d) => (
                <DiscussionItem key={d.discussionId} discussion={d} />
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  )
}

function DiscussionItem({ discussion }: { discussion: ParsedDiscussion }) {
  const head = discussion.comments.at(0)
  const replyCount = Math.max(0, discussion.comments.length - 1)

  return (
    <li className={`grb-item ${discussion.resolved ? 'grb-item--resolved' : ''}`}>
      <div className="grb-item__row">
        <span
          className={`grb-item__dot ${
            discussion.resolved ? 'grb-item__dot--resolved' : ''
          }`}
          aria-hidden
        />
        <span className="grb-item__file" title={discussion.filePath ?? ''}>
          {discussion.filePath ?? 'no file context'}
          {discussion.line !== null && (
            <span className="grb-item__line">:{discussion.line}</span>
          )}
        </span>
      </div>
      {head ? (
        <div className="grb-item__body">
          <span className="grb-item__author">@{head.author}</span>{' '}
          <span className="grb-item__text">{head.body || '(empty comment)'}</span>
        </div>
      ) : (
        <div className="grb-item__body grb-item__body--muted">
          (no comments)
        </div>
      )}
      {replyCount > 0 && (
        <div className="grb-item__replies">+{replyCount} more</div>
      )}
    </li>
  )
}
