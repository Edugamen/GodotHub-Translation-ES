import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import NumberFlow from '@number-flow/react'
import { useProjectsContext } from '../../../hooks/projectsContext'
import { useCategoriesContext } from '../../../hooks/categoriesContext'
import { useGodotVersionsContext } from '../../../hooks/godotVersionsContext'
import {
  IconArrowUpDown,
  IconFilter,
  IconPlus,
  IconX,
} from '../../../components/Icons'
import { tagColor } from '../../../lib/colors'
import { Dropdown } from '../components/Dropdown'
import { ImportButton } from '../components/ImportButton'
import { OverlayScrollArea } from '../components/OverlayScrollArea'
import { ProjectCard } from '../components/ProjectCard'
import { ProjectCardList } from '../components/ProjectCardList'
import { useSettings } from '../../../hooks/useSettings'
import { useScrollCompensation } from '../../../hooks/useScrollCompensation'
import { api } from '../../../lib/api'
import type { GitStatus } from '../../../types'
import {
  comparatorFor,
  SORT_OPTIONS,
  type ProjectSortOption,
} from '../../../lib/projectSort'
import { ScanButton } from '../components/ScanButton'
import { SearchBar } from '../components/SearchBar'

const UNCATEGORIZED = '__uncategorized__'

export function ProjectsViewNew({
  onOpenSettings,
}: {
  onOpenSettings?: () => void
}) {
  const { t } = useTranslation('nav')
  const { t: tc } = useTranslation('common')
  const { projects, remove, updateVersion, setPinned, updateTags } =
    useProjectsContext()
  const { categories } = useCategoriesContext()
  const { installed } = useGodotVersionsContext()
  const { settings } = useSettings()
  const [query, setQuery] = useState('')
  // Debounced copy of the search query drives filtering, so typing doesn't
  // re-render (and re-animate) the whole list on every keystroke — the input
  // itself stays instant.
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(id)
  }, [query])
  const [filterBy, setFilterBy] = useState<string>('all')
  // Session-only: survives tab switches (view remounts) but resets on app
  // launch, since the webview (and its sessionStorage) is recreated each run.
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
  // Git status for the project cards (repo? branch? dirty?), refreshed on a timer.
  const [gitStatusMap, setGitStatusMap] = useState<Record<string, GitStatus>>({})
  const fetchingGitRef = useRef(false)
  // Scroll compensation for pin toggles and tag filter changes: the hook
  // tracks the live position and restores it (clamped to the new bounds) after
  // the list height changes, so the view never snaps while it settles.
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
  // Re-fetch immediately whenever the project list itself changes (e.g. import).
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
      // Non-fatal: cards simply won't show a git button.
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

  // Persist the active tag filter to sessionStorage (not localStorage, so it
  // doesn't survive app restarts). A stale tag (removed elsewhere) is dropped
  // by the auto-clear effect below, which also clears the stored value.
  useEffect(() => {
    try {
      if (tagFilter) {
        sessionStorage.setItem('godothub_projects_tag_filter', tagFilter)
      } else {
        sessionStorage.removeItem('godothub_projects_tag_filter')
      }
    } catch {}
  }, [tagFilter])

  // One-time cleanup: drop the localStorage key the older (restart-persisting)
  // implementation used, so stale filters never linger between storage areas.
  useEffect(() => {
    try {
      localStorage.removeItem('godothub_projects_tag_filter')
    } catch {}
  }, [])

  // If the persisted sort isn't available (e.g. categories got disabled),
  // fall back to the first available option instead of showing a stale state.
  useEffect(() => {
    if (!sortOptions.some((opt) => opt.value === sortBy)) {
      setSortBy(sortOptions[0]?.value ?? 'name_asc')
    }
  }, [sortOptions, sortBy])

  // If the active filter category was renamed or deleted, reset to "All".
  useEffect(() => {
    if (!filterOptions.some((opt) => opt.key === filterBy)) {
      setFilterBy('all')
    }
  }, [filterOptions, filterBy])

  // Drop the tag filter if no project carries that tag anymore.
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
    const cmp = comparatorFor(sortBy)
    // Pinned projects always float to the top in every sort mode and are
    // ordered by name; the active comparator (recency, name, created, …)
    // applies to the unpinned group below. The category sort keeps the
    // natural (category/sort_order) order for that group.
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (a.pinned) return a.name.localeCompare(b.name)
      return cmp ? cmp(a, b) : 0
    })
  }, [projects, debouncedQuery, sortBy, filterBy, tagFilter])

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
      {/* Header block (header card + toolbar) */}
      <div className="flex flex-col gap-2">
      {/* Projects card — header, search, and the future list live inside */}
      <section className="shrink-0 rounded-card bg-raised px-6 py-4 flex flex-col gap-2">
        <header className="shrink-0 flex flex-row items-center gap-3">
          <div className="flex items-center gap-1.5">
            <h1 className="font-display text-4xl font-bold tracking-wide text-ink uppercase">
              {t('projects')}
            </h1>
            <motion.button
              type="button"
              aria-label={t('new_project')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="w-9 h-9 cursor-pointer flex items-center justify-center rounded-full bg-accent text-ink hover:bg-accent-bright transition-colors"
            >
              <IconPlus className="w-10 h-10" strokeWidth={3} />
            </motion.button>
          </div>

          <div className="ml-auto flex items-baseline gap-1">
            <h2 className="text-4xl font-bold text-muted">
              <NumberFlow value={filtered.length} />
            </h2>
            <p className="text-lg font-medium uppercase text-muted">
              {t('projects')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ImportButton />
            <ScanButton onOpenSettings={onOpenSettings} />
          </div>
        </header>

        <SearchBar value={query} onChange={setQuery} />
      </section>

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

      {/* Project cards */}
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
            activeTag={tagFilter}
          />
        )}
      />
      </div>
    </OverlayScrollArea>
  )
}