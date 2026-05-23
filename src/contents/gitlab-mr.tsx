import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlasmoCSConfig, PlasmoGetRootContainer } from 'plasmo'

import {
  FetchDiscussionsError,
  fetchGitLabDiscussions,
  type FetchedDiscussion,
} from '../lib/fetchGitLabDiscussions'
import { Sidebar } from '../sidebar/Sidebar'

import sidebarStyles from 'data-text:../sidebar/sidebar.css'

export const config: PlasmoCSConfig = {
  matches: [
    'https://gitlab.com/*/-/merge_requests/*',
    'https://gitlab.example.com/*/-/merge_requests/*',
  ],
  run_at: 'document_idle',
}

const ROOT_ID = 'grb-sidebar-root'
const STYLE_ID = 'grb-sidebar-style'

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

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; discussions: FetchedDiscussion[] }
  | { kind: 'error'; message: string }

function Content() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [title, setTitle] = useState<string>(extractMrTitle())
  const lastUrl = useRef<string>(window.location.href)

  const load = useCallback(async (url: string) => {
    setState({ kind: 'loading' })
    setTitle(extractMrTitle())
    try {
      const { discussions } = await fetchGitLabDiscussions(url)
      setState({ kind: 'ok', discussions })
    } catch (err) {
      const message =
        err instanceof FetchDiscussionsError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unknown error'
      setState({ kind: 'error', message })
    }
  }, [])

  const refresh = useCallback(() => {
    void load(window.location.href)
  }, [load])

  useEffect(() => {
    void load(window.location.href)

    const onUrlChange = () => {
      const url = window.location.href
      if (url === lastUrl.current) return
      lastUrl.current = url
      if (isMergeRequestPage(url)) void load(url)
    }
    window.addEventListener('grb:urlchange', onUrlChange)
    return () => window.removeEventListener('grb:urlchange', onUrlChange)
  }, [load])

  return (
    <Sidebar
      mrTitle={title}
      loadState={state}
      onRefresh={refresh}
    />
  )
}

export default Content
