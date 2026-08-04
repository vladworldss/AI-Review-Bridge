/**
 * User preferences persisted in `chrome.storage.local`.
 *
 * Kept free of React and DOM imports so the whole module is unit-testable as
 * plain `.ts` (the vitest `include` glob only picks up `*.test.ts`, and this
 * project has no React testing setup).
 *
 * Everything lives under ONE storage key holding one object, so an update fires
 * `onChanged` once rather than once per field — no transient half-applied state
 * reaching the UI.
 */

export type Preferences = {
  /** Master on/off. When false the sidebar renders nothing and fetches nothing. */
  enabled: boolean
  /** Sidebar collapsed to the narrow rail. */
  collapsed: boolean
}

export const PREFERENCES_KEY = 'grb:preferences'

/**
 * Absent/corrupt storage means ON — matches the pre-0.4.0 behaviour, so
 * upgrading users don't silently lose the sidebar.
 */
export const DEFAULT_PREFERENCES: Preferences = {
  enabled: true,
  collapsed: false,
}

type StorageChange = { newValue?: unknown; oldValue?: unknown }
type ChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void

/**
 * The slice of `chrome.storage` this module needs. Narrow on purpose: it keeps
 * the test stub small and documents exactly what the extension touches.
 */
export type PreferenceStorage = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  onChanged: {
    addListener(cb: ChangeListener): void
    removeListener(cb: ChangeListener): void
  }
}

/**
 * Defensive parse. Non-boolean fields are REJECTED rather than coerced — a
 * hand-edited or corrupted value should fall back to the safe default, not to
 * `Boolean('false') === true`.
 */
export function normalizePreferences(raw: unknown): Preferences {
  if (!isRecord(raw)) return { ...DEFAULT_PREFERENCES }
  return {
    enabled: boolOr(raw.enabled, DEFAULT_PREFERENCES.enabled),
    collapsed: boolOr(raw.collapsed, DEFAULT_PREFERENCES.collapsed),
  }
}

export async function readPreferences(
  storage: PreferenceStorage | null,
): Promise<Preferences> {
  if (!storage) return { ...DEFAULT_PREFERENCES }
  try {
    const bag = await storage.get(PREFERENCES_KEY)
    return normalizePreferences(bag[PREFERENCES_KEY])
  } catch {
    // Extension context invalidated (e.g. reloaded while the page stayed open).
    return { ...DEFAULT_PREFERENCES }
  }
}

/**
 * Read-modify-write of a PARTIAL patch. Must not clobber the sibling field —
 * writing `{collapsed}` has to preserve `enabled` and vice versa.
 */
export async function writePreferences(
  storage: PreferenceStorage | null,
  patch: Partial<Preferences>,
): Promise<Preferences> {
  const current = await readPreferences(storage)
  const next: Preferences = {
    enabled: patch.enabled ?? current.enabled,
    collapsed: patch.collapsed ?? current.collapsed,
  }
  if (!storage) return next
  try {
    await storage.set({ [PREFERENCES_KEY]: next })
  } catch {
    // Same as readPreferences: never let a dead extension context throw into
    // the UI. The in-memory value is still returned so the click feels applied.
  }
  return next
}

/**
 * Subscribe to preference changes. Returns an unsubscribe function.
 *
 * Filters on BOTH the area and the key: `onChanged` fires for every area
 * (`local`/`sync`/`session`/`managed`), so without these guards an unrelated
 * future key would re-render the sidebar and trigger a re-sync.
 */
export function subscribePreferences(
  storage: PreferenceStorage | null,
  onChange: (prefs: Preferences) => void,
): () => void {
  if (!storage) return () => {}

  const listener: ChangeListener = (changes, areaName) => {
    if (areaName !== 'local') return
    const entry = changes[PREFERENCES_KEY]
    if (!entry) return
    onChange(normalizePreferences(entry.newValue))
  }

  try {
    storage.onChanged.addListener(listener)
  } catch {
    return () => {}
  }

  return () => {
    try {
      storage.onChanged.removeListener(listener)
    } catch {
      // Nothing to do — the context is gone, so the listener is gone with it.
    }
  }
}

/**
 * Real `chrome.storage.local` adapter, or `null` when the API is unavailable
 * (dev server, jsdom, invalidated extension context). Callers treat `null` as
 * "use defaults, don't persist" — same guard style as `extensionVersion()` in
 * the sidebar.
 */
export function chromePreferenceStorage(): PreferenceStorage | null {
  try {
    const local = globalThis.chrome?.storage?.local
    const onChanged = globalThis.chrome?.storage?.onChanged
    if (!local || !onChanged) return null
    return {
      get: (key) => local.get(key) as Promise<Record<string, unknown>>,
      set: (items) => local.set(items),
      onChanged: {
        addListener: (cb) => onChanged.addListener(cb),
        removeListener: (cb) => onChanged.removeListener(cb),
      },
    }
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}
