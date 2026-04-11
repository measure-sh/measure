/**
 * Deduplicates concurrent calls to an async function by key.
 * If a call is already in flight with the same key, returns the existing promise.
 */
export type InFlightTracker<T = void> = {
  (key: string, fn: () => Promise<T>): Promise<T>
  clear: () => void
}

export function createInFlightTracker<T = void>(): InFlightTracker<T> {
  let pending: Promise<T> | null = null
  let pendingKey: string | null = null

  const tracker = (async (key: string, fn: () => Promise<T>): Promise<T> => {
    if (pending && pendingKey === key) {
      return pending
    }
    pendingKey = key
    pending = fn().finally(() => {
      if (pendingKey === key) {
        pending = null
        pendingKey = null
      }
    })
    return pending
  }) as InFlightTracker<T>

  tracker.clear = () => {
    pending = null
    pendingKey = null
  }

  return tracker
}
