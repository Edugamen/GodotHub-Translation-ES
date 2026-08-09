import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { Category, GitStatus, InstalledGodotVersion, Project } from '../../../types'
import { api, getCachedProjectIcon, getCachedProjectName } from '../../../lib/api'
import { formatLastOpened } from '../../../lib/lastOpened'
import { useSettings } from '../../../hooks/useSettings'
import { ConfirmDialog } from '../../../components/modals/ConfirmDialog'
import { Dropdown } from './Dropdown'
import {
  IconChevronDown,
  IconClock,
  IconCode,
  IconDownload,
  IconExternalLink,
  IconGitBranch,
  IconMore,
  IconNode,
  IconPin,
  IconRefresh,
  IconTerminal,
  IconTrash,
  IconX,
} from '../../../components/Icons'

interface ProjectCardProps {
  project: Project
  installedVersions: InstalledGodotVersion[]
  categories: Category[]
  gitStatus?: GitStatus | null
  onTogglePin: () => void
  onVersionChange: (tag: string) => void
  onRemove: () => void
  onDelete: () => void
}

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function ProjectCard({
  project,
  installedVersions,
  gitStatus,
  onTogglePin,
  onVersionChange,
  onRemove,
  onDelete,
}: ProjectCardProps) {
  const { t } = useTranslation('common')
  const { t: tg } = useTranslation('git')
  const { settings } = useSettings()
  const [icon, setIcon] = useState<string | null>(() =>
    getCachedProjectIcon(project.path),
  )
  const [settingsName, setSettingsName] = useState<string | null>(() =>
    getCachedProjectName(project.path),
  )
  const [confirmAction, setConfirmAction] = useState<'remove' | 'delete' | null>(
    null,
  )

  const displayName = settingsName ?? project.name
  const boundVersion = installedVersions.find(
    (v) => v.tag === project.godot_version,
  )
  const versionInstalled = Boolean(boundVersion)

  useEffect(() => {
    let cancelled = false
    api.getProjectIcon(project.path).then((data) => {
      if (!cancelled) setIcon(data)
    })
    return () => {
      cancelled = true
    }
  }, [project.path])

  useEffect(() => {
    let cancelled = false
    api.getProjectName(project.path).then((data) => {
      if (!cancelled) setSettingsName(data)
    })
    return () => {
      cancelled = true
    }
  }, [project.path])

  const lastOpenedLabel = formatLastOpened(
    project.last_opened,
    settings.last_opened_time_format,
    settings.last_opened_date_format,
  )

  const openFolder = () =>
    api.openProjectFolder(project.path).catch((e) => alert(e))
  const openInIde = () => api.openInEditor(project.path).catch((e) => alert(e))
  const launchProject = () =>
    window.dispatchEvent(
      new CustomEvent('app:open-project', { detail: { id: project.id } }),
    )
  const openTerminal = () =>
    api.openTerminal(project.path).catch((e) => alert(e))
  const runGitAction = async (action: 'pull' | 'push' | 'fetch') => {
    try {
      if (action === 'pull') {
        const result = await api.gitPull(project.path)
        alert(result || t('pull_completed'))
      } else if (action === 'push') {
        const result = await api.gitPush(project.path)
        alert(result || t('push_completed'))
      } else {
        await api.gitFetch(project.path)
      }
    } catch (e) {
      alert(String(e))
    }
  }

  return (
    <div className="group relative flex items-center gap-3.5 p-3.5 rounded-item bg-overlay border border-outline/50 hover:bg-raised hover:border-accent-dim/60 transition-colors">
      {/* Watermark background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-item isolate">
        {icon ? (
          <img
            src={icon}
            alt=""
            aria-hidden="true"
            className="select-none absolute -left-6 top-1/2 -translate-y-1/2 -rotate-6 group-hover:rotate-0 h-35 w-35 object-contain grayscale group-hover:grayscale-0 contrast-125 transition-all duration-300 ease-out group-hover:will-change-transform"
            style={{
              opacity: 'var(--project-icon-opacity, 0.14)',
              maskImage: 'linear-gradient(to right, black 35%, transparent 90%)',
              WebkitMaskImage:
                'linear-gradient(to right, black 35%, transparent 90%)',
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            className="select-none absolute -left-3 top-1/2 -translate-y-1/2 -rotate-6 group-hover:rotate-0 font-display font-black text-muted group-hover:text-accent-bright transition-all duration-300 ease-out group-hover:will-change-transform"
            style={{
              fontSize: '72px',
              lineHeight: 1,
              opacity: 'var(--project-icon-opacity, 0.14)',
              maskImage: 'linear-gradient(to right, black 35%, transparent 90%)',
              WebkitMaskImage:
                'linear-gradient(to right, black 35%, transparent 90%)',
            }}
          >
            {getInitials(displayName)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-display font-medium text-xl text-ink truncate">
            {displayName}
          </h3>
          {gitStatus?.is_repo && (
            <Dropdown
              align="left"
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={toggle}
                  title={
                    gitStatus.has_uncommitted
                      ? t('project_git_dirty_tooltip', {
                          branch: gitStatus.branch ?? 'HEAD',
                        })
                      : t('project_git_clean_tooltip', {
                          branch: gitStatus.branch ?? 'HEAD',
                        })
                  }
                  className={`shrink-0 inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-tag font-mono text-[10px] transition-colors cursor-pointer ${
                    gitStatus.has_uncommitted
                      ? 'bg-amber/10 text-amber'
                      : 'bg-raised border-outline/50 text-muted hover:text-ink hover:border-accent-dim'
                  }`}
                >
                  <IconGitBranch className="w-3 h-3 shrink-0" />
                  <span className="max-w-28 truncate">
                    {gitStatus.branch ?? 'HEAD'}
                  </span>
                </button>
              )}
              items={[
                {
                  key: 'terminal',
                  label: tg('terminal'),
                  icon: IconTerminal,
                  onClick: openTerminal,
                },
                {
                  key: 'pull',
                  label: tg('pull'),
                  icon: IconDownload,
                  onClick: () => runGitAction('pull'),
                },
                {
                  key: 'push',
                  label: tg('push'),
                  icon: IconGitBranch,
                  onClick: () => runGitAction('push'),
                },
                {
                  key: 'fetch',
                  label: tg('fetch'),
                  icon: IconRefresh,
                  onClick: () => runGitAction('fetch'),
                },
              ]}
            />
          )}
          {project.pinned && (
            <IconPin
              className="w-3 h-3 text-accent-bright shrink-0"
              fill="currentColor"
            />
          )}
        </div>

        <button
          type="button"
          onClick={openFolder}
          title={project.path}
          className="block w-fit max-w-full bg-black/15 px-3 py-1 rounded-tag text-[11px] font-mono text-muted truncate hover:text-accent-bright cursor-pointer transition-colors"
        >
          {project.path}
        </button>

        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          {lastOpenedLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag bg-raised border border-outline/50 font-mono text-[10px] text-muted shrink-0">
              <IconClock className="w-2.5 h-2.5" />
              {lastOpenedLabel}
            </span>
          )}
          <Dropdown
            align="left"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                aria-expanded={open}
                onClick={toggle}
                className="inline-flex items-center gap-1.5 px-3 py-3 rounded-btn bg-raised border border-outline/50 font-mono text-[10px] text-muted hover:text-ink hover:border-accent-dim cursor-pointer transition-colors shrink-0"
              >
                <IconNode className="w-2.5 h-2.5" />
                {boundVersion
                  ? boundVersion.custom_name || boundVersion.tag
                  : t('no_version_selected')}
                <IconChevronDown
                  className={`w-2.5 h-2.5 transition-transform duration-200 ${
                    open ? 'rotate-180 text-ink' : ''
                  }`}
                />
              </button>
            )}
            items={installedVersions.map((v) => ({
              key: v.tag,
              label: v.custom_name || v.tag,
              active: v.tag === project.godot_version,
              onClick: () => onVersionChange(v.tag),
            }))}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={onTogglePin}
          aria-label={
            project.pinned ? t('project_unpin_aria') : t('project_pin_aria')
          }
          className={`focus-ring cursor-pointer p-2 rounded-item transition-colors ${
            project.pinned
              ? 'text-accent-bright bg-accent/15'
              : 'text-muted/40 hover:text-muted hover:bg-raised'
          }`}
        >
          <IconPin
            className="w-4 h-4"
            fill={project.pinned ? 'currentColor' : 'none'}
          />
        </motion.button>

        <motion.button
          whileHover={versionInstalled ? { y: -1 } : undefined}
          whileTap={versionInstalled ? { scale: 0.96 } : undefined}
          type="button"
          disabled={!versionInstalled}
          onClick={launchProject}
          className={`focus-ring uppercase flex items-center gap-1 px-10 h-10 rounded-item text-lg font-medium transition-colors ${
            versionInstalled
              ? 'bg-accent text-ink hover:bg-accent-bright cursor-pointer'
              : 'bg-raised text-muted/40 cursor-not-allowed'
          }`}
        >
          {versionInstalled ? t('open_project') : t('no_version_selected')}
        </motion.button>

        <Dropdown
          align="right"
          trigger={({ open, toggle }) => (
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              aria-label={t('project_more_aria')}
              aria-expanded={open}
              onClick={toggle}
              className={`focus-ring cursor-pointer p-2 rounded-item transition-colors ${
                open ? 'bg-raised text-ink' : 'text-muted hover:text-ink hover:bg-raised'
              }`}
            >
              <IconMore className="w-4 h-4" />
            </motion.button>
          )}
          items={[
            {
              key: 'open-folder',
              label: t('open_folder'),
              icon: IconExternalLink,
              onClick: openFolder,
            },
            {
              key: 'open-ide',
              label: t('open_in_ide'),
              icon: IconCode,
              onClick: openInIde,
            },
            {
              key: 'pin',
              label: project.pinned
                ? t('project_unpin_from_library')
                : t('project_pin_to_library'),
              icon: IconPin,
              onClick: onTogglePin,
              dividerAfter: true,
            },
            {
              key: 'remove',
              label: t('project_card_remove_library'),
              icon: IconX,
              onClick: () => setConfirmAction('remove'),
            },
            {
              key: 'delete',
              label: t('project_card_delete_files'),
              icon: IconTrash,
              danger: true,
              onClick: () => setConfirmAction('delete'),
            },
          ]}
        />
      </div>

      <AnimatePresence>
        {confirmAction === 'remove' && (
          <ConfirmDialog
            title={t('project_remove_title')}
            description={t('project_remove_desc', { name: displayName })}
            confirmLabel={t('project_remove_confirm')}
            onConfirm={() => {
              setConfirmAction(null)
              onRemove()
            }}
            onCancel={() => setConfirmAction(null)}
          />
        )}
        {confirmAction === 'delete' && (
          <ConfirmDialog
            title={t('project_delete_title')}
            description={t('project_delete_desc', { name: displayName })}
            confirmLabel={t('project_delete_confirm')}
            variant="danger"
            onConfirm={() => {
              setConfirmAction(null)
              onDelete()
            }}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
