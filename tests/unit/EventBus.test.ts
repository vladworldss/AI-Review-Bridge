import { describe, expect, it, vi } from 'vitest'

import { InMemoryEventBus } from '../../src/shared/events'

type TestEvent =
  | { type: 'A'; payload: string }
  | { type: 'B'; n: number }

describe('InMemoryEventBus', () => {
  it('delivers events to type-specific handlers', async () => {
    const bus = new InMemoryEventBus<TestEvent>()
    const onA = vi.fn()
    bus.on('A', onA)

    await bus.publish({ type: 'A', payload: 'hello' })

    expect(onA).toHaveBeenCalledTimes(1)
    expect(onA).toHaveBeenCalledWith({ type: 'A', payload: 'hello' })
  })

  it('does not invoke handlers for other event types', async () => {
    const bus = new InMemoryEventBus<TestEvent>()
    const onA = vi.fn()
    const onB = vi.fn()
    bus.on('A', onA)
    bus.on('B', onB)

    await bus.publish({ type: 'A', payload: 'x' })

    expect(onA).toHaveBeenCalledTimes(1)
    expect(onB).not.toHaveBeenCalled()
  })

  it('supports multiple handlers per type', async () => {
    const bus = new InMemoryEventBus<TestEvent>()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('A', h1)
    bus.on('A', h2)

    await bus.publish({ type: 'A', payload: 'x' })

    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
  })

  it('onAny receives every event', async () => {
    const bus = new InMemoryEventBus<TestEvent>()
    const spy = vi.fn()
    bus.onAny(spy)

    await bus.publish({ type: 'A', payload: 'x' })
    await bus.publish({ type: 'B', n: 1 })

    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('unsubscribe stops further deliveries', async () => {
    const bus = new InMemoryEventBus<TestEvent>()
    const h = vi.fn()
    const off = bus.on('A', h)

    await bus.publish({ type: 'A', payload: 'first' })
    off()
    await bus.publish({ type: 'A', payload: 'second' })

    expect(h).toHaveBeenCalledTimes(1)
  })

  it('publishAll delivers events in order', async () => {
    const bus = new InMemoryEventBus<TestEvent>()
    const order: string[] = []
    bus.onAny((e) => {
      order.push(e.type === 'A' ? e.payload : String(e.n))
    })

    await bus.publishAll([
      { type: 'A', payload: 'first' },
      { type: 'B', n: 2 },
      { type: 'A', payload: 'third' },
    ])

    expect(order).toEqual(['first', '2', 'third'])
  })

  it('awaits async handlers before resolving publish', async () => {
    const bus = new InMemoryEventBus<TestEvent>()
    let done = false
    bus.on('A', async () => {
      await new Promise((r) => setTimeout(r, 5))
      done = true
    })

    await bus.publish({ type: 'A', payload: 'x' })
    expect(done).toBe(true)
  })

  it('isolates handler errors so other handlers still run', async () => {
    const bus = new InMemoryEventBus<TestEvent>()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const good = vi.fn()
    bus.on('A', () => {
      throw new Error('boom')
    })
    bus.on('A', good)

    await bus.publish({ type: 'A', payload: 'x' })

    expect(good).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
