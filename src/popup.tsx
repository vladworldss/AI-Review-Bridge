import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  type Preferences,
  chromePreferenceStorage,
  readPreferences,
  subscribePreferences,
  writePreferences,
} from './shared/storage/preferences'

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

function Popup() {
  const storage = useMemo(() => chromePreferenceStorage(), [])
  // null while storage resolves, so the switch never flashes the wrong position.
  const [prefs, setPrefs] = useState<Preferences | null>(null)

  useEffect(() => {
    let cancelled = false

    void readPreferences(storage).then((p) => {
      if (!cancelled) setPrefs(p)
    })

    // Another popup window (or the sidebar) may change this while we're open.
    const unsubscribe = subscribePreferences(storage, (p) => {
      if (!cancelled) setPrefs(p)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [storage])

  const toggle = useCallback(
    (next: boolean) => {
      // Optimistic: the storage round-trip is ~1ms but the click should feel
      // instant. The onChanged subscription re-confirms the same value.
      setPrefs((current) => ({
        enabled: next,
        collapsed: current?.collapsed ?? false,
      }))
      void writePreferences(storage, { enabled: next })
    },
    [storage],
  )

  const loading = prefs === null
  const enabled = prefs?.enabled ?? true

  return (
    <main
      style={{
        width: 240,
        padding: 12,
        fontFamily: FONT_STACK,
        fontSize: 13,
      }}
    >
      <h1 style={{ fontSize: 14, margin: '0 0 10px' }}>AI Review Bridge</h1>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={loading}
          onChange={(e) => toggle(e.target.checked)}
          style={{ margin: 0 }}
        />
        <span style={{ flex: 1 }}>Sidebar</span>
        <strong style={{ color: enabled ? '#1f7a3d' : '#8b8b8b' }}>
          {loading ? '…' : enabled ? 'On' : 'Off'}
        </strong>
      </label>

      <p style={{ margin: '10px 0 0', color: '#555', lineHeight: 1.4 }}>
        {enabled
          ? 'Open a merge request on gitlab.com or any self-hosted GitLab to see the sidebar.'
          : 'The sidebar is hidden on every merge request. Turn it back on here.'}
      </p>
      <p style={{ margin: '6px 0 0', color: '#888', fontSize: 12 }}>
        The setting is remembered across merge requests and browser restarts.
      </p>
    </main>
  )
}

export default Popup
