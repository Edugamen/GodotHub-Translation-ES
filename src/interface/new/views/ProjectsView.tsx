import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { AnimatedNumber } from '../components/reusables/AnimatedNumber'
import { useProjectsContext } from '../../../hooks/projectsContext'
import { useGodotVersionsContext } from '../../../hooks/godotVersionsContext'
import { useCategoriesContext } from '../../../hooks/categoriesContext'
import {
  IconArrowUpDown,
  IconCheck,
  IconChevronDown,
  IconFilter,
  IconGitBranch,
  IconPin,
  IconPlay,
  IconPlus,
  IconTags,
  IconTrash,
  IconX,
} from '../lib/icons'
import { tagColor } from '../../../lib/colors'
import { Dropdown } from '../components/ui/Dropdown'
import { ImportButton } from '../components/reusables/ImportButton'
import { OverlayScrollArea } from '../components/reusables/OverlayScrollArea'
import { Tooltip } from '../components/reusables/Tooltip'
import { ProjectCard } from '../components/cards/ProjectCard'
import { ProjectCardList } from '../components/cards/ProjectCardList'
import { useSettings } from '../../../hooks/useSettings'
import { useScrollCompensation } from '../hooks/useScrollCompensation'
import { api } from '../../../lib/api'
import type { GitStatus } from '../../../types'
import {
  comparatorFor,
  SORT_OPTIONS,
  type ProjectSortOption,
} from '../../../lib/projectSort'
import { ScanButton } from '../components/reusables/ScanButton'
import { SearchBar } from '../components/ui/SearchBar'
import { ViewHeader } from '../components/reusables/ViewHeader'
import { CreateProjectModal } from '../components/modals/CreateProjectModal'
import { CloneRepoModal } from '../components/modals/CloneRepoModal'
import { CategoryManagerModal } from '../components/modals/CategoryManagerModal'
import { ConfirmDialog } from '../components/modals/ConfirmDialog'

export function ProjectsView({
  onOpenSettings,
  connected = false,
}: {
  onOpenSettings?: () => void
  connected?: boolean
}) {
  const { t } = useTranslation('nav')
  const { t: tc } = useTranslation('common')

  const {
    projects,
    refresh,
    remove,
    updateVersion,
    setPinned,
    setCategory,
    updateTags,
  } = useProjectsContext()
  const {
    categories,
    create: createCategory,
    update: updateCategory,
    remove: removeCategory,
    reorder: reorderCategories,
  } = useCategoriesContext()
  const { installed } = useGodotVersionsContext()
  const { settings } = useSettings()
  const categoriesEnabled = settings.categories_enabled
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [cloneRepoOpen, setCloneRepoOpen] = useState(false)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(id)
  }, [query])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selecting, setSelecting] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta' || e.key === 'Shift') {
        setSelecting(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta' || e.key === 'Shift') {
        setSelecting(false)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const [confirmBatchAction, setConfirmBatchAction] = useState<
    'remove' | 'delete' | null
  >(null)
  const [tagFilter, setTagFilter] = useState<string | null>(() => {
    try {
      const raw = sessionStorage.getItem('godothub_projects_tag_filter')
      if (raw) return raw
    } catch {}
    return null
  })

  const sortOptions = SORT_OPTIONS.filter(
    (opt) => categoriesEnabled || opt.value !== 'categories',
  )
  const [sortBy, setSortBy] = useState<ProjectSortOption>(() => {
    try {
      const raw = localStorage.getItem('godothub_projects_sort_by')
      if (raw) return raw as ProjectSortOption
    } catch {}
    return 'categories'
  })
  const [categoryFilter, setCategoryFilter] = useState<string | null>(() => {
    try {
      const raw = sessionStorage.getItem('godothub_projects_category_filter')
      if (raw === '__uncategorized__') return ''
      if (raw) return raw
    } catch {}
    return null
  })
  const [sortNow, setSortNow] = useState(() => Date.now())
  useEffect(() => {
    if (sortBy !== 'time_desc') return
    if (!projects.some((p) => p.session_started_at_ms)) return
    setSortNow(Date.now())
    const id = setInterval(() => setSortNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [sortBy, projects])
  const [gitStatusMap, setGitStatusMap] = useState<Record<string, GitStatus>>({})
  const fetchingGitRef = useRef(false)
  const { viewportRef, restoreScroll } = useScrollCompensation()
  const pinnedSignature = useMemo(
    () => projects.filter((p) => p.pinned).map((p) => p.id).join(','),
    [projects],
  )
  useLayoutEffect(() => {
    restoreScroll()
  }, [pinnedSignature, tagFilter, restoreScroll])
  const projectsRef = useRef(projects)
  projectsRef.current = projects
  const projectPathsKey = useMemo(
    () => projects.map((p) => p.path).join('|'),
    [projects],
  )

  const fetchGitStatuses = useCallback(async () => {
    if (fetchingGitRef.current) return
    const list = projectsRef.current
    if (list.length === 0) return
    fetchingGitRef.current = true
    try {
      const statuses = await api.batchGitStatus(list.map((p) => p.path))
      setGitStatusMap(statuses)
    } catch {
    } finally {
      fetchingGitRef.current = false
    }
  }, [])

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

  useEffect(() => {
    try {
      localStorage.setItem('godothub_projects_sort_by', sortBy)
    } catch {}
  }, [sortBy])

  useEffect(() => {
    try {
      if (tagFilter) {
        sessionStorage.setItem('godothub_projects_tag_filter', tagFilter)
      } else {
        sessionStorage.removeItem('godothub_projects_tag_filter')
      }
    } catch {}
  }, [tagFilter])

  useEffect(() => {
    try {
      if (categoryFilter) {
        sessionStorage.setItem('godothub_projects_category_filter', categoryFilter)
      } else if (categoryFilter === '') {
        sessionStorage.setItem('godothub_projects_category_filter', '__uncategorized__')
      } else {
        sessionStorage.removeItem('godothub_projects_category_filter')
      }
    } catch {}
  }, [categoryFilter])

  useEffect(() => {
    try {
      localStorage.removeItem('godothub_projects_tag_filter')
      sessionStorage.removeItem('godothub_projects_category_filter')
    } catch {}
  }, [])

  useEffect(() => {
    if (!sortOptions.some((opt) => opt.value === sortBy)) {
      setSortBy(sortOptions[0]?.value ?? 'name_asc')
    }
  }, [sortBy])

  useEffect(() => {
    if (tagFilter && !projects.some((p) => p.tags.includes(tagFilter))) {
      setTagFilter(null)
    }
  }, [projects, tagFilter])

  useEffect(() => {
    if (!categoriesEnabled && categoryFilter !== null) {
      setCategoryFilter(null)
    }
  }, [categoriesEnabled, categoryFilter])

  useEffect(() => {
    if (categoryFilter === null || categoryFilter === '') return
    if (!categories.some((c) => c.name === categoryFilter)) {
      setCategoryFilter(null)
    }
  }, [categories, categoryFilter])

  const baseFiltered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    let list = projects
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q),
      )
    }
    if (tagFilter) {
      list = list.filter((p) => p.tags.includes(tagFilter))
    }
    return list
  }, [projects, debouncedQuery, tagFilter])

  const filtered = useMemo(() => {
    let list = baseFiltered
    if (categoryFilter) {
      list = list.filter((p) => (p.category ?? '') === categoryFilter)
    } else if (categoryFilter === '') {
      list = list.filter((p) => !p.category)
    }
    const cmp = comparatorFor(sortBy, sortNow)
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (a.pinned) return a.name.localeCompare(b.name)
      return cmp ? cmp(a, b) : a.sort_order - b.sort_order
    })
  }, [baseFiltered, sortBy, categoryFilter, sortNow])

  const hasActiveFilters =
    query.trim() !== '' || tagFilter !== null || categoryFilter !== null

  const lastClickedIndexRef = useRef<number | null>(null)

  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    const clickedIndex = filtered.findIndex((p) => p.id === id)

    if (e?.shiftKey && lastClickedIndexRef.current !== null) {
      const start = Math.min(lastClickedIndexRef.current, clickedIndex)
      const end = Math.max(lastClickedIndexRef.current, clickedIndex)
      const rangeIds = filtered.slice(start, end + 1).map((p) => p.id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const rid of rangeIds) next.add(rid)
        return next
      })
    } else if (e?.ctrlKey || e?.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    }
    lastClickedIndexRef.current = clickedIndex
  }, [filtered])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    lastClickedIndexRef.current = null
  }, [])

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const p of filtered) next.delete(p.id)
      } else {
        for (const p of filtered) next.add(p.id)
      }
      return next
    })
  }, [allVisibleSelected, filtered])

  const batchLaunch = useCallback(() => {
    for (const id of selectedIds) {
      window.dispatchEvent(
        new CustomEvent('app:open-project', {
          detail: { id, console: settings.launch_with_console },
        }),
      )
    }
    clearSelection()
  }, [selectedIds, settings.launch_with_console, clearSelection])

  const batchPin = useCallback(() => {
    const ids = [...selectedIds]
    const allPinned = ids.every(
      (id) => projects.find((p) => p.id === id)?.pinned,
    )
    for (const id of ids) setPinned(id, !allPinned)
    clearSelection()
  }, [selectedIds, projects, setPinned, clearSelection])

  const executeBatchRemove = useCallback(async () => {
    setConfirmBatchAction(null)
    for (const id of selectedIds) await remove(id, false)
    clearSelection()
  }, [selectedIds, remove, clearSelection])

  const executeBatchDelete = useCallback(async () => {
    setConfirmBatchAction(null)
    for (const id of selectedIds) await remove(id, true)
    clearSelection()
  }, [selectedIds, remove, clearSelection])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) clearSelection()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIds.size, clearSelection])

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      <div className="shrink-0 flex flex-col gap-2">
      <ViewHeader
        connected={connected}
        title={t('projects')}
        leadingAction={
          <motion.button
            type="button"
            aria-label={t('new_project')}
            onClick={() => setCreateProjectOpen(true)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="w-9 h-9 cursor-pointer flex items-center justify-center rounded-full bg-accent text-ink hover:bg-accent-bright transition-colors"
          >
            <IconPlus className="w-10 h-10" strokeWidth={3} />
          </motion.button>
        }
        metric={
          <>
            <h2 className="text-4xl font-bold text-muted">
              <AnimatedNumber value={filtered.length} />
            </h2>
            <p className="text-lg font-medium uppercase text-muted">
              {t('projects')}
            </p>
          </>
        }
        actions={
          <>
            <ImportButton
              onImport={async (folder) => {
                await api.importProject(folder, '')
                await refresh()
              }}
              options={[
                {
                  key: 'clone-repo',
                  label: tc('clone_import_repo'),
                  icon: IconGitBranch,
                  onClick: () => setCloneRepoOpen(true),
                },
              ]}
            />
            <ScanButton
              onOpenSettings={onOpenSettings}
              scanDirs={settings.project_scan_dirs}
              scan={() =>
                api.scanForProjectsWithInfo(
                  settings.project_scan_dirs,
                  settings.scan_depth,
                )
              }
              onComplete={() => refresh().catch(() => {})}
              onReadd={(paths) =>
                api
                  .reintroduceDismissedProjects(paths)
                  .then(() => refresh().catch(() => {}))
              }
            />
            {categoriesEnabled && (
              <Tooltip content={tc('manage_categories')} side="top">
                <button
                  type="button"
                  aria-label={tc('manage_categories')}
                  onClick={() => setCategoryManagerOpen(true)}
                  className="focus-ring cursor-pointer w-10 h-10 flex items-center justify-center rounded-item bg-overlay text-muted hover:text-ink hover:bg-raised transition-colors shadow-md shadow-black/10 border border-outline/50"
                >
                  <IconTags className="w-5 h-5" />
                </button>
              </Tooltip>
            )}
          </>
        }
      >
        <SearchBar value={query} onChange={setQuery} />
      </ViewHeader>

      <div className="shrink-0 flex items-center gap-2 mb-3">
        <Dropdown
          align="left"
          trigger={({ open, toggle }) => (
            <motion.button
              type="button"
              aria-expanded={open}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={toggle}
              className="focus-ring cursor-pointer flex items-center justify-center gap-1 h-8 px-4 rounded-item bg-overlay text-muted hover:text-ink hover:bg-raised transition-colors"
            >
              <IconArrowUpDown className="w-3 h-3 text-muted" />
              <span className="text-[16px] font-medium">
                {tc('sort')}
              </span>
            </motion.button>
          )}
          items={sortOptions.map((opt) => ({
            key: opt.value,
            label: tc(opt.labelKey),
            active: opt.value === sortBy,
            onClick: () => setSortBy(opt.value),
          }))}
        />

          {categoriesEnabled && (
            <Dropdown
              align="left"
              trigger={({ open, toggle }) => {
                const hasCategoryFilter = categoryFilter !== null
                const activeLabel =
                  categoryFilter === ''
                    ? tc('uncategorized')
                    : categoryFilter
                return (
                  <motion.button
                    type="button"
                    aria-expanded={open}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={toggle}
                    className={`focus-ring cursor-pointer flex items-center justify-center gap-1 h-8 px-4 rounded-item transition-colors ${
                      hasCategoryFilter
                        ? 'bg-accent/15 text-accent-bright ring-1 ring-accent-dim/70'
                        : 'bg-overlay text-muted hover:text-ink hover:bg-raised'
                    }`}
                  >
                    <IconFilter className="w-3 h-3" />
                    <span className="text-[16px] font-medium">{tc('filter')}</span>
                    {hasCategoryFilter && (
                      <span className="text-[12px] tabular-nums text-muted/80 max-w-30 truncate">
                        {activeLabel}
                      </span>
                    )}
                  </motion.button>
                )
              }}
              items={[
                {
                  key: 'filter-all',
                  label: tc('no_filter'),
                  active: categoryFilter === null,
                  onClick: () => setCategoryFilter(null),
                },
                {
                  key: 'filter-uncategorized',
                  label: tc('uncategorized'),
                  active: categoryFilter === '',
                  dotColor: '#949ba4',
                  onClick: () => setCategoryFilter(''),
                },
                ...categories.map((cat) => ({
                  key: `filter-${cat.id}`,
                  label: cat.name,
                  active: categoryFilter === cat.name,
                  dotColor: cat.color,
                  onClick: () => setCategoryFilter(cat.name),
                })),
              ]}
            />
          )}

        {tagFilter && (
          <Tooltip content={tc('clear_tag_filter')} side="top">
            <button
              type="button"
              onClick={() => setTagFilter(null)}
              className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-item bg-accent/15 text-accent-bright ring-1 ring-accent-dim/70 hover:bg-accent/25 transition-colors"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: tagColor(tagFilter) }}
              />
              <span className="text-[16px] font-medium">{tagFilter}</span>
              <IconX className="w-3 h-3" />
            </button>
          </Tooltip>
        )}

      </div>
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-item bg-accent/10 border border-accent-dim/40">
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                aria-label={tc('select_all_visible')}
                className={`focus-ring cursor-pointer w-5 h-5 rounded-item border-2 flex items-center justify-center transition-colors ${
                  allVisibleSelected
                    ? 'bg-accent border-accent text-white'
                    : 'border-muted/40 text-transparent hover:border-accent/60'
                }`}
              >
                <IconCheck className="w-3 h-3" />
              </button>
              <span className="text-sm font-medium text-ink tabular-nums">
                {tc('selected_count', { count: selectedIds.size })}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={batchLaunch}
                className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-btn bg-accent text-ink hover:bg-accent-bright transition-colors"
              >
                <IconPlay className="w-3 h-3" />
                <span className="text-xs font-medium">{tc('bulk_launch')}</span>
              </button>
              <button
                type="button"
                onClick={batchPin}
                className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-btn bg-raised text-muted hover:text-ink hover:bg-overlay transition-colors"
              >
                <IconPin className="w-3 h-3" />
                <span className="text-xs font-medium">
                  {tc('bulk_pin')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmBatchAction('remove')}
                className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-btn bg-raised text-muted hover:text-ink hover:bg-overlay transition-colors"
              >
                <IconX className="w-3 h-3" />
                <span className="text-xs font-medium">
                  {tc('bulk_remove')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmBatchAction('delete')}
                className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-btn bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
              >
                <IconTrash className="w-3 h-3" />
                <span className="text-xs font-medium">
                  {tc('bulk_delete')}
                </span>
              </button>
              <button
                type="button"
                onClick={clearSelection}
                aria-label={tc('clear_selection')}
                className="focus-ring cursor-pointer w-8 h-8 rounded-btn flex items-center justify-center text-muted hover:text-ink hover:bg-overlay transition-colors"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <OverlayScrollArea
        className={`flex-1 min-w-0 ${connected ? '' : '-mr-4 -mb-4'}`}
        hideThumb={!settings.show_scrollbars}
        scrollToTopOn={tagFilter}
        scrollRef={viewportRef}
      >
        <div
          className={`h-full ${connected ? 'pl-5' : ''} pr-5 pb-4 flex flex-col gap-2`}
        >
        {sortBy === 'categories' ? (
        <CategorySections
          filtered={filtered}
          categories={categories}
          uncategorizedLabel={tc('uncategorized')}
          installedVersions={installed}
          gitStatusMap={gitStatusMap}
          launchWithConsole={settings.launch_with_console}
          allCategories={categories}
          onSetCategory={(id, cat) => setCategory(id, cat)}
          onTogglePin={setPinned}
          onRemove={remove}
          onDelete={remove}
          onUpdateVersion={updateVersion}
          onTagsSaved={updateTags}
          onTagClick={(tag) => setTagFilter((cur) => (cur === tag ? null : tag))}
          onShowGitSidebar={(project) =>
            window.dispatchEvent(
              new CustomEvent('app:show-git-sidebar', {
                detail: { project, gitStatus: gitStatusMap[project.path] ?? null },
              }),
            )
          }
          selectedIds={selectedIds}
          selecting={selecting}
          onToggleSelect={(id, e) => toggleSelect(id, e)}
        />
        ) : (
        <ProjectCardList
          projects={filtered}
          totalCount={projects.length}
          animationThreshold={settings.animation_threshold}
          hasActiveFilters={hasActiveFilters}
          renderCard={(p) => (
            <ProjectCard
              project={p}
              installedVersions={installed}
              categories={categoriesEnabled ? categories : []}
              gitStatus={gitStatusMap[p.path] ?? null}
              launchWithConsole={settings.launch_with_console}
              onTogglePin={() => setPinned(p.id, !p.pinned)}
              onVersionChange={(tag) => updateVersion(p.id, tag)}
              onRemove={() => remove(p.id, false)}
              onDelete={() => remove(p.id, true)}
              onCategoryChange={(category) => setCategory(p.id, category)}
              onTagsSaved={(updated) => updateTags(updated.id, updated.tags)}
              onTagClick={(tag) => setTagFilter((cur) => (cur === tag ? null : tag))}
              onShowGitSidebar={() =>
                window.dispatchEvent(
                  new CustomEvent('app:show-git-sidebar', {
                    detail: {
                      project: p,
                      gitStatus: gitStatusMap[p.path] ?? null,
                    },
                  }),
                )
              }
              activeTag={tagFilter}
              selected={selectedIds.has(p.id)}
              onToggleSelect={(selecting || selectedIds.size > 0) ? (e) => toggleSelect(p.id, e) : undefined}
            />
          )}
        />
        )}

      <AnimatePresence>
        {createProjectOpen && (
          <CreateProjectModal
            installedVersions={installed}
            defaultLocation={settings.default_project_location}
            onClose={() => setCreateProjectOpen(false)}
            onCreated={() => {
              setCreateProjectOpen(false)
              refresh()
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cloneRepoOpen && (
          <CloneRepoModal
            defaultLocation={settings.default_project_location}
            onClose={() => setCloneRepoOpen(false)}
            onCloned={() => {
              setCloneRepoOpen(false)
              refresh()
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmBatchAction === 'remove' && (
          <ConfirmDialog
            title={tc('bulk_remove_title', {
              count: selectedIds.size,
            })}
            description={tc('bulk_remove_desc', {
              count: selectedIds.size,
            })}
            confirmLabel={tc('bulk_remove_confirm')}
            onConfirm={executeBatchRemove}
            onCancel={() => setConfirmBatchAction(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmBatchAction === 'delete' && (
          <ConfirmDialog
            title={tc('bulk_delete_title', { count: selectedIds.size })}
            description={tc('bulk_delete_desc', {
              count: selectedIds.size,
            })}
            confirmLabel={tc('bulk_delete_confirm')}
            variant="danger"
            onConfirm={executeBatchDelete}
            onCancel={() => setConfirmBatchAction(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {categoryManagerOpen && (
          <CategoryManagerModal
            categories={categories}
            onClose={() => setCategoryManagerOpen(false)}
            onCreate={createCategory}
            onUpdate={updateCategory}
            onDelete={removeCategory}
            onReorder={reorderCategories}
          />
        )}
      </AnimatePresence>
      </div>
      </OverlayScrollArea>
    </div>
  )
}

const UNCATEGORIZED = '__uncategorized__'

function CategorySections({
  filtered,
  categories,
  uncategorizedLabel,
  installedVersions,
  gitStatusMap,
  launchWithConsole,
  allCategories,
  onSetCategory,
  onTogglePin,
  onRemove,
  onDelete,
  onUpdateVersion,
  onTagsSaved,
  onTagClick,
  onShowGitSidebar,
  selectedIds,
  selecting,
  onToggleSelect,
}: {
  filtered: import('../../../types').Project[]
  categories: import('../../../types').Category[]
  uncategorizedLabel: string
  installedVersions: import('../../../types').InstalledGodotVersion[]
  gitStatusMap: Record<string, import('../../../types').GitStatus>
  launchWithConsole: boolean
  allCategories: import('../../../types').Category[]
  onSetCategory: (id: string, category: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
  onRemove: (id: string, deleteFiles: boolean) => void
  onDelete: (id: string, deleteFiles: boolean) => void
  onUpdateVersion: (id: string, tag: string) => void
  onTagsSaved: (id: string, tags: string[]) => void
  onTagClick: (tag: string) => void
  onShowGitSidebar: (project: import('../../../types').Project) => void
  selectedIds: Set<string>
  selecting: boolean
  onToggleSelect: (id: string, e?: React.MouseEvent) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const pinned = filtered.filter((p) => p.pinned)
  const unpinned = filtered.filter((p) => !p.pinned)

  const categoryNames = [...new Set(unpinned.map((p) => p.category ?? UNCATEGORIZED))]
  const orderedNames = [
    ...categories.map((c) => c.name).filter((n) => categoryNames.includes(n)),
    ...categoryNames.filter((n) => n === UNCATEGORIZED || !categories.some((c) => c.name === n)),
  ].filter((n, i, arr) => arr.indexOf(n) === i)

  useEffect(() => {
    const nextKeys = [
      ...(pinned.length > 0 ? ['__pinned__'] : []),
      ...orderedNames,
    ]
    setExpanded((prev) => {
      const next: Record<string, boolean> = {}
      for (const key of nextKeys) {
        next[key] = prev[key] ?? true
      }
      return next
    })
  }, [pinned.length, orderedNames])

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }))
  }

  return (
    <div className="flex flex-col gap-6">
      {pinned.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => toggleSection('__pinned__')}
            className="focus-ring cursor-pointer w-full flex items-center gap-2 mb-3 text-left rounded-item px-2 py-2 hover:bg-overlay/60 transition-colors"
            aria-expanded={expanded.__pinned__ ?? true}
          >
            <IconChevronDown
              className={`w-3.5 h-3.5 text-muted transition-transform ${(expanded.__pinned__ ?? true) ? '' : '-rotate-90'}`}
            />
            <IconPin className="w-3.5 h-3.5 text-accent-bright" fill="currentColor" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Pinned
            </h3>
            <span className="text-xs text-muted/50 tabular-nums">{pinned.length}</span>
            <div className="flex-1 h-px bg-white/6 ml-1" />
          </button>
          <AnimatePresence initial={false}>
            {(expanded.__pinned__ ?? true) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2">
                  {pinned.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      installedVersions={installedVersions}
                      categories={allCategories}
                      gitStatus={gitStatusMap[p.path] ?? null}
                      launchWithConsole={launchWithConsole}
                      onTogglePin={() => onTogglePin(p.id, !p.pinned)}
                      onVersionChange={(tag) => onUpdateVersion(p.id, tag)}
                      onRemove={() => onRemove(p.id, false)}
                      onDelete={() => onDelete(p.id, true)}
                      onCategoryChange={(cat) => onSetCategory(p.id, cat)}
                      onTagsSaved={(updated) => onTagsSaved(updated.id, updated.tags)}
                      onTagClick={onTagClick}
                      onShowGitSidebar={() => onShowGitSidebar(p)}
                      selected={selectedIds.has(p.id)}
                      onToggleSelect={(selecting || selectedIds.size > 0) ? (e) => onToggleSelect(p.id, e) : undefined}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {orderedNames.map((name) => {
        const items = unpinned.filter((p) => (p.category ?? UNCATEGORIZED) === name)
        if (items.length === 0) return null
        const cat = categories.find((c) => c.name === name)
        return (
          <section key={name}>
            <button
              type="button"
              onClick={() => toggleSection(name)}
              className="focus-ring cursor-pointer w-full flex items-center gap-2 mb-3 text-left rounded-item px-2 py-2 hover:bg-overlay/60 transition-colors"
              aria-expanded={expanded[name] ?? true}
            >
              <IconChevronDown
                className={`w-3.5 h-3.5 text-muted transition-transform ${(expanded[name] ?? true) ? '' : '-rotate-90'}`}
              />
              {cat && (
                <span
                  className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10"
                  style={{ backgroundColor: cat.color }}
                />
              )}
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {name === UNCATEGORIZED ? uncategorizedLabel : name}
              </h3>
              <span className="text-xs text-muted/50 tabular-nums">{items.length}</span>
              <div className="flex-1 h-px bg-white/6 ml-1" />
            </button>
            <AnimatePresence initial={false}>
              {(expanded[name] ?? true) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-2">
                    {items.map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        installedVersions={installedVersions}
                        categories={allCategories}
                        gitStatus={gitStatusMap[p.path] ?? null}
                        launchWithConsole={launchWithConsole}
                        onTogglePin={() => onTogglePin(p.id, !p.pinned)}
                        onVersionChange={(tag) => onUpdateVersion(p.id, tag)}
                        onRemove={() => onRemove(p.id, false)}
                        onDelete={() => onDelete(p.id, true)}
                        onCategoryChange={(cat) => onSetCategory(p.id, cat)}
                        onTagsSaved={(updated) => onTagsSaved(updated.id, updated.tags)}
                        onTagClick={onTagClick}
                        onShowGitSidebar={() => onShowGitSidebar(p)}
                        selected={selectedIds.has(p.id)}
                        onToggleSelect={(selecting || selectedIds.size > 0) ? (e) => onToggleSelect(p.id, e) : undefined}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )
      })}
    </div>
  )
}
