import { InMemoryEventBus, type EventBus } from '../../../shared/events'
import type { ReviewTask, DomainEvent } from '../domain'

export type TaskEventBus = EventBus<DomainEvent>

export function createInMemoryTaskEventBus(): TaskEventBus {
  return new InMemoryEventBus<DomainEvent>()
}

export async function publishTaskEvents(
  task: ReviewTask,
  bus: TaskEventBus,
): Promise<DomainEvent[]> {
  const events = task.pullEvents()
  await bus.publishAll(events)
  return events
}
