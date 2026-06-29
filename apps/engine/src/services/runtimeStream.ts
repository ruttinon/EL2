/**
 * Lightweight in-process pub/sub for runtime tag values.
 * The polling service pushes the latest snapshot here after every read cycle,
 * and SSE clients (/api/tags/stream) subscribe to receive real-time updates
 * instead of polling /api/tags/current on an interval.
 */

export type RuntimeSubscriber = (values: unknown[]) => void;

const subscribers = new Set<RuntimeSubscriber>();

export function addRuntimeSubscriber(fn: RuntimeSubscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function runtimeSubscriberCount(): number {
  return subscribers.size;
}

export function broadcastRuntimeValues(values: unknown[]): void {
  if (subscribers.size === 0) return;
  for (const fn of subscribers) {
    try {
      fn(values);
    } catch {
      // ignore broken pipe / closed connection — close handler removes it
    }
  }
}
