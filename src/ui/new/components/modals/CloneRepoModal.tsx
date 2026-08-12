import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category } from '../../../../types'
import { api } from '../../../../lib/api'
import { useSettings } from '../../../../hooks/useSettings'
import { useTaskTray } from '../../../../hooks/useTaskTray'
import { Checkbox } from '../Checkbox'
import {
  IconGitBranch,
  IconAlertTriangle,
  IconSpinner,
  IconCheck,
} from '../../lib/icons'

function repoBaseName(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, '')
  while (cleaned.endsWith('.git')) {
    cleaned = cleaned.slice(0, -4)
  }
  const parts = cleaned.split('/')
  return parts[parts.length - 1] || 'repo'
}

interface Props {
  defaultLocation?: string | null
  categories?: Category[]
  onClose: () => void
  onCloned: (projectPath: string) => void
}

export function CloneRepoModal({
  defaultLocation,
  onClose,
  onCloned,
  categories = [],
}: Props) {
  const { t } = useTranslation('common')
  const { settings, update: updateSettings } = useSettings()
  const { registerTask, updateTask, unregisterTask } = useTaskTray()
  const [url, setUrl] = useState('')
  const [location, setLocation] = useState(defaultLocation ?? '')
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [openAfterImport, setOpenAfterImport] = useState(
    settings.open_after_import,
  )

  const handleOpenAfterImportChange = (checked: boolean) => {
    setOpenAfterImport(checked)
    updateSettings({ ...settings, open_after_import: checked }).catch(
      () => {},
    )
  }
  const urlInputRef = useRef<HTMLInputElement>(null)

  const repoName = useMemo(() => repoBaseName(url), [url])

  useEffect(() => {
    urlInputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app:dialog-open'))
    return () => {
      window.dispatchEvent(new CustomEvent('app:dialog-close'))
    }
  }, [])

  const pickLocation = async () => {
    const folder = await api.pickFolder()
    if (folder) {
      setLocation(folder)
      setError(null)
    }
  }

  const urlInvalid = attempted && !url.trim()
  const locationInvalid = attempted && !location

  const submit = async () => {
    if (busy) return
    if (!url.trim() || !location) {
      setAttempted(true)
      setError(
        !url.trim()
          ? t('clone_repo_error_url')
          : t('clone_repo_error_location'),
      )
      return
    }

    setBusy(true)
    setError(null)

    const taskId = `clone-${Date.now()}`

    registerTask({
      id: taskId,
      type: 'clone-repo',
      label: `${t('cloning')} ${repoName}`,
      description: t('loading'),
      progress: null,
      status: 'running',
    })

    try {
      const clonedPath = await api.cloneRepo(url.trim(), location)
      updateTask(taskId, {
        description: t('importing_project'),
        status: 'running',
      })
      const project = await api.importProject(clonedPath, '', category || null)
      updateTask(taskId, { status: 'completed', description: 'Done' })
      setTimeout(() => unregisterTask(taskId), 3000)
      onCloned(project.id)
      if (openAfterImport) {
        api.openProject(project.id, true).catch((e) => alert(String(e)))
      }
    } catch (e) {
      setError(String(e))
      updateTask(taskId, {
        status: 'error',
        errorMessage: String(e),
      })
      setTimeout(() => unregisterTask(taskId), 6000)
    } finally {
      setBusy(false)
    }
  }

  const inputClass = (invalid: boolean) =>
    `focus-ring bg-overlay border rounded-item px-3.5 py-2.5 text-sm font-mono transition-colors ${
      invalid ? 'border-danger/70 focus:border-danger' : 'border-outline/50 focus:border-accent-dim'
    }`

  const chipClass = (active: boolean) =>
    active
      ? 'focus-ring cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn border text-xs font-medium transition-colors'
      : 'focus-ring cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn border border-outline/50 text-muted hover:border-accent-dim hover:text-ink hover:bg-raised text-xs font-medium transition-colors'

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-surface rounded-modal w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-clip"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-2">
          <div className="flex items-start gap-1 min-w-0 bg-black/15 px-3 py-4 rounded-btn shrink-0">
            <div className="w-10 h-10 rounded-tile flex items-center justify-center shrink-0 ">
              <IconGitBranch className="w-5 h-5 text-accent-bright" />
            </div>
            <div className="min-w-0">
              <h3 className="uppercase font-semibold text-xl text-ink">
                {t('clone_repo_title')}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                {t('clone_repo_desc')}
              </p>
            </div>
          </div>
        </div>

        <div className="gap-6 p-6 flex-1 overflow-y-auto">
          <div className="md:col-span-3 flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <label className="pl-3 text-xs font-medium text-muted">
                {t('clone_repo_url_label')}
              </label>
              <input
                ref={urlInputRef}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                }}
                placeholder={t('clone_repo_url_placeholder')}
                className={`${inputClass(urlInvalid)} w-full`}
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="pl-3 text-xs font-medium text-muted">
                {t('clone_repo_dest_label')}
              </label>
              <div className="flex gap-2.5">
                <input
                  value={location}
                  readOnly
                  onClick={pickLocation}
                  className={`${inputClass(locationInvalid)} flex-1 text-muted truncate`}
                  placeholder={t('clone_repo_dest_placeholder')}
                />
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={pickLocation}
                  className="focus-ring cursor-pointer px-4 py-2.5 rounded-btn border border-outline/50 hover:border-accent-dim hover:bg-raised text-sm transition-colors shrink-0"
                >
                  {t('browse')}
                </motion.button>
              </div>
            </div>

            {categories.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted">
                  {t('category_optional')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCategory('')}
                    className={`${chipClass(category === '')} ${
                      category === ''
                        ? 'border-accent bg-accent/10 text-accent-bright'
                        : ''
                    }`}
                  >
                    {category === '' && <IconCheck className="w-3 h-3 inline -mt-0.5" />}
                    {t('no_category_label')}
                  </button>
                  {categories.map((c) => {
                    const active = category === c.name
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setCategory(c.name)}
                        className={chipClass(active)}
                        style={
                          active
                            ? {
                                borderColor: c.color,
                                backgroundColor: `${c.color}18`,
                                color: c.color,
                              }
                            : undefined
                        }
                      >
                        {active && <IconCheck className="w-3 h-3 inline -mt-0.5" />}
                        <span
                          className="w-1.5 h-1.5 rounded-full ring-1 ring-black/10 shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Checkbox
                checked={openAfterImport}
                onChange={handleOpenAfterImportChange}
                label={t('clone_repo_open_after')}
              />
              <span className="text-xs font-medium text-ink">
                {t('clone_repo_open_after')}
              </span>
            </label>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="px-6 overflow-hidden"
            >
              <div className="flex items-start gap-2.5 rounded-item border border-danger/25 bg-danger/10 px-4 py-3">
                <IconAlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <p className="text-xs text-danger leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end gap-2.5 p-6 pt-4 border-t border-line">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            disabled={busy}
            className="focus-ring cursor-pointer px-4 py-2.5 rounded-btn text-sm text-muted hover:text-ink hover:bg-raised transition-colors disabled:opacity-50"
          >
            {t('clone_repo_cancel')}
          </motion.button>
          <motion.button
            whileTap={busy ? undefined : { scale: 0.96 }}
            onClick={submit}
            disabled={busy}
            className="focus-ring px-5 cursor-pointer py-2.5 rounded-btn bg-accent hover:bg-accent-bright disabled:opacity-50 text-sm font-medium text-white transition-colors flex items-center gap-2"
          >
            {busy ? (
              <>
                <IconSpinner className="w-3.5 h-3.5 animate-spin" />
                {t('cloning')}
              </>
            ) : (
              t('clone_import')
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
