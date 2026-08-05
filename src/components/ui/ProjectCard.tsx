import { useCallback, useEffect, useLayoutEffect, useRef, useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import type { Category, GitStatus, InstalledGodotVersion, Project } from '../../types'
import { api, getCachedProjectIcon, getCachedProjectName } from '../../lib/api'
import { Dropdown } from './Dropdown'
import { ConfirmDialog } from '../modals/ConfirmDialog'
import { LaunchArgsModal } from '../modals/LaunchArgsModal'
import {
  ContextMenu,
  type ContextMenuSection,
} from './ContextMenu'
import { Tooltip } from './Tooltip'

import { IconGrip, IconMore, IconPin, IconPlay, IconTrash, IconClock, IconExternalLink, IconCode, IconGitBranch, IconX, IconTags, IconCopy, IconHardDrive, IconCheckCircle, IconTerminal } from '../Icons'
import {
  formatLastOpened,
  type LastOpenedTimeFormat,
  type LastOpenedDateFormat,
} from '../../lib/lastOpened'

interface Props {
  project: Project
  installedVersions: InstalledGodotVersion[]
  categories: Category[]
  categoriesEnabled?: boolean
  launchWithConsole?: boolean
  onRemove: () => void
  onDelete: () => void
  onVersionChange: (tag: string) => void
  onCategoryChange: (category: string) => void
  onTogglePin: () => void
  onLaunchArgsChange?: (args: string) => void
  onOpenProperties?: () => void
  onManageTags?: () => void
  onTagsSaved?: () => void
  onGitAction?: (action: 'terminal' | 'pull' | 'push' | 'fetch' | 'log') => void
  onShowGitSidebar?: () => void
  draggable?: boolean
  isDragging?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  gitStatus?: GitStatus | null
  lastOpenedTimeFormat?: LastOpenedTimeFormat
  lastOpenedDateFormat?: LastOpenedDateFormat
  setNodeRef?: (node: HTMLElement | null) => void
  style?: React.CSSProperties
  dragHandleProps?: Record<string, unknown>
}

const MORE_MENU_OPEN_UP_THRESHOLD = 210
const MORE_MENU_GAP = 8

const TAG_COLORS = [
  '#457ff2', '#f28b45', '#45c97f', '#e74c8a', '#a855f7',
  '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#6366f1',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
  '#84cc16', '#d946ef', '#0ea5e9', '#eab308', '#3b82f6',
]

function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
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

export const ProjectCard = memo(function ProjectCard({
  project,
  installedVersions,
  onRemove,
  onDelete,
  onVersionChange,
  onCategoryChange,
  categories,
  onTogglePin,
  onLaunchArgsChange,
  onOpenProperties,
  onManageTags,
  onTagsSaved,
  onGitAction: _onGitAction,
  onShowGitSidebar,
  gitStatus,
  draggable,
  isDragging,
  selected,
  onToggleSelect,
  setNodeRef,
  style,
  dragHandleProps,
  lastOpenedTimeFormat = '12h',
  lastOpenedDateFormat = 'DD-MM-YYYY',
  categoriesEnabled = true,
  launchWithConsole = false,
}: Props) {
  const { t } = useTranslation('common')
  const [icon, setIcon] = useState<string | null>(() => getCachedProjectIcon(project.path))
  const [settingsName, setSettingsName] = useState<string | null>(() => getCachedProjectName(project.path))
  const displayName = settingsName ?? project.name
  const boundVersion = installedVersions.find(
    (v) => v.tag === project.godot_version,
  )
  const versionInstalled = Boolean(boundVersion)
  const supportsConsole = boundVersion?.supports_console ?? false
  const [useConsole, setUseConsole] = useState(launchWithConsole && supportsConsole)
  const [confirmAction, setConfirmAction] = useState<
    'remove' | 'delete' | null
  >(null)
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [templateBusy, setTemplateBusy] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
  } | null>(null)
  const [showLaunchArgs, setShowLaunchArgs] = useState(false)
  const [cardMoreOpen, setCardMoreOpen] = useState(false)
  const [cardMoreUp, setCardMoreUp] = useState(false)
  const cardMoreRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const [morePos, setMorePos] = useState<{ left: number; top: number } | null>(null)

  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null)
  const [editTagValue, setEditTagValue] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')
  const [savingTags, setSavingTags] = useState(false)
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const lastOpenedLabel = formatLastOpened(
    project.last_opened,
    lastOpenedTimeFormat,
    lastOpenedDateFormat,
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

  const openFolder = () =>
    api.openProjectFolder(project.path).catch((e) => alert(e))

  const launchProject = (withConsole?: boolean) =>
    window.dispatchEvent(
      new CustomEvent('app:open-project', {
        detail: { id: project.id, console: withConsole },
      }),
    )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardMoreRef.current && !cardMoreRef.current.contains(e.target as Node)) {
        // The menu is portaled to <body>, so clicks inside it must not be
        // treated as outside clicks.
        if (moreMenuRef.current?.contains(e.target as Node)) return
        setCardMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const measureMoreMenu = useCallback(() => {
    const btn = cardMoreRef.current
    const menu = moreMenuRef.current
    if (!btn || !menu) return
    const r = btn.getBoundingClientRect()
    const mw = menu.offsetWidth
    const mh = menu.offsetHeight
    const up = window.innerHeight - r.bottom < MORE_MENU_OPEN_UP_THRESHOLD
    setCardMoreUp(up)
    setMorePos({
      left: Math.max(MORE_MENU_GAP, r.right - mw),
      top: up
        ? Math.max(MORE_MENU_GAP, r.top - mh - MORE_MENU_GAP)
        : Math.min(r.bottom + MORE_MENU_GAP, window.innerHeight - mh - MORE_MENU_GAP),
    })
  }, [])

  // Position the portaled menu right after it mounts (synchronously, before paint).
  useLayoutEffect(() => {
    if (cardMoreOpen) measureMoreMenu()
  }, [cardMoreOpen, measureMoreMenu])

  // Keep the menu anchored to the trigger while open.
  useEffect(() => {
    if (!cardMoreOpen) return
    const reposition = () => measureMoreMenu()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [cardMoreOpen, measureMoreMenu])

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return
    setTemplateBusy(true)
    try {
      await api.saveProjectAsTemplate(
        project.id,
        templateName.trim(),
        templateDesc.trim(),
      )
      setTemplateSaveOpen(false)
      setTemplateName('')
      setTemplateDesc('')
    } catch (e) {
      alert(e)
    } finally {
      setTemplateBusy(false)
    }
  }

  const saveTags = async (newTags: string[]) => {
    setSavingTags(true)
    try {
      await api.saveProjectTags(project.id, project.path, newTags)
      onTagsSaved?.()
    } catch (e) {
      console.error('Failed to save tags:', e)
    } finally {
      setSavingTags(false)
    }
  }

  const handleAddTag = () => {
    const trimmed = newTagValue.trim()
    if (!trimmed || savingTags) return
    const newTags = [...project.tags, trimmed]
    setAddingTag(false)
    setNewTagValue('')
    saveTags(newTags)
  }

  const handleRemoveTag = (index: number) => {
    if (savingTags) return
    const newTags = project.tags.filter((_, i) => i !== index)
    if (editingTagIndex === index) {
      setEditingTagIndex(null)
      setEditTagValue('')
    }
    saveTags(newTags)
  }

  const handleRenameTag = (index: number) => {
    if (editingTagIndex !== index) return
    const trimmed = editTagValue.trim()
    const current = project.tags[index]
    if (!trimmed || trimmed === current || savingTags) {
      setEditingTagIndex(null)
      setEditTagValue('')
      return
    }
    const newTags = project.tags.map((t, i) => (i === index ? trimmed : t))
    setEditingTagIndex(null)
    setEditTagValue('')
    saveTags(newTags)
  }

  const dialogs = (
    <>
      <AnimatePresence>
        {confirmAction === 'remove' && (
          <ConfirmDialog
            title={t('project_remove_title')}
            description={t('project_remove_desc', { name: displayName })}
            confirmLabel={t('project_remove_confirm')}
            onConfirm={() => {
              onRemove()
              setConfirmAction(null)
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
              onDelete()
              setConfirmAction(null)
            }}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {templateSaveOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setTemplateSaveOpen(false)}
            >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="bg-surface border border-line rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h4 className="font-display font-semibold text-muted">
                  {t('project_save_template_title')}
                </h4>
                <p className="text-xs text-muted mt-1">
                  {t('project_save_template_desc', { name: displayName })}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted">
                  {t('project_template_name_label')}
                </label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="focus-ring bg-raised border border-line rounded-lg px-3.5 py-2.5 text-sm focus:border-accent-dim transition-colors"
                  placeholder={displayName}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted">
                  {t('project_template_desc_label')}{' '}
                  <span className="text-muted/60 font-normal">{t('project_template_desc_sublabel')}</span>
                </label>
                <textarea
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className="focus-ring bg-raised border border-line rounded-lg px-3.5 py-2.5 text-sm focus:border-accent-dim transition-colors resize-none"
                  placeholder={t('project_template_desc_placeholder')}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-1">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setTemplateSaveOpen(false)}
                  className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-raised transition-colors"
                >
                  {t('cancel')}
                </motion.button>
                <motion.button
                  whileHover={templateBusy ? undefined : { y: -1 }}
                  whileTap={templateBusy ? undefined : { scale: 0.96 }}
                  onClick={handleSaveTemplate}
                  disabled={templateBusy || !templateName.trim()}
                  className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-bright disabled:opacity-50 text-sm font-medium text-white transition-colors"
                >
                  {templateBusy ? t('project_saving_template') : t('project_save_template_btn')}
                </motion.button>
              </div>
            </motion.div>            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
        className={`group relative border p-3 rounded-xl bg-surface transition-all duration-200 ${
          isDragging
            ? 'opacity-40 border-line scale-[1.02] shadow-lg shadow-black/30'
            : selected
              ? 'border-accent ring-1 ring-accent/30 bg-accent/5'
              : draggable
                ? 'border-line hover:border-accent-dim hover:shadow-sm hover:shadow-black/10'
                : 'border-line hover:border-accent-dim'
        }`}
      >
            
            {onToggleSelect && (
              <div className="absolute top-2.5 left-2.5 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelect()
                  }}
                  className={`focus-ring cursor-pointer w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
                    selected
                      ? 'bg-accent border-accent text-white scale-100 opacity-100'
                      : 'border-muted/40 bg-black/20 opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-75 hover:border-accent/60'
                  }`}
                  aria-label={selected ? t('project_deselect_aria') : t('project_select_aria')}
                >
                  {selected && <IconCheckCircle className="w-3.5 h-3.5" fill="currentColor" />}
                </button>
              </div>
            )}

            
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl isolate">
              {icon ? (
                <img
                  src={icon}
                  alt=""
                  aria-hidden="true"
                  className="select-none absolute -left-6 top-1/2 -translate-y-1/2 -rotate-6 group-hover:rotate-0 h-35 w-35 object-contain grayscale group-hover:grayscale-0 contrast-125 transition-all duration-300 ease-out group-hover:will-change-transform"
                  style={{
                    opacity: 'var(--project-icon-opacity, 0.14)',
                    maskImage:
                      'linear-gradient(to right, black 35%, transparent 90%)',
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
                    maskImage:
                      'linear-gradient(to right, black 35%, transparent 90%)',
                    WebkitMaskImage:
                      'linear-gradient(to right, black 35%, transparent 90%)',
                  }}
                >
                  {getInitials(displayName)}
                </span>
              )}
            </div>
            <div className={`flex items-center gap-3.5 min-w-0${onToggleSelect && !draggable ? ' pl-8' : ''}`}>
              {draggable && (
                <span
                  {...dragHandleProps}
                  className="inline-flex touch-none cursor-grab active:cursor-grabbing"
                >
                  <IconGrip className="w-4 h-4 text-muted/30 group-hover:text-muted/70 shrink-0 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-200 ease-out" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                  <span
                    className="overflow-hidden inline-flex items-center transition-all duration-150 max-w-0 group-hover:max-w-[22px] mr-0 group-hover:mr-1.5"
                    style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                  >
                    <button
                      onClick={onTogglePin}
                      aria-label={project.pinned ? t('project_unpin_aria') : t('project_pin_aria')}
                      className={`icon-wiggle focus-ring cursor-pointer shrink-0 p-1 rounded-md transition-colors ${
                        project.pinned
                          ? 'text-accent-bright opacity-100'
                          : 'text-muted/40 opacity-0 group-hover:opacity-100 hover:text-muted hover:bg-raised'
                      }`}
                    >
                      <IconPin
                        className="w-3.5 h-3.5"
                        fill={project.pinned ? 'currentColor' : 'none'}
                      />
                    </button>
                  </span>
                  <h3 className="font-display font-medium ml-1 text-xl truncate min-w-0">
                    {displayName}
                  </h3>
                  
                  {(project.tags.length > 0 || addingTag) && (
                    <>
                      {project.tags.slice(0, tagsExpanded ? project.tags.length : 2).map((tag, index) => {
                        const color = tagColor(tag)
                        const isEditing = editingTagIndex === index
                        return (
                          <span
                            key={`${tag}-${index}`}
                            className="group/tag inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-mono text-[10px] font-medium tracking-tight shrink-0 transition-all duration-100"
                            style={{
                              backgroundColor: `${color}18`,
                              color: color,
                            }}
                          >
                            {isEditing ? (
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editTagValue}
                                onChange={(e) => setEditTagValue(e.target.value)}
                                onKeyDown={(e) => {
                                  e.stopPropagation()
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleRenameTag(index)
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingTagIndex(null)
                                    setEditTagValue('')
                                  }
                                }}
                                onBlur={() => handleRenameTag(index)}
                                className="w-16 bg-transparent outline-none text-[10px] font-mono font-medium"
                                style={{ color }}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className="cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingTagIndex(index)
                                  setEditTagValue(tag)
                                }}
                                title={t('tag_rename_hint')}
                              >
                                {tag}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveTag(index)
                              }}
                              className="focus-ring cursor-pointer opacity-0 group-hover/tag:opacity-100 w-0 group-hover/tag:w-3 h-3 overflow-hidden rounded-full flex items-center justify-center transition-all duration-100 hover:text-danger shrink-0"
                              aria-label={t('tag_remove_aria', { tag })}
                            >
                              <IconX className="w-2.5 h-2.5 shrink-0" />
                            </button>
                          </span>
                        )
                      })}
                      {!tagsExpanded && project.tags.length > 2 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setTagsExpanded(true) }}
                          className="focus-ring cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-tight text-muted/50 hover:text-accent-bright hover:bg-accent/10 transition-all shrink-0 border border-dashed border-line/30"
                        >
                          +{project.tags.length - 2} more
                        </button>
                      )}
                      {tagsExpanded && project.tags.length > 2 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setTagsExpanded(false) }}
                          className="focus-ring cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-tight text-muted/50 hover:text-accent-bright hover:bg-accent/10 transition-all shrink-0"
                        >
                          Show less
                        </button>
                      )}
                      {addingTag ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full font-mono text-[10px] font-medium tracking-tight shrink-0 bg-accent/10 border border-accent/30">
                          <input
                            ref={addInputRef}
                            type="text"
                            value={newTagValue}
                            onChange={(e) => setNewTagValue(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddTag()
                              }
                              if (e.key === 'Escape') {
                                setAddingTag(false)
                                setNewTagValue('')
                              }
                            }}
                            onBlur={() => {
                              if (newTagValue.trim()) {
                                handleAddTag()
                              } else {
                                setAddingTag(false)
                              }
                            }}
                            className="w-16 bg-transparent outline-none text-[10px] font-mono font-medium text-accent-bright placeholder:text-accent/40"
                            placeholder={t('add')}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setAddingTag(true)
                            setNewTagValue('')
                          }}
                          className="focus-ring cursor-pointer inline-flex items-center justify-center w-4 h-4 rounded-full text-muted/40 opacity-0 group-hover:opacity-100 hover:text-accent-bright hover:bg-accent/10 transition-all shrink-0"
                          aria-label={t('add_tag_aria')}
                        >
                          <IconX className="w-3 h-3 rotate-45" />
                        </button>
                      )}
                      {savingTags && (
                        <div className="w-3 h-3 rounded-full border-2 border-accent/30 border-t-accent animate-spin shrink-0" />
                      )}
                    </>
                  )}
                </div>
                  <button
                    type="button"
                    onClick={openFolder}
                    className="text-[11px] px-3 py-1.5 mb-1 bg-base rounded-md text-muted font-mono truncate block w-fit text-left hover:text-accent-bright cursor-pointer transition-colors"
                  >
                    {project.path}
                  </button>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap justify-between">
              <div className="flex items-center gap-2.5 ml-8 flex-wrap min-w-0">
                {lastOpenedLabel && (
                  <Tooltip content={t('project_last_opened_tooltip', { label: lastOpenedLabel })}>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-raised border border-line font-mono text-[11px] text-muted shrink-0">
                      <IconClock className="w-3 h-3" />
                      {lastOpenedLabel}
                    </span>
                  </Tooltip>
                )}
                {gitStatus?.is_repo && (
                  <Tooltip
                    content={
                      gitStatus.has_uncommitted
                        ? t('project_git_dirty_tooltip', { branch: gitStatus.branch ?? 'HEAD' })
                        : t('project_git_clean_tooltip', { branch: gitStatus.branch ?? 'HEAD' })
                    }
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onShowGitSidebar?.()
                      }}
                      className={`focus-ring cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[11px] border shrink-0 transition-colors hover:border-accent-dim ${
                        gitStatus.has_uncommitted
                          ? 'bg-amber/10 border-amber/30 text-amber'
                          : 'bg-raised border-line text-muted'
                      }`}
                    >
                      <IconGitBranch className="w-3 h-3" />
                      {gitStatus.branch ?? 'HEAD'}
                      {gitStatus.has_uncommitted && <span className="w-1.5 h-1.5 rounded-full bg-amber ml-0.5" />}
                    </button>
                  </Tooltip>
                )}
                {project.pinned && categoriesEnabled && (() => {
                  const cat = categories.find((c) => c.name === project.category)
                  const catColor = cat?.color ?? '#949ba4'
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-raised border border-line font-mono text-[11px] text-muted shrink-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 ring-1 ring-black/10"
                        style={{ backgroundColor: catColor }}
                      />
                      {project.category ?? t('uncategorized')}
                    </span>
                  )
                })()}

                <Dropdown
                  className="w-48 shrink-0"
                  value={project.godot_version}
                  onChange={onVersionChange}
                  options={installedVersions.map((v) => ({
                    value: v.tag,
                    label: v.custom_name || v.tag,
                    dotClassName: 'bg-mint',
                    badge: v.is_mono ? 'Mono' : undefined,
                  }))}
                />
              </div>

              <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                {supportsConsole && (
                  <Tooltip content={t('open_with_console')}>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setUseConsole(!useConsole)
                      }}
                      className={`focus-ring cursor-pointer p-2 rounded-lg border transition-colors ${
                        useConsole
                          ? 'bg-green-700/15 border-green-500/40 text-green-500'
                          : 'border-line text-muted/50 hover:text-green-500 hover:border-green-500/50 hover:bg-green-500/10'
                      }`}
                      aria-label={t('open_with_console')}
                      aria-pressed={useConsole}
                    >
                      <IconTerminal className="w-4 h-4" />
                    </motion.button>
                  </Tooltip>
                )}
                <motion.button
                  whileHover={versionInstalled ? { y: -1 } : undefined}
                  whileTap={versionInstalled ? { scale: 0.97 } : undefined}
                  type="button"
                  disabled={!versionInstalled}
                  onClick={() => launchProject(useConsole || undefined)}
                  className={`focus-ring flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
                    versionInstalled
                      ? 'bg-accent hover:bg-accent-bright cursor-pointer'
                      : 'bg-raised text-muted/50 cursor-not-allowed'
                  }`}
                >
                  <IconPlay className="w-3.5 h-3.5" />
                  {versionInstalled ? t('open_project') : t('no_version_selected')}
                </motion.button>

                <div ref={cardMoreRef} className="relative">
                  <button
                    onClick={() => {
                      const btnRect = cardMoreRef.current?.getBoundingClientRect()
                      if (btnRect) {
                        setCardMoreUp(window.innerHeight - btnRect.bottom < MORE_MENU_OPEN_UP_THRESHOLD)
                      }
                      setCardMoreOpen((prev) => !prev)
                    }}
                    className="focus-ring cursor-pointer p-2 rounded-lg border border-line text-muted hover:text-ink hover:border-accent-dim hover:bg-raised transition-colors"
                    aria-label={t('project_more_aria')}
                  >
                    <IconMore className="w-4 h-4" />
                  </button>
                  {createPortal(
                    <AnimatePresence>
                      {cardMoreOpen && (
                        <motion.div
                          ref={moreMenuRef}
                          initial={{ opacity: 0, y: cardMoreUp ? 4 : -4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: cardMoreUp ? 4 : -4, scale: 0.96 }}
                          transition={{ duration: 0.12, ease: 'easeOut' }}
                          className={`fixed z-50 ${cardMoreUp ? 'origin-bottom' : 'origin-top'} min-w-50 rounded-xl border border-line bg-surface shadow-2xl shadow-black/40 p-1.5`}
                          style={{ left: morePos?.left, top: morePos?.top }}
                        >
                        <button
                          type="button"
                          onClick={() => { setCardMoreOpen(false); onOpenProperties?.() }}
                          className="w-full flex items-center cursor-pointer gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink hover:bg-raised transition-colors"
                        >
                          <IconHardDrive className="w-3.5 h-3.5 text-muted" />
                          {t('project_card_project_size')}
                        </button>
                        <div className="h-px bg-line my-1" />
                        <button
                          type="button"
                          onClick={() => { setCardMoreOpen(false); setTemplateSaveOpen(true) }}
                          className="w-full flex items-center cursor-pointer gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink hover:bg-raised transition-colors"
                        >
                          <IconCopy className="w-3.5 h-3.5 text-muted" />
                          {t('project_card_save_template')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCardMoreOpen(false); onManageTags?.() }}
                          className="w-full flex items-center cursor-pointer gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink hover:bg-raised transition-colors"
                        >
                          <IconTags className="w-3.5 h-3.5 text-muted" />
                          {t('manage_tags')}
                        </button>
                        <div className="h-px bg-line my-1" />
                        <button
                          type="button"
                          onClick={() => { setCardMoreOpen(false); setConfirmAction('remove') }}
                          className="w-full flex items-center cursor-pointer gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink hover:bg-raised transition-colors"
                        >
                          <IconX className="w-3.5 h-3.5 text-muted" />
                          {t('project_card_remove_library')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCardMoreOpen(false); setConfirmAction('delete') }}
                          className="w-full flex items-center cursor-pointer gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          {t('project_card_delete_files')}
                        </button>
                        </motion.div>
                      )}
                    </AnimatePresence>,
                    document.body,
                  )}
                </div>
              </div>
            </div>
      </div>

      {dialogs}

      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            position={contextMenu}
            onClose={() => setContextMenu(null)}
            items={buildContextMenuItems()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLaunchArgs && (
          <LaunchArgsModal
            projectName={displayName}
            currentArgs={project.launch_arguments}
            onSave={(args) => {
              onLaunchArgsChange?.(args)
              setShowLaunchArgs(false)
            }}
            onClose={() => setShowLaunchArgs(false)}
          />
        )}
      </AnimatePresence>
    </>
  )

  function buildContextMenuItems(): ContextMenuSection[] {
    return [
      {
        label: t('open_project'),
        icon: IconPlay,
        onClick: () => launchProject(useConsole || undefined),
        disabled: !versionInstalled,
      },
      {
        label: t('open_folder'),
        icon: IconExternalLink,
        onClick: openFolder,
      },
      {
        label: t('open_in_ide'),
        icon: IconCode,
        onClick: () => api.openInEditor(project.path).catch((e) => alert(e)),
      },
      { type: 'separator' },
      {
        label: t('pinning'),
        icon: IconPin,
        children: [
          {
            label: project.pinned ? t('project_unpin_from_library') : t('project_pin_to_library'),
            icon: IconPin,
            onClick: onTogglePin,
          },
        ],
      },
      {
        label: t('category'),
        icon: IconTags,
        children: [
          {
            label: t('none'),
            onClick: () => onCategoryChange(''),
            icon: IconX,
          },
          ...(categories.length > 0
            ? [
                { type: 'separator' as const },
                ...categories.map((cat) => ({
                  label: cat.name,
                  onClick: () => onCategoryChange(cat.name),
                  icon: IconTags,
                })),
              ]
            : []),
        ],
      },
      {
        label: t('project_size'),
        icon: IconHardDrive,
        onClick: () => onOpenProperties?.(),
      },
      {
        label: t('launch_arguments'),
        icon: IconCode,
        onClick: () => setShowLaunchArgs(true),
      },
      {
        label: t('manage_tags'),
        icon: IconTags,
        onClick: () => onManageTags?.(),
      },
      {
        label: t('save_as_template'),
        icon: IconCopy,
        onClick: () => setTemplateSaveOpen(true),
      },
      ...(gitStatus?.is_repo
        ? [
            { type: 'separator' as const },
            {
              label: t('git'),
              icon: IconGitBranch,
              onClick: () => onShowGitSidebar?.(),
            },
          ]
        : []),
      { type: 'separator' },
      {
        label: t('remove_from_library'),
        icon: IconX,
        onClick: () => setConfirmAction('remove'),
      },
      {
        label: t('delete_files'),
        icon: IconTrash,
        variant: 'danger',
        onClick: () => setConfirmAction('delete'),
      },
    ]
  }
})
