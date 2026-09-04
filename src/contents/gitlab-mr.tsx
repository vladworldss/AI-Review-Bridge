import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlasmoCSConfig, PlasmoGetRootContainer } from 'plasmo'

import {
  FetchDiscussionsError,
  fetchGitLabDiscussions,
} from '../lib/fetchGitLabDiscussions'
import {
  InMemoryReviewTaskStore,
} from '../lib/reviewTaskMapper'
import { dispatchAllFromStore, dispatchFromStore } from '../lib/dispatchFromStore'
import { Sidebar, type DispatchOutcome, type LoadState } from '../sidebar/Sidebar'
import {
  type Preferences,
  chromePreferenceStorage,
  readPreferences,
  subscribePreferences,
  writePreferences,
} from '../shared/storage/preferences'

import sidebarStyles from 'data-text:../sidebar/sidebar.css'

// Broad match so corporate/self-hosted GitLab instances work out of the box —
// their hostnames are unknowable at build time. The path shape
// (/-/merge_requests/) is GitLab-specific, and getRootContainer below still
// requires a numeric MR id before mounting anything, so non-GitLab sites that
// happen to be matched get no sidebar and no network calls.
export const config: PlasmoCSConfig = {
  matches: ['https://*/*/-/merge_requests/*'],
  run_at: 'document_idle',
}

const ROOT_ID = 'grb-sidebar-root'
const STYLE_ID = 'grb-sidebar-style'

/**
 * NOTE: the sidebar on/off preference is deliberately NOT checked here.
 *
 * This content script exports no anchor getter, so Plasmo builds no anchor
 * observer and calls render() exactly ONCE at document_idle, with no retry. A
 * container returned here is the only one we ever get — gate on the preference
 * and toggling it back on could never show the sidebar without a page reload.
 *
 * The enabled check therefore lives in Content(), which returns null when off.
 * Do not "optimize" it up into here.
 */
export const getRootContainer: PlasmoGetRootContainer = async () => {
  if (!isMergeRequestPage(window.location.href)) {
    return null as unknown as Element
  }

  injectStyleOnce()
  installUrlChangeBridge()

  const existing = document.getElementById(ROOT_ID)
  if (existing) return existing

  const host = document.createElement('div')
  host.id = ROOT_ID
  document.body.appendChild(host)
  return host
}

function injectStyleOnce(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = sidebarStyles
  document.head.appendChild(style)
}

function isMergeRequestPage(url: string): boolean {
  return /\/-\/merge_requests\/\d+/.test(url)
}

function installUrlChangeBridge(): void {
  const w = window as Window & { __grbUrlChangeInstalled?: boolean }
  if (w.__grbUrlChangeInstalled) return
  w.__grbUrlChangeInstalled = true

  const fire = () => window.dispatchEvent(new Event('grb:urlchange'))
  const origPush = history.pushState
  const origReplace = history.replaceState
  history.pushState = function (...args) {
    const r = origPush.apply(this, args)
    fire()
    return r
  }
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args)
    fire()
    return r
  }
  window.addEventListener('popstate', fire)
}

function extractMrTitle(): string {
  const el =
    document.querySelector('[data-testid="title-content"]') ??
    document.querySelector('h1.title') ??
    document.querySelector('meta[property="og:title"]')
  const text =
    el instanceof HTMLMetaElement ? el.content : (el?.textContent?.trim() ?? '')
  return text.replace(/\s*·.*$/, '').trim()
}

function Content() {
  // Single store instance per mount. URL changes within the same MR reuse it,
  // cross-MR navigation calls store.clear() to drop stale tasks.
  const store = useMemo(() => new InMemoryReviewTaskStore(), [])
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [title, setTitle] = useState<string>(extractMrTitle())
  const lastMrIid = useRef<string | null>(null)

  const storage = useMemo(() => chromePreferenceStorage(), [])
  // null until storage resolves. Treated as "not enabled" so the first paint
  // never fires a fetch a disabled user didn't ask for; the default-ON
  // semantics live in normalizePreferences, not here.
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const enabled = prefs?.enabled ?? false

  const sync = useCallback(
    async (url: string) => {
      setState({ kind: 'loading' })
      setTitle(extractMrTitle())
      try {
        const { mrIid, discussions } = await fetchGitLabDiscussions(url)
        if (lastMrIid.current && lastMrIid.current !== mrIid) {
          store.clear()
        }
        lastMrIid.current = mrIid
        const mrTitle = extractMrTitle()
        store.syncFromDiscussions({ iid: mrIid, title: mrTitle }, discussions)
        setState({ kind: 'ok', tasks: store.list() })
      } catch (err) {
        const message =
          err instanceof FetchDiscussionsError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Unknown error'
        setState({ kind: 'error', message })
      }
    },
    [store],
  )

  const refresh = useCallback(() => {
    void sync(window.location.href)
  }, [sync])

  const onDispatch = useCallback(
    async (taskId: string): Promise<DispatchOutcome> => {
      const snap = store.list().find((t) => t.id === taskId)
      if (!snap) return 'error'
      try {
        await dispatchFromStore(store, snap.discussionId, { agent: 'clipboard' })
        setState({ kind: 'ok', tasks: store.list() })
        return 'success'
      } catch {
        setState({ kind: 'ok', tasks: store.list() })
        return 'error'
      }
    },
    [store],
  )

  const onDispatchAll = useCallback(async (): Promise<DispatchOutcome> => {
    try {
      await dispatchAllFromStore(store, { agent: 'clipboard' })
      setState({ kind: 'ok', tasks: store.list() })
      return 'success'
    } catch {
      setState({ kind: 'ok', tasks: store.list() })
      return 'error'
    }
  }, [store])

  const setCollapsed = useCallback(
    (next: boolean) => {
      setPrefs((current) => ({
        enabled: current?.enabled ?? true,
        collapsed: next,
      }))
      void writePreferences(storage, { collapsed: next })
    },
    [storage],
  )

  useEffect(() => {
    let cancelled = false

    void readPreferences(storage).then((p) => {
      if (!cancelled) setPrefs(p)
    })

    // Fires in every tab, so toggling off in one hides the sidebar everywhere.
    const unsubscribe = subscribePreferences(storage, (p) => {
      if (!cancelled) setPrefs(p)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [storage])

  useEffect(() => {
    // Gated on `enabled` so a disabled sidebar issues no discussions.json
    // request at all — the render gate alone would still fetch.
    if (!enabled) return

    void sync(window.location.href)

    const onUrlChange = () => {
      const url = window.location.href
      if (isMergeRequestPage(url)) void sync(url)
    }
    window.addEventListener('grb:urlchange', onUrlChange)
    return () => window.removeEventListener('grb:urlchange', onUrlChange)
  }, [sync, enabled])

  useEffect(() => {
    // Drop tasks fetched before the toggle-off so re-enabling starts clean
    // instead of flashing a stale list. Also covers a sync that resolved after
    // the user disabled it.
    if (enabled) return
    store.clear()
    lastMrIid.current = null
    setState({ kind: 'loading' })
  }, [enabled, store])

  // Every hook must run before this early return (rules of hooks) — tsc will
  // not catch a violation and this repo has no eslint.
  if (!enabled) return null

  return (
    <Sidebar
      mrTitle={title}
      loadState={state}
      onRefresh={refresh}
      onDispatch={onDispatch}
      onDispatchAll={onDispatchAll}
      collapsed={prefs?.collapsed ?? false}
      onCollapsedChange={setCollapsed}
    />
  )
}

export default Content
