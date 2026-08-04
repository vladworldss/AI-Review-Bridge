import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_PREFERENCES,
  type Preferences,
  chromePreferenceStorage,
  readPreferences,
  subscribePreferences,
  writePreferences,
} from './shared/storage/preferences'

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

const WIDTH = 240

/**
 * Chrome measures the popup window from the document's layout at first paint.
 * This popup reads its state asynchronously from storage, so the first paint
 * happens before the value is known — if the document had no intrinsic size of
 * its own, Chrome could latch onto a collapsed window and the popup would look
 * like it never opened (until a reload changed the timing).
 *
 * Pinning html/body to the final width, and keeping the layout identical in the
 * loading state, makes the window size independent of when storage resolves.
 */
function useStablePopupSize(): void {
  useEffect(() => {
    const { documentElement: html, body } = document
    for (const el of [html, body]) {
      el.style.width = `${WIDTH}px`
      el.style.margin = '0'
      el.style.padding = '0'
    }
    body.style.overflow = 'hidden'
  }, [])
}

function Popup() {
  const storage = useMemo(() => chromePreferenceStorage(), [])
  useStablePopupSize()

  // Seeded with the defaults rather than null so the very first paint already
  // has the real layout. `settled` only drives the subtle "not confirmed yet"
  // styling — it must not change the box model, or the window would resize.
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let cancelled = false

    void readPreferences(storage).then((p) => {
      if (cancelled) return
      setPrefs(p)
      setSettled(true)
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
      setPrefs((current) => ({ ...current, enabled: next }))
      setSettled(true)
      void writePreferences(storage, { enabled: next })
    },
    [storage],
  )

  const enabled = prefs.enabled

  return (
    <main
      style={{
        boxSizing: 'border-box',
        width: WIDTH,
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
          cursor: 'pointer',
          // Opacity only — no layout change between loading and settled.
          opacity: settled ? 1 : 0.55,
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          style={{ margin: 0 }}
        />
        <span style={{ flex: 1 }}>Sidebar</span>
        <strong style={{ color: enabled ? '#1f7a3d' : '#8b8b8b' }}>
          {enabled ? 'On' : 'Off'}
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
