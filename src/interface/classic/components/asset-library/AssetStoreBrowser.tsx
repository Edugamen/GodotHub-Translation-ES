import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { openUrl } from '@tauri-apps/plugin-opener'
import { api } from '../../../../lib/api'
import { useProjectsContext } from '../../../../hooks/projectsContext'
import {
  assetSortParams,
  shouldClientSort,
  sortAssets,
  sortKeysForSource,
  storeServerSort,
  type AssetSortKey,
  type AssetSource,
} from '../../../../lib/assetSort'
import type {
  AssetLibraryAsset,
  AssetLibraryCategory,
} from '../../../../types'
import { cachedAssetSearch } from '../../../../lib/assetSearchCache'
import { Dropdown } from '../ui/Dropdown'
import {
  InstallAssetModal,
  type AssetInstallOutcome,
} from '../modals/InstallAssetModal'
import {
  IconSearch,
  IconStore,
  IconDownload,
  IconCheck,
  IconCircleCheck,
  IconCloudArrowDown,
  IconSpinner,
  IconX,
} from '../../lib/Icons'
import { Tooltip } from '../reusables/Tooltip'
import { AssetCard } from '../ui/AssetCard'

const PAGE_SIZE = 12

const VERSION_OPTIONS = [
  '4.7',
  '4.6',
  '4.5',
  '4.4',
  '4.3',
  '4.2',
  '4.1',
]

const SOURCE_OPTIONS: { value: AssetSource; labelKey: string }[] = [
  { value: 'all', labelKey: 'asset_source_all' },
  { value: 'library', labelKey: 'asset_source_library' },
  { value: 'store', labelKey: 'asset_source_store' },
]

function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx > 0 ? path.slice(0, idx) : path
}

function parseStoreId(id: string): [string, string] {
  const rest = id.startsWith('store:') ? id.slice('store:'.length) : id
  const idx = rest.indexOf('/')
  return idx > 0 ? [rest.slice(0, idx), rest.slice(idx + 1)] : [rest, '']
}

export function AssetStoreBrowser() {
  const { t } = useTranslation('common')
  const { refresh: refreshProjects } = useProjectsContext()
  const [assets, setAssets] = useState<AssetLibraryAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<AssetSource>('all')
  const [categoryId, setCategoryId] = useState('')
  const [version, setVersion] = useState('')
  const [sort, setSort] = useState<AssetSortKey>('relevance')
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<AssetLibraryCategory[]>([])
  const [installAsset, setInstallAsset] = useState<AssetLibraryAsset | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    api
      .listAssetLibraryCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.category_type === '0')
        .map((c) => ({ value: c.id, label: c.name })),
    [categories],
  )

  useEffect(() => {
    if (categoryId && !categoryOptions.some((c) => c.value === categoryId)) {
      setCategoryId('')
    }
  }, [categoryOptions, categoryId])

  useEffect(() => {
    if (
      source === 'all' &&
      (sort === 'updated_new' || sort === 'updated_old')
    ) {
      setSort('relevance')
    }
  }, [source, sort])

  const showNotice = (message: string) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }

  const load = useCallback(
    async (nextPage: number, append: boolean): Promise<number> => {
      const seq = ++requestSeq.current
      try {
        const { sort: librarySort, reverse } = assetSortParams(sort)
        const storeSort = storeServerSort(sort)
        const fetchLibrary = () =>
          cachedAssetSearch(
            `lib|${query.trim()}|${version || ''}|${nextPage}|${categoryId}|${librarySort}|${reverse}`,
            () =>
              api.searchAssetLibrary(
                query.trim() || null,
                version || VERSION_OPTIONS[0],
                nextPage,
                PAGE_SIZE,
                'addon',
                categoryId || null,
                librarySort,
                reverse,
              ),
          )
        const fetchStore = () =>
          cachedAssetSearch(
            `store|${query.trim()}|${version || ''}|${nextPage}|${storeSort}`,
            () =>
              api.searchAssetStore(
                query.trim() || null,
                version || null,
                nextPage,
                PAGE_SIZE,
                storeSort,
              ),
          )

        let merged: AssetLibraryAsset[] = []
        let resTotal = 0
        let resPages = 1
        if (source === 'all') {
          const [libRes, storeRes] = await Promise.allSettled([
            fetchLibrary(),
            fetchStore(),
          ])
          const lib = libRes.status === 'fulfilled' ? libRes.value : null
          const store = storeRes.status === 'fulfilled' ? storeRes.value : null
          if (!lib && !store) {
            throw new Error('Both asset sources failed')
          }
          merged = [...(lib?.assets ?? []), ...(store?.assets ?? [])]
          resTotal = (lib?.total ?? 0) + (store?.total ?? 0)
          resPages = Math.max(lib?.pages ?? 1, store?.pages ?? 1)
          if ((!lib || !store) && !append) {
            showNotice(t('asset_load_partial'))
          }
        } else if (source === 'library') {
          const res = await fetchLibrary()
          merged = res.assets
          resTotal = res.total
          resPages = res.pages
        } else {
          const res = await fetchStore()
          merged = res.assets
          resTotal = res.total
          resPages = res.pages
        }

        if (requestSeq.current !== seq) return seq
        setAssets((prev) => {
          const next = append ? [...prev, ...merged] : merged
          const seen = new Set<string>()
          const deduped = next.filter((a) => {
            if (seen.has(a.asset_id)) return false
            seen.add(a.asset_id)
            return true
          })
          return shouldClientSort(source, sort, query)
            ? sortAssets(deduped, sort, query)
            : deduped
        })
        setPages(resPages)
        setTotal(resTotal)
        setPage(nextPage)
        setError(null)
      } catch (e) {
        if (requestSeq.current !== seq) return seq
        setError(String(e))
      }
      return seq
    },
    [query, version, categoryId, sort, source],
  )

  useEffect(() => {
    setError(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setLoading(true)
      const seq = await load(0, false)
      if (requestSeq.current === seq) setLoading(false)
    }, 250)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [query, version, categoryId, sort, source, load])

  const loadMore = async () => {
    if (loadingMore || page + 1 >= pages) return
    setLoadingMore(true)
    await load(page + 1, true)
    setLoadingMore(false)
  }

  const handleInstalled = (outcome: AssetInstallOutcome) => {
    setInstalled((prev) => new Set(prev).add(outcome.assetId))
    if (outcome.targetType === 'project') {
      refreshProjects()
    } else {
      window.dispatchEvent(new Event('app:refresh-templates'))
    }
    showNotice(
      outcome.targetType === 'project'
        ? t('asset_install_success_project', { target: outcome.targetName })
        : t('asset_install_success_template', { target: outcome.targetName }),
    )
  }

  const handleDownload = async (asset: AssetLibraryAsset) => {
    if (busyId) return
    setBusyId(asset.asset_id)
    try {
      const path = await api.downloadAsset(asset.asset_id)
      setDownloaded((prev) => new Set(prev).add(asset.asset_id))
      api.openProjectFolder(dirname(path)).catch(() => {})
      showNotice(`${t('asset_downloaded_to')} ${dirname(path)}`)
    } catch (e) {
      showNotice(t('asset_download_error'))
    } finally {
      setBusyId(null)
    }
  }

  const handleStoreDownload = async (asset: AssetLibraryAsset) => {
    if (busyId) return
    setBusyId(asset.asset_id)
    try {
      const [publisherSlug, assetSlug] = parseStoreId(asset.asset_id)
      const path = await api.downloadStoreAsset(
        publisherSlug,
        assetSlug,
        asset.title,
      )
      setDownloaded((prev) => new Set(prev).add(asset.asset_id))
      api.openProjectFolder(dirname(path)).catch(() => {})
      showNotice(`${t('asset_downloaded_to')} ${dirname(path)}`)
    } catch (e) {
      showNotice(t('asset_download_error'))
    } finally {
      setBusyId(null)
    }
  }

  const sortOptions = sortKeysForSource(source).map((k) => ({
    value: k,
    label: t(`asset_sort_${k}`),
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56 max-w-md">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted/50 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('asset_search_placeholder')}
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-line bg-surface text-sm text-ink placeholder:text-muted/50 outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent/30"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted/50 hover:text-ink transition-colors cursor-pointer"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="w-40 shrink-0">
          <Dropdown
            value={source}
            onChange={(v) => setSource(v as AssetSource)}
            options={SOURCE_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.labelKey),
            }))}
            hideEmpty
          />
        </div>
        {source !== 'store' && (
          <div className="w-44 shrink-0">
            <Dropdown
              value={categoryId}
              onChange={setCategoryId}
              emptyLabel={t('asset_category_all')}
              options={categoryOptions}
              hideEmpty={false}
            />
          </div>
        )}
        <div className="w-44 shrink-0">
          <Dropdown
            value={sort}
            onChange={(v) => setSort(v as AssetSortKey)}
            options={sortOptions}
            hideEmpty
          />
        </div>
        <div className="w-40 shrink-0">
          <Dropdown
            value={version}
            onChange={setVersion}
            emptyLabel={t('asset_all_versions')}
            options={VERSION_OPTIONS.map((v) => ({ value: v, label: `Godot ${v}` }))}
            hideEmpty={false}
          />
        </div>
        {!loading && (
          <span className="text-[11px] text-muted/60 shrink-0">
            {t('asset_result_count', { count: total })}
          </span>
        )}
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-mint/20 bg-mint/10 text-xs text-mint"
          >
            <IconCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="min-w-0 wrap-break-word">{notice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border border-line rounded-xl bg-surface overflow-hidden flex flex-col animate-pulse"
            >
              <div className="h-28 bg-raised" />
              <div className="p-3.5 flex flex-col gap-2.5 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-4 w-3/4 rounded bg-raised" />
                  <div className="w-5 h-5 rounded bg-raised shrink-0" />
                </div>
                <div className="h-3 w-1/2 rounded bg-raised" />
                <div className="h-3 w-2/3 rounded bg-raised mt-1" />
                <div className="flex gap-1.5 mt-1">
                  <div className="h-4 w-14 rounded-md bg-raised" />
                  <div className="h-4 w-10 rounded-md bg-raised" />
                </div>
              </div>
              <div className="px-3.5 py-3 border-t border-line/50 flex justify-end gap-1.5">
                <div className="h-7 w-16 rounded-lg bg-raised" />
                <div className="h-7 w-20 rounded-lg bg-raised" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="border border-dashed border-line rounded-2xl py-24 flex flex-col items-center gap-4 text-center">
          <IconStore className="w-6 h-6 text-muted" />
          <p className="text-sm text-muted max-w-xs leading-relaxed">{t('asset_load_error')}</p>
          <button
            onClick={() => load(0, false)}
            className="focus-ring cursor-pointer px-4 py-2 rounded-lg border border-line hover:bg-raised text-xs font-medium text-ink transition-colors"
          >
            {t('retry')}
          </button>
        </div>
      ) : assets.length === 0 ? (
        <div className="border border-dashed border-line rounded-2xl py-24 flex flex-col items-center gap-4 text-center">
          <IconStore className="w-6 h-6 text-muted" />
          <p className="text-sm text-muted max-w-xs leading-relaxed">{t('asset_no_results')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {assets.map((asset) => {
                const isInstalled = installed.has(asset.asset_id)
                const isDownloaded = downloaded.has(asset.asset_id)
                const isBusy = busyId === asset.asset_id
                const isStore = asset.source === 'store'
                return (
                  <AssetCard
                    key={asset.asset_id}
                    asset={asset}
                    showSource={source === 'all'}
                    onOpenPage={
                      asset.browse_url
                        ? () => openUrl(asset.browse_url!)
                        : undefined
                    }
                    actions={
                      <div className="flex items-center justify-end gap-1.5 w-full">
                        <Tooltip
                          content={isDownloaded ? t('asset_downloaded') : t('asset_download')}
                          side="top"
                        >
                          <motion.button
                            whileHover={isBusy || isDownloaded ? undefined : { y: -1 }}
                            whileTap={isBusy || isDownloaded ? undefined : { scale: 0.94 }}
                            onClick={() =>
                              isStore
                                ? handleStoreDownload(asset)
                                : handleDownload(asset)
                            }
                            disabled={isBusy || isDownloaded}
                            className={`focus-ring cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:cursor-default ${
                              isDownloaded
                                ? 'bg-mint/10 text-mint border-mint/20'
                                : 'border-line text-muted hover:text-ink hover:bg-raised'
                            }`}
                          >
                            {isBusy ? (
                              <IconSpinner className="w-3 h-3 animate-spin" />
                            ) : isDownloaded ? (
                              <IconCircleCheck className="w-3 h-3" />
                            ) : (
                              <IconCloudArrowDown className="w-3 h-3" />
                            )}
                          </motion.button>
                        </Tooltip>
                        <motion.button
                          whileHover={isInstalled || isBusy ? undefined : { y: -1 }}
                          whileTap={isInstalled || isBusy ? undefined : { scale: 0.96 }}
                          onClick={() => setInstallAsset(asset)}
                          disabled={isBusy}
                          className={`focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:cursor-default ${
                            isInstalled
                              ? 'bg-mint/10 text-mint border border-mint/20'
                              : 'bg-accent/15 text-accent-bright border border-accent-dim/40 hover:bg-accent/25'
                          }`}
                        >
                          {isInstalled ? (
                            <>
                              <IconCheck className="w-3 h-3" />
                              {t('asset_installed')}
                            </>
                          ) : (
                            <>
                              <IconDownload className="w-3 h-3" />
                              {t('asset_install')}
                            </>
                          )}
                        </motion.button>
                      </div>
                    }
                  />
                )
              })}
            </AnimatePresence>
          </div>

          {page + 1 < pages && (
            <div className="flex justify-center">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={loadMore}
                disabled={loadingMore}
                className="focus-ring cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <IconSpinner className="w-4 h-4 animate-spin text-muted" />
                    {t('loading')}
                  </>
                ) : (
                  t('asset_load_more')
                )}
              </motion.button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {installAsset && (
          <InstallAssetModal
            asset={installAsset}
            onClose={() => setInstallAsset(null)}
            onInstalled={handleInstalled}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
