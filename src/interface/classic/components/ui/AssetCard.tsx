import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import type { AssetLibraryAsset } from '../../../../types'
import {
  IconBookOpen,
  IconExternalLink,
  IconStar,
  IconStore,
} from '../../lib/Icons'

const SUPPORT_BADGE: Record<string, string> = {
  official: 'bg-mint/10 text-mint border-mint/20',
  featured: 'bg-accent/10 text-accent-bright border-accent-dim/40',
  community: 'bg-raised text-muted border-line',
  testing: 'bg-amber/10 text-amber border-amber/20',
  testers: 'bg-amber/10 text-amber border-amber/20',
}

interface AssetCardProps {
  asset: AssetLibraryAsset
  showSource?: boolean
  showRating?: boolean
  onOpenPage?: () => void
  actions?: React.ReactNode
}

export function AssetCard({
  asset,
  showSource = false,
  showRating = true,
  onOpenPage,
  actions,
}: AssetCardProps) {
  const { t } = useTranslation('common')
  const isStore = asset.source === 'store'

  const metaParts = [
    asset.godot_version ? `Godot ${asset.godot_version}` : null,
    asset.category || null,
    asset.cost || null,
  ].filter(Boolean) as string[]

  const rating = Number.parseFloat(asset.rating ?? '')
  const hasRating = Number.isFinite(rating) && rating > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm shadow-black/5 transition-colors duration-200 hover:border-accent-dim hover:shadow-lg hover:shadow-black/25"
    >
      <div className="relative h-28 shrink-0 overflow-hidden bg-raised">
        {asset.icon_url && (
          <img
            src={asset.icon_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover opacity-15"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-tr from-accent/15 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />

        <div className="relative h-full flex items-center justify-center">
          <div className="relative w-16 h-16 rounded-xl bg-surface/90 backdrop-blur-sm border border-line/60 shadow-lg shadow-black/40 flex items-center justify-center overflow-hidden ring-1 ring-white/5">
            <IconStore className="w-6 h-6 text-muted/50" />
            {asset.icon_url && (
              <img
                src={asset.icon_url}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
          </div>
        </div>

        {showSource && (
          <span
            className={`absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border backdrop-blur-sm ${
              isStore
                ? 'bg-accent/15 text-accent-bright border-accent-dim/40'
                : 'bg-surface/80 text-muted border-line/60'
            }`}
          >
            {isStore ? (
              <IconStore className="w-2.5 h-2.5" />
            ) : (
              <IconBookOpen className="w-2.5 h-2.5" />
            )}
            {isStore ? t('asset_source_store') : t('asset_source_library')}
          </span>
        )}

        {showRating && hasRating && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface/80 backdrop-blur-sm border border-line/60 text-[10px] font-semibold text-amber">
            <IconStar className="w-2.5 h-2.5" />
            {rating.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3.5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display font-semibold text-sm leading-snug line-clamp-2 min-w-0">
            {asset.title}
          </h4>
          {onOpenPage && (
            <button
              onClick={onOpenPage}
              className="focus-ring cursor-pointer p-1 rounded-md text-muted/40 opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-raised transition-all shrink-0 -mt-0.5 -mr-0.5"
              aria-label={t('asset_open_page')}
            >
              <IconExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[11px] text-muted/70 truncate min-w-0">
            {t('asset_by_author', { author: asset.author })}
          </p>
          {asset.support_level && (
            <span
              className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                SUPPORT_BADGE[asset.support_level] ?? 'bg-raised text-muted border-line'
              }`}
            >
              {asset.support_level}
            </span>
          )}
        </div>

        {asset.description && (
          <p className="text-[11px] text-muted/60 leading-relaxed line-clamp-2">
            {asset.description.replace(/\r?\n/g, ' ')}
          </p>
        )}

        {metaParts.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {metaParts.map((part, i) => (
              <span
                key={i}
                className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-raised border border-line font-mono text-[10px] text-muted/70"
              >
                {part}
              </span>
            ))}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 px-3.5 py-3 border-t border-line/50 bg-base/20">
          {actions}
        </div>
      )}
    </motion.div>
  )
}
