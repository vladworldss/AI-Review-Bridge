export interface ClipboardPort {
  write(payload: string): Promise<void>
}
