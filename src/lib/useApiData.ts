import { useCallback, useEffect, useState } from 'react'

/**
 * Generic hook for loading data from an async API function.
 * Handles the common pattern of:
 *   - loading state
 *   - data state
 *   - refresh function
 *   - auto-load on mount / dependency change
 *
 * @param fetcher   Async function that returns the data.
 * @param deps      Dependencies that trigger a re-fetch.
 * @param initial   Initial data value (defaults to empty array).
 */
export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  initial: T | undefined = undefined,
) {
  const [data, setData] = useState<T>(initial as T)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setData(await fetcher())
    } catch {
      setData(initial as T)
    } finally {
      setLoaded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loaded, refresh, setData } as const
}

/**
 * Variant that wraps fetcher in try/catch and stores error.
 */
export function useApiDataWithError<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  initial: T | undefined = undefined,
) {
  const [data, setData] = useState<T>(initial as T)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      setData(await fetcher())
    } catch (e) {
      setData(initial as T)
      setError(String(e))
    } finally {
      setLoaded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loaded, error, refresh, setData } as const
}
