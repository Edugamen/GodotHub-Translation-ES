import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type Transition } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { Category, GitStatus, InstalledGodotVersion, Project } from '../../../../types'
import { api, getCachedProjectIcon, getCachedProjectName } from '../../../../lib/api'
import { formatLastOpened } from '../../../../lib/lastOpened'
import { formatDuration } from '../../lib/duration'
import { effectiveTotalMs } from '../../../../lib/projectSort'
import { tagColor } from '../../../../lib/colors'
import { isReducedMotion } from '../../../../lib/appearance'
import { useSettings } from '../../../../hooks/useSettings'
import { ConfirmDialog } from '../modals/ConfirmDialog'
import { TagManagerModal } from '../modals/TagManagerModal'
import { Dropdown } from '../ui/Dropdown'
import { Tooltip } from '../reusables/Tooltip'
import { OpenButton } from '../reusables/OpenButton'
import {
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconCode,
  IconExternalLink,
  IconGitBranch,
  IconHistory,
  IconNode,
  IconPencil,
  IconPin,
  IconPlus,
  IconStopwatch,
  IconTags,
  IconTrash,
  IconX,
} from '../../lib/icons'

interface ProjectCardProps {
  project: Project
  installedVersions: InstalledGodotVersion[]
  categories: Category[]
  gitStatus?: GitStatus | null
  launchWithConsole?: boolean
  onTogglePin: () => void
  onVersionChange: (tag: string) => void
  onRemove: () => void
  onDelete: () => void
  onTagsSaved?: (project: Project) => void
  onTagClick?: (tag: string) => void
  onShowGitSidebar?: () => void
  activeTag?: string | null
}

function isSameLocalDay(aMs: number, bMs: number): boolean {
  const a = new Date(aMs)
  const b = new Date(bMs)
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfLocalWeek(ms: number): number {
  const d = new Date(ms)
  const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d.getTime()
}

function isSameLocalWeek(aMs: number, bMs: number): boolean {
  return startOfLocalWeek(aMs) === startOfLocalWeek(bMs)
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
  launchWithConsole = false,
  onTogglePin,
  onVersionChange,
  onRemove,
  onDelete,
  onTagsSaved,
  onTagClick,
  onShowGitSidebar,
  activeTag,
}: ProjectCardProps) {
  const { t } = useTranslation('common')
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
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null)
  const [editTagValue, setEditTagValue] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')
  const [savingTags, setSavingTags] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)
  const [cardHovered, setCardHovered] = useState(false)
  const [pinFocused, setPinFocused] = useState(false)
  const [addFocused, setAddFocused] = useState(false)
  const [showLessFocused, setShowLessFocused] = useState(false)
  const [tagsRowHovered, setTagsRowHovered] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const displayName = settingsName ?? project.name
  const pinOpen = cardHovered || pinFocused || project.pinned
  const springTransition: Transition = isReducedMotion()
    ? { duration: 0 }
    : { type: 'spring', stiffness: 460, damping: 34 }
  const boundVersion = installedVersions.find(
    (v) => v.tag === project.godot_version,
  )
  const versionInstalled = Boolean(boundVersion)
  const supportsConsole = boundVersion?.supports_console ?? false

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

  useEffect(() => {
    if (tagError) editInputRef.current?.focus()
  }, [tagError])

  const lastOpenedLabel = formatLastOpened(
    project.last_opened,
    settings.last_opened_time_format,
    settings.last_opened_date_format,
  )

  const sessionStart = project.session_started_at_ms
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!sessionStart) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [sessionStart])
  const liveElapsed = sessionStart ? Math.max(0, now - sessionStart) : 0
  const allMs = effectiveTotalMs(project, now)
  const todayMs =
    (project.time_today_seconds ?? 0) * 1000 +
    (sessionStart && isSameLocalDay(sessionStart, Date.now())
      ? liveElapsed
      : 0)
  const weekMs =
    (project.time_week_seconds ?? 0) * 1000 +
    (sessionStart && isSameLocalWeek(sessionStart, Date.now())
      ? liveElapsed
      : 0)

  const openFolder = () =>
    api.openProjectFolder(project.path).catch((e) => alert(e))
  const openInIde = () => api.openInEditor(project.path).catch((e) => alert(e))
  const launchProject = (withConsole?: boolean) =>
    window.dispatchEvent(
      new CustomEvent('app:open-project', {
        detail: { id: project.id, console: withConsole },
      }),
    )
  const saveTags = async (newTags: string[]) => {
    setSavingTags(true)
    try {
      await api.saveProjectTags(project.id, project.path, newTags)
      onTagsSaved?.({ ...project, tags: newTags })
    } catch (e) {
      console.error('Failed to save tags:', e)
    } finally {
      setSavingTags(false)
    }
  }

  const handleAddTag = () => {
    const trimmed = newTagValue.trim()
    if (!trimmed || savingTags) return
    if (project.tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTagError(t('tag_already_exists'))
      return
    }
    const newTags = [...project.tags, trimmed]
    setAddingTag(false)
    setNewTagValue('')
    setTagError(null)
    setAddFocused(false)
    saveTags(newTags)
  }

  const handleRemoveTag = (index: number) => {
    if (savingTags) return
    const newTags = project.tags.filter((_, i) => i !== index)
    if (editingTagIndex === index) {
      setEditingTagIndex(null)
      setEditTagValue('')
    }
    setTagError(null)
    saveTags(newTags)
  }

  const handleRenameTag = (index: number) => {
    if (editingTagIndex !== index) return
    const trimmed = editTagValue.trim()
    const current = project.tags[index]
    if (!trimmed || trimmed === current || savingTags) {
      setEditingTagIndex(null)
      setEditTagValue('')
      setTagError(null)
      return
    }
    if (
      project.tags.some(
        (t, i) => i !== index && t.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setTagError(t('tag_already_exists'))
      return
    }
    const newTags = project.tags.map((t, i) => (i === index ? trimmed : t))
    setEditingTagIndex(null)
    setEditTagValue('')
    setTagError(null)
    saveTags(newTags)
  }

  return (
    <div
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
      className="group relative flex items-end gap-3.5 p-3.5 rounded-item bg-overlay border border-outline/50 hover:bg-raised hover:border-accent-dim/60 transition-colors"
    >
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

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <h3 className="font-display font-medium text-xl text-ink truncate">
            {displayName}
          </h3>
          {gitStatus?.is_repo && (
            <Tooltip
              content={
                gitStatus.has_uncommitted
                  ? t('project_git_dirty_tooltip', {
                      branch: gitStatus.branch ?? 'HEAD',
                    })
                  : t('project_git_clean_tooltip', {
                      branch: gitStatus.branch ?? 'HEAD',
                    })
              }
            >
              <button
                type="button"
                onClick={onShowGitSidebar}
                aria-label={t('git_sidebar')}
                className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-item transition-colors cursor-pointer ${
                  gitStatus.has_uncommitted
                    ? 'bg-amber/10 text-amber'
                    : 'text-muted hover:text-ink hover:bg-raised'
                }`}
              >
                <IconGitBranch className="w-3 h-3 shrink-0" />
              </button>
            </Tooltip>
          )}
          {project.tags.length > 0 && (
            <div
              onMouseEnter={() => setTagsRowHovered(true)}
              onMouseLeave={() => setTagsRowHovered(false)}
              className="flex items-center gap-1 flex-wrap min-w-0"
            >
              {project.tags
                .slice(0, tagsExpanded ? project.tags.length : 3)
                .map((tag, index) => {
                  const color = tagColor(tag)
                  const isActive = activeTag === tag
                  const isEditing = editingTagIndex === index
                  return (
                    <span
                      key={`${tag}-${index}`}
                      className={`group/tag inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-tag font-mono text-[10px] font-medium tracking-tight shrink-0 transition-[filter,box-shadow] duration-100 ${
                        isActive ? 'ring-1 ring-accent-dim/70 brightness-110' : ''
                      }`}
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full shrink-0 ring-1 ring-black/20"
                        style={{ backgroundColor: color }}
                      />
                      {isEditing ? (
                        tagError ? (
                          <Tooltip content={tagError} side="top" className="w-16">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editTagValue}
                              onChange={(e) => {
                                setEditTagValue(e.target.value)
                                if (tagError) setTagError(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleRenameTag(index)
                                }
                                if (e.key === 'Escape') {
                                  setEditingTagIndex(null)
                                  setEditTagValue('')
                                  setTagError(null)
                                }
                              }}
                              onBlur={() => handleRenameTag(index)}
                              className={`w-16 bg-transparent outline-none text-[10px] font-mono font-medium ${
                                tagError ? 'text-danger' : ''
                              }`}
                              style={tagError ? undefined : { color }}
                              aria-invalid={tagError ? true : undefined}
                              autoFocus
                            />
                          </Tooltip>
                        ) : (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editTagValue}
                            onChange={(e) => {
                              setEditTagValue(e.target.value)
                              if (tagError) setTagError(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleRenameTag(index)
                              }
                              if (e.key === 'Escape') {
                                setEditingTagIndex(null)
                                setEditTagValue('')
                                setTagError(null)
                              }
                            }}
                            onBlur={() => handleRenameTag(index)}
                            className={`w-16 bg-transparent outline-none text-[10px] font-mono font-medium ${
                              tagError ? 'text-danger' : ''
                            }`}
                            style={tagError ? undefined : { color }}
                            aria-invalid={tagError ? true : undefined}
                            autoFocus
                          />
                        )
                      ) : (
                        <>
                          <Tooltip content={t('filter_by_tag')} side="top">
                            <button
                              type="button"
                              onClick={() => onTagClick?.(tag)}
                              className="cursor-pointer hover:brightness-125 transition-[filter] duration-100"
                            >
                              {tag}
                            </button>
                          </Tooltip>
                          <Tooltip content={t('tag_rename_aria')} side="top">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTagIndex(index)
                                setEditTagValue(tag)
                                setTagError(null)
                              }}
                              aria-label={t('tag_rename_aria')}
                              className="focus-ring cursor-pointer opacity-0 group-hover/tag:opacity-100 scale-75 group-hover/tag:scale-100 w-0 group-hover/tag:w-3 h-3 overflow-hidden rounded-full flex items-center justify-center transition-all duration-150 hover:text-ink shrink-0"
                            >
                              <IconPencil className="w-2.5 h-2.5 shrink-0" />
                            </button>
                          </Tooltip>
                          <Tooltip content={t('tag_remove_aria', { tag })} side="top">
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(index)}
                              aria-label={t('tag_remove_aria', { tag })}
                              className="focus-ring cursor-pointer opacity-0 group-hover/tag:opacity-100 scale-75 group-hover/tag:scale-100 w-0 group-hover/tag:w-3 h-3 overflow-hidden rounded-full flex items-center justify-center transition-all duration-150 hover:text-danger shrink-0"
                            >
                              <IconX className="w-2.5 h-2.5 shrink-0" />
                            </button>
                          </Tooltip>
                        </>
                      )}
                    </span>
                  )
                })}
              {!tagsExpanded && project.tags.length > 3 && (
                <Tooltip content={t('show_more_tags')} side="top">
                  <button
                    type="button"
                    onClick={() => setTagsExpanded(true)}
                    aria-label={t('show_more_tags')}
                    className="focus-ring cursor-pointer inline-flex items-center px-2 py-0.5 rounded-tag text-[10px] font-mono font-medium tracking-tight text-muted hover:text-ink hover:bg-raised transition-colors shrink-0 border border-dashed border-outline/50"
                  >
                    +{project.tags.length - 3}
                  </button>
                </Tooltip>
              )}
              {tagsExpanded && project.tags.length > 3 && (
                <motion.span
                  initial={false}
                  animate={{
                    width: tagsRowHovered || showLessFocused ? 20 : 0,
                    marginRight: tagsRowHovered || showLessFocused ? 6 : 0,
                    opacity: tagsRowHovered || showLessFocused ? 1 : 0,
                  }}
                  transition={springTransition}
                  className="overflow-hidden inline-flex items-center shrink-0"
                >
                  <Tooltip content={t('show_fewer_tags')} side="top">
                    <button
                      type="button"
                      onClick={() => setTagsExpanded(false)}
                      onFocus={() => setShowLessFocused(true)}
                      onBlur={() => setShowLessFocused(false)}
                      aria-label={t('show_fewer_tags')}
                      className="focus-ring cursor-pointer inline-flex items-center justify-center w-5 h-5 rounded-full text-muted hover:text-ink hover:bg-raised transition-colors"
                    >
                      <IconChevronRight className="w-2 h-2 rotate-180" />
                    </button>
                  </Tooltip>
                </motion.span>
              )}
            </div>
          )}
          {addingTag ? (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-tag font-mono text-[10px] font-medium tracking-tight shrink-0 border ${
                tagError
                  ? 'bg-danger/10 border-danger/50'
                  : 'bg-accent/10 border-accent/30'
              }`}
            >
              {tagError ? (
                <Tooltip content={tagError} side="top" className="w-16">
                  <input
                    ref={addInputRef}
                    type="text"
                    value={newTagValue}
                    onChange={(e) => {
                      setNewTagValue(e.target.value)
                      if (tagError) setTagError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddTag()
                      }
                      if (e.key === 'Escape') {
                        setAddingTag(false)
                        setNewTagValue('')
                        setTagError(null)
                        setAddFocused(false)
                      }
                    }}
                    onBlur={() => {
                      if (newTagValue.trim()) {
                        handleAddTag()
                      } else {
                        setAddingTag(false)
                        setTagError(null)
                        setAddFocused(false)
                      }
                    }}
                    className={`w-16 bg-transparent outline-none text-[10px] font-mono font-medium ${
                      tagError
                        ? 'text-danger placeholder:text-danger/40'
                        : 'text-accent-bright placeholder:text-accent/40'
                    }`}
                    placeholder={t('tag_input_placeholder')}
                    aria-invalid={tagError ? true : undefined}
                    autoFocus
                  />
                </Tooltip>
              ) : (
                <input
                  ref={addInputRef}
                  type="text"
                  value={newTagValue}
                  onChange={(e) => {
                    setNewTagValue(e.target.value)
                    if (tagError) setTagError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                    if (e.key === 'Escape') {
                      setAddingTag(false)
                      setNewTagValue('')
                      setTagError(null)
                      setAddFocused(false)
                    }
                  }}
                  onBlur={() => {
                    if (newTagValue.trim()) {
                      handleAddTag()
                    } else {
                      setAddingTag(false)
                      setTagError(null)
                      setAddFocused(false)
                    }
                  }}
                  className={`w-16 bg-transparent outline-none text-[10px] font-mono font-medium ${
                    tagError
                      ? 'text-danger placeholder:text-danger/40'
                      : 'text-accent-bright placeholder:text-accent/40'
                  }`}
                  placeholder={t('tag_input_placeholder')}
                  aria-invalid={tagError ? true : undefined}
                  autoFocus
                />
              )}
            </span>
          ) : (
            <motion.span
              initial={false}
              animate={{
                width: cardHovered || addFocused ? 20 : 0,
                marginRight: cardHovered || addFocused ? 6 : 0,
                opacity: cardHovered || addFocused ? 1 : 0,
              }}
              transition={springTransition}
              className="overflow-hidden inline-flex items-center shrink-0"
            >
              <Tooltip content={t('add_tag_aria')} side="top">
                <button
                  type="button"
                  onClick={() => {
                    setAddingTag(true)
                    setNewTagValue('')
                    setTagError(null)
                  }}
                  onFocus={() => setAddFocused(true)}
                  onBlur={() => setAddFocused(false)}
                  aria-label={t('add_tag_aria')}
                  className="focus-ring cursor-pointer inline-flex items-center justify-center w-5 h-5 rounded-full text-muted hover:text-accent-bright hover:bg-raised transition-colors"
                >
                  <IconPlus className="w-3 h-3" />
                </button>
              </Tooltip>
            </motion.span>
          )}
          {savingTags && (
            <span
              aria-label={t('saving_tags')}
              className="w-3 h-3 rounded-full border-2 border-accent-dim/30 border-t-accent-bright animate-spin shrink-0"
            />
          )}
        </div>

        <Tooltip content={project.path} side="top" className="w-fit max-w-full">
          <button
            type="button"
            onClick={openFolder}
            className="block w-fit max-w-full bg-black/15 px-3 py-1 rounded-tag text-[11px] font-mono text-muted truncate hover:text-accent-bright cursor-pointer transition-colors"
          >
            {project.path}
          </button>
        </Tooltip>

        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">

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
                {boundVersion ? (
                  <>
                    {boundVersion.custom_name || boundVersion.tag}
                    {boundVersion.is_mono && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-tag bg-accent/10 text-accent-bright border border-accent-dim/40 shrink-0">
                        {t('version_mono_badge')}
                      </span>
                    )}
                  </>
                ) : (
                  t('no_version_selected')
                )}
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
              badge: v.is_mono ? t('version_mono_badge') : undefined,
            }))}
          />
          <motion.span
            initial={false}
            animate={{
              width: pinOpen ? 22 : 0,
              marginRight: pinOpen ? 6 : 0,
              opacity: pinOpen ? 1 : 0,
            }}
            transition={springTransition}
            className="overflow-hidden inline-flex items-center shrink-0"
          >
            <Tooltip
              content={
                project.pinned
                  ? t('project_unpin_aria')
                  : t('project_pin_aria')
              }
              side="top"
            >
              <button
                type="button"
                onClick={onTogglePin}
                onFocus={() => setPinFocused(true)}
                onBlur={() => setPinFocused(false)}
                aria-label={
                  project.pinned
                    ? t('project_unpin_aria')
                    : t('project_pin_aria')
                }
                className={`focus-ring icon-wiggle cursor-pointer p-1 rounded-item transition-colors ${
                  project.pinned
                    ? 'text-accent-bright opacity-100'
                    : 'text-muted/40 opacity-100 hover:text-ink hover:bg-raised'
                }`}
              >
                <IconPin
                  className="w-3.5 h-3.5"
                  fill={project.pinned ? 'currentColor' : 'none'}
                />
              </button>
            </Tooltip>
          </motion.span>
          {lastOpenedLabel && (
            <Tooltip
              content={t('project_last_opened_tooltip', {
                label: lastOpenedLabel,
              })}
              side="top"
            >
              <span className="inline-flex items-center gap-1.5 rounded-btn px-3 py-3 bg-black/10 font-mono text-[10px] text-muted shrink-0">
                <IconClock className="w-3 h-3 text-muted/60 shrink-0" />
                {lastOpenedLabel}
              </span>
            </Tooltip>
          )}
          {allMs > 0 && (
            <Dropdown
              align="left"
              trigger={({ open, toggle }) => (
                <Tooltip
                  content={t('project_total_time_tooltip', {
                    label: formatDuration(allMs),
                  })}
                  side="top"
                >
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    className="focus-ring cursor-pointer inline-flex items-center gap-1.5 rounded-btn px-3 py-3 bg-black/10 font-mono text-[10px] text-muted hover:text-ink hover:bg-raised transition-colors shrink-0"
                  >
                    <IconStopwatch className="w-3 h-3 text-muted/60 shrink-0" />
                    {formatDuration(allMs)}
                  </button>
                </Tooltip>
              )}
              items={[
                {
                  key: 'today',
                  label: `${t('time_today')} · ${formatDuration(todayMs)}`,
                  icon: IconClock,
                },
                {
                  key: 'week',
                  label: `${t('time_this_week')} · ${formatDuration(weekMs)}`,
                  icon: IconHistory,
                },
                {
                  key: 'all',
                  label: `${t('time_all_time')} · ${formatDuration(allMs)}`,
                  icon: IconStopwatch,
                },
              ]}
            />
          )}
        </div>
      </div>

      <OpenButton
        label={versionInstalled ? t('open_project') : t('no_version_selected')}
        disabled={!versionInstalled}
        onOpen={launchProject}
        consoleSupported={supportsConsole}
        consoleInitiallyOn={launchWithConsole && supportsConsole}
        moreAriaLabel={t('project_more_aria')}
        className="px-10"
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
            key: 'manage-tags',
            label: t('manage_tags'),
            icon: IconTags,
            onClick: () => setTagManagerOpen(true),
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
          ...(gitStatus?.is_repo
            ? [
                {
                  key: 'git-sidebar',
                  label: t('git_sidebar'),
                  icon: IconGitBranch,
                  onClick: onShowGitSidebar,
                  dividerAfter: true,
                },
              ]
            : []),
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
        {tagManagerOpen && (
          <TagManagerModal
            project={project}
            onClose={() => setTagManagerOpen(false)}
            onSaved={(updated) => onTagsSaved?.(updated)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
