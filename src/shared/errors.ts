export class NotImplementedError extends Error {
  constructor(useCase: string) {
    super(`Use case "${useCase}" is not implemented yet`)
    this.name = 'NotImplementedError'
  }
}
