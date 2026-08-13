import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { openUrl } from '@tauri-apps/plugin-opener'
import { api } from '../../../../lib/api'
import type { AssetLibraryAsset } from '../../../../types'
import { cachedAssetSearch } from '../../../../lib/assetSearchCache'
import {
  ASSET_SORT_KEYS,
  assetSortParams,
  rankByRelevance,
  type AssetSortKey,
} from '../../../../lib/assetSort'
import { IconSearch, IconStore, IconDownload, IconCheck, IconSpinner, IconX } from '../../lib/Icons'
import { Dropdown } from '../ui/Dropdown'
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

export function AssetLibraryBrowser() {
  const { t } = useTranslation('common')
  const [assets, setAssets] = useState<AssetLibraryAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState('')
  const [sort, setSort] = useState<AssetSortKey>('relevance')
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      try {
        const { sort: sortParam, reverse } = assetSortParams(sort)
        const res = await cachedAssetSearch(
          `lib|${query.trim()}|${version || ''}|${nextPage}|${sortParam}|${reverse}`,
          () =>
            api.searchAssetLibrary(
              query.trim() || null,
              version || VERSION_OPTIONS[0],
              nextPage,
              PAGE_SIZE,
              null,
              null,
              sortParam,
              reverse,
            ),
        )
        setAssets((prev) => {
          const next = append ? [...prev, ...res.assets] : res.assets
          return sort === 'relevance' && query.trim()
            ? rankByRelevance(next, query)
            : next
        })
        setPages(res.pages)
        setTotal(res.total)
        setPage(res.page)
        setError(null)
      } catch (e) {
        setError(String(e))
      }
    },
    [query, version, sort],
  )

  useEffect(() => {
    setError(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setLoading(true)
      await load(0, false)
      setLoading(false)
    }, 250)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [query, version, sort, load])

  const loadMore = async () => {
    if (loadingMore || page + 1 >= pages) return
    setLoadingMore(true)
    await load(page + 1, true)
    setLoadingMore(false)
  }

  const install = async (asset: AssetLibraryAsset) => {
    if (installing) return
    setInstalling(asset.asset_id)
    try {
      await api.installAssetAsTemplate(asset.asset_id)
      setInstalled((prev) => new Set(prev).add(asset.asset_id))
      window.dispatchEvent(new Event('app:refresh-templates'))
    } catch {
    } finally {
      setInstalling(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
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
        <div className="w-44 shrink-0">
          <Dropdown
            value={sort}
            onChange={(v) => setSort(v as AssetSortKey)}
            options={ASSET_SORT_KEYS.map((k) => ({
              value: k,
              label: t(`asset_sort_${k}`),
            }))}
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
                <div className="flex gap-1.5 mt-1">
                  <div className="h-4 w-14 rounded-md bg-raised" />
                  <div className="h-4 w-10 rounded-md bg-raised" />
                </div>
              </div>
              <div className="px-3.5 py-3 border-t border-line/50 flex justify-end">
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
                const isInstalling = installing === asset.asset_id
                return (
                  <AssetCard
                    key={asset.asset_id}
                    asset={asset}
                    onOpenPage={
                      asset.browse_url
                        ? () => openUrl(asset.browse_url!)
                        : undefined
                    }
                    actions={
                      <motion.button
                        whileHover={isInstalled || isInstalling ? undefined : { y: -1 }}
                        whileTap={isInstalled || isInstalling ? undefined : { scale: 0.96 }}
                        onClick={() => install(asset)}
                        disabled={isInstalled || isInstalling}
                        className={`focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:cursor-default ml-auto ${
                          isInstalled
                            ? 'bg-mint/10 text-mint border border-mint/20'
                            : 'bg-accent/15 text-accent-bright border border-accent-dim/40 hover:bg-accent/25'
                        }`}
                      >
                        {isInstalling ? (
                          <>
                            <IconSpinner className="w-3 h-3 animate-spin" />
                            {t('asset_installing')}
                          </>
                        ) : isInstalled ? (
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
    </div>
  )
}
