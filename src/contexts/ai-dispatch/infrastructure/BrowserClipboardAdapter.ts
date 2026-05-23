import type { ClipboardPort } from '../application/ClipboardPort'

export class ClipboardUnavailableError extends Error {
  constructor(message = 'Clipboard API unavailable in this context') {
    super(message)
    this.name = 'ClipboardUnavailableError'
  }
}

export class ClipboardWriteError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ClipboardWriteError'
  }
}

export type BrowserClipboardDeps = {
  // Async Clipboard API. `null` to force the fallback path (useful in tests
  // and on pages where the API is permission-denied).
  asyncClipboard?: Pick<Clipboard, 'writeText'> | null
  // DOM root used by the execCommand fallback. Defaults to global `document`;
  // pass `null` to disable the fallback.
  doc?: Document | null
}

/**
 * ClipboardPort implementation backed by `navigator.clipboard.writeText`,
 * with a `document.execCommand('copy')` fallback for content-script contexts
 * where the async API is gated by permissions or transient-activation rules.
 */
export class BrowserClipboardAdapter implements ClipboardPort {
  private readonly asyncClipboard: Pick<Clipboard, 'writeText'> | null
  private readonly doc: Document | null

  constructor(deps: BrowserClipboardDeps = {}) {
    this.asyncClipboard =
      deps.asyncClipboard !== undefined
        ? deps.asyncClipboard
        : typeof navigator !== 'undefined' && navigator.clipboard
          ? navigator.clipboard
          : null
    this.doc =
      'doc' in deps
        ? (deps.doc ?? null)
        : typeof document !== 'undefined'
          ? document
          : null
  }

  async write(payload: string): Promise<void> {
    if (this.asyncClipboard) {
      try {
        await this.asyncClipboard.writeText(payload)
        return
      } catch (err) {
        if (!this.doc) {
          throw new ClipboardWriteError(messageOf(err), err)
        }
        // Fall through to execCommand fallback.
      }
    }

    if (!this.doc) {
      throw new ClipboardUnavailableError()
    }

    const ok = writeViaExecCommand(this.doc, payload)
    if (!ok) {
      throw new ClipboardWriteError('execCommand("copy") returned false')
    }
  }
}

function writeViaExecCommand(doc: Document, payload: string): boolean {
  const ta = doc.createElement('textarea')
  ta.value = payload
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '0'
  ta.style.opacity = '0'
  ta.style.pointerEvents = 'none'
  doc.body.appendChild(ta)
  try {
    ta.select()
    ta.setSelectionRange(0, payload.length)
    return doc.execCommand('copy')
  } catch {
    return false
  } finally {
    doc.body.removeChild(ta)
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
