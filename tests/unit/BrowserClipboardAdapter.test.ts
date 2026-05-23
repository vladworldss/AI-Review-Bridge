import { describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'

import {
  BrowserClipboardAdapter,
  ClipboardUnavailableError,
  ClipboardWriteError,
  type BrowserClipboardDeps,
} from '../../src/contexts/ai-dispatch/infrastructure/BrowserClipboardAdapter'

function withNoDocument(deps: Omit<BrowserClipboardDeps, 'doc'>): BrowserClipboardAdapter {
  return new BrowserClipboardAdapter({ ...deps, doc: null })
}

describe('BrowserClipboardAdapter', () => {
  it('writes via the async Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const adapter = new BrowserClipboardAdapter({ asyncClipboard: { writeText } })

    await adapter.write('hello')

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand("copy") when the async API rejects', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>')
    const doc = dom.window.document
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(doc, 'execCommand', { value: execCommand })

    const writeText = vi.fn().mockRejectedValue(new Error('not allowed'))
    const adapter = new BrowserClipboardAdapter({
      asyncClipboard: { writeText },
      doc,
    })

    await adapter.write('payload')

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(execCommand).toHaveBeenCalledWith('copy')
    // textarea cleaned up afterwards
    expect(doc.body.querySelector('textarea')).toBeNull()
  })

  it('uses execCommand directly when no async API is configured', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>')
    const doc = dom.window.document
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(doc, 'execCommand', { value: execCommand })

    const adapter = new BrowserClipboardAdapter({ asyncClipboard: null, doc })

    await adapter.write('just-this')

    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('throws ClipboardWriteError when execCommand returns false', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>')
    const doc = dom.window.document
    Object.defineProperty(doc, 'execCommand', { value: () => false })

    const adapter = new BrowserClipboardAdapter({ asyncClipboard: null, doc })

    await expect(adapter.write('x')).rejects.toBeInstanceOf(ClipboardWriteError)
  })

  it('throws ClipboardUnavailableError when neither async API nor document is available', async () => {
    const adapter = withNoDocument({ asyncClipboard: null })
    await expect(adapter.write('x')).rejects.toBeInstanceOf(ClipboardUnavailableError)
  })

  it('throws ClipboardWriteError when async API fails and no document is available', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const adapter = withNoDocument({ asyncClipboard: { writeText } })
    await expect(adapter.write('x')).rejects.toBeInstanceOf(ClipboardWriteError)
  })
})
