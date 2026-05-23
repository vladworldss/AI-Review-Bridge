export * from './domain'
export type { ClipboardPort } from './application/ClipboardPort'
export {
  dispatchTask,
  TaskNotFoundError,
  type DispatchTaskInput,
  type DispatchTaskDeps,
  type DispatchTaskResult,
} from './application/DispatchTask'
export {
  BrowserClipboardAdapter,
  ClipboardUnavailableError,
  ClipboardWriteError,
  type BrowserClipboardDeps,
} from './infrastructure/BrowserClipboardAdapter'
