import type { AssetLibraryAsset } from '../types'

/**
 * Sort options for browsing the Godot Asset Library.
 *
 * The live API only honors `sort=(updated|name|rating|cost)` plus a `reverse`
 * flag (downloads / added / version / support_level silently fall back to the
 * default "updated" order). "Relevance" has no server-side ranking, so it is
 * approximated client-side by `rankByRelevance` when a search query is active.
 */
export type AssetSortKey =
  | 'relevance'
  | 'updated_new'
  | 'updated_old'
  | 'name_az'
  | 'name_za'
  | 'rating_high'
  | 'rating_low'
  | 'license_az'
  | 'license_za'

export const ASSET_SORT_KEYS: AssetSortKey[] = [
  'relevance',
  'updated_new',
  'updated_old',
  'name_az',
  'name_za',
  'rating_high',
  'rating_low',
  'license_az',
  'license_za',
]

/**
 * Maps a sort key to the raw `sort`/`reverse` query params.
 * The server defaults dates to descending (newest first) and strings to
 * ascending, so `reverse` is only set for the flipped direction.
 */
export function assetSortParams(key: AssetSortKey): {
  sort: string | null
  reverse: boolean
} {
  switch (key) {
    case 'updated_new':
      return { sort: 'updated', reverse: false }
    case 'updated_old':
      return { sort: 'updated', reverse: true }
    case 'name_az':
      return { sort: 'name', reverse: false }
    case 'name_za':
      return { sort: 'name', reverse: true }
    case 'rating_high':
      return { sort: 'rating', reverse: true }
    case 'rating_low':
      return { sort: 'rating', reverse: false }
    case 'license_az':
      return { sort: 'cost', reverse: false }
    case 'license_za':
      return { sort: 'cost', reverse: true }
    default:
      return { sort: null, reverse: false }
  }
}

function relevanceScore(asset: AssetLibraryAsset, query: string): number {
  const title = asset.title.toLowerCase()
  const author = asset.author.toLowerCase()
  const category = asset.category.toLowerCase()
  const description = (asset.description ?? '').toLowerCase()
  let score = 0
  if (title === query) score += 100
  else if (title.startsWith(query)) score += 80
  else if (title.includes(query)) score += 60
  if (author.includes(query)) score += 25
  if (category.includes(query)) score += 15
  if (description.includes(query)) score += 10
  return score
}

/**
 * Deterministic tie-breaker used whenever the primary comparison is a draw, so
 * the final order never depends on the server response order (the new store
 * returns identical requests in different orders). Title, then asset id.
 */
function tieBreak(a: AssetLibraryAsset, b: AssetLibraryAsset): number {
  const byTitle = a.title.localeCompare(b.title)
  if (byTitle !== 0) return byTitle
  return a.asset_id.localeCompare(b.asset_id)
}

/**
 * Client-side relevance ranking used when "Relevance" is selected and a search
 * query is active. The server has no relevance scoring, so we rank the loaded
 * results by how strongly they match the query (title matches weigh the most).
 * With no query there is no relevance signal, so a stable title order is used
 * instead of preserving the (potentially shuffled) server order. Always
 * returns a new array; the input is never mutated.
 */
export function rankByRelevance(
  assets: AssetLibraryAsset[],
  query: string,
): AssetLibraryAsset[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...assets].sort(tieBreak)
  return [...assets].sort((a, b) => {
    const byScore = relevanceScore(b, q) - relevanceScore(a, q)
    return byScore !== 0 ? byScore : tieBreak(a, b)
  })
}

// ---------------------------------------------------------------------------
// Merged browsing across the old Asset Library and the new Asset Store.
// The two APIs expose different sort fields, so when browsing both sources at
// once the combined list is sorted client-side on fields both provide.
// ---------------------------------------------------------------------------

export type AssetSource = 'all' | 'library' | 'store'

/**
 * Maps a sort key to the new Asset Store's `sort` enum. Name/license are not
 * supported by the store API and fall back to its relevance ordering.
 */
export function storeServerSort(key: AssetSortKey): string {
  switch (key) {
    case 'updated_new':
      return 'updated_desc'
    case 'updated_old':
      return 'updated_asc'
    case 'rating_high':
      return 'reviews_desc'
    case 'rating_low':
      return 'reviews_asc'
    default:
      return 'relevance'
  }
}

/**
 * Sort keys offered per source filter. "Updated" relies on server-side dates
 * that the new store does not expose in search results, so it is only
 * available when a single source is selected.
 */
export function sortKeysForSource(source: AssetSource): AssetSortKey[] {
  const base: AssetSortKey[] = [
    'relevance',
    'name_az',
    'name_za',
    'license_az',
    'license_za',
    'rating_high',
    'rating_low',
  ]
  return source === 'all' ? base : [...base, 'updated_new', 'updated_old']
}

/**
 * Whether the loaded results must be re-sorted client-side. The old library
 * sorts deterministically server-side, but the new store returns identical
 * requests in different orders for relevance and name/license (which fall back
 * to relevance), and leaves rating ties in an unstable order - so those are
 * re-sorted locally. "Updated" is served deterministically and can't be
 * computed locally, so it is left untouched. The merged view always sorts
 * client-side.
 */
export function shouldClientSort(
  source: AssetSource,
  sort: AssetSortKey,
  query: string,
): boolean {
  if (source === 'all') return true
  if (source === 'store') {
    if (!query.trim()) return true
    // The store's relevance ranking is non-deterministic between requests and
    // its name/license sorts fall back to that same unstable order, so all of
    // those are re-sorted locally. Rating is re-sorted to break ties that the
    // server leaves in an unstable order. "Updated" is served deterministically
    // and can't be computed locally, so it is left untouched.
    return (
      sort === 'relevance' ||
      sort === 'name_az' ||
      sort === 'name_za' ||
      sort === 'license_az' ||
      sort === 'license_za' ||
      sort === 'rating_high' ||
      sort === 'rating_low'
    )
  }
  return false
}

function parseRating(asset: AssetLibraryAsset): number {
  const n = parseFloat(asset.rating ?? '')
  return Number.isFinite(n) ? n : 0
}

/**
 * Sorts a combined list client-side. Only used for the sorts that can be
 * computed on fields both sources provide; "updated" keys are left untouched
 * (they rely on server ordering in single-source mode).
 */
export function sortAssets(
  assets: AssetLibraryAsset[],
  sort: AssetSortKey,
  query: string,
): AssetLibraryAsset[] {
  switch (sort) {
    case 'relevance':
      return rankByRelevance(assets, query)
    case 'name_az':
      return [...assets].sort((a, b) => tieBreak(a, b))
    case 'name_za':
      return [...assets].sort((a, b) => tieBreak(b, a))
    case 'license_az':
      return [...assets].sort((a, b) =>
        (a.cost ?? '').localeCompare(b.cost ?? '') || tieBreak(a, b),
      )
    case 'license_za':
      return [...assets].sort((a, b) =>
        (b.cost ?? '').localeCompare(a.cost ?? '') || tieBreak(a, b),
      )
    case 'rating_high':
      return [...assets].sort((a, b) =>
        parseRating(b) - parseRating(a) || tieBreak(a, b),
      )
    case 'rating_low':
      return [...assets].sort((a, b) =>
        parseRating(a) - parseRating(b) || tieBreak(a, b),
      )
    default:
      return assets
  }
}
