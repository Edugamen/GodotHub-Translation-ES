import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { openUrl } from '@tauri-apps/plugin-opener'
import { api } from '../lib/api'
import type { AssetLibraryAsset } from '../types'
import { IconSearch, IconStore, IconDownload, IconCheck, IconSpinner, IconX, IconExternalLink } from './Icons'
import { Dropdown } from './ui/Dropdown'

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

const SUPPORT_BADGE: Record<string, string> = {
  official: 'bg-mint/10 text-mint border-mint/20',
  community: 'bg-accent/10 text-accent-bright border-accent-dim/40',
  testers: 'bg-amber/10 text-amber border-amber/20',
}

export function AssetLibraryBrowser() {
  const { t } = useTranslation('common')
  const [assets, setAssets] = useState<AssetLibraryAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState('')
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      try {
        const res = await api.searchAssetLibrary(
          query.trim() || null,
          version || VERSION_OPTIONS[0],
          nextPage,
          PAGE_SIZE,
        )
        setAssets((prev) => (append ? [...prev, ...res.assets] : res.assets))
        setPages(res.pages)
        setTotal(res.total)
        setPage(res.page)
        setError(null)
      } catch (e) {
        setError(String(e))
      }
    },
    [query, version],
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
  }, [query, version, load])

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
              className="border border-line rounded-xl bg-surface p-4 flex flex-col gap-3 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-lg bg-raised" />
                <div className="w-20 h-8 rounded-lg bg-raised" />
              </div>
              <div className="h-4 w-3/4 rounded bg-raised" />
              <div className="h-3 w-1/2 rounded bg-raised" />
              <div className="h-3 w-2/3 rounded bg-raised mt-1" />
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
                  <motion.div
                    key={asset.asset_id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative border border-line rounded-xl bg-surface p-4 flex flex-col gap-3 transition-colors hover:border-accent-dim hover:bg-raised"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-lg bg-raised border border-line flex items-center justify-center overflow-hidden shrink-0">
                        {asset.icon_url ? (
                          <img
                            src={asset.icon_url}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.parentElement?.classList.remove('overflow-hidden')
                            }}
                          />
                        ) : (
                          <IconStore className="w-5 h-5 text-muted" />
                        )}
                      </div>
                      {/* Plain <a target="_blank"> links do nothing inside the
                          Tauri webview, so open via the opener plugin like the
                          rest of the app (News, Titlebar, Bug Report, etc.). */}
                      {asset.browse_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openUrl(asset.browse_url!)
                          }}
                          className="focus-ring cursor-pointer p-1.5 rounded-lg text-muted/40 opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-raised transition-all"
                          aria-label={t('asset_open_page')}
                        >
                          <IconExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-semibold text-sm leading-snug line-clamp-2">
                        {asset.title}
                      </h4>
                      <p className="text-[11px] text-muted/70 mt-0.5 truncate">
                        {t('asset_by_author', { author: asset.author })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-muted/50 font-mono truncate">
                      <span>Godot {asset.godot_version}</span>
                      <span>·</span>
                      <span className="truncate">{asset.category}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                          SUPPORT_BADGE[asset.support_level] ?? 'bg-raised text-muted border-line'
                        }`}
                      >
                        {asset.support_level}
                      </span>
                      <motion.button
                        whileHover={isInstalled || isInstalling ? undefined : { y: -1 }}
                        whileTap={isInstalled || isInstalling ? undefined : { scale: 0.96 }}
                        onClick={() => install(asset)}
                        disabled={isInstalled || isInstalling}
                        className={`focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:cursor-default ${
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
                    </div>
                  </motion.div>
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
