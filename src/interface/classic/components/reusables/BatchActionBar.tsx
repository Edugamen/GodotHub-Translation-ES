import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '../reusables/Tooltip'
import { Dropdown } from '../ui/Dropdown'
import { ConfirmDialog } from '../modals/ConfirmDialog'
import { IconPin, IconX, IconRefresh } from '../../lib/Icons'
import type { InstalledGodotVersion } from '../../../../types'

const UNCATEGORIZED = '__uncategorized__'

interface BatchActionBarProps {
  selectedCount: number
  isAllSelected: boolean
  isAllPinned: boolean
  installedVersions: InstalledGodotVersion[]
  availableCategories: string[]
  onSelectAll: () => void
  onClearSelection: () => void
  onBatchPin: () => void
  onBatchVersionChange: (tag: string) => void
  onBatchCategoryChange: (category: string) => void
  onBatchRemove: () => void
  confirmBatchRemove: boolean
  confirmBatchPin: boolean
  confirmBatchVersion: string | null
  confirmBatchCategory: string | null
  onConfirmBatchRemove: () => void
  onCancelBatchRemove: () => void
  onConfirmBatchPin: () => void
  onCancelBatchPin: () => void
  onConfirmBatchVersion: () => void
  onCancelBatchVersion: () => void
  onConfirmBatchCategory: () => void
  onCancelBatchCategory: () => void
  undoBatchData: { paths: string[] } | null
  onUndoBatchRemove: () => void
  onDismissUndo: () => void
}

export function BatchActionBar({
  selectedCount,
  isAllSelected,
  isAllPinned,
  installedVersions,
  availableCategories,
  onSelectAll,
  onClearSelection,
  onBatchPin,
  onBatchVersionChange,
  onBatchCategoryChange,
  onBatchRemove,
  confirmBatchRemove,
  confirmBatchPin,
  confirmBatchVersion,
  confirmBatchCategory,
  onConfirmBatchRemove,
  onCancelBatchRemove,
  onConfirmBatchPin,
  onCancelBatchPin,
  onConfirmBatchVersion,
  onCancelBatchVersion,
  onConfirmBatchCategory,
  onCancelBatchCategory,
  undoBatchData,
  onUndoBatchRemove,
  onDismissUndo,
}: BatchActionBarProps) {
  const { t } = useTranslation('common')

  return (
    <>

      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface border border-line shadow-2xl shadow-black/40"
          >
            <span className="text-xs font-medium text-muted whitespace-nowrap mr-1">
              {t('n_selected', { count: selectedCount })}
            </span>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={isAllSelected ? onClearSelection : onSelectAll}
              className="focus-ring cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-ink hover:bg-raised transition-colors"
              aria-label={isAllSelected ? t('deselect_all') : t('select_all')}
            >
              {isAllSelected ? t('deselect_all') : t('select_all')}
            </motion.button>

            <div className="h-5 w-px bg-line/60" />

            <Tooltip content={selectedCount === 1 ? t('toggle_pin') : t('pin_unpin_all')} side="top">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onBatchPin}
                className="focus-ring cursor-pointer p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors"
                aria-label={t('toggle_pin')}
              >
                <IconPin className="w-3.5 h-3.5" fill="none" />
              </motion.button>
            </Tooltip>

            <Dropdown
              className="w-44"
              value=""
              onChange={(tag) => tag && onBatchVersionChange(tag)}
              emptyLabel={t('set_version')}
              openUp
              options={installedVersions.map((v) => ({
                value: v.tag,
                label: v.custom_name || v.tag,
                dotClassName: 'bg-mint',
                badge: v.is_mono ? 'Mono' : undefined,
              }))}
            />

            <Dropdown
              className="w-36"
              value=""
              onChange={(cat) => {
                if (cat != null) {
                  const resolved = cat === UNCATEGORIZED ? '' : cat
                  onBatchCategoryChange(resolved)
                }
              }}
              emptyLabel={t('set_category')}
              openUp
              options={availableCategories.map((c) => ({
                value: c,
                label: c === UNCATEGORIZED ? t('uncategorized') : c,
              }))}
            />

            <div className="h-5 w-px bg-line/60" />

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onBatchRemove}
              className="focus-ring cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              aria-label={t('remove_selected')}
            >
              {t('remove_selected')}
            </motion.button>

            <div className="h-5 w-px bg-line/60" />

            <Tooltip content={t('clear_selection')} side="top">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onClearSelection}
                className="focus-ring cursor-pointer p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors ml-1"
                aria-label={t('clear_selection')}
              >
                <IconX className="w-3.5 h-3.5" />
              </motion.button>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmBatchRemove && (
          <ConfirmDialog
            title={t('remove_count_title', { count: selectedCount })}
            description={t('remove_count_desc', { count: selectedCount })}
            confirmLabel={t('remove_count_confirm', { count: selectedCount })}
            variant="danger"
            onConfirm={onConfirmBatchRemove}
            onCancel={onCancelBatchRemove}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmBatchPin && (
          <ConfirmDialog
            title={selectedCount === 1 ? t('pin_unpin_title_one', { count: selectedCount }) : t('pin_unpin_title_other', { count: selectedCount })}
            description={t('pin_unpin_desc', { action: isAllPinned ? 'unpin' : 'pin' })}
            confirmLabel={t('confirm')}
            variant="default"
            onConfirm={onConfirmBatchPin}
            onCancel={onCancelBatchPin}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmBatchVersion && (
          <ConfirmDialog
            title={t('set_version_title', { count: selectedCount })}
            description={t('set_version_desc', { version: confirmBatchVersion })}
            confirmLabel={t('set_to_version', { version: confirmBatchVersion })}
            variant="default"
            onConfirm={onConfirmBatchVersion}
            onCancel={onCancelBatchVersion}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmBatchCategory != null && (
          <ConfirmDialog
            title={t('set_category_title', { count: selectedCount })}
            description={t('set_category_desc', { category: confirmBatchCategory === '' ? t('uncategorized') : confirmBatchCategory })}
            confirmLabel={t('set_to_category', { category: confirmBatchCategory === '' ? t('uncategorized') : confirmBatchCategory })}
            variant="default"
            onConfirm={onConfirmBatchCategory}
            onCancel={onCancelBatchCategory}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {undoBatchData && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-110 flex items-center gap-3 px-5 py-3 rounded-xl bg-surface/95 border border-line/60 shadow-2xl backdrop-blur-md max-w-lg"
          >
            <div className="w-8 h-8 rounded-full bg-raised flex items-center justify-center shrink-0">
              <IconRefresh className="w-4 h-4 text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink uppercase tracking-wide">
                {t('removed_from_library')}
              </p>
              <p className="text-sm text-muted mt-0.5 truncate">
                {t('n_removed', { count: undoBatchData.paths.length })}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onUndoBatchRemove}
              className="focus-ring cursor-pointer shrink-0 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent-bright text-xs font-semibold hover:bg-accent/20 transition-colors"
            >
              {t('undo')}
            </motion.button>
            <Tooltip content={t('dismiss')} side="bottom">
              <button
                onClick={onDismissUndo}
                className="focus-ring cursor-pointer shrink-0 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors"
                aria-label={t('dismiss')}
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
