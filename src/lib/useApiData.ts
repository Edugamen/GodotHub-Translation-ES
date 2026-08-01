import { useCallback, useEffect, useState } from 'react'

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
  }, deps)

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loaded, refresh, setData } as const
}

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
  }, deps)

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loaded, error, refresh, setData } as const
}
