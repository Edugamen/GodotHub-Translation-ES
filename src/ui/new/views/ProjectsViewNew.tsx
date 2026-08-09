import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import NumberFlow from '@number-flow/react'
import { useProjectsContext } from '../../../hooks/projectsContext'
import { useCategoriesContext } from '../../../hooks/categoriesContext'
import { useGodotVersionsContext } from '../../../hooks/godotVersionsContext'
import {
  IconArrowUpDown,
  IconFilter,
  IconNode,
  IconPlus,
} from '../../../components/Icons'
import { Dropdown } from '../components/Dropdown'
import { ImportButton } from '../components/ImportButton'
import { ProjectCard } from '../components/ProjectCard'
import { useSettings } from '../../../hooks/useSettings'
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
const STICKY_HEADER_KEY = 'godothub_new_ui_sticky_header'

export function ProjectsViewNew({
  onOpenSettings,
}: {
  onOpenSettings?: () => void
}) {
  const { t } = useTranslation('nav')
  const { t: tc } = useTranslation('common')
  const { projects, remove, updateVersion, setPinned } = useProjectsContext()
  const { categories } = useCategoriesContext()
  const { installed } = useGodotVersionsContext()
  const { settings } = useSettings()
  const [query, setQuery] = useState('')
  const [filterBy, setFilterBy] = useState<string>('all')
  const [sortBy, setSortBy] = useState<ProjectSortOption>(() => {
    try {
      const raw = localStorage.getItem('godothub_projects_sort_by')
      if (raw) return raw as ProjectSortOption
    } catch {}
    return 'categories'
  })
  const [stickyHeader] = useState(() => {
    try {
      return localStorage.getItem(STICKY_HEADER_KEY) === '1'
    } catch {
      return false
    }
  })

  // Git status for the project cards (repo? branch? dirty?), refreshed on a timer.
  const [gitStatusMap, setGitStatusMap] = useState<Record<string, GitStatus>>({})
  const fetchingGitRef = useRef(false)
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
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
    const cmp = comparatorFor(sortBy)
    return cmp ? [...list].sort(cmp) : list
  }, [projects, query, sortBy, filterBy])

  const hasActiveFilters = query.trim() !== '' || filterBy !== 'all'

  return (
    <div className="flex-1 min-w-0 -mr-4 -mb-4 pr-4 pb-4 overflow-y-auto flex flex-col gap-2">
      {/* Sticky-capable header block (header card + toolbar) */}
      <div
        className={`flex flex-col gap-2 ${
          stickyHeader ? 'sticky top-0 z-10 bg-base' : ''
        }`}
      >
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

      </div>
      </div>

      {/* Project cards */}
      <div className="flex-1">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
            <IconNode className="w-5 h-5 text-muted/50" />
            <p className="text-sm text-muted">
              {hasActiveFilters ? tc('no_projects_match') : tc('no_projects_yet')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-1">
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                installedVersions={installed}
                categories={categories}
                gitStatus={gitStatusMap[p.path] ?? null}
                onTogglePin={() => setPinned(p.id, !p.pinned)}
                onVersionChange={(tag) => updateVersion(p.id, tag)}
                onRemove={() => remove(p.id, false)}
                onDelete={() => remove(p.id, true)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}