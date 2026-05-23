export type DomainEventBase = { type: string }

export type EventHandler<E extends DomainEventBase> = (event: E) => void | Promise<void>

export type Unsubscribe = () => void

export interface EventBus<E extends DomainEventBase> {
  publish(event: E): Promise<void>
  publishAll(events: ReadonlyArray<E>): Promise<void>
  on<T extends E['type']>(
    type: T,
    handler: EventHandler<Extract<E, { type: T }>>,
  ): Unsubscribe
  onAny(handler: EventHandler<E>): Unsubscribe
}

export class InMemoryEventBus<E extends DomainEventBase> implements EventBus<E> {
  private byType = new Map<string, Set<EventHandler<E>>>()
  private anyHandlers = new Set<EventHandler<E>>()

  async publish(event: E): Promise<void> {
    const typed = this.byType.get(event.type)
    const handlers: EventHandler<E>[] = [
      ...(typed ?? []),
      ...this.anyHandlers,
    ]
    for (const h of handlers) {
      try {
        await h(event)
      } catch (err) {
        this.onHandlerError(event, err)
      }
    }
  }

  async publishAll(events: ReadonlyArray<E>): Promise<void> {
    for (const e of events) {
      await this.publish(e)
    }
  }

  on<T extends E['type']>(
    type: T,
    handler: EventHandler<Extract<E, { type: T }>>,
  ): Unsubscribe {
    const set = this.byType.get(type) ?? new Set<EventHandler<E>>()
    const wrapped = handler as EventHandler<E>
    set.add(wrapped)
    this.byType.set(type, set)
    return () => set.delete(wrapped)
  }

  onAny(handler: EventHandler<E>): Unsubscribe {
    this.anyHandlers.add(handler)
    return () => this.anyHandlers.delete(handler)
  }

  protected onHandlerError(event: E, err: unknown): void {
    console.error(`[EventBus] handler for ${event.type} threw`, err)
  }
}
