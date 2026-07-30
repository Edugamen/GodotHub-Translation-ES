import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'

type EventHandler<T> = (payload: T) => void

/**
 * Subscribe to a Tauri event and automatically clean up on unmount
 * or when deps change.
 *
 * ```ts
 * useTauriEvent('godot-download-progress', (p: DownloadProgress) => { ... })
 * ```
 */
export function useTauriEvent<T = unknown>(
  event: string,
  handler: EventHandler<T>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const unlisten = listen<T>(event, (e) => handler(e.payload))
    return () => {
      unlisten.then((fn) => fn())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps])
}

/**
 * Subscribe to multiple Tauri events at once with a single cleanup.
 */
export function useTauriEvents(
  handlers: [string, (payload: unknown) => void][],
  deps: unknown[] = [],
) {
  useEffect(() => {
    const unlisteners = handlers.map(([event, handler]) =>
      listen(event, (e) => handler(e.payload)),
    )
    return () => {
      unlisteners.forEach((p) => p.then((fn) => fn()))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])
}
