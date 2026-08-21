import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Masonry from 'react-masonry-css'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  closestCorners,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useProjectsContext } from '../../../hooks/projectsContext'
import { useCategoriesContext } from '../../../hooks/categoriesContext'
import { useSettings } from '../../../hooks/useSettings'
import { useTaskTray } from '../../../hooks/useTaskTray'
import { ProjectCard } from '../components/cards/ProjectCard'
import { Tooltip } from '../components/reusables/Tooltip'
import { CreateProjectModal } from '../components/modals/CreateProjectModal'
import { CloneRepoModal } from '../components/modals/CloneRepoModal'
import { CategoryManagerModal } from '../components/modals/CategoryManagerModal'
import { ConfirmDialog } from '../components/modals/ConfirmDialog'
import { ProjectPropertiesModal } from '../components/modals/ProjectPropertiesModal'
import { TagManagerModal } from '../components/modals/TagManagerModal'
import { Dropdown } from '../components/ui/Dropdown'
import { api } from '../../../lib/api'
import { consumePendingAction } from '../../../lib/pendingAction'
import { isReducedMotion, applyNewUi } from '../../../lib/appearance'
import {
  IconFolderPlus,
  IconGitBranch,
  IconImport,
  IconNode,
  IconPalette,
  IconPin,
  IconSearch,
  IconX,
  IconTags,
  IconRefresh,
  IconChevronDown,
  IconArrowUpDown,
  IconLayoutGrid,
  IconLayoutList,
} from '../lib/Icons'
import {
  comparatorFor,
  SORT_OPTIONS,
  type ProjectSortOption,
} from '../../../lib/projectSort'
import type { GitStatus, Project } from '../../../types'
import { useGodotVersionsContext } from '../../../hooks/godotVersionsContext'

const UNCATEGORIZED = '__uncategorized__'
const SORT_BY_KEY = 'godothub_projects_sort_by'
const VIEW_MODE_KEY = 'godothub_projects_view_mode'
const UI_NOTICE_KEY = 'ui_rewrite_notice_v2_dismissed'

type ViewMode = 'list' | 'grid'

type ZoneKind = 'category' | 'pinned' | 'flat'

const kindOfZone = (zoneKey: string): ZoneKind =>
  zoneKey === '__pinned__'
    ? 'pinned'
    : zoneKey === '__flat__'
      ? 'flat'
      : 'category'

function SortableProjectCard({
  project,
  disabled,
  ...cardProps
}: {
  project: Project
  disabled: boolean
} & Omit<
  React.ComponentProps<typeof ProjectCard>,
  'project' | 'setNodeRef' | 'style' | 'dragHandleProps' | 'isDragging'
>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    disabled,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
      <ProjectCard
        project={project}
        setNodeRef={setNodeRef}
        style={style}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        {...cardProps}
      />
  )
}


export function ProjectsView({
  onShowGitSidebar,
}: {
  onShowGitSidebar?: (project: Project, gitStatus: GitStatus | null) => void
}) {
  const { t } = useTranslation('common')

  const [noticeDismissed, setNoticeDismissed] = useState(() => {
    try {
      return localStorage.getItem(UI_NOTICE_KEY) === '1'
    } catch {
      return false
    }
  })

  const dismissNotice = () => {
    setNoticeDismissed(true)
    try {
      localStorage.setItem(UI_NOTICE_KEY, '1')
    } catch {}
  }

  useEffect(() => {
    const handler = () => setNoticeDismissed(false)
    window.addEventListener('app:show-ui-notice', handler)
    return () => window.removeEventListener('app:show-ui-notice', handler)
  }, [])

  const {
    projects,
    loaded,
    refresh,
    remove,
    updateVersion,
    setPinned,
    setCategory,
    moveProject,
    reorder,
  } = useProjectsContext()
  const {
    categories,
    create: createCategory,
    update: updateCategory,
    remove: removeCategory,
    reorder: reorderCategories,
  } = useCategoriesContext()
  const { installed } = useGodotVersionsContext()
  const { settings, update: updateSettings } = useSettings()
  const { registerTask, updateTask, unregisterTask } = useTaskTray()
  const categoriesEnabled = settings.categories_enabled
  const [modalOpen, setModalOpen] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [cloneRepoOpen, setCloneRepoOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overContainer, setOverContainer] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<ProjectSortOption>(
    () => {
      try {
        const raw = localStorage.getItem(SORT_BY_KEY)
        if (raw && raw !== 'categories') return raw as ProjectSortOption
      } catch {}
      return 'recent'
    },
  )
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const raw = localStorage.getItem(VIEW_MODE_KEY)
      if (raw === 'list' || raw === 'grid') return raw
    } catch {}
    return 'list'
  })
  const [sortNow, setSortNow] = useState(() => Date.now())
  useEffect(() => {
    if (sortBy !== 'time_desc') return
    if (!projects.some((p) => p.session_started_at_ms)) return
    setSortNow(Date.now())
    const id = setInterval(() => setSortNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [sortBy, projects])
  const contentRef = useRef<HTMLDivElement>(null)
  const [gridCols, setGridCols] = useState(3)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const compute = () => {
      const cs = getComputedStyle(el)
      const padX =
        parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0')
      const w = Math.max(0, el.clientWidth - padX)
      setGridCols(w >= 1300 ? 4 : w >= 950 ? 3 : w >= 620 ? 2 : 1)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [gitStatusMap, setGitStatusMap] = useState<Record<string, GitStatus>>({})
  const fetchingGitRef = useRef(false)

  const [propertiesProject, setPropertiesProject] = useState<Project | null>(null)
  const [tagManagerProject, setTagManagerProject] = useState<Project | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastClickedIdRef = useRef<string | null>(null)
  const [confirmBatchRemove, setConfirmBatchRemove] = useState(false)
  const [confirmBatchPin, setConfirmBatchPin] = useState(false)
  const [confirmBatchVersion, setConfirmBatchVersion] = useState<string | null>(null)
  const [confirmBatchCategory, setConfirmBatchCategory] = useState<string | null>(null)
  const [undoBatchData, setUndoBatchData] = useState<{ paths: string[] } | null>(null)
  const undoBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [importDropdownOpen, setImportDropdownOpen] = useState(false)
  const importDropdownRef = useRef<HTMLDivElement>(null)
  const [foundDismissed, setFoundDismissed] = useState<string[] | null>(null)

  const handleImport = async () => {
    const folder = await api.pickFolder()
    if (!folder) return
    setImporting(true)
    const taskId = `import-project-${Date.now()}`
    registerTask({
      id: taskId,
      type: 'import-projects',
      label: t('importing_project'),
      description: folder,
      progress: null,
      status: 'running',
    })
    try {
      await api.importProject(folder, '')
      refresh()
      updateTask(taskId, { status: 'completed' })
      setTimeout(() => unregisterTask(taskId), 3000)
    } catch (e) {
      alert(e)
      updateTask(taskId, { status: 'error', errorMessage: String(e) })
      setTimeout(() => unregisterTask(taskId), 6000)
    } finally {
      setImporting(false)
    }
  }

  const handleCloneResult = (projectId: string) => {
    setCloneRepoOpen(false)
    refresh()
    setTimeout(() => {
      const el = document.getElementById(`project-${projectId}`)
      if (!el) return
      el.scrollIntoView({ behavior: isReducedMotion() ? 'auto' : 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-accent', 'rounded-xl')
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-accent', 'rounded-xl')
      }, 2000)
    }, 200)
  }

  const openScanFolderSetting = () => {
    window.dispatchEvent(
      new CustomEvent('app:open-setting', { detail: 'project_scan_dirs' }),
    )
  }

  const handleScanNow = async () => {
    if (scanning) return
    if (!settings.project_scan_dirs.length) {
      openScanFolderSetting()
      return
    }
    setScanning(true)
    try {
      const result = await api.scanForProjectsWithInfo(
        settings.project_scan_dirs,
        settings.scan_depth,
      )
      if (result.found_dismissed.length > 0) {
        setFoundDismissed(result.found_dismissed)
      }
    } finally {
      setScanning(false)
    }
  }

  const handleReaddDismissed = async () => {
    if (!foundDismissed) return
    const paths = foundDismissed
    setFoundDismissed(null)
    await api.reintroduceDismissedProjects(paths)
    await refresh()
  }

  const handleSkipDismissed = () => {
    setFoundDismissed(null)
  }

  const importRef = useRef(handleImport)
  importRef.current = handleImport
  const scanRef = useRef(handleScanNow)
  scanRef.current = handleScanNow

  useEffect(() => {
    const handleScrollToProject = (e: Event) => {
      const projectId = (e as CustomEvent).detail as string
      if (!projectId) return

      setTimeout(() => {
        const el = document.getElementById(`project-${projectId}`)
        if (!el) return

        el.scrollIntoView({ behavior: isReducedMotion() ? 'auto' : 'smooth', block: 'center' })

        el.classList.add('ring-2', 'ring-accent', 'rounded-xl')
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-accent', 'rounded-xl')
        }, 2000)
      }, 150)
    }

    window.addEventListener('app:scroll-to-project', handleScrollToProject)
    return () =>
      window.removeEventListener(
        'app:scroll-to-project',
        handleScrollToProject,
      )
  }, [])

  useEffect(() => {
    const pending = consumePendingAction()
    if (pending === 'new-project') setModalOpen(true)
    else if (pending === 'import-project') importRef.current()
    else if (pending === 'scan-projects') scanRef.current()

    const handleNewProject = () => setModalOpen(true)
    const handleImportProject = () => importRef.current()
    const handleScanProjects = () => scanRef.current()
    window.addEventListener('app:new-project', handleNewProject)
    window.addEventListener('app:import-project', handleImportProject)
    window.addEventListener('app:scan-projects', handleScanProjects)
    return () => {
      window.removeEventListener('app:new-project', handleNewProject)
      window.removeEventListener('app:import-project', handleImportProject)
      window.removeEventListener('app:scan-projects', handleScanProjects)
    }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(e.target as Node)) {
        setImportDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allVisibleIdsRef = useRef<string[]>([])

  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    lastClickedIdRef.current = id
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
    lastClickedIdRef.current = null
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeId) {
          setActiveId(null)
          setOverContainer(null)
        }
        if (selectedIdsRef.current.size > 0) {
          handleClearSelection()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeId, handleClearSelection])

  const isSearching = query.trim().length > 0
  const dragDisabled = isSearching

  const availableCategories = useMemo(
    () => [...categories.map((c) => c.name), UNCATEGORIZED],
    [categories],
  )

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q),
    )
  }, [projects, query])

  const cmp = comparatorFor(sortBy, sortNow)

  const sortProjects = useCallback(
    (list: Project[]) => {
      if (cmp) return [...list].sort(cmp)
      return [...list].sort((a, b) => a.sort_order - b.sort_order)
    },
    [cmp],
  )

  const pinned = useMemo(() => {
    return sortProjects(filteredProjects.filter((p) => p.pinned))
  }, [filteredProjects, sortProjects])



  const flatList = useMemo(() => {
    return sortProjects(filteredProjects)
  }, [filteredProjects, sortProjects])

  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  )

  const sourceContainers = useMemo(() => {
    return {
      __pinned__: pinned.map((p) => p.id),
      __flat__: flatList.map((p) => p.id),
    }
  }, [pinned, flatList])

  const [containers, setContainers] = useState<Record<string, string[]>>(
    () => sourceContainers,
  )
  useEffect(() => {
    if (!activeId) setContainers(sourceContainers)
  }, [sourceContainers])

  useMemo(() => {
    const ids: string[] = []
    for (const list of Object.values(containers)) {
      ids.push(...list)
    }
    allVisibleIdsRef.current = ids
  }, [containers])



  useEffect(() => {
    try {
      localStorage.setItem(SORT_BY_KEY, sortBy)
    } catch {}
  }, [sortBy])

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode)
    } catch {}
  }, [viewMode])

  const draggedProject = activeId ? (projectsById.get(activeId) ?? null) : null
  const canDropInZone = (kind: ZoneKind) =>
    draggedProject
      ? kind === 'pinned'
        ? draggedProject.pinned
        : !draggedProject.pinned
      : false

  const findContainer = (id: string): string | undefined =>
    id in containers
      ? id
      : Object.keys(containers).find((key) => containers[key].includes(id))

  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    if (viewMode === 'grid') {
      const rectCollisions = rectIntersection(args)
      if (rectCollisions.length > 0) return rectCollisions
    }
    return closestCorners(args)
  }, [viewMode])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string)
    const container = findContainer(e.active.id as string)
    setOverContainer(container ?? null)
  }

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) {
      setOverContainer(null)
      return
    }
    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string)
    setOverContainer(overContainer ?? null)
    if (
      !activeContainer ||
      !overContainer ||
      activeContainer === overContainer ||
      !canDropInZone(kindOfZone(overContainer))
    )
      return
    setContainers((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const activeIndex = activeItems.indexOf(active.id as string)
      if (activeIndex === -1) return prev
      const overIndex = overItems.indexOf(over.id as string)
      const newIndex = overIndex >= 0 ? overIndex : overItems.length
      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== active.id),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          active.id as string,
          ...overItems.slice(newIndex),
        ],
      }
    })
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    setOverContainer(null)
    if (!over) return
    const id = active.id as string
    const activeContainer = findContainer(id)
    const overContainer = findContainer(over.id as string)
    if (!activeContainer || !overContainer || activeContainer !== overContainer)
      return

    let finalItems = containers[activeContainer]
    const oldIndex = finalItems.indexOf(id)
    const newIndex = finalItems.indexOf(over.id as string)
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      finalItems = arrayMove(finalItems, oldIndex, newIndex)
      setContainers((prev) => ({ ...prev, [activeContainer]: finalItems }))
    }

    const kind = kindOfZone(activeContainer)
    if (kind === 'category') {
      const dragged = projectsById.get(id)
      const draggedZoneKey = dragged?.category ?? UNCATEGORIZED
      if (draggedZoneKey !== activeContainer) {
        await moveProject(
          id,
          activeContainer === UNCATEGORIZED ? '' : activeContainer,
          finalItems,
        )
        return
      }
    }
    await reorder(finalItems)
  }

  const projectsRef = useRef(projects)
  projectsRef.current = projects

  const fetchGitStatuses = useCallback(async () => {
    if (fetchingGitRef.current) return
    if (document.visibilityState === 'hidden') return
    const list = projectsRef.current
    if (list.length === 0) return
    fetchingGitRef.current = true
    try {
      const paths = list.map((p) => p.path)
      const statuses = await api.batchGitStatus(paths)
      setGitStatusMap((prev) => {
        const prevKeys = Object.keys(prev)
        const nextKeys = Object.keys(statuses)
        if (prevKeys.length !== nextKeys.length) return statuses
        for (const k of nextKeys) {
          const a = prev[k]
          const b = statuses[k]
          if (!a || a.branch !== b.branch || a.has_uncommitted !== b.has_uncommitted || a.is_repo !== b.is_repo) {
            return statuses
          }
        }
        return prev
      })
    } catch {
    } finally {
      fetchingGitRef.current = false
    }
  }, [])

  const projectPathsKey = projects.map((p) => p.path).join('\u0000')

  useEffect(() => {
    fetchGitStatuses()
    const interval = setInterval(fetchGitStatuses, 30000)

    const handleRefresh = () => fetchGitStatuses()
    window.addEventListener('app:refresh-git-status', handleRefresh)

    return () => {
      clearInterval(interval)
      window.removeEventListener('app:refresh-git-status', handleRefresh)
    }
  }, [fetchGitStatuses, projectPathsKey])

  const handleLaunchArgsChange = useCallback(async (id: string, args: string) => {
    await api.updateProject(id, { launch_arguments: args })
    await refresh()
  }, [refresh])

  const handleGitAction = useCallback(
    async (id: string, action: 'terminal' | 'pull' | 'push' | 'fetch' | 'log') => {
      const project = projects.find((p) => p.id === id)
      if (!project) return
      try {
        if (action === 'terminal') {
          await api.openTerminal(project.path)
        } else if (action === 'pull') {
          const result = await api.gitPull(project.path)
          alert(result || t('pull_completed'))
          setTimeout(fetchGitStatuses, 2000)
        } else if (action === 'push') {
          const result = await api.gitPush(project.path)
          alert(result || t('push_completed'))
          setTimeout(fetchGitStatuses, 2000)
        } else if (action === 'fetch') {
          await api.gitFetch(project.path)
          setTimeout(fetchGitStatuses, 2000)
        } else if (action === 'log') {
          await api.gitLog(project.path)
        }
      } catch (e) {
        alert(String(e))
      }
    },
    [projects, fetchGitStatuses],
  )

  const selectedCount = selectedIds.size

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(allVisibleIdsRef.current))
    lastClickedIdRef.current = null
  }, [])

  const handleBatchPin = useCallback(() => {
    if (selectedCount === 0) return
    setConfirmBatchPin(true)
  }, [selectedCount])

  const executeBatchPin = useCallback(async () => {
    setConfirmBatchPin(false)
    const allPinned = [...selectedIds].every((id) => projectsById.get(id)?.pinned)
    for (const id of selectedIds) {
      await setPinned(id, !allPinned)
    }
    handleClearSelection()
  }, [selectedIds, projectsById, setPinned, handleClearSelection])

  const handleBatchVersionChange = useCallback(
    (tag: string) => {
      if (selectedCount === 0) return
      setConfirmBatchVersion(tag)
    },
    [selectedCount],
  )

  const executeBatchVersionChange = useCallback(
    async () => {
      const tag = confirmBatchVersion
      setConfirmBatchVersion(null)
      if (!tag) return
      for (const id of selectedIds) {
        await updateVersion(id, tag)
      }
      handleClearSelection()
    },
    [confirmBatchVersion, selectedIds, updateVersion, handleClearSelection],
  )

  const handleBatchCategoryChange = useCallback(
    (category: string) => {
      if (selectedCount === 0) return
      setConfirmBatchCategory(category)
    },
    [selectedCount],
  )

  const executeBatchCategoryChange = useCallback(
    async () => {
      const category = confirmBatchCategory
      setConfirmBatchCategory(null)
      if (category == null) return
      for (const id of selectedIds) {
        await setCategory(id, category)
      }
      handleClearSelection()
    },
    [confirmBatchCategory, selectedIds, setCategory, handleClearSelection],
  )

  const handleBatchRemove = useCallback(() => {
    if (selectedCount === 0) return
    setConfirmBatchRemove(true)
  }, [selectedCount])

  const executeBatchRemove = useCallback(async () => {
    setConfirmBatchRemove(false)
    const removedPaths: string[] = []
    for (const id of selectedIds) {
      const project = projectsById.get(id)
      if (project) removedPaths.push(project.path)
      await remove(id, false)
    }
    handleClearSelection()
    if (undoBatchTimerRef.current) clearTimeout(undoBatchTimerRef.current)
    setUndoBatchData({ paths: removedPaths })
    undoBatchTimerRef.current = setTimeout(() => setUndoBatchData(null), 5000)
  }, [selectedIds, projectsById, remove, handleClearSelection])

  const handleUndoBatchRemove = useCallback(async () => {
    if (!undoBatchData) return
    const data = undoBatchData
    setUndoBatchData(null)
    for (const path of data.paths) {
      try {
        await api.importProject(path, '')
      } catch {}
    }
    refresh()
  }, [undoBatchData, refresh])

  const hasAnyProjects = projects.length > 0
  const hasVisibleProjects = filteredProjects.length > 0

  const renderGridSection = (ids: string[], zoneKey: string) => (
    <div className={activeId && overContainer === zoneKey ? 'bg-accent/5 rounded-xl ring-1 ring-accent/20 -mx-2 px-2 transition-colors duration-150' : ''}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <Masonry
          breakpointCols={gridCols}
          className="masonry"
          columnClassName="masonry-column"
        >
          {ids.map((id) => {
            const entry = projectsById.get(id)
            if (!entry) return null
            return (
              <div key={id} id={`project-${entry.id}`} className="rounded-xl">
                <SortableProjectCard
                  project={entry}
                  variant="grid"
                  disabled={dragDisabled}
                  installedVersions={installed}
                  categories={categories}
                  categoriesEnabled={categoriesEnabled}
                  launchWithConsole={settings.launch_with_console}
                  onRemove={() => remove(entry.id, false)}
                  onDelete={() => remove(entry.id, true)}
                  onVersionChange={(tag) => updateVersion(entry.id, tag)}
                  onCategoryChange={(category) => setCategory(entry.id, category)}
                  onTogglePin={() => setPinned(entry.id, !entry.pinned)}
                  onLaunchArgsChange={(args) => handleLaunchArgsChange(entry.id, args)}
                  gitStatus={gitStatusMap[entry.path] ?? null}
                  onGitAction={(action) => handleGitAction(entry.id, action)}
                  onOpenProperties={() => setPropertiesProject(entry)}
                  onManageTags={() => setTagManagerProject(entry)}
                  onTagsSaved={() => refresh()}
                  onShowGitSidebar={() => onShowGitSidebar?.(entry, gitStatusMap[entry.path] ?? null)}
                  draggable={!dragDisabled}
                  selected={selectedIds.has(entry.id)}
                  onToggleSelect={() => toggleSelect(entry.id)}
                  lastOpenedTimeFormat={settings.last_opened_time_format}
                  lastOpenedDateFormat={settings.last_opened_date_format}
                />
              </div>
            )
          })}
        </Masonry>
      </SortableContext>
    </div>
  )

  const renderCards = (zoneKey: string) => {
    const ids = containers[zoneKey] ?? []
    if (viewMode === 'grid') {
      return renderGridSection(ids, zoneKey)
    }
    return (
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={`flex flex-col gap-3 min-h-[8px] ${activeId ? '' : 'project-list-cv'}`}>
          <AnimatePresence initial={false}>
            {ids.map((id) => {
              const entry = projectsById.get(id)
              if (!entry) return null
              return (
                <motion.div
                  layout={activeId ? 'position' : false}
                  key={id}
                  id={`project-${entry.id}`}
                  transition={{ duration: 0.18 }}
                >
                  <SortableProjectCard
                    project={entry}
                    disabled={dragDisabled}
                    installedVersions={installed}
                    categories={categories}
                    categoriesEnabled={categoriesEnabled}
                    launchWithConsole={settings.launch_with_console}
                    onRemove={() => remove(entry.id, false)}
                    onDelete={() => remove(entry.id, true)}
                    onVersionChange={(tag) => updateVersion(entry.id, tag)}
                    onCategoryChange={(category) => setCategory(entry.id, category)}
                    onTogglePin={() => setPinned(entry.id, !entry.pinned)}
                    onLaunchArgsChange={(args) => handleLaunchArgsChange(entry.id, args)}
                    gitStatus={gitStatusMap[entry.path] ?? null}
                    onGitAction={(action) => handleGitAction(entry.id, action)}
                    onOpenProperties={() => setPropertiesProject(entry)}
                    onManageTags={() => setTagManagerProject(entry)}
                    onTagsSaved={() => refresh()}
                    onShowGitSidebar={() => onShowGitSidebar?.(entry, gitStatusMap[entry.path] ?? null)}
                    draggable={!dragDisabled}
                    selected={selectedIds.has(entry.id)}
                    onToggleSelect={() => toggleSelect(entry.id)}
                    lastOpenedTimeFormat={settings.last_opened_time_format}
                    lastOpenedDateFormat={settings.last_opened_date_format}
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </SortableContext>
    )
  }

  return (
    <div ref={contentRef} className="p-10 pt-6 max-w-8xl mx-auto">
      <AnimatePresence initial={false}>
        {!noticeDismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="relative overflow-hidden rounded-2xl border border-accent-dim/40 bg-linear-to-br from-raised via-surface to-accent-dim/10 px-6 py-5 pr-12">
              <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
              <div className="relative flex items-start gap-4">
                <span className="w-11 h-11 shrink-0 rounded-xl bg-accent/15 border border-accent-dim/40 flex items-center justify-center">
                  <IconPalette className="w-5 h-5 text-accent-bright" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-ink">
                    {t('ui_rewrite_title')}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted max-w-3xl">
                    {t('ui_rewrite_body')}
                  </p>
                  <button
                    onClick={() => {
                      applyNewUi(true)
                      updateSettings({ ...settings, new_ui: true })
                    }}
                    className="focus-ring cursor-pointer mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-bright text-sm font-medium text-white transition-colors"
                  >
                    {t('ui_rewrite_switch')}
                  </button>
                </div>
              </div>
              <button
                onClick={dismissNotice}
                aria-label={t('dismiss')}
                title={t('dismiss')}
                className="focus-ring cursor-pointer absolute top-3 right-3 p-1.5 rounded-md text-muted/50 hover:text-ink hover:bg-raised transition-colors"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-body font-semibold text-3xl tracking-tight">
            {t('projects_title')}
          </h2>
          <p className="text-xs text-muted">
            {t('project_count', { count: projects.length })}
            {isSearching && (
              <> · {t('showing_count', { count: filteredProjects.length })}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setModalOpen(true)}
            className="focus-ring flex cursor-pointer items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-bright text-sm font-medium text-white transition-colors"
          >
            <span className="icon-wiggle inline-flex">
              <IconFolderPlus className="w-4 h-4" />
            </span>
            {t('new_project')}
          </motion.button>

          <div ref={importDropdownRef} className="relative flex">
            <div className="flex rounded-lg border border-line">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleImport}
                disabled={scanning || importing}
                className="focus-ring cursor-pointer flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-r border-line"
              >
                <span className="icon-wiggle inline-flex">
                  <IconImport className="w-4 h-4" />
                </span>
                {t('import')}
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setImportDropdownOpen((prev) => !prev)}
                className="focus-ring cursor-pointer px-2 py-2.5 text-muted hover:text-ink transition-colors"
                aria-label={t('more_import_options')}
              >
                <IconChevronDown className={`w-3 h-3 transition-transform duration-200 ${importDropdownOpen ? 'rotate-180 text-accent' : ''}`} />
              </motion.button>
            </div>
            <AnimatePresence>
              {importDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 top-full z-30 mt-2 min-w-44 rounded-xl border border-line bg-surface shadow-2xl shadow-black/40 p-1.5 origin-top"
                >
                  <button
                    type="button"
                    onClick={() => { setImportDropdownOpen(false); setCloneRepoOpen(true) }}
                    className="w-full flex items-center cursor-pointer gap-2.5 px-5 py-2 rounded-lg text-xs font-medium text-ink hover:bg-raised transition-colors"
                  >
                    <IconGitBranch className="w-4 h-4 text-muted" />
                    {t('clone_import_repo')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Tooltip content={scanning ? t('scanning') : t('scan_for_projects')} side="bottom">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleScanNow}
              disabled={scanning}
              className="focus-ring cursor-pointer p-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-muted hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconRefresh className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            </motion.button>
          </Tooltip>

          {categoriesEnabled && (
            <Tooltip content={t('manage_categories')} side="bottom">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setCategoryModalOpen(true)}
                className="focus-ring cursor-pointer p-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-muted hover:text-ink transition-colors"
                aria-label={t('manage_categories')}
              >
                <IconTags className="w-4 h-4" />
              </motion.button>
            </Tooltip>
          )}
        </div>
      </div>

      {hasAnyProjects && (
        <div className="flex items-center gap-3 mb-8">
          <div className="relative flex-1">
            <IconSearch
              fill="none"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_projects_placeholder')}
              className="focus-ring w-full bg-surface border border-line rounded-lg pl-9 pr-9 py-2.5 text-sm text-ink placeholder:text-muted transition-colors focus:border-accent-dim"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('clear_search')}
                className="focus-ring cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-ink hover:bg-raised transition-colors"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center rounded-lg border border-line bg-surface p-0.5 gap-0.5 shrink-0">
            <Tooltip content={t('view_list')}>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => setViewMode('list')}
                aria-label={t('view_list')}
                aria-pressed={viewMode === 'list'}
                className={`focus-ring cursor-pointer p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-raised text-ink shadow-sm'
                    : 'text-muted hover:text-ink hover:bg-raised/60'
                }`}
              >
                <IconLayoutList className="w-3.5 h-3.5" />
              </motion.button>
            </Tooltip>
            <div className="relative">
              <Tooltip content={t('view_grid')}>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setViewMode('grid')}
                  aria-label={t('view_grid')}
                  aria-pressed={viewMode === 'grid'}
                  className={`focus-ring cursor-pointer p-1.5 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-raised text-ink shadow-sm'
                      : 'text-muted hover:text-ink hover:bg-raised/60'
                  }`}
                >
                  <IconLayoutGrid className="w-3.5 h-3.5" />
                </motion.button>
              </Tooltip>
              {viewMode === 'grid' && (
                <span className="pointer-events-none absolute -top-1.5 -right-1.5 z-10 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber/15 text-amber border border-amber/30">
                  {t('git_beta_badge')}
                </span>
              )}
            </div>
          </div>

          <div className="h-5 w-px bg-line/60 shrink-0" />

          <div className="flex items-center gap-1.5 shrink-0">
            <IconArrowUpDown className="w-3.5 h-3.5 text-muted shrink-0" />
            <Dropdown
              className="w-44"
              value={sortBy}
              onChange={(v) => setSortBy((v || 'recent') as ProjectSortOption)}
              emptyLabel={t('sort')}
              options={SORT_OPTIONS.map((opt) => ({ ...opt, label: t(opt.labelKey) }))}
            />
          </div>
        </div>
      )}

      {!loaded ? (
        <div className="border border-dashed border-line rounded-2xl py-24 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-raised border border-line flex items-center justify-center">
            <IconRefresh className="w-5 h-5 text-muted animate-spin" />
          </div>
          <p className="text-sm text-muted max-w-xs leading-relaxed">
            {t('loading_projects')}
          </p>
        </div>
      ) : !hasAnyProjects ? (
        <div className="border border-dashed border-line rounded-2xl py-24 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-raised border border-line flex items-center justify-center">
            <IconNode className="w-5 h-5 text-muted" />
          </div>
          <p className="text-sm text-muted max-w-xs leading-relaxed">
            {settings.project_scan_dirs.length === 0
              ? t('no_scan_folders_yet')
              : t('no_projects_yet')}
          </p>
          {settings.project_scan_dirs.length === 0 && (
            <button
              onClick={openScanFolderSetting}
              className="focus-ring cursor-pointer px-4 py-2 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors"
            >
              {t('add_scan_folder')}
            </button>
          )}
        </div>
      ) : !hasVisibleProjects ? (
        <div className="border border-dashed border-line rounded-2xl py-24 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-raised border border-line flex items-center justify-center">
            <IconSearch fill="none" className="w-5 h-5 text-muted" />
          </div>
          <p className="text-sm text-muted max-w-xs leading-relaxed">
            {t('no_projects_match')} &ldquo;{query.trim()}&rdquo;.
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">

        <motion.div
          key="list"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={(e) => {
            handleDragStart(e)
            handleClearSelection()
          }}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveId(null)
            setOverContainer(null)
            setContainers(sourceContainers)
          }}
        >
          <div className="flex flex-col gap-8">
            {(containers.__pinned__?.length ?? 0) > 0 && (() => {
              const pinnedIds = containers.__pinned__!
              const isOverPinned = overContainer === '__pinned__'
              return (
                <section className={activeId ? (isOverPinned ? 'relative' : 'opacity-60') : ''}>
                  <div className="flex items-center gap-2 mb-4">
                    <IconPin
                      className="w-3.5 h-3.5 text-accent-bright"
                      fill="currentColor"
                    />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {t('pinned_section')}
                    </h3>
                    {activeId && isOverPinned && (
                      <span className="ml-1 text-[10px] font-medium text-accent animate-pulse">
                        {t('drop_here_animated')}
                      </span>
                    )}
                  </div>
                  {viewMode === 'grid' ? (
                    renderGridSection(pinnedIds, '__pinned__')
                  ) : (
                    <SortableContext items={pinnedIds} strategy={verticalListSortingStrategy}>
                    <div className={`flex flex-col gap-3 min-h-[8px] rounded-xl transition-colors duration-150 ${activeId ? '' : 'project-list-cv'} ${activeId && isOverPinned ? 'bg-accent/5 ring-1 ring-accent/20 -mx-2 px-2 py-2' : ''}`}>
                      <AnimatePresence initial={false}>
                        {pinnedIds.map((id) => {
                          const entry = projectsById.get(id)
                          if (!entry) return null
                          return (
                            <motion.div
                              layout={activeId ? 'position' : false}
                              key={id}
                              transition={{ duration: 0.18 }}
                            >
                              <SortableProjectCard
                                project={entry}
                                disabled={dragDisabled}
                                installedVersions={installed}
                                categories={categories}
                                categoriesEnabled={categoriesEnabled}
                                launchWithConsole={settings.launch_with_console}
                                onRemove={() => remove(entry.id, false)}
                                onDelete={() => remove(entry.id, true)}
                                onVersionChange={(tag) => updateVersion(entry.id, tag)}
                                onCategoryChange={(category) => setCategory(entry.id, category)}
                                onTogglePin={() => setPinned(entry.id, !entry.pinned)}
                                onLaunchArgsChange={(args) => handleLaunchArgsChange(entry.id, args)}
                                gitStatus={gitStatusMap[entry.path] ?? null}
                                onGitAction={(action) => handleGitAction(entry.id, action)}
                                onOpenProperties={() => setPropertiesProject(entry)}
                                onManageTags={() => setTagManagerProject(entry)}
                                onShowGitSidebar={() => onShowGitSidebar?.(entry, gitStatusMap[entry.path] ?? null)}
                                draggable={!dragDisabled}
                                selected={selectedIds.has(entry.id)}
                                onToggleSelect={() => toggleSelect(entry.id)}
                                lastOpenedTimeFormat={settings.last_opened_time_format}
                                lastOpenedDateFormat={settings.last_opened_date_format}
                              />
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                    </SortableContext>
                  )}
                </section>
              )
            })()}

            <section>
                <div className={activeId && overContainer === '__flat__' ? 'bg-accent/5 rounded-xl ring-1 ring-accent/20 -mx-2 px-2 py-2 transition-colors duration-150' : ''}>
                  {renderCards('__flat__')}
                </div>
              </section>
          </div>

          <DragOverlay
            dropAnimation={{
              duration: isReducedMotion() ? 0 : 300,
              easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            style={{
              cursor: 'grabbing',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
            }}
          >
            {draggedProject ? (
              <ProjectCard
                project={draggedProject}
                variant={viewMode}
                installedVersions={installed}
                categories={categories}
                categoriesEnabled={categoriesEnabled}
                launchWithConsole={settings.launch_with_console}
                onRemove={() => {}}
                onDelete={() => {}}
                onVersionChange={() => {}}
                onCategoryChange={() => {}}
                onTogglePin={() => {}}
                onLaunchArgsChange={() => {}}
                onGitAction={() => {}}
                onOpenProperties={() => {}}
                onShowGitSidebar={() => {}}
                draggable
                lastOpenedTimeFormat={settings.last_opened_time_format}
                lastOpenedDateFormat={settings.last_opened_date_format}
              />
            ) : null}
          </DragOverlay>          </DndContext>
        </motion.div>
      </AnimatePresence>
      )}

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
              onClick={() => {
                const allSelected = selectedIds.size === allVisibleIdsRef.current.length && allVisibleIdsRef.current.length > 0
                if (allSelected) {
                  handleClearSelection()
                } else {
                  handleSelectAll()
                }
              }}
              className="focus-ring cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-ink hover:bg-raised transition-colors"
              aria-label={selectedIds.size === allVisibleIdsRef.current.length && allVisibleIdsRef.current.length > 0 ? t('deselect_all') : t('select_all')}
            >
              {selectedIds.size === allVisibleIdsRef.current.length && allVisibleIdsRef.current.length > 0 ? t('deselect_all') : t('select_all')}
            </motion.button>

            <div className="h-5 w-px bg-line/60" />

            <Tooltip content={selectedIds.size === 1 ? t('toggle_pin') : t('pin_unpin_all')} side="top">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleBatchPin}
                className="focus-ring cursor-pointer p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors"
                aria-label={t('toggle_pin')}
              >
                <IconPin className="w-3.5 h-3.5" fill="none" />
              </motion.button>
            </Tooltip>

            <Dropdown
              className="w-44"
              value=""
              onChange={(tag) => tag && handleBatchVersionChange(tag)}
              emptyLabel={t('set_version')}
              openUp
              options={installed.map((v) => ({
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
                  handleBatchCategoryChange(resolved)
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
              onClick={handleBatchRemove}
              className="focus-ring cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              aria-label={t('remove_selected')}
            >
              {t('remove_selected')}
            </motion.button>

            <div className="h-5 w-px bg-line/60" />

            <Tooltip content={t('clear_selection')} side="top">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleClearSelection}
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
            onConfirm={executeBatchRemove}
            onCancel={() => setConfirmBatchRemove(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmBatchPin && (
          <ConfirmDialog
            title={selectedCount === 1 ? t('pin_unpin_title_one', { count: selectedCount }) : t('pin_unpin_title_other', { count: selectedCount })}
            description={t('pin_unpin_desc', { action: [...selectedIds].every((id) => projectsById.get(id)?.pinned) ? 'unpin' : 'pin' })}
            confirmLabel={t('confirm')}
            variant="default"
            onConfirm={executeBatchPin}
            onCancel={() => setConfirmBatchPin(false)}
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
            onConfirm={executeBatchVersionChange}
            onCancel={() => setConfirmBatchVersion(null)}
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
            onConfirm={executeBatchCategoryChange}
            onCancel={() => setConfirmBatchCategory(null)}
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
              onClick={handleUndoBatchRemove}
              className="focus-ring cursor-pointer shrink-0 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent-bright text-xs font-semibold hover:bg-accent/20 transition-colors"
            >
              {t('undo')}
            </motion.button>
            <Tooltip content={t('dismiss')} side="bottom">
              <button
                onClick={() => setUndoBatchData(null)}
                className="focus-ring cursor-pointer shrink-0 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors"
                aria-label={t('dismiss')}
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {foundDismissed && (
          <ConfirmDialog
            title={t('found_dismissed_title', { count: foundDismissed.length })}
            description={
              <div className="flex flex-col gap-2">
                <p>{t('found_dismissed_desc', { count: foundDismissed.length })}</p>
                <ul className="flex flex-wrap gap-1.5 mt-1">
                  {foundDismissed.map((p) => (
                    <li
                      key={p}
                      className="text-xs px-2 py-1 rounded-md bg-raised border border-line/50 text-muted truncate max-w-48"
                    >
                      {p.split(/[\\/]/).pop()}
                    </li>
                  ))}
                </ul>
              </div>
            }
            confirmLabel={t('readd_all')}
            cancelLabel={t('skip_all')}
            variant="default"
            onConfirm={handleReaddDismissed}
            onCancel={handleSkipDismissed}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cloneRepoOpen && (
          <CloneRepoModal
            defaultLocation={settings.default_project_location}
            categories={categories}
            onClose={() => setCloneRepoOpen(false)}
            onCloned={handleCloneResult}
          />
        )}
      </AnimatePresence>

      {modalOpen && (
        <CreateProjectModal
          installedVersions={installed}
          defaultLocation={settings.default_project_location}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false)
            refresh()
          }}
        />
      )}

      <AnimatePresence>
        {propertiesProject && (
          <ProjectPropertiesModal
            project={propertiesProject}
            onClose={() => setPropertiesProject(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tagManagerProject && (
          <TagManagerModal
            project={tagManagerProject}
            onClose={() => setTagManagerProject(null)}
            onSaved={() => refresh()}
          />
        )}
      </AnimatePresence>

      {categoryModalOpen && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => { setCategoryModalOpen(false); refresh() }}
          onCreate={createCategory}
          onUpdate={updateCategory}
          onDelete={async (id) => {
            await removeCategory(id)
            refresh()
          }}
          onReorder={reorderCategories}
        />
      )}
    </div>
  )
}
