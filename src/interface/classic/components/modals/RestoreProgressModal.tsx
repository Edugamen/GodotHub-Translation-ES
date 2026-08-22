import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { IconCloudArrowDown, IconCheck, IconAlertTriangle, IconRefresh } from '../../lib/Icons'
import { api } from '../../../../lib/api'

interface RestorePreview {
  workspace_count: number
  workspace_names: string[]
  project_count: number
  category_count: number
  template_count: number
  has_time_stats: boolean
  version_scan_dirs: string[]
  project_scan_dirs: string[]
}

interface Props {
  onClose: () => void
}

type Phase = 'fetching' | 'preview' | 'applying' | 'done' | 'error'

export function RestoreProgressModal({ onClose }: Props) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const [phase, setPhase] = useState<Phase>('fetching')
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app:dialog-open'))
    api
      .gistSyncFetchBackup()
      .then((data) => {
        setPreview(data)
        setPhase('preview')
      })
      .catch((e) => {
        setError(String(e))
        setPhase('error')
      })
    return () => {
      window.dispatchEvent(new CustomEvent('app:dialog-close'))
    }
  }, [])

  const handleApplyAndRestart = async () => {
    setPhase('applying')
    try {
      await api.gistSyncPull()
      setPhase('done')
      setTimeout(() => {
        window.location.reload()
      }, 1200)
    } catch (e) {
      setError(String(e))
      setPhase('error')
    }
  }

  const handleRetry = () => {
    setPhase('fetching')
    setError(null)
    api
      .gistSyncFetchBackup()
      .then((data) => {
        setPreview(data)
        setPhase('preview')
      })
      .catch((e) => {
        setError(String(e))
        setPhase('error')
      })
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={
        phase === 'preview' || phase === 'error' ? onClose : undefined
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-surface border border-line rounded-2xl p-7 w-full max-w-md flex flex-col gap-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              phase === 'done'
                ? 'bg-green/15 border border-green/30'
                : phase === 'error'
                  ? 'bg-danger/15 border border-danger/30'
                  : 'bg-accent/15 border border-accent/30'
            }`}
          >
            {phase === 'done' ? (
              <IconCheck className="w-4 h-4 text-green" />
            ) : phase === 'error' ? (
              <IconAlertTriangle className="w-4 h-4 text-danger" />
            ) : (
              <IconCloudArrowDown className="w-4 h-4 text-accent" />
            )}
          </div>
          <div>
            <h3 className="font-display font-semibold">
              {phase === 'done'
                ? t('restore_modal_done_title')
                : t('restore_modal_title')}
            </h3>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              {phase === 'done'
                ? t('restore_modal_done_desc')
                : t('restore_modal_desc')}
            </p>
          </div>
        </div>

        {/* Body */}
        <div>
          {phase === 'fetching' && (
            <div className="flex items-center gap-3 py-4">
              <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted">
                {t('restore_modal_fetching')}
              </span>
            </div>
          )}

          {phase === 'applying' && (
            <div className="flex items-center gap-3 py-4">
              <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted">
                {t('restore_modal_applying')}
              </span>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-danger/10 border border-danger/20">
              <IconAlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {phase === 'preview' && preview && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                {t('restore_modal_preview_desc')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-raised px-3 py-2.5">
                  <p className="text-lg font-semibold">
                    {preview.workspace_count}
                  </p>
                  <p className="text-[11px] text-muted">
                    {preview.workspace_count === 1
                      ? t('restore_modal_workspaces_one')
                      : t('restore_modal_workspaces_other')}
                  </p>
                </div>
                <div className="rounded-lg bg-raised px-3 py-2.5">
                  <p className="text-lg font-semibold">
                    {preview.project_count}
                  </p>
                  <p className="text-[11px] text-muted">
                    {preview.project_count === 1
                      ? t('restore_modal_projects_one')
                      : t('restore_modal_projects_other')}
                  </p>
                </div>
                <div className="rounded-lg bg-raised px-3 py-2.5">
                  <p className="text-lg font-semibold">
                    {preview.category_count}
                  </p>
                  <p className="text-[11px] text-muted">
                    {preview.category_count === 1
                      ? t('restore_modal_categories_one')
                      : t('restore_modal_categories_other')}
                  </p>
                </div>
                <div className="rounded-lg bg-raised px-3 py-2.5">
                  <p className="text-lg font-semibold">
                    {preview.template_count}
                  </p>
                  <p className="text-[11px] text-muted">
                    {preview.template_count === 1
                      ? t('restore_modal_templates_one')
                      : t('restore_modal_templates_other')}
                  </p>
                </div>
              </div>
              {preview.has_time_stats && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <IconCheck className="w-3.5 h-3.5 text-green" />
                  {t('restore_modal_time_stats')}
                </div>
              )}
              {preview.project_scan_dirs.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <IconCheck className="w-3.5 h-3.5 text-green" />
                  {t('restore_modal_project_scan_dirs', { count: preview.project_scan_dirs.length })}
                </div>
              )}
              {preview.version_scan_dirs.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <IconCheck className="w-3.5 h-3.5 text-green" />
                  {t('restore_modal_version_scan_dirs', { count: preview.version_scan_dirs.length })}
                </div>
              )}
              {preview.workspace_names.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs font-medium text-muted mb-1">
                    {t('restore_modal_workspace_list')}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.workspace_names.map((name) => (
                      <span
                        key={name}
                        className="px-2 py-0.5 rounded-full bg-raised text-xs"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-amber mt-1">
                {t('restore_modal_warning')}
              </p>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="h-10 w-10 rounded-full bg-green/15 flex items-center justify-center">
                <IconCheck className="w-5 h-5 text-green" />
              </div>
              <p className="text-sm text-muted text-center">
                {t('restore_modal_done_hint')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'preview' && (
          <div className="flex justify-end gap-2.5 mt-1">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-raised transition-colors"
            >
              {tc('cancel')}
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleApplyAndRestart}
              className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-bright text-white transition-colors"
            >
              {t('restore_modal_apply_btn')}
            </motion.button>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex justify-end gap-2.5 mt-1">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-raised transition-colors"
            >
              {tc('cancel')}
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleRetry}
              className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg text-sm font-medium border border-line hover:border-accent-dim hover:bg-raised transition-colors"
            >
              {tc('retry')}
            </motion.button>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex justify-end mt-1">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => window.location.reload()}
              className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-bright text-white transition-colors inline-flex items-center gap-2"
            >
              <IconRefresh className="w-4 h-4" />
              {t('restore_modal_restart_btn')}
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
