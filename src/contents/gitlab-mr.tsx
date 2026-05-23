import { useCallback, useEffect, useState } from 'react'
import type { PlasmoCSConfig, PlasmoGetRootContainer } from 'plasmo'

import { extractDiscussions } from '../contexts/gitlab-integration/application/ExtractDiscussions'
import type {
  ParsedDiscussion,
  ParsedMergeRequest,
} from '../contexts/gitlab-integration/domain'
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

// GitLab is an SPA — pushState/replaceState change the URL without a full reload.
// Re-emit them as a single 'grb:urlchange' event the React layer can subscribe to.
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

function parseCurrentPage(): ParsedMergeRequest | null {
  const { mr } = extractDiscussions({
    document,
    url: window.location.href,
  })
  return mr
}

function Content() {
  const [mr, setMr] = useState<ParsedMergeRequest | null>(() => parseCurrentPage())

  const refresh = useCallback(() => {
    setMr(parseCurrentPage())
  }, [])

  useEffect(() => {
    refresh()

    const onUrlChange = () => refresh()
    window.addEventListener('grb:urlchange', onUrlChange)

    // GitLab streams in discussion threads after initial paint; observe the
    // body and debounce re-parses so we pick them up without burning CPU.
    let debounce: ReturnType<typeof setTimeout> | null = null
    const observer = new MutationObserver(() => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(refresh, 250)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('grb:urlchange', onUrlChange)
      observer.disconnect()
      if (debounce) clearTimeout(debounce)
    }
  }, [refresh])

  const discussions: ParsedDiscussion[] = mr?.discussions ?? []
  const title = mr?.title ?? ''

  return <Sidebar mrTitle={title} discussions={discussions} onRefresh={refresh} />
}

export default Content
