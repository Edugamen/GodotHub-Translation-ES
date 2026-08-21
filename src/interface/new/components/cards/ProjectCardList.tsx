import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type Transition } from 'framer-motion'
import { AnimatedNumber } from '../reusables/AnimatedNumber'
import { useTranslation } from 'react-i18next'
import { IconChevronDown, IconNode, IconPin } from '../../lib/icons'
import { isReducedMotion } from '../../../../lib/appearance'
import type { Category, Project } from '../../../../types'

const DEFAULT_ANIMATION_THRESHOLD = 20
const UNCATEGORIZED = '__uncategorized__'

interface ProjectCardListProps {
  projects: Project[]
  renderCard: (project: Project) => ReactNode
  hasActiveFilters: boolean
  totalCount: number
  animationThreshold?: number
  categories?: Category[]
  categoriesEnabled?: boolean
}

function CategorySection({
  title,
  color,
  count,
  children,
  defaultOpen = true,
}: {
  title: string
  color?: string
  count: number
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring cursor-pointer w-full flex items-center gap-1.5 px-1 py-1 rounded-item text-left hover:bg-raised/60 transition-colors group"
      >
        <IconChevronDown
          className={`w-3 h-3 text-muted/50 shrink-0 transition-transform duration-200 ${
            open ? '' : '-rotate-90'
          }`}
        />
        {color && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted/50 group-hover:text-muted transition-colors">
          {title}
        </span>
        <div className="flex-1 h-px bg-outline/30 mx-1.5" />
        <span className="text-[10px] font-medium text-muted/50 tabular-nums shrink-0">
          · <AnimatedNumber value={count} />
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="flex flex-col gap-2 pt-2 pb-0.5">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function ProjectCardList({
  projects,
  renderCard,
  hasActiveFilters,
  totalCount,
  animationThreshold = DEFAULT_ANIMATION_THRESHOLD,
  categories = [],
  categoriesEnabled = false,
}: ProjectCardListProps) {
  const { t } = useTranslation('common')

  const animateList =
    totalCount <= animationThreshold && !isReducedMotion()
  const layoutTransition: Transition = {
    type: 'tween',
    duration: 0.25,
    ease: 'easeOut',
  }

  const cardFor = (p: Project) => {
    const card = renderCard(p)
    if (!animateList) {
      return <div key={p.id} className="min-w-0">{card}</div>
    }
    return (
      <motion.div
        key={p.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
        transition={layoutTransition}
        className="min-w-0"
      >
        {card}
      </motion.div>
    )
  }

  const showPinnedSection = projects.some((p) => p.pinned)
  const pinnedProjects = showPinnedSection
    ? projects.filter((p) => p.pinned)
    : []
  const unpinnedProjects = showPinnedSection
    ? projects.filter((p) => !p.pinned)
    : projects

  const categoryGroups = useMemo(() => {
    if (!categoriesEnabled || categories.length === 0) {
      return null
    }
    const groups = new Map<string, Project[]>()
    for (const p of unpinnedProjects) {
      const cat = p.category || UNCATEGORIZED
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(p)
    }
    return groups
  }, [categoriesEnabled, categories, unpinnedProjects])

  const pinnedHeader = (
    <div className="mt-1 mb-0.5 flex items-center gap-2 px-1">
      <IconPin className="w-3 h-3 text-accent-bright" fill="currentColor" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {t('pinned_section')}
      </span>
      <span className="text-[10px] font-medium text-muted/50 tabular-nums">
        · <AnimatedNumber value={pinnedProjects.length} />
      </span>
      <div className="flex-1 h-px bg-outline/50" />
    </div>
  )

  const emptyState = animateList ? (
    <motion.div
      key="empty"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="h-full flex flex-col items-center justify-center gap-2 text-center"
    >
      <IconNode className="w-5 h-5 text-muted/50" />
      <p className="text-sm text-muted">
        {hasActiveFilters ? t('no_projects_match') : t('no_projects_yet')}
      </p>
    </motion.div>
  ) : (
    <div
      key="empty"
      className="h-full flex flex-col items-center justify-center gap-2 text-center"
    >
      <IconNode className="w-5 h-5 text-muted/50" />
      <p className="text-sm text-muted">
        {hasActiveFilters ? t('no_projects_match') : t('no_projects_yet')}
      </p>
    </div>
  )

  const listChildren: ReactNode[] = projects.length === 0
    ? [emptyState]
    : showPinnedSection
      ? [
          <div
            key="pinned-top-divider"
            className="h-0.5 my-1 bg-outline"
            style={{ backgroundColor: 'var(--color-outline)' }}
          />,
          pinnedHeader,
          ...pinnedProjects.map((p) => cardFor(p)),
          <div
            key="pinned-bottom-divider"
            className="h-0.5 my-1 bg-outline"
            style={{ backgroundColor: 'var(--color-outline)' }}
          />,
          ...(categoryGroups
            ? renderCategoryGroups(categoryGroups, categories, cardFor)
            : unpinnedProjects.map((p) => cardFor(p))),
        ]
      : categoryGroups
        ? renderCategoryGroups(categoryGroups, categories, cardFor)
        : projects.map((p) => cardFor(p))

  return (
    <div className="flex-1 min-h-0 relative flex flex-col gap-2">
      {animateList ? (
        <AnimatePresence mode="popLayout">{listChildren}</AnimatePresence>
      ) : (
        listChildren
      )}
      {projects.length > 0 && (
        <div className="shrink-0 h-4" aria-hidden="true" />
      )}
    </div>
  )
}

function renderCategoryGroups(
  groups: Map<string, Project[]>,
  categories: Category[],
  cardFor: (p: Project) => ReactNode,
): ReactNode[] {
  const result: ReactNode[] = []
  const defined = categories.filter((c) => groups.has(c.name))
  const uncategorized = groups.get(UNCATEGORIZED) ?? []

  for (const cat of defined) {
    const projs = groups.get(cat.name) ?? []
    result.push(
      <CategorySection
        key={`cat-${cat.id}`}
        title={cat.name}
        color={cat.color}
        count={projs.length}
      >
        {projs.map((p) => cardFor(p))}
      </CategorySection>,
    )
  }

  if (uncategorized.length > 0) {
    result.push(
      <CategorySection
        key="cat-uncategorized"
        title="Uncategorized"
        count={uncategorized.length}
      >
        {uncategorized.map((p) => cardFor(p))}
      </CategorySection>,
    )
  }

  return result
}
