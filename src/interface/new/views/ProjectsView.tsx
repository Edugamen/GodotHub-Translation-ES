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
import NumberFlow from '@number-flow/react'
import { useProjectsContext } from '../../../hooks/projectsContext'
import { useCategoriesContext } from '../../../hooks/categoriesContext'
import { useGodotVersionsContext } from '../../../hooks/godotVersionsContext'
import {
  IconArrowUpDown,
  IconFilter,
  IconGitBranch,
  IconPlus,
  IconX,
} from '../lib/icons'
import { tagColor } from '../../../lib/colors'
import { Dropdown } from '../components/ui/Dropdown'
import { ImportButton } from '../components/reusables/ImportButton'
import { OverlayScrollArea } from '../components/reusables/OverlayScrollArea'
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

const UNCATEGORIZED = '__uncategorized__'

export function ProjectsView({
  onOpenSettings,
}: {
  onOpenSettings?: () => void
}) {
  const { t } = useTranslation('nav')
  const { t: tc } = useTranslation('common')
  const { projects, refresh, remove, updateVersion, setPinned, updateTags } =
    useProjectsContext()
  const { categories } = useCategoriesContext()
  const { installed } = useGodotVersionsContext()
  const { settings } = useSettings()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [cloneRepoOpen, setCloneRepoOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(id)
  }, [query])
  const [filterBy, setFilterBy] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(() => {
    try {
      const raw = sessionStorage.getItem('godothub_projects_tag_filter')
      if (raw) return raw
    } catch {}
    return null
  })
  const [sortBy, setSortBy] = useState<ProjectSortOption>(() => {
    try {
      const raw = localStorage.getItem('godothub_projects_sort_by')
      if (raw) return raw as ProjectSortOption
    } catch {}
    return 'categories'
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

  const sortOptions = SORT_OPTIONS.filter(
    (opt) => settings.categories_enabled || opt.value !== 'categories',
  )
  const filterOptions = [
    { key: 'all', label: tc('filter_all') },
    ...categories.map((c) => ({ key: c.name, label: c.name })),
    { key: UNCATEGORIZED, label: tc('uncategorized') },
  ]
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
      localStorage.removeItem('godothub_projects_tag_filter')
    } catch {}
  }, [])

  useEffect(() => {
    if (!sortOptions.some((opt) => opt.value === sortBy)) {
      setSortBy(sortOptions[0]?.value ?? 'name_asc')
    }
  }, [sortOptions, sortBy])

  useEffect(() => {
    if (!filterOptions.some((opt) => opt.key === filterBy)) {
      setFilterBy('all')
    }
  }, [filterOptions, filterBy])

  useEffect(() => {
    if (tagFilter && !projects.some((p) => p.tags.includes(tagFilter))) {
      setTagFilter(null)
    }
  }, [projects, tagFilter])

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    let list = projects
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q),
      )
    }
    if (filterBy !== 'all') {
      list = list.filter((p) =>
        filterBy === UNCATEGORIZED ? !p.category : p.category === filterBy,
      )
    }
    if (tagFilter) {
      list = list.filter((p) => p.tags.includes(tagFilter))
    }
    const cmp = comparatorFor(sortBy, sortNow)
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (a.pinned) return a.name.localeCompare(b.name)
      return cmp ? cmp(a, b) : 0
    })
  }, [projects, debouncedQuery, sortBy, filterBy, tagFilter, sortNow])

  const hasActiveFilters =
    query.trim() !== '' || filterBy !== 'all' || tagFilter !== null

  return (
    <OverlayScrollArea
      className="flex-1 min-w-0 -mr-4 -mb-4"
      hideThumb={!settings.show_scrollbars}
      scrollToTopOn={tagFilter}
      scrollRef={viewportRef}
    >
      <div className="h-full pr-5 pb-4 flex flex-col gap-2">
      <div className="flex flex-col gap-2">
      <ViewHeader
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
              <NumberFlow value={filtered.length} />
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
          </>
        }
      >
        <SearchBar value={query} onChange={setQuery} />
      </ViewHeader>

      <div className="shrink-0 flex items-center gap-2">
        {settings.categories_enabled && (
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
              <IconFilter className="w-3 h-3 text-muted" />
              <span className="text-[16px] font-medium">
                {tc('filter')}
              </span>
            </motion.button>
          )}
          items={filterOptions.map((opt) => ({
            key: opt.key,
            label: opt.label,
            dotColor:
              opt.key === 'all' || opt.key === UNCATEGORIZED
                ? undefined
                : categories.find((c) => c.name === opt.key)?.color,
            active: filterBy === opt.key,
            onClick: () => setFilterBy(opt.key),
          }))}
        />
        )}

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

        {tagFilter && (
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            title={tc('clear_tag_filter')}
            className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-item bg-accent/15 text-accent-bright ring-1 ring-accent-dim/70 hover:bg-accent/25 transition-colors"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: tagColor(tagFilter) }}
            />
            <span className="text-[16px] font-medium">{tagFilter}</span>
            <IconX className="w-3 h-3" />
          </button>
        )}

      </div>
      </div>

      <ProjectCardList
        projects={filtered}
        totalCount={projects.length}
        animationThreshold={settings.animation_threshold}
        hasActiveFilters={hasActiveFilters}
        renderCard={(p) => (
          <ProjectCard
            project={p}
            installedVersions={installed}
            categories={categories}
            gitStatus={gitStatusMap[p.path] ?? null}
            launchWithConsole={settings.launch_with_console}
            onTogglePin={() => setPinned(p.id, !p.pinned)}
            onVersionChange={(tag) => updateVersion(p.id, tag)}
            onRemove={() => remove(p.id, false)}
            onDelete={() => remove(p.id, true)}
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
          />
        )}
      />

      <AnimatePresence>
        {createProjectOpen && (
          <CreateProjectModal
            installedVersions={installed}
            defaultLocation={settings.default_project_location}
            categories={categories}
            onClose={() => setCreateProjectOpen(false)}
            onCreated={() => {
              setCreateProjectOpen(false)
              refresh()
            }}
          />
        )}
        {cloneRepoOpen && (
          <CloneRepoModal
            defaultLocation={settings.default_project_location}
            categories={categories}
            onClose={() => setCloneRepoOpen(false)}
            onCloned={() => {
              setCloneRepoOpen(false)
              refresh()
            }}
          />
        )}
      </AnimatePresence>
      </div>
    </OverlayScrollArea>
  )
}
