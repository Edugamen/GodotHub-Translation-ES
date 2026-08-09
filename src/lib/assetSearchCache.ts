import type { AssetLibraryResponse } from '../types'

/**
 * Small in-memory cache for asset search responses, shared by the Asset Store
 * and Templates browsers. Re-applying a filter or navigating back to a page
 * seen recently returns the cached result instead of re-hitting the network
 * (the Rust backend caches too; this just skips the invoke round trip).
 *
 * Successful responses are kept for a short TTL; failed requests are evicted
 * immediately so a retry always re-fetches.
 */
const RESPONSE_CACHE_TTL = 120_000
const responseCache = new Map<
  string,
  { at: number; promise: Promise<AssetLibraryResponse> }
>()

export function cachedAssetSearch(
  key: string,
  fn: () => Promise<AssetLibraryResponse>,
): Promise<AssetLibraryResponse> {
  const hit = responseCache.get(key)
  if (hit && Date.now() - hit.at < RESPONSE_CACHE_TTL) {
    return hit.promise
  }
  const promise = fn()
  promise.catch(() => responseCache.delete(key))
  responseCache.set(key, { at: Date.now(), promise })
  return promise
}
