import type { PreferenceStorage } from '../../../src/shared/storage/preferences'

type StorageChange = { newValue?: unknown; oldValue?: unknown }
type ChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void

export type FakeChromeStorage = PreferenceStorage & {
  /** Raw backing bag, for asserting what actually landed in storage. */
  data: Record<string, unknown>
  /** Live listener count, so unsubscribe can be asserted directly. */
  listenerCount(): number
  /** Emit an arbitrary change, e.g. a foreign key or a non-local area. */
  emit(changes: Record<string, StorageChange>, areaName?: string): void
}

/**
 * Minimal `chrome.storage.local` double.
 *
 * Two behaviours matter and a naive stub misses both:
 *  - `set()` fires `onChanged` the way Chrome does, so the round-trip is
 *    exercised rather than just the getter.
 *  - `get()` returns `{}` for a missing key (NOT `{key: undefined}`), matching
 *    the real API — that's what the defaults path has to cope with.
 */
export function fakeChromeStorage(
  initial: Record<string, unknown> = {},
): FakeChromeStorage {
  const data: Record<string, unknown> = { ...initial }
  const listeners = new Set<ChangeListener>()

  const emit = (changes: Record<string, StorageChange>, areaName = 'local') => {
    for (const listener of [...listeners]) listener(changes, areaName)
  }

  return {
    data,
    listenerCount: () => listeners.size,
    emit,
    async get(key) {
      return key in data ? { [key]: data[key] } : {}
    },
    async set(items) {
      const changes: Record<string, StorageChange> = {}
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data[key], newValue: value }
        data[key] = value
      }
      emit(changes)
    },
    onChanged: {
      addListener: (cb) => {
        listeners.add(cb)
      },
      removeListener: (cb) => {
        listeners.delete(cb)
      },
    },
  }
}
