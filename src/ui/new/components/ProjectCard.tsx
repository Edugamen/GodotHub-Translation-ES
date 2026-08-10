import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type Transition } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { Category, GitStatus, InstalledGodotVersion, Project } from '../../../types'
import { api, getCachedProjectIcon, getCachedProjectName } from '../../../lib/api'
import { formatLastOpened } from '../../../lib/lastOpened'
import { tagColor } from '../../../lib/colors'
import { isReducedMotion } from '../../../lib/appearance'
import { useSettings } from '../../../hooks/useSettings'
import { ConfirmDialog } from '../../../components/modals/ConfirmDialog'
import { TagManagerModal } from '../../../components/modals/TagManagerModal'
import { Dropdown } from './Dropdown'
import {
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconCode,
  IconDownload,
  IconExternalLink,
  IconGitBranch,
  IconMore,
  IconNode,
  IconPencil,
  IconPin,
  IconPlus,
  IconRefresh,
  IconTags,
  IconTerminal,
  IconTrash,
  IconX,
} from '../../../components/Icons'

interface ProjectCardProps {
  project: Project
  installedVersions: InstalledGodotVersion[]
  categories: Category[]
  gitStatus?: GitStatus | null
  /** Default the console toggle on when the launch-with-console setting is on. */
  launchWithConsole?: boolean
  onTogglePin: () => void
  onVersionChange: (tag: string) => void
  onRemove: () => void
  onDelete: () => void
  /** Called after tag edits are persisted; receives the updated project. */
  onTagsSaved?: (project: Project) => void
  /** Clicking a tag pill filters the projects view to that tag. */
  onTagClick?: (tag: string) => void
  /** The tag currently filtering the projects view (highlighted on pills). */
  activeTag?: string | null
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
  activeTag,
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
  // Pin slides out from the left while the card is hovered or the button is
  // focused (or always for pinned projects).
  const pinOpen = cardHovered || pinFocused || project.pinned
  // Shared spring for the row's slide-in controls (pin, git, add-tag).
  const springTransition: Transition = isReducedMotion()
    ? { duration: 0 }
    : { type: 'spring', stiffness: 460, damping: 34 }
  const boundVersion = installedVersions.find(
    (v) => v.tag === project.godot_version,
  )
  const versionInstalled = Boolean(boundVersion)
  const supportsConsole = boundVersion?.supports_console ?? false
  const [useConsole, setUseConsole] = useState(
    launchWithConsole && supportsConsole,
  )

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

  // Keep focus in the rename input when a duplicate-tag error is shown, so the
  // user can fix the name without clicking back in.
  useEffect(() => {
    if (tagError) editInputRef.current?.focus()
  }, [tagError])

  const lastOpenedLabel = formatLastOpened(
    project.last_opened,
    settings.last_opened_time_format,
    settings.last_opened_date_format,
  )

  const openFolder = () =>
    api.openProjectFolder(project.path).catch((e) => alert(e))
  const openInIde = () => api.openInEditor(project.path).catch((e) => alert(e))
  const launchProject = (withConsole?: boolean) =>
    window.dispatchEvent(
      new CustomEvent('app:open-project', {
        detail: { id: project.id, console: withConsole },
      }),
    )
  const openTerminal = () =>
    api.openTerminal(project.path).catch((e) => alert(e))
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
    <div
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
      className="group relative flex items-end gap-3.5 p-3.5 rounded-item bg-overlay border border-outline/50 hover:bg-raised hover:border-accent-dim/60 transition-colors"
    >
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
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
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
                  aria-label={
                    gitStatus.has_uncommitted
                      ? t('project_git_dirty_tooltip', {
                          branch: gitStatus.branch ?? 'HEAD',
                        })
                      : t('project_git_clean_tooltip', {
                          branch: gitStatus.branch ?? 'HEAD',
                        })
                  }
                  title={
                    gitStatus.has_uncommitted
                      ? t('project_git_dirty_tooltip', {
                          branch: gitStatus.branch ?? 'HEAD',
                        })
                      : t('project_git_clean_tooltip', {
                          branch: gitStatus.branch ?? 'HEAD',
                        })
                  }
                  className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-item transition-colors cursor-pointer ${
                    gitStatus.has_uncommitted
                      ? 'bg-amber/10 text-amber'
                      : 'text-muted hover:text-ink hover:bg-raised'
                  }`}
                >
                  <IconGitBranch className="w-3 h-3 shrink-0" />
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
                          title={tagError ?? undefined}
                          aria-invalid={tagError ? true : undefined}
                          autoFocus
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onTagClick?.(tag)}
                            title={t('filter_by_tag')}
                            className="cursor-pointer hover:brightness-125 transition-[filter] duration-100"
                          >
                            {tag}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagIndex(index)
                              setEditTagValue(tag)
                              setTagError(null)
                            }}
                            aria-label={t('tag_rename_aria')}
                            title={t('tag_rename_aria')}
                            className="focus-ring cursor-pointer opacity-0 group-hover/tag:opacity-100 scale-75 group-hover/tag:scale-100 w-0 group-hover/tag:w-3 h-3 overflow-hidden rounded-full flex items-center justify-center transition-all duration-150 hover:text-ink shrink-0"
                          >
                            <IconPencil className="w-2.5 h-2.5 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(index)}
                            aria-label={t('tag_remove_aria', { tag })}
                            title={t('tag_remove_aria', { tag })}
                            className="focus-ring cursor-pointer opacity-0 group-hover/tag:opacity-100 scale-75 group-hover/tag:scale-100 w-0 group-hover/tag:w-3 h-3 overflow-hidden rounded-full flex items-center justify-center transition-all duration-150 hover:text-danger shrink-0"
                          >
                            <IconX className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        </>
                      )}
                    </span>
                  )
                })}
              {!tagsExpanded && project.tags.length > 3 && (
                <button
                  type="button"
                  onClick={() => setTagsExpanded(true)}
                  aria-label={t('show_more_tags')}
                  title={t('show_more_tags')}
                  className="focus-ring cursor-pointer inline-flex items-center px-2 py-0.5 rounded-tag text-[10px] font-mono font-medium tracking-tight text-muted hover:text-ink hover:bg-raised transition-colors shrink-0 border border-dashed border-outline/50"
                >
                  +{project.tags.length - 3}
                </button>
              )}
              {tagsExpanded && project.tags.length > 3 && (
                // Hidden by default, springs in on card hover / focus like
                // the add-tag and pin icons; a touch smaller than them.
                <motion.span
                  initial={false}
                  animate={{
                    // Visible while the tags row itself is hovered (or the
                    // button focused), not just the whole card.
                    width: tagsRowHovered || showLessFocused ? 20 : 0,
                    marginRight: tagsRowHovered || showLessFocused ? 6 : 0,
                    opacity: tagsRowHovered || showLessFocused ? 1 : 0,
                  }}
                  transition={springTransition}
                  className="overflow-hidden inline-flex items-center shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setTagsExpanded(false)}
                    onFocus={() => setShowLessFocused(true)}
                    onBlur={() => setShowLessFocused(false)}
                    aria-label={t('show_fewer_tags')}
                    title={t('show_fewer_tags')}
                    className="focus-ring cursor-pointer inline-flex items-center justify-center w-5 h-5 rounded-full text-muted hover:text-ink hover:bg-raised transition-colors"
                  >
                    {/* Tags extend to the right, so collapsing points left. */}
                    <IconChevronRight className="w-2 h-2 rotate-180" />
                  </button>
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
                title={tagError ?? undefined}
                aria-invalid={tagError ? true : undefined}
                autoFocus
              />
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
                title={t('add_tag_aria')}
                className="focus-ring cursor-pointer inline-flex items-center justify-center w-5 h-5 rounded-full text-muted hover:text-accent-bright hover:bg-raised transition-colors"
              >
                <IconPlus className="w-3 h-3" />
              </button>
            </motion.span>
          )}
          {savingTags && (
            <span
              aria-label={t('saving_tags')}
              className="w-3 h-3 rounded-full border-2 border-accent-dim/30 border-t-accent-bright animate-spin shrink-0"
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
          {/* Pin springs in next to the version select on hover. */}
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
              title={
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
          </motion.span>
          {lastOpenedLabel && (
            <span
              title={t('project_last_opened_tooltip', {
                label: lastOpenedLabel,
              })}
              // Informational only — a soft tint with no border or raised
              // surface so it reads as a static label, not a clickable
              // control like the version dropdown beside it.
              className="inline-flex items-center gap-1.5 rounded-btn px-3 py-3 bg-black/10 font-mono text-[10px] text-muted shrink-0"
            >
              <IconClock className="w-3 h-3 text-muted/60 shrink-0" />
              {lastOpenedLabel}
            </span>
          )}
        </div>
      </div>

      {/* Actions — bottom right of the card. Open + console + ⋯ form a
          split-button group styled like the Import button + its dropdown. */}
      <div className="flex items-stretch gap-1 shrink-0 justify-end">
        <motion.button
          whileHover={versionInstalled ? { scale: 1.04 } : undefined}
          whileTap={versionInstalled ? { scale: 0.94 } : undefined}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          type="button"
          disabled={!versionInstalled}
          onClick={() => launchProject(useConsole || undefined)}
          className={`focus-ring flex items-center px-10 h-12 rounded-l-dropdown-btn rounded-r-[4px] font-semibold text-[17px] shadow-md shadow-black/10 border border-outline/50 transition-colors ${
            versionInstalled
              ? 'bg-accent text-ink hover:bg-accent-bright cursor-pointer'
              : 'bg-raised text-muted/40 cursor-not-allowed'
          }`}
        >
          {versionInstalled ? t('open_project') : t('no_version_selected')}
        </motion.button>

        {supportsConsole && (
          <motion.button
            key={useConsole ? 'console-on' : 'console-off'}
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={() => setUseConsole((v) => !v)}
            aria-label={t('open_with_console')}
            aria-pressed={useConsole}
            title={t('open_with_console')}
            // Squared inner corners (4px) on both sides so it reads as the
            // middle member of the split group between Open and ⋯.
            className={`focus-ring cursor-pointer p-2 h-12 rounded-[4px] font-semibold text-[17px] shadow-md shadow-black/10 border transition-colors duration-200 ${
              // ON adopts the split-button member look (like the ⋯ button's
              // open state); the terminal icon stays green as the signal.
              useConsole
                ? 'bg-raised text-ink border-green-500'
                : 'bg-overlay text-muted border-outline/50 hover:text-green-500 hover:border-green-500/50'
            }`}
          >
            <IconTerminal
              className={`w-4 h-4 ${useConsole ? 'text-green-500' : ''}`}
            />
          </motion.button>
        )}

        <Dropdown
          align="right"
          trigger={({ open, toggle }) => (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              type="button"
              aria-label={t('project_more_aria')}
              aria-expanded={open}
              onClick={toggle}
              className={`focus-ring cursor-pointer px-[5px] h-12 rounded-r-dropdown rounded-l-[4px] font-semibold text-[17px] shadow-md shadow-black/10 border border-outline/50 transition-colors ${
                open
                  ? 'bg-raised text-ink border-accent-dim/60'
                  : 'bg-overlay text-muted hover:text-ink hover:bg-raised'
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
