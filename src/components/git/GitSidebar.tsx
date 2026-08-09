import { useEffect, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  GitBranchInfo,
  GitChangedFile,
  GitLogEntry,
  GitStashEntry,
  GitStatus,
  Project,
} from '../../types'
import { api } from '../../lib/api'
import { DiffViewer } from './DiffViewer'
import { CommitGraph } from './CommitGraph'
import { GitResultDialog, parseGitError } from './GitResultDialog'
import { MergeConflictDialog } from './MergeConflictDialog'
import { Tooltip } from '../ui/Tooltip'
import { ContextMenu, type ContextMenuSection } from '../ui/ContextMenu'
import {
  IconX,
  IconGitBranch,
  IconCloudArrowDown,
  IconRefresh,
  IconTerminal,
  IconTrash,
  IconArrowUpDown,
  IconHistory,
  IconCheck,
  IconFolderPlus,
  IconCheckCircle,
  IconAlertTriangle,
  IconInfo,
  IconBomb,
  IconPlus,
  IconCopy,
  IconCode,
  IconChevronRight,
} from '../Icons'
import { ConfirmDialog } from '../modals/ConfirmDialog'

interface Props {
  project: Project
  gitStatus: GitStatus | null
  onClose: () => void
  onRefresh: () => void
}

interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

let toastId = 0

function truncateMessage(msg: string): string {
  const trimmed = msg.trim()
  if (!trimmed) return msg
  const firstLine = trimmed.split('\n')[0] ?? trimmed
  if (firstLine.length <= 120) return firstLine
  return firstLine.slice(0, 117) + '…'
}

function statusLabel(status: string): { short: string; color: string; label: string } {
  const s = status.trim()
  const primary = s.length >= 2 && s[0] !== ' ' ? s[0] : s[s.length - 1] ?? ''
  if (primary === 'M') return { short: 'M', color: 'text-amber', label: 'Modified' }
  if (primary === 'A') return { short: 'A', color: 'text-mint', label: 'Added' }
  if (primary === 'D') return { short: 'D', color: 'text-danger', label: 'Deleted' }
  if (primary === 'R') return { short: 'R', color: 'text-accent-bright', label: 'Renamed' }
  if (primary === 'C') return { short: 'C', color: 'text-accent-bright', label: 'Copied' }
  if (s.includes('?')) return { short: '?', color: 'text-muted', label: 'Untracked' }
  if (s.includes('U')) return { short: 'U', color: 'text-danger', label: 'Unmerged' }
  return { short: s, color: 'text-muted', label: s }
}

function FileRow({
  file,
  staged,
  busy,
  onDiff,
  onToggleStage,
  onDiscard,
  onContextMenu,
}: {
  file: GitChangedFile
  staged: boolean
  busy: boolean
  onDiff: () => void
  onToggleStage: () => void
  onDiscard: () => void
  onContextMenu: (x: number, y: number) => void
}) {
  const { t } = useTranslation('git')
  const info = statusLabel(file.status)
  const untracked = file.status.trim().includes('?')
  const slash = file.path.lastIndexOf('/')
  const folder = slash >= 0 ? file.path.slice(0, slash + 1) : ''
  const name = slash >= 0 ? file.path.slice(slash + 1) : file.path
  return (
    <div
      className="group flex items-center gap-1.5 pl-5 pr-1 py-1 rounded-md hover:bg-raised transition-colors"
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e.clientX, e.clientY)
      }}
    >
      <span className={`font-mono text-[10px] font-bold w-5 shrink-0 text-center ${info.color}`}>{info.short}</span>
      <button
        onClick={onDiff}
        disabled={untracked || busy}
        title={info.label}
        className="flex-1 min-w-0 text-left text-[11px] truncate cursor-pointer disabled:cursor-default transition-colors"
      >
        {folder && <span className="text-muted/50">{folder}</span>}
        <span className="text-ink/90 group-hover:text-accent-bright transition-colors">{name}</span>
      </button>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDiff}
          disabled={untracked || busy}
          title={t('view_diff')}
          aria-label={t('view_diff')}
          className="focus-ring cursor-pointer p-1 rounded text-muted/50 hover:text-accent-bright hover:bg-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <IconCode className="w-3 h-3" />
        </button>
        <button
          onClick={onToggleStage}
          disabled={busy}
          title={staged ? t('unstage_file') : t('stage_file')}
          aria-label={staged ? t('unstage_file') : t('stage_file')}
          className="focus-ring cursor-pointer p-1 rounded text-muted/50 hover:text-accent-bright hover:bg-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {staged ? <IconX className="w-3 h-3" /> : <IconPlus className="w-3 h-3" />}
        </button>
        <button
          onClick={onDiscard}
          disabled={busy}
          title={t('discard')}
          aria-label={t('discard')}
          className="focus-ring cursor-pointer p-1 rounded text-muted/50 hover:text-danger hover:bg-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <IconTrash className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

/**
 * VS Code-style collapsible group header: label + count badge, with batch
 * actions revealed on hover (e.g. stage all / unstage all / discard all).
 */
function ChangeGroup({
  label,
  count,
  collapsed,
  onToggle,
  actions,
  children,
}: {
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
  actions: { icon: ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }[]
  children: ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        className="group/chg focus-ring flex items-center gap-1.5 px-1 py-1.5 rounded-md cursor-pointer select-none hover:bg-raised transition-colors"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        <IconChevronRight
          className={`w-3 h-3 text-muted/60 shrink-0 transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        <span className="text-[9px] font-semibold text-muted/60 px-1.5 py-px rounded-full bg-raised leading-4">{count}</span>
        <div className="flex-1" />
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover/chg:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((a) => (
            <button
              key={a.title}
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.title}
              aria-label={a.title}
              className={`focus-ring cursor-pointer p-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                a.danger
                  ? 'text-muted hover:text-danger hover:bg-raised'
                  : 'text-muted hover:text-accent-bright hover:bg-raised'
              }`}
            >
              {a.icon}
            </button>
          ))}
        </div>
      </div>
      {!collapsed && <div className="flex flex-col gap-px pb-1">{children}</div>}
    </div>
  )
}

function Checkbox({
  checked,
  onChange,
  className = '',
}: {
  checked: boolean
  onChange: () => void
  className?: string
}) {
  return (
    <label
      className={`git-checkbox relative inline-flex items-center justify-center w-4 h-4 shrink-0 cursor-pointer ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
      <span
        className={`w-4 h-4 rounded border transition-all duration-150 flex items-center justify-center
          ${checked
            ? 'bg-accent border-accent-bright'
            : 'bg-base border-line hover:border-accent-dim'
          }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={3}>
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </span>
    </label>
  )
}

export function GitSidebar({ project, gitStatus, onClose, onRefresh }: Props) {
  const { t } = useTranslation('git')
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [logEntries, setLogEntries] = useState<GitLogEntry[]>([])
  const [logLoading, setLogLoading] = useState(true)

  const [branches, setBranches] = useState<GitBranchInfo[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [newBranchName, setNewBranchName] = useState('')
  const [showCreateBranch, setShowCreateBranch] = useState(false)

  const [changedFiles, setChangedFiles] = useState<GitChangedFile[]>([])
  const [changesLoading, setChangesLoading] = useState(true)

  const [collapsedGroups, setCollapsedGroups] = useState<{ staged: boolean; changes: boolean }>({
    staged: false,
    changes: false,
  })
  const [commitMessage, setCommitMessage] = useState('')
  const [amendMode, setAmendMode] = useState(false)
  const [pushAfterCommit, setPushAfterCommit] = useState(false)

  const [stashes, setStashes] = useState<GitStashEntry[]>([])
  const [stashesLoading, setStashesLoading] = useState(true)

  const [busyAction, setBusyAction] = useState<string | null>(null)

  const [switchedTo, setSwitchedTo] = useState<string | null>(null)

  const [remoteInput, setRemoteInput] = useState('')
  const [showRemoteInput, setShowRemoteInput] = useState(false)

  const [diffFile, setDiffFile] = useState<string | null>(null)

  const [fileMenu, setFileMenu] = useState<{
    x: number
    y: number
    file: GitChangedFile
    staged: boolean
  } | null>(null)
  const [discardFileTarget, setDiscardFileTarget] = useState<GitChangedFile | null>(null)

  const [showMergeConflicts, setShowMergeConflicts] = useState(false)
  const [mergeActive, setMergeActive] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, type, message: truncateMessage(message) }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const [gitResult, setGitResult] = useState<{
    type: 'success' | 'error'
    title: string
    instructions: string
    rawError?: string
  } | null>(null)

  const showGitError = useCallback((message: string) => {
    const parsed = parseGitError(message)
    setGitResult({ type: 'error', ...parsed })
  }, [])

  const showGitSuccess = useCallback((title: string, instructions?: string) => {
    setGitResult({ type: 'success', title, instructions: instructions ?? '' })
  }, [])

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [confirmBranchDelete, setConfirmBranchDelete] = useState<string | null>(null)
  const [showRemoveRemoteConfirm, setShowRemoveRemoteConfirm] = useState(false)
  const [showStashPushConfirm, setShowStashPushConfirm] = useState(false)
  const [showPushConfirm, setShowPushConfirm] = useState(false)
  const [showForcePushConfirm, setShowForcePushConfirm] = useState(false)

  interface UndoEntry {
    id: number
    label: string
    undo: () => Promise<void>
    redo?: () => Promise<void>
  }
  const [undoHistory, setUndoHistory] = useState<UndoEntry[]>([])
  const [redoHistory, setRedoHistory] = useState<UndoEntry[]>([])
  const nextUndoIdRef = useRef(0)

  const pushUndo = useCallback((label: string, undo: () => Promise<void>, redo?: () => Promise<void>) => {
    setUndoHistory((prev) => [{ id: nextUndoIdRef.current++, label, undo, redo }, ...prev])
    setRedoHistory([])
  }, [])

  const handleUndo = async (entry: UndoEntry) => {
    setBusyAction('undo')
    try {
      await entry.undo()
      setRedoHistory((prev) => [entry, ...prev])
      setUndoHistory((prev) => prev.filter((e) => e.id !== entry.id))
      await refreshAll()
      onRefresh()
      window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
    } catch (e) {
      addToast('error', String(e))
    } finally {
      setBusyAction(null)
    }
  }

  const handleRedo = async (entry: UndoEntry) => {
    if (!entry.redo) return
    setBusyAction('redo')
    try {
      await entry.redo()
      setUndoHistory((prev) => [entry, ...prev])
      setRedoHistory((prev) => prev.filter((e) => e.id !== entry.id))
      await refreshAll()
      onRefresh()
      window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
    } catch (e) {
      addToast('error', String(e))
    } finally {
      setBusyAction(null)
    }
  }

  const isRepo = gitStatus?.is_repo ?? false

  const refreshAll = useCallback(async () => {
    try {
      const [entries, branchList, files, stashList] = await Promise.all([
        api.gitLogEntries(project.path).catch(() => [] as GitLogEntry[]),
        api.gitListBranches(project.path).catch(() => [] as GitBranchInfo[]),
        api.gitChangedFiles(project.path).catch(() => [] as GitChangedFile[]),
        api.gitStashList(project.path).catch(() => [] as GitStashEntry[]),
      ])
      setLogEntries(entries)
      setBranches(branchList)
      setChangedFiles(files)
      setStashes(stashList)
    } catch { /* fallback */ }
  }, [project.path])

  useEffect(() => {
    let cancelled = false
    api.getProjectName(project.path).then((name) => { if (!cancelled) setDisplayName(name) })
    return () => { cancelled = true }
  }, [project.path])

  useEffect(() => {
    let cancelled = false
    api.gitRemoteUrl(project.path).then((url) => { if (!cancelled) setRemoteUrl(url) })
      .catch(() => { if (!cancelled) setRemoteUrl(null) })
    return () => { cancelled = true }
  }, [project.path])

  useEffect(() => {
    if (!isRepo) return
    let cancelled = false
    api.gitIsMerging(project.path).then((merging) => {
      if (!cancelled) {
        setMergeActive(merging)
        if (merging) {
          api.gitMergeConflictFiles(project.path).then((files) => {
            if (!cancelled && files.length > 0) {
              setShowMergeConflicts(true)
            }
          }).catch(() => {})
        }
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [project.path, isRepo])

  useEffect(() => {
    if (!isRepo) {
      setLogLoading(false); setBranchesLoading(false); setChangesLoading(false); setStashesLoading(false)
      return
    }
    let cancelled = false
    setLogLoading(true); setBranchesLoading(true); setChangesLoading(true); setStashesLoading(true)
    Promise.all([
      api.gitLogEntries(project.path).then((e) => { if (!cancelled) { setLogEntries(e); setLogLoading(false) } }).catch(() => { if (!cancelled) setLogLoading(false) }),
      api.gitListBranches(project.path).then((b) => { if (!cancelled) { setBranches(b); setBranchesLoading(false) } }).catch(() => { if (!cancelled) setBranchesLoading(false) }),
      api.gitChangedFiles(project.path).then((f) => { if (!cancelled) { setChangedFiles(f); setChangesLoading(false) } }).catch(() => { if (!cancelled) setChangesLoading(false) }),
      api.gitStashList(project.path).then((s) => { if (!cancelled) { setStashes(s); setStashesLoading(false) } }).catch(() => { if (!cancelled) setStashesLoading(false) }),
    ])
    return () => { cancelled = true }
  }, [project.path, isRepo])

  const doAction = async (key: string, fn: () => Promise<unknown>): Promise<boolean> => {
    setBusyAction(key)
    try {
      await fn()
      await refreshAll()
      onRefresh()
      window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
      return true
    } catch (e) {
      const errStr = String(e)
      const lower = errStr.toLowerCase()
      if (lower.includes('merge conflict') || lower.includes('merge conflicts detected')) {
        const conflictFiles = await api.gitMergeConflictFiles(project.path).catch(() => [])
        if (conflictFiles.length > 0) {
          setShowMergeConflicts(true)
          setMergeActive(true)
          return false
        }
      }
      showGitError(errStr)
      return false
    } finally {
      setBusyAction(null)
    }
  }

  const handleAbortMerge = async () => {
    try {
      setBusyAction('abort-merge')
      await api.gitAbortMerge(project.path)
      setShowMergeConflicts(false)
      addToast('success', t('merge_aborted'))
      await refreshAll()
      onRefresh()
      window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
    } catch (e) {
      addToast('error', String(e))
    } finally {
      setBusyAction(null)
    }
  }

  const handleSwitchBranch = async (name: string) => {
    const prevBranch = currentBranch?.name
    const ok = await doAction(`switch:${name}`, async () => {
      await api.gitSwitchBranch(project.path, name)
      setSwitchedTo(name)
      setTimeout(() => setSwitchedTo(null), 2500)
    })
    if (ok && prevBranch && prevBranch !== name) {
      pushUndo(
        `Switch to "${name}"`,
        async () => { await api.gitSwitchBranch(project.path, prevBranch) },
        async () => { await api.gitSwitchBranch(project.path, name) },
      )
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return
    const branchName = newBranchName.trim()
    const ok = await doAction('create-branch', async () => {
      await api.gitCreateBranch(project.path, branchName)
      setNewBranchName(''); setShowCreateBranch(false)
    })
    if (ok) {
      pushUndo(
        `Create branch "${branchName}"`,
        async () => { await api.gitDeleteBranch(project.path, branchName) },
        async () => { await api.gitCreateBranch(project.path, branchName) },
      )
    }
  }

  const handleDeleteBranch = (name: string) => doAction(`delete:${name}`, () => api.gitDeleteBranch(project.path, name))
  const handleStashPush = () => doAction('stash-push', () => api.gitStashPush(project.path))
  const handleStashApply = (index: number) => doAction(`stash-apply:${index}`, () => api.gitStashApply(project.path, index))
  const handleStashDrop = (index: number) => doAction(`stash-drop:${index}`, () => api.gitStashDrop(project.path, index))
  const handleDiscardChanges = () =>
    doAction('discard', async () => {
      const stashResult = await api.gitStashPush(project.path)
      if (stashResult) {
        const match = stashResult.match(/stash@\{([^}]+)\}/)
        const stashLabel = match ? `stash@{${match[1]}}` : 'latest'
        addToast('info', t('git_stashed_to', { ns: 'common', label: stashLabel }))
      }
      await api.gitDiscardChanges(project.path)
    })
  const handleInit = () => doAction('init', async () => { await api.gitInit(project.path) })

  /** Stage every remaining change (VS Code: "Stage All Changes"). */
  const stageAllChanges = async (): Promise<boolean> => {
    if (unstagedFiles.length === 0) return true
    setBusyAction('stage-all')
    try {
      for (const f of unstagedFiles) {
        await api.gitStageFile(project.path, f.path)
      }
      await refreshAll()
      onRefresh()
      window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
      addToast('success', t('git_files_staged', { ns: 'common', count: unstagedFiles.length }))
      return true
    } catch (e) {
      showGitError(String(e))
      return false
    } finally {
      setBusyAction(null)
    }
  }

  /** Unstage every staged change (VS Code: "Unstage All Changes"). */
  const unstageAllChanges = async () => {
    if (gitStagedFiles.length === 0) return
    setBusyAction('unstage-all')
    try {
      for (const f of gitStagedFiles) {
        await api.gitUnstageFile(project.path, f.path)
      }
      await refreshAll()
      onRefresh()
      window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
      addToast('success', t('unstaged_all'))
    } catch (e) {
      showGitError(String(e))
    } finally {
      setBusyAction(null)
    }
  }

  /** Stage or unstage a single file directly from its row. */
  const quickStage = async (filePath: string, staged: boolean) => {
    setBusyAction(`quick:${filePath}`)
    try {
      if (staged) await api.gitUnstageFile(project.path, filePath)
      else await api.gitStageFile(project.path, filePath)
      await refreshAll()
      onRefresh()
      window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
    } catch (e) {
      showGitError(String(e))
    } finally {
      setBusyAction(null)
    }
  }

  const copyPath = async (filePath: string) => {
    try {
      await navigator.clipboard.writeText(filePath)
      addToast('success', t('path_copied'))
    } catch {
      addToast('error', t('path_copy_failed'))
    }
  }

  /** Discard a single file: stash it first (matching the all-files discard) so the change can be recovered. */
  const handleDiscardFile = async (f: GitChangedFile) => {
    setBusyAction(`discard:${f.path}`)
    try {
      await api.gitStashPush(project.path, [f.path])
      addToast('success', t('file_discarded', { file: f.path }))
      await refreshAll()
      onRefresh()
      window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
    } catch (e) {
      showGitError(String(e))
    } finally {
      setBusyAction(null)
    }
  }

  const buildFileMenuItems = (file: GitChangedFile, staged: boolean): ContextMenuSection[] => {
    const busy = busyAction !== null
    return [
      {
        label: t('view_diff'),
        icon: IconCode,
        onClick: () => setDiffFile(file.path),
        disabled: file.status.trim().includes('?'),
      },
      staged
        ? {
            label: t('unstage_file'),
            icon: IconX,
            onClick: () => quickStage(file.path, true),
            disabled: busy,
          }
        : {
            label: t('stage_file'),
            icon: IconPlus,
            onClick: () => quickStage(file.path, false),
            disabled: busy,
          },
      { type: 'separator' },
      {
        label: t('copy_path'),
        icon: IconCopy,
        onClick: () => copyPath(file.path),
      },
      {
        label: t('discard'),
        icon: IconTrash,
        variant: 'danger',
        onClick: () => setDiscardFileTarget(file),
        disabled: busy,
      },
    ]
  }

  /** Ctrl+Enter: stage everything first, then commit — but only if staging succeeded. */
  const handleCommitShortcut = async () => {
    if (busyAction !== null || !commitMessage.trim()) return
    if (needsStaging) {
      const ok = await stageAllChanges()
      if (!ok) return
    }
    await handleCommit()
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) return
    const msg = commitMessage.trim()
    setBusyAction('commit')
    try {
      const filesToStage = unstagedFiles.filter((f) => !f.status.trim().includes('?'))
      if (filesToStage.length > 0) {
        for (const f of filesToStage) {
          await api.gitStageFile(project.path, f.path)
        }
      }

      const result = await api.gitCommit(project.path, msg, amendMode)
      showGitSuccess(amendMode ? t('commit_amended') : t('committed'), result || t('committed_successfully'))

      if (!amendMode) {
        pushUndo(
          `Commit "${msg.length > 30 ? msg.slice(0, 30) + '…' : msg}"`,
          async () => { await api.gitUndoCommit(project.path) },
          async () => {
            await api.gitStageFile(project.path, '.')
            await api.gitCommit(project.path, msg, false)
          },
        )
      }

      if (pushAfterCommit && remoteUrl) {
        try {
          const pushResult = await api.gitPush(project.path)
          if (pushResult) showGitSuccess(t('pushed'), pushResult)
        } catch (e) {
          showGitError(`Push failed: ${e}`)
        }
      }

      setCommitMessage('')
      setAmendMode(false)
      setPushAfterCommit(false)
      await refreshAll()
      onRefresh()
      window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
    } catch (e) {
      showGitError(String(e))
    } finally {
      setBusyAction(null)
    }
  }

  const handleSetRemote = async () => {
    if (!remoteInput.trim()) return
    const newUrl = remoteInput.trim()
    const prevUrl = remoteUrl
    const ok = await doAction('set-remote', async () => {
      await api.gitSetRemote(project.path, newUrl)
      setRemoteUrl(newUrl)
      setRemoteInput('')
      setShowRemoteInput(false)
    })
    if (ok) {
      if (prevUrl) {
        pushUndo(
          `Set remote URL`,
          async () => { await api.gitSetRemote(project.path, prevUrl); setRemoteUrl(prevUrl) },
          async () => { await api.gitSetRemote(project.path, newUrl); setRemoteUrl(newUrl) },
        )
      } else {
        pushUndo(
          `Add remote URL`,
          async () => { await api.gitRemoveRemote(project.path); setRemoteUrl(null) },
          async () => { await api.gitSetRemote(project.path, newUrl); setRemoteUrl(newUrl) },
        )
      }
    }
  }

  const handleRemoveRemote = async () => {
    const removedUrl = remoteUrl
    const ok = await doAction('remove-remote', async () => {
      await api.gitRemoveRemote(project.path)
      setRemoteUrl(null)
    })
    if (ok && removedUrl) {
      pushUndo(
        `Remove remote`,
        async () => { await api.gitSetRemote(project.path, removedUrl); setRemoteUrl(removedUrl) },
        async () => { await api.gitRemoveRemote(project.path); setRemoteUrl(null) },
      )
    }
  }

  const handlePushAction = () => {
    if (changedFiles.length > 0) {
      setShowPushConfirm(true)
    } else {
      executePush(false)
    }
  }

  const executePush = async (force: boolean) => {
    await doAction(force ? 'force-push' : 'push', async () => {
      try {
        const r = force ? await api.gitPushForce(project.path) : await api.gitPush(project.path)
        if (r) showGitSuccess(force ? t('force_push_succeeded') : t('pushed'), r)
      } catch (e: unknown) {
        const errStr = String(e)
        if (!force && (errStr.toLowerCase().includes('non-fast-forward') || errStr.toLowerCase().includes('[rejected]') || errStr.toLowerCase().includes('failed to push'))) {
          addToast('info', t('push_rejected'))
          try {
            await api.gitPull(project.path)
            const retry = await api.gitPush(project.path)
            showGitSuccess(t('push_after_pull'), retry || t('changes_pushed'))
            return
          } catch (pullErr) {
            showGitError(`Pull then push failed: ${pullErr}`)
            throw pullErr
          }
        }
        throw e
      }
    })
  }

  const handleForcePush = () => setShowForcePushConfirm(true)

  const currentBranch = branches.find((b) => b.is_current)

  const isStaged = (f: GitChangedFile) =>
    f.status.length >= 2 && f.status[0] !== ' ' && f.status[0] !== '?'
  const isUnstaged = (f: GitChangedFile) =>
    f.status.startsWith('??') ||
    (f.status.length >= 2 ? f.status[1] !== ' ' : f.status.trim() !== '')
  const gitStagedFiles = changedFiles.filter(isStaged)
  const unstagedFiles = changedFiles.filter(isUnstaged)
  const needsStaging = unstagedFiles.length > 0

  const prevGroupCounts = useRef({ staged: 0, changes: 0 })
  useEffect(() => {
    if (gitStagedFiles.length > 0 && prevGroupCounts.current.staged === 0) {
      setCollapsedGroups((c) => (c.staged ? { ...c, staged: false } : c))
    }
    if (unstagedFiles.length > 0 && prevGroupCounts.current.changes === 0) {
      setCollapsedGroups((c) => (c.changes ? { ...c, changes: false } : c))
    }
    prevGroupCounts.current = { staged: gitStagedFiles.length, changes: unstagedFiles.length }
  }, [gitStagedFiles.length, unstagedFiles.length])

  const Skeleton = ({ className = 'h-7' }: { className?: string }) => (
    <div className={`${className} rounded-md bg-raised animate-pulse`} />
  )

  return (
    <div className="w-[380px] h-full flex flex-col overflow-hidden relative">
      
      <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <IconGitBranch className="w-4 h-4 text-accent-bright shrink-0" />
            <h3 className="font-display font-semibold truncate">{displayName ?? project.name}</h3>
            <Tooltip content={t('git_beta_tooltip', { ns: 'common' })} side="bottom">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('app:switch-tab', { detail: 4 }))}
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber/15 text-amber border border-amber/30 hover:bg-amber/25 hover:border-amber/50 cursor-pointer shrink-0 transition-colors"
              >
                {t('git_beta_badge', { ns: 'common' })}
              </button>
            </Tooltip>
          </div>
          {isRepo && currentBranch && (
            <p className="text-[11px] font-mono text-muted mt-0.5 truncate">
              {currentBranch.name}
              {changedFiles.length > 0 && <span className="ml-1.5 text-amber">· {changedFiles.length} {t('git_uncommitted', { ns: 'common' })}</span>}
            </p>
          )}
        </div>
        <button onClick={onClose} aria-label={t('close_sidebar')} className="focus-ring cursor-pointer p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors shrink-0">
          <IconX className="w-4 h-4" />
        </button>
      </div>

      {!isRepo ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <IconGitBranch className="w-10 h-10 text-muted/40" />
          <p className="text-sm text-muted">{t('git_not_repo', { ns: 'common' })}</p>
          <button disabled={busyAction === 'init'} onClick={handleInit}
            className="focus-ring cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition-colors">
            <IconFolderPlus className="w-3.5 h-3.5" />
            {busyAction === 'init' ? t('initializing') : t('init_repo')}
          </button>
        </div>
      ) : (
        <>
          
          <div className="flex items-center gap-2 px-5 py-3 border-b border-line shrink-0 flex-wrap">
            
            {mergeActive && !showMergeConflicts && (
              <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 mb-1">
                <IconAlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />
                <span className="flex-1 text-[11px] text-danger font-medium">{t('merge_in_progress')}</span>
                <button
                  onClick={() => setShowMergeConflicts(true)}
                  className="focus-ring cursor-pointer text-[10px] text-accent-bright hover:underline font-medium"
                >
                  {t('resolve')}
                </button>
                <button
                  onClick={handleAbortMerge}
                  disabled={busyAction !== null}
                  className="focus-ring cursor-pointer text-[10px] text-danger hover:underline disabled:opacity-40 font-medium"
                >
                  Abort
                </button>
              </div>
            )}
            <button disabled={busyAction !== null || showMergeConflicts}
              onClick={() => doAction('pull', async () => {
                const r = await api.gitPull(project.path)
                if (r) {
                  pushUndo(
                    `Pull`,
                    async () => { await api.gitUndoPull(project.path) },
                    async () => { const r2 = await api.gitPull(project.path); if (r2) addToast('info', r2) },
                  )
                  showGitSuccess(t('pull_complete'), r)
                }
              })}
              className={`focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-medium text-white transition-colors ${
                showMergeConflicts ? 'bg-danger/40 text-danger/60' : 'bg-accent hover:bg-accent-bright'
              }`}
              title={showMergeConflicts ? t('resolve_first') : t('pull_latest')}>
              <IconCloudArrowDown className="w-3 h-3" />{busyAction === 'pull' ? '…' : showMergeConflicts ? t('conflicts') : t('pull')}
            </button>
            <button onClick={handlePushAction} disabled={busyAction !== null}
              className="focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-medium text-white transition-colors">
              <IconArrowUpDown className="w-3 h-3" />{busyAction === 'push' ? '…' : t('push')}
            </button>
            <button disabled={busyAction !== null}
              onClick={handleForcePush}
              className="focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 hover:border-danger disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-medium transition-colors">
              <IconBomb className="w-3 h-3" />{busyAction === 'force-push' ? '…' : t('force_push')}
            </button>
            <button disabled={busyAction !== null}
              onClick={() => doAction('fetch', () => api.gitFetch(project.path))}
              className="focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-muted hover:text-ink hover:border-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-medium transition-colors">
              <IconRefresh className={`w-3 h-3 ${busyAction === 'fetch' ? 'animate-spin' : ''}`} />{busyAction === 'fetch' ? '…' : t('fetch')}
            </button>
            <button onClick={() => api.openTerminal(project.path)} title={t('git_open_in_terminal', { ns: 'common' })}
              className="focus-ring cursor-pointer px-2 py-0.5 rounded-lg border border-line text-muted hover:text-ink hover:border-accent-dim transition-colors">
              <IconTerminal className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            
            <div className="px-5 pt-4 pb-2 border-b border-line">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted/60">{t('remote_title')}</h4>
                <button onClick={() => setShowRemoteInput((v) => !v)}
                  className="focus-ring cursor-pointer text-[10px] text-accent-bright hover:underline transition-colors">
                  {remoteUrl ? t('change') : t('add_remote')}
                </button>
              </div>
              {showRemoteInput ? (
                <div className="flex items-center gap-1.5 mb-1">
                  <input type="text" value={remoteInput} onChange={(e) => setRemoteInput(e.target.value)}
                    placeholder={remoteUrl ? t('new_remote_url') : t('git_remote_placeholder', { ns: 'common' })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSetRemote(); if (e.key === 'Escape') setShowRemoteInput(false) }}
                    className="flex-1 focus-ring bg-base border border-line rounded-md px-2.5 py-1.5 text-xs text-ink placeholder:text-muted transition-colors focus:border-accent-dim outline-none" autoFocus />
                  <button onClick={handleSetRemote} disabled={busyAction !== null || !remoteInput.trim()}
                    className="focus-ring cursor-pointer p-1.5 rounded-md bg-accent hover:bg-accent-bright disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
                    <IconCheck className="w-3 h-3" />
                  </button>
                </div>
              ) : remoteUrl ? (
                <div className="flex items-center gap-1.5">
                  <span className="flex-1 text-[11px] font-mono text-muted truncate" title={remoteUrl}>{remoteUrl}</span>
                  <button onClick={() => setShowRemoveRemoteConfirm(true)} disabled={busyAction !== null} title={t('git_remove_remote', { ns: 'common' })}
                    className="focus-ring cursor-pointer p-1 rounded text-muted hover:text-danger transition-colors">
                    <IconTrash className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-muted/60 py-1">{t('git_no_remote', { ns: 'common' })}</p>
              )}
            </div>

            
            <div className="px-5 pt-4 pb-2 border-b border-line">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted/60">{t('branches_title', { ns: 'git' })}</h4>
                <button onClick={() => setShowCreateBranch((v) => !v)}
                  className="focus-ring cursor-pointer text-[10px] text-accent-bright hover:underline transition-colors">{t('new_branch_btn', { ns: 'git' })}</button>
              </div>
              {showCreateBranch && (
                <div className="flex items-center gap-1.5 mb-2">
                  <input type="text" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder={t('git_branch_name_placeholder', { ns: 'common' })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBranch(); if (e.key === 'Escape') setShowCreateBranch(false) }}
                    className="flex-1 focus-ring bg-base border border-line rounded-md px-2.5 py-1.5 text-xs text-ink placeholder:text-muted transition-colors focus:border-accent-dim outline-none" autoFocus />
                  <button onClick={handleCreateBranch} disabled={busyAction !== null || !newBranchName.trim()}
                    className="focus-ring cursor-pointer p-1.5 rounded-md bg-accent hover:bg-accent-bright disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
                    <IconCheck className="w-3 h-3" />
                  </button>
                </div>
              )}
              {branchesLoading ? (
                <div className="flex flex-col gap-1.5 py-1">
                  <Skeleton />
                  <Skeleton />
                  <Skeleton className="h-6" />
                </div>
              ) : branches.length === 0 ? (
                <p className="text-[11px] text-muted/60 py-2">No branches found.</p>
              ) : (
                <div className="flex flex-col gap-0.5 max-h-[150px] overflow-y-auto">
                  {branches.map((b) => (
                    <div key={b.name}
                      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${b.is_current ? 'bg-accent/10 text-ink' : 'hover:bg-raised text-muted'}`}>
                      <IconGitBranch className={`w-3 h-3 shrink-0 ${b.is_current ? 'text-accent-bright' : ''}`} />
                      <span className={`text-xs font-mono truncate flex-1 ${b.is_current ? 'font-medium' : ''}`}>{b.name}</span>
                      {b.is_current ? (
                        <span className="text-[9px] font-semibold uppercase transition-all duration-300"
                          style={{
                            color: switchedTo ? 'var(--color-mint, #34d399)' : 'var(--color-accent-bright)',
                          }}
                        >
                          {switchedTo === b.name ? t('switched') : t('active_branch')}
                        </span>
                      ) : (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleSwitchBranch(b.name)} disabled={busyAction !== null}
                            className="focus-ring cursor-pointer p-1 rounded text-muted hover:text-accent-bright hover:bg-raised disabled:opacity-40 transition-colors" title={`Switch to ${b.name}`}>
                            <IconCheck className="w-3 h-3" />
                          </button>
                          {b.name !== 'main' && b.name !== 'master' && (
                            <button onClick={() => setConfirmBranchDelete(b.name)} disabled={busyAction !== null}
                              className="focus-ring cursor-pointer p-1 rounded text-muted hover:text-danger hover:bg-raised disabled:opacity-40 transition-colors" title={`Delete ${b.name}`}>
                              <IconTrash className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            

            
            
            {(undoHistory.length > 0 || redoHistory.length > 0) && (
              <div className="px-5 pt-4 pb-3 border-b border-line">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted/60">Actions</h4>
                </div>
                <div className="flex flex-col gap-0.5">
                  {redoHistory.slice(0, 3).map((entry) => (
                    <button key={`redo-${entry.id}`}
                      onClick={() => handleRedo(entry)}
                      disabled={busyAction !== null}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md opacity-40 hover:opacity-100 hover:bg-raised transition-all disabled:opacity-20 disabled:cursor-not-allowed w-full text-left cursor-pointer">
                      <IconHistory className="w-3 h-3 text-muted shrink-0" />
                      <span className="text-[11px] text-muted truncate flex-1">{t('redo')} {entry.label}</span>
                    </button>
                  ))}
                  {undoHistory.slice(0, 5).map((entry) => (
                    <button key={`undo-${entry.id}`}
                      onClick={() => handleUndo(entry)}
                      disabled={busyAction !== null}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-raised transition-all disabled:opacity-40 disabled:cursor-not-allowed w-full text-left cursor-pointer group">
                      <IconHistory className="w-3 h-3 text-accent-bright shrink-0" />
                      <span className="text-[11px] text-muted truncate flex-1 group-hover:text-ink transition-colors">{entry.label}</span>
                      <span className="text-[9px] text-accent-bright font-semibold uppercase shrink-0">{t('undo')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            
            <div className="px-5 pt-4 pb-2 border-b border-line">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted/60">Stashes</h4>
              </div>
              {stashesLoading ? (
                <div className="flex flex-col gap-1.5 py-1">
                  <Skeleton className="h-6" />
                  <Skeleton className="h-6" />
                </div>
              ) : stashes.length === 0 ? (
                <p className="text-[11px] text-muted/60 py-2">No stashes.</p>
              ) : (
                <div className="flex flex-col gap-0.5 max-h-[120px] overflow-y-auto">
                  {stashes.map((s) => (
                    <div key={s.index} className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-raised transition-colors">
                      <IconHistory className="w-3 h-3 text-muted shrink-0" />
                      <span className="text-[11px] font-mono text-muted truncate flex-1">{s.message}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleStashApply(s.index)} disabled={busyAction !== null}
                          className="focus-ring cursor-pointer p-1 rounded text-muted hover:text-accent-bright transition-colors" title={t('git_apply_stash', { ns: 'common' })}><IconCheck className="w-3 h-3" /></button>
                        <button onClick={() => handleStashDrop(s.index)} disabled={busyAction !== null}
                          className="focus-ring cursor-pointer p-1 rounded text-muted hover:text-danger transition-colors" title={t('git_drop_stash', { ns: 'common' })}><IconTrash className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            
            <div className="px-5 pt-4 pb-2 border-b border-line">
              {changesLoading ? (
                <div className="flex flex-col gap-1.5 py-1">
                  <Skeleton />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                </div>
              ) : changedFiles.length === 0 ? (
                <p className="text-[11px] text-muted/60 py-2">{t('working_tree_clean')}</p>
              ) : (
                <div className="flex flex-col max-h-[260px] overflow-y-auto -mx-1 px-1">
                  {gitStagedFiles.length > 0 && (
                    <ChangeGroup
                      label={t('staged_changes')}
                      count={gitStagedFiles.length}
                      collapsed={collapsedGroups.staged}
                      onToggle={() => setCollapsedGroups((c) => ({ ...c, staged: !c.staged }))}
                      actions={[
                        {
                          icon: <IconX className="w-3 h-3" />,
                          title: t('unstage_all_changes'),
                          onClick: unstageAllChanges,
                          disabled: busyAction !== null,
                        },
                      ]}
                    >
                      {gitStagedFiles.map((f) => (
                        <FileRow
                          key={`staged-${f.path}`}
                          file={f}
                          staged
                          busy={busyAction !== null}
                          onDiff={() => setDiffFile(f.path)}
                          onToggleStage={() => quickStage(f.path, true)}
                          onDiscard={() => setDiscardFileTarget(f)}
                          onContextMenu={(x, y) => setFileMenu({ x, y, file: f, staged: true })}
                        />
                      ))}
                    </ChangeGroup>
                  )}
                  {unstagedFiles.length > 0 && (
                    <ChangeGroup
                      label={t('changes_title')}
                      count={unstagedFiles.length}
                      collapsed={collapsedGroups.changes}
                      onToggle={() => setCollapsedGroups((c) => ({ ...c, changes: !c.changes }))}
                      actions={[
                        {
                          icon: <IconPlus className="w-3 h-3" />,
                          title: t('stage_all_changes'),
                          onClick: stageAllChanges,
                          disabled: busyAction !== null,
                        },
                        {
                          icon: <IconTrash className="w-3 h-3" />,
                          title: t('discard_all_changes'),
                          onClick: () => setShowDiscardConfirm(true),
                          disabled: busyAction !== null,
                          danger: true,
                        },
                      ]}
                    >
                      {unstagedFiles.map((f) => (
                        <FileRow
                          key={`unstaged-${f.path}`}
                          file={f}
                          staged={false}
                          busy={busyAction !== null}
                          onDiff={() => setDiffFile(f.path)}
                          onToggleStage={() => quickStage(f.path, false)}
                          onDiscard={() => setDiscardFileTarget(f)}
                          onContextMenu={(x, y) => setFileMenu({ x, y, file: f, staged: false })}
                        />
                      ))}
                    </ChangeGroup>
                  )}
                </div>
              )}
              {changedFiles.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 pb-1">
                  <textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder={t('git_commit_placeholder', { ns: 'common' })}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && commitMessage.trim()) {
                        handleCommitShortcut()
                      }
                    }}
                    className="focus-ring w-full bg-base border border-line rounded-md px-3 py-2 text-xs text-ink placeholder:text-muted transition-colors focus:border-accent-dim outline-none resize-none"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => setAmendMode((v) => !v)}>
                      <Checkbox checked={amendMode} onChange={() => setAmendMode((v) => !v)} />
                      <span className="text-[10px] text-muted hover:text-ink transition-colors">{t('amend')}</span>
                    </label>
                    {remoteUrl && (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => setPushAfterCommit((v) => !v)}>
                        <Checkbox checked={pushAfterCommit} onChange={() => setPushAfterCommit((v) => !v)} />
                        <span className="text-[10px] text-muted hover:text-ink transition-colors">{t('push_after')}</span>
                      </label>
                    )}
                    <div className="flex-1" />
                    <span className="text-[10px] text-muted/60">Ctrl+Enter</span>
                    <button
                      disabled={busyAction !== null || !commitMessage.trim() || changedFiles.length === 0}
                      onClick={() => (needsStaging ? stageAllChanges() : handleCommit())}
                      title={needsStaging ? t('stage_all') : amendMode ? t('amend') : t('commit')}
                      className="focus-ring cursor-pointer flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-bright disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-white transition-colors"
                    >
                      {needsStaging && busyAction !== 'commit' ? (
                        <IconPlus className="w-3 h-3" />
                      ) : (
                        <IconCheck className="w-3 h-3" />
                      )}
                      {busyAction === 'stage-all'
                        ? t('staging')
                        : busyAction === 'commit'
                          ? (pushAfterCommit ? t('commit_push') : t('committing'))
                          : needsStaging
                            ? t('stage_all')
                            : (amendMode ? t('amend') : t('commit'))}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 pt-4 pb-4 border-b border-line">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                  {t('commits_title')}
                </h4>
                {!logLoading && logEntries.length > 0 && (
                  <span className="text-[9px] font-semibold text-muted/50">
                    {t('commits_count', { count: logEntries.length })}
                  </span>
                )}
              </div>
              {logLoading ? (
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ) : (
                <CommitGraph commits={logEntries} remoteUrl={remoteUrl} />
              )}
            </div>
          </div>
        </>
      )}

      
      <div className="absolute bottom-3 left-3 right-3 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl shadow-lg border text-xs max-w-full ${
                toast.type === 'success'
                  ? 'bg-mint/10 border-mint/30 text-mint'
                  : toast.type === 'error'
                  ? 'bg-danger/10 border-danger/30 text-danger'
                  : 'bg-accent/10 border-accent/30 text-accent-bright'
              }`}
            >
              {toast.type === 'success' ? (
                <IconCheckCircle className="w-4 h-4 shrink-0" />
              ) : toast.type === 'error' ? (
                <IconAlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <IconInfo className="w-4 h-4 shrink-0" />
              )}
              <span className="flex-1 min-w-0 truncate leading-snug">{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <IconX className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      
      {diffFile && (
        <DiffViewer
          projectPath={project.path}
          filePath={diffFile}
          onClose={() => setDiffFile(null)}
        />
      )}

      
      <AnimatePresence>
        {fileMenu && (
          <ContextMenu
            position={{ x: fileMenu.x, y: fileMenu.y }}
            onClose={() => setFileMenu(null)}
            items={buildFileMenuItems(fileMenu.file, fileMenu.staged)}
          />
        )}
      </AnimatePresence>

      
      <AnimatePresence>
        {discardFileTarget && (
          <ConfirmDialog
            title={t('discard_file_title', { file: discardFileTarget.path })}
            description={t('discard_file_desc')}
            confirmLabel={t('discard')}
            variant="danger"
            onConfirm={() => { const f = discardFileTarget; setDiscardFileTarget(null); handleDiscardFile(f) }}
            onCancel={() => setDiscardFileTarget(null)}
          />
        )}
      </AnimatePresence>

      
      <AnimatePresence>
        {showDiscardConfirm && (
          <ConfirmDialog
            title={t('discard_title')}
            description={t('discard_desc')}
            confirmLabel={t('discard')}
            variant="danger"
            onConfirm={() => { setShowDiscardConfirm(false); handleDiscardChanges() }}
            onCancel={() => setShowDiscardConfirm(false)}
          />
        )}
      </AnimatePresence>

      
      <AnimatePresence>
        {confirmBranchDelete && (
          <ConfirmDialog
            title={t('delete_branch_title', { name: confirmBranchDelete })}
            description={t('delete_branch_desc')}
            confirmLabel={t('delete')}
            variant="danger"
            onConfirm={() => { const name = confirmBranchDelete; setConfirmBranchDelete(null); handleDeleteBranch(name) }}
            onCancel={() => setConfirmBranchDelete(null)}
          />
        )}
      </AnimatePresence>

      
      <AnimatePresence>
        {showRemoveRemoteConfirm && (
          <ConfirmDialog
            title={t('remove_remote_title')}
            description={t('remove_remote_desc')}
            confirmLabel={t('remove')}
            variant="danger"
            onConfirm={() => { setShowRemoveRemoteConfirm(false); handleRemoveRemote() }}
            onCancel={() => setShowRemoveRemoteConfirm(false)}
          />
        )}
      </AnimatePresence>

      
      <AnimatePresence>
        {showStashPushConfirm && (
          <ConfirmDialog
            title={t('git_stash_title', { ns: 'common' })}
            description={t('git_stash_desc', { ns: 'common' })}
            confirmLabel={t('git_stash_confirm', { ns: 'common' })}
            onConfirm={() => { setShowStashPushConfirm(false); handleStashPush() }}
            onCancel={() => setShowStashPushConfirm(false)}
          />
        )}
      </AnimatePresence>

      
      <AnimatePresence>
        {showPushConfirm && (
          <ConfirmDialog
            title={t('git_push_uncommitted_title', { ns: 'common' })}
            description={t('git_push_uncommitted_desc', { ns: 'common' })}
            confirmLabel={t('git_push_uncommitted_confirm', { ns: 'common' })}
            variant="default"
            onConfirm={() => { setShowPushConfirm(false); executePush(false) }}
            onCancel={() => setShowPushConfirm(false)}
          />
        )}
      </AnimatePresence>

      
      <AnimatePresence>
        {showForcePushConfirm && (
          <ConfirmDialog
            title={t('git_force_push_title', { ns: 'common' })}
            description={t('git_force_push_desc', { ns: 'common' })}
            confirmLabel={t('git_force_push_confirm', { ns: 'common' })}
            variant="danger"
            onConfirm={() => { setShowForcePushConfirm(false); executePush(true) }}
            onCancel={() => setShowForcePushConfirm(false)}
          />
        )}
      </AnimatePresence>

      
      <AnimatePresence>
        {gitResult && !showMergeConflicts && (
          <GitResultDialog
            type={gitResult.type}
            title={gitResult.title}
            instructions={gitResult.instructions}
            rawError={gitResult.rawError}
            onClose={() => setGitResult(null)}
            onOpenTerminal={() => api.openTerminal(project.path)}
          />
        )}
      </AnimatePresence>

      
      <AnimatePresence>
        {showMergeConflicts && (
          <MergeConflictDialog
            projectPath={project.path}
            onClose={() => setShowMergeConflicts(false)}
            onAllResolved={async () => {
              setShowMergeConflicts(false)
              setMergeActive(false)
              await refreshAll()
              onRefresh()
              window.dispatchEvent(new CustomEvent('app:refresh-git-status'))
              addToast('success', t('conflicts_resolved'))
            }}
            onOpenTerminal={() => api.openTerminal(project.path)}
            onAbortMerge={handleAbortMerge}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
