import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  chromePreferenceStorage,
  normalizePreferences,
  readPreferences,
  subscribePreferences,
  writePreferences,
} from '../../src/shared/storage/preferences'
import { fakeChromeStorage } from './helpers/fakeChromeStorage'

describe('normalizePreferences', () => {
  it('defaults to enabled when there is nothing stored', () => {
    expect(normalizePreferences(undefined)).toEqual({
      enabled: true,
      collapsed: false,
    })
  })

  it('defaults an empty object', () => {
    expect(normalizePreferences({})).toEqual(DEFAULT_PREFERENCES)
  })

  it('keeps explicit booleans', () => {
    expect(normalizePreferences({ enabled: false, collapsed: true })).toEqual({
      enabled: false,
      collapsed: true,
    })
  })

  it('fills in only the missing field', () => {
    expect(normalizePreferences({ enabled: false })).toEqual({
      enabled: false,
      collapsed: false,
    })
  })

  it('rejects non-boolean values instead of coercing them', () => {
    // Boolean('false') is true — coercion here would flip the meaning.
    expect(normalizePreferences({ enabled: 'false' })).toEqual(
      DEFAULT_PREFERENCES,
    )
    expect(normalizePreferences({ enabled: 0, collapsed: 1 })).toEqual(
      DEFAULT_PREFERENCES,
    )
    expect(normalizePreferences({ enabled: null })).toEqual(DEFAULT_PREFERENCES)
  })

  it.each([null, [], 'x', 42, true])('defaults non-record input: %s', (raw) => {
    expect(normalizePreferences(raw)).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns a fresh object so callers cannot mutate the defaults', () => {
    const first = normalizePreferences(undefined)
    first.enabled = false
    expect(normalizePreferences(undefined).enabled).toBe(true)
    expect(DEFAULT_PREFERENCES.enabled).toBe(true)
  })
})

describe('readPreferences', () => {
  it('returns defaults for empty storage', async () => {
    await expect(readPreferences(fakeChromeStorage())).resolves.toEqual(
      DEFAULT_PREFERENCES,
    )
  })

  it('reads a stored value', async () => {
    const storage = fakeChromeStorage({
      [PREFERENCES_KEY]: { enabled: false, collapsed: true },
    })
    await expect(readPreferences(storage)).resolves.toEqual({
      enabled: false,
      collapsed: true,
    })
  })

  it('falls back to defaults without a storage adapter', async () => {
    await expect(readPreferences(null)).resolves.toEqual(DEFAULT_PREFERENCES)
  })

  it('falls back to defaults when storage throws', async () => {
    const storage = fakeChromeStorage()
    storage.get = () => Promise.reject(new Error('context invalidated'))
    await expect(readPreferences(storage)).resolves.toEqual(DEFAULT_PREFERENCES)
  })
})

describe('writePreferences', () => {
  it('persists under the single preferences key', async () => {
    const storage = fakeChromeStorage()
    await writePreferences(storage, { enabled: false })
    expect(storage.data[PREFERENCES_KEY]).toEqual({
      enabled: false,
      collapsed: false,
    })
  })

  it('merges a partial patch without clobbering the sibling field', async () => {
    const storage = fakeChromeStorage()
    await writePreferences(storage, { collapsed: true })
    await writePreferences(storage, { enabled: false })
    await expect(readPreferences(storage)).resolves.toEqual({
      enabled: false,
      collapsed: true,
    })
  })

  it('returns the merged result', async () => {
    const storage = fakeChromeStorage()
    await expect(writePreferences(storage, { collapsed: true })).resolves.toEqual(
      { enabled: true, collapsed: true },
    )
  })

  it('repairs a corrupted stored value on write', async () => {
    const storage = fakeChromeStorage({ [PREFERENCES_KEY]: 'garbage' })
    await writePreferences(storage, { collapsed: true })
    expect(storage.data[PREFERENCES_KEY]).toEqual({
      enabled: true,
      collapsed: true,
    })
  })

  it('is a no-op without a storage adapter but still reports the value', async () => {
    await expect(writePreferences(null, { enabled: false })).resolves.toEqual({
      enabled: false,
      collapsed: false,
    })
  })

  it('does not throw when storage.set fails', async () => {
    const storage = fakeChromeStorage()
    storage.set = () => Promise.reject(new Error('context invalidated'))
    await expect(
      writePreferences(storage, { enabled: false }),
    ).resolves.toEqual({ enabled: false, collapsed: false })
  })
})

describe('subscribePreferences', () => {
  it('fires with normalized preferences when the key changes', async () => {
    const storage = fakeChromeStorage()
    const seen = vi.fn()
    subscribePreferences(storage, seen)

    await writePreferences(storage, { enabled: false })

    expect(seen).toHaveBeenCalledTimes(1)
    expect(seen).toHaveBeenCalledWith({ enabled: false, collapsed: false })
  })

  it('normalizes a corrupted incoming value', () => {
    const storage = fakeChromeStorage()
    const seen = vi.fn()
    subscribePreferences(storage, seen)

    storage.emit({ [PREFERENCES_KEY]: { newValue: { enabled: 'nope' } } })

    expect(seen).toHaveBeenCalledWith(DEFAULT_PREFERENCES)
  })

  it('ignores changes to other keys', () => {
    const storage = fakeChromeStorage()
    const seen = vi.fn()
    subscribePreferences(storage, seen)

    storage.emit({ 'grb:something-else': { newValue: 1 } })

    expect(seen).not.toHaveBeenCalled()
  })

  it('ignores non-local storage areas', () => {
    const storage = fakeChromeStorage()
    const seen = vi.fn()
    subscribePreferences(storage, seen)

    storage.emit({ [PREFERENCES_KEY]: { newValue: { enabled: false } } }, 'sync')

    expect(seen).not.toHaveBeenCalled()
  })

  it('removes the listener on unsubscribe', async () => {
    const storage = fakeChromeStorage()
    const seen = vi.fn()
    const unsubscribe = subscribePreferences(storage, seen)
    expect(storage.listenerCount()).toBe(1)

    unsubscribe()

    expect(storage.listenerCount()).toBe(0)
    await writePreferences(storage, { enabled: false })
    expect(seen).not.toHaveBeenCalled()
  })

  it('is a safe no-op without a storage adapter', () => {
    const unsubscribe = subscribePreferences(null, vi.fn())
    expect(() => unsubscribe()).not.toThrow()
  })
})

describe('chromePreferenceStorage', () => {
  it('returns null when the chrome API is unavailable', () => {
    // No `chrome` global under plain vitest — the dev/jsdom degradation path.
    expect(chromePreferenceStorage()).toBeNull()
  })
})
