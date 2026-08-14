import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category } from '../../../../types'
import { api } from '../../../../lib/api'
import { applyNamingConvention } from '../../../../lib/namingConvention'
import { useSettings } from '../../../../hooks/useSettings'
import { useTaskTray } from '../../../../hooks/useTaskTray'
import {
  IconGitBranch,
  IconX,
  IconAlertTriangle,
  IconSpinner,
  IconFolderPlus,
  IconCheck,
} from '../../lib/Icons'

function repoBaseName(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, '')
  while (cleaned.endsWith('.git')) {
    cleaned = cleaned.slice(0, -4)
  }
  const parts = cleaned.split('/')
  return parts[parts.length - 1] || 'repo'
}

function joinPath(base: string, name: string): string {
  const trimmed = base.replace(/[\\/]+$/, '')
  const sep = trimmed.includes('\\') ? '\\' : '/'
  return `${trimmed}${sep}${name}`
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
  const { settings } = useSettings()
  const { registerTask, updateTask, unregisterTask } = useTaskTray()
  const [url, setUrl] = useState('')
  const [location, setLocation] = useState(defaultLocation ?? '')
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)

  const selectedCategory = categories.find((c) => c.name === category)

  const repoName = useMemo(() => repoBaseName(url), [url])

  const folderName = useMemo(
    () =>
      applyNamingConvention(
        repoName,
        settings.directory_naming_convention,
      ),
    [repoName, settings.directory_naming_convention],
  )

  const resolvedPath = useMemo(
    () => (location && folderName ? joinPath(location, folderName) : ''),
    [location, folderName],
  )

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

  const previewName = url.trim() ? repoName : t('none')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-surface border border-line rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-line">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent-dim/30 flex items-center justify-center shrink-0">
              <IconGitBranch className="w-5 h-5 text-accent-bright" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-semibold text-xl">
                {t('clone_repo_title')}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                {t('clone_repo_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="focus-ring cursor-pointer p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors shrink-0"
            aria-label={t('close')}
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6 flex-1 overflow-y-auto">

          <div className="md:col-span-3 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted">
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
                className={`focus-ring bg-raised border rounded-lg px-3.5 py-2.5 text-sm font-mono transition-colors ${
                  urlInvalid
                    ? 'border-danger/70 focus:border-danger'
                    : 'border-line focus:border-accent-dim'
                }`}
              />
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted/60">
                <IconGitBranch className="w-3 h-3 text-accent-bright/70 shrink-0" />
                <span className="truncate">{t('clone_repo_url_hint')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted">
                {t('clone_repo_dest_label')}
              </label>
              <div className="flex gap-2.5">
                <input
                  value={location}
                  readOnly
                  onClick={pickLocation}
                  className={`flex-1 bg-raised border rounded-lg px-3.5 py-2.5 text-sm font-mono text-muted truncate transition-colors ${
                    locationInvalid
                      ? 'border-danger/70'
                      : 'border-line'
                  }`}
                  placeholder={t('clone_repo_dest_placeholder')}
                />
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={pickLocation}
                  className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm transition-colors shrink-0"
                >
                  {t('browse')}
                </motion.button>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted/60">
                <IconFolderPlus className="w-3 h-3 text-accent-bright/70 shrink-0" />
                <span className="truncate">
                  {url.trim()
                    ? t('clone_repo_folder_preview', { name: folderName })
                    : t('clone_repo_subfolder_hint')}
                </span>
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
                    className={`focus-ring cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      category === ''
                        ? 'border-accent bg-accent/10 text-accent-bright'
                        : 'border-line text-muted hover:border-accent-dim hover:text-ink hover:bg-raised'
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
                        className={`focus-ring cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          active
                            ? ''
                            : 'border-line text-muted hover:border-accent-dim hover:text-ink hover:bg-raised'
                        }`}
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
          </div>

          <div className="md:col-span-2 flex flex-col gap-2">
            <label className="text-xs font-medium text-muted">
              {t('preview_label')}
            </label>
            <div className="flex-1">
              <div className="relative overflow-hidden rounded-xl border border-line bg-base/50 p-4 isolate h-full min-h-44">
                <div className="relative flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg border border-line bg-raised flex items-center justify-center overflow-hidden shrink-0">
                    <IconGitBranch className="w-5 h-5 text-accent-bright" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-display font-semibold text-lg truncate">
                      {previewName}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 border border-accent/25 text-accent-bright text-[10px] font-mono font-medium">
                        <IconGitBranch className="w-3 h-3" />
                        git
                      </span>
                      {url.trim() && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-mint/10 border border-mint/25 text-mint text-[10px] font-mono font-medium">
                          <IconFolderPlus className="w-3 h-3" />
                          {folderName}
                        </span>
                      )}
                      {selectedCategory && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-raised border border-line text-[10px] font-mono text-muted">
                          <span
                            className="w-1.5 h-1.5 rounded-full ring-1 ring-black/10"
                            style={{ backgroundColor: selectedCategory.color }}
                          />
                          {selectedCategory.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="relative mt-3 pt-3 border-t border-line">
                  <p className="text-[10px] uppercase tracking-wide text-muted/50">
                    {t('clone_repo_resolved_path')}
                  </p>
                  <p className="text-[10px] font-mono text-muted break-all mt-1 leading-relaxed">
                    {resolvedPath || t('clone_repo_subfolder_hint')}
                  </p>
                </div>
              </div>
            </div>
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
              <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3">
                <IconAlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <p className="text-xs text-danger leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end gap-2.5 p-6 pt-4 border-t border-line">
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            disabled={busy}
            className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-raised transition-colors disabled:opacity-50"
          >
            {t('clone_repo_cancel')}
          </motion.button>
          <motion.button
            whileHover={busy ? undefined : { y: -1 }}
            whileTap={busy ? undefined : { scale: 0.96 }}
            onClick={submit}
            disabled={busy}
            className="focus-ring px-5 cursor-pointer py-2.5 rounded-lg bg-accent hover:bg-accent-bright disabled:opacity-50 text-sm font-medium text-white transition-colors flex items-center gap-2"
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
    </motion.div>
  )
}
