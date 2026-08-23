import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type Transition } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { AnimatedNumber } from '../reusables/AnimatedNumber'
import { useTranslation } from 'react-i18next'
import { IconChevronDown, IconNode, IconPin } from '../../lib/icons'
import { isReducedMotion } from '../../../../lib/appearance'
import type { Category, Project } from '../../../../types'

/** Context that provides the ID of the item currently being hovered over during drag */
export const DragOverContext = createContext<string | null>(null)
export function useDragOverId(): string | null {
  return useContext(DragOverContext)
}

const DEFAULT_ANIMATION_THRESHOLD = 20
const UNCATEGORIZED = '__uncategorized__'

export interface PinChange {
  id: string
  pinned: boolean
}

export interface CategoryChange {
  id: string
  category: string
}

interface ProjectCardListProps {
  projects: Project[]
  renderCard: (project: Project) => ReactNode
  hasActiveFilters: boolean
  totalCount: number
  animationThreshold?: number
  categories?: Category[]
  categoriesEnabled?: boolean
  /** When true, dragging is disabled (e.g. during search) */
  dragDisabled?: boolean
  /**
   * Called when items are reordered via drag-and-drop.
   * `pinChanges` is non-empty when the drag crosses the pinned/unpinned boundary.
   * `categoryChanges` is non-empty when the drag crosses a category boundary.
   */
  onReorder?: (
    orderedIds: string[],
    pinChanges?: PinChange[],
    categoryChanges?: CategoryChange[],
  ) => void
  /** Project currently being dragged, for rendering the DragOverlay */
  dragOverlayProject?: Project | null
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
  dragDisabled = false,
  onReorder,
  dragOverlayProject = null,
}: ProjectCardListProps) {
  const { t } = useTranslation('common')

  const animateList =
    totalCount <= animationThreshold && !isReducedMotion()
  const layoutTransition: Transition = {
    type: 'spring',
    stiffness: 350,
    damping: 30,
    mass: 0.8,
  }

  const cardFor = (p: Project) => {
    const card = renderCard(p)
    if (!animateList) {
      return <div key={p.id} className="min-w-0">{card}</div>
    }
    return (
      <motion.div
        key={p.id}
        layout
        layoutId={p.id}
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

  // All project IDs in display order for SortableContext
  const allIds = useMemo(() => {
    const ids: string[] = []
    if (showPinnedSection) {
      for (const p of pinnedProjects) ids.push(p.id)
    }
    if (categoryGroups) {
      for (const [, projs] of categoryGroups) {
        for (const p of projs) ids.push(p.id)
      }
    } else {
      for (const p of unpinnedProjects) ids.push(p.id)
    }
    return ids
  }, [showPinnedSection, pinnedProjects, categoryGroups, unpinnedProjects])

  // DnD state and handlers
  const hasDnd = !dragDisabled && allIds.length > 1
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  // Track which zone the dragged item is hovering over for visual feedback
  const [overZone, setOverZone] = useState<'pinned' | 'unpinned' | null>(null)
  const pinnedCountRef = useRef(pinnedProjects.length)
  pinnedCountRef.current = pinnedProjects.length

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(e.active.id as string)
  }, [])

  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const { over } = e
      if (!over) {
        setOverId(null)
        setOverZone(null)
        return
      }
      setOverId(over.id as string)
      const pinnedCount = pinnedCountRef.current
      const overIdx = allIds.indexOf(over.id as string)

      // Determine zone from the over item's position in the master list
      if (overIdx !== -1) {
        setOverZone(overIdx < pinnedCount ? 'pinned' : 'unpinned')
      } else if (over.id === 'drop-zone-pinned') {
        setOverZone('pinned')
      } else if (over.id === 'drop-zone-unpinned') {
        setOverZone('unpinned')
      }
    },
    [allIds],
  )

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e
      setActiveId(null)
      setOverId(null)
      setOverZone(null)
      if (!over || active.id === over.id || !onReorder) return

      const pinnedCount = pinnedCountRef.current
      const oldIndex = allIds.indexOf(active.id as string)
      const newIndex = allIds.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return

      const newOrder = arrayMove(allIds, oldIndex, newIndex)
      const pinChanges: PinChange[] = []
      const categoryChanges: CategoryChange[] = []

      // Detect boundary crossing
      const wasPinned = oldIndex < pinnedCount
      const isPinned = newIndex < pinnedCount

      if (wasPinned && !isPinned) {
        pinChanges.push({ id: active.id as string, pinned: false })
      } else if (!wasPinned && isPinned) {
        pinChanges.push({ id: active.id as string, pinned: true })
      }

      // Detect category boundary crossing (only when categories are visible)
      if (categoriesEnabled && categories.length > 0 && !wasPinned && !isPinned) {
        const draggedId = active.id as string
        const draggedProject = projects.find((p) => p.id === draggedId)
        if (draggedProject) {
          const oldCategory = draggedProject.category || ''
          // Find which category the drop target belongs to
          const overId = over.id as string
          const overProject = projects.find((p) => p.id === overId)
          if (overProject && overProject.id !== draggedId) {
            const targetCategory = overProject.category || ''
            if (oldCategory !== targetCategory) {
              categoryChanges.push({
                id: draggedId,
                category: targetCategory,
              })
            }
          }
        }
      }

      onReorder(
        newOrder,
        pinChanges.length > 0 ? pinChanges : undefined,
        categoryChanges.length > 0 ? categoryChanges : undefined,
      )
    },
    [allIds, onReorder, categoriesEnabled, categories, projects],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setOverId(null)
    setOverZone(null)
  }, [])

  const pinnedHeader = (
    <div
      className={`mt-1 mb-0.5 flex items-center gap-2 px-1 rounded-item transition-colors duration-150 ${
        activeId && overZone === 'pinned'
          ? 'bg-accent/10 ring-1 ring-accent/25 py-1 -mx-1 px-2'
          : ''
      }`}
    >
      <IconPin className="w-3 h-3 text-accent-bright" fill="currentColor" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {t('pinned_section')}
      </span>
      <span className="text-[10px] font-medium text-muted/50 tabular-nums">
        · <AnimatedNumber value={pinnedProjects.length} />
      </span>
      {activeId && overZone === 'pinned' && (
        <span className="text-[9px] font-medium text-accent animate-pulse ml-1">
          {t('drop_here_animated')}
        </span>
      )}
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
            className={`h-0.5 my-1 transition-colors duration-150 ${
              activeId && overZone === 'unpinned'
                ? 'bg-accent/40'
                : 'bg-outline'
            }`}
            style={
              activeId && overZone !== 'unpinned'
                ? { backgroundColor: 'var(--color-outline)' }
                : undefined
            }
          />,
          ...(categoryGroups
            ? renderCategoryGroups(categoryGroups, categories, cardFor)
            : unpinnedProjects.map((p) => cardFor(p))),
        ]
      : categoryGroups
        ? renderCategoryGroups(categoryGroups, categories, cardFor)
        : projects.map((p) => cardFor(p))

  const sortableContextItems = hasDnd ? allIds : []

  const content = (
    <div className="flex-1 min-h-0 relative flex flex-col gap-2">
      {animateList ? (
        <AnimatePresence initial={false}>{listChildren}</AnimatePresence>
      ) : (
        listChildren
      )}
      {projects.length > 0 && (
        <div className="shrink-0 h-4" aria-hidden="true" />
      )}
    </div>
  )

  if (!hasDnd) {
    return content
  }

  return (
    <>
      <DragOverContext.Provider value={overId}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={sortableContextItems}
          strategy={verticalListSortingStrategy}
        >
          {content}
        </SortableContext>

        <DragOverlay
          dropAnimation={isReducedMotion() ? undefined : {
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
          style={{
            cursor: 'grabbing',
            filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.35))',
            maxWidth: '800px',
            transformOrigin: 'center center',
          }}
        >
          {dragOverlayProject ? (
            <div className="opacity-90 scale-[1.02]">
              {renderCard(dragOverlayProject)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      </DragOverContext.Provider>
    </>
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
