import { type ReactNode } from 'react'
import { AnimatePresence, motion, type Transition } from 'framer-motion'
import { AnimatedNumber } from '../reusables/AnimatedNumber'
import { useTranslation } from 'react-i18next'
import { IconNode, IconPin } from '../../lib/icons'
import { isReducedMotion } from '../../../../lib/appearance'
import type { Project } from '../../../../types'

const DEFAULT_ANIMATION_THRESHOLD = 20

interface ProjectCardListProps {
  projects: Project[]
  renderCard: (project: Project) => ReactNode
  hasActiveFilters: boolean
  totalCount: number
  animationThreshold?: number
}

export function ProjectCardList({
  projects,
  renderCard,
  hasActiveFilters,
  totalCount,
  animationThreshold = DEFAULT_ANIMATION_THRESHOLD,
}: ProjectCardListProps) {
  const { t } = useTranslation('common')

  const showPinnedSection = projects.some((p) => p.pinned)
  const pinnedProjects = showPinnedSection
    ? projects.filter((p) => p.pinned)
    : []
  const unpinnedProjects = showPinnedSection
    ? projects.filter((p) => !p.pinned)
    : []

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
        layout="position"
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
          ...unpinnedProjects.map((p) => cardFor(p)),
        ]
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
