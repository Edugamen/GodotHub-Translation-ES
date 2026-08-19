import { motion, AnimatePresence } from 'framer-motion'
import { AnimatedNumber } from '../reusables/AnimatedNumber'
import {
  IconChevronDown,
  IconPin,
} from '../../lib/icons'

interface Props {
  label: string
  color: string
  projectCount: number
  collapsed: boolean
  isPinned: boolean
  onToggleCollapse: () => void
  children: React.ReactNode
  emptyState?: React.ReactNode
}

export function CategoryGroup({
  label,
  color,
  projectCount,
  collapsed,
  isPinned,
  onToggleCollapse,
  children,
  emptyState,
}: Props) {
  const hasProjects = projectCount > 0
  return (
    <div className="flex flex-col gap-0.5 rounded-item">
      {/* Category header */}
      <button
        type="button"
        onClick={() => !isPinned && onToggleCollapse()}
        className={`flex items-center gap-2 px-1 py-1 rounded-item transition-colors ${
          isPinned ? '' : 'hover:bg-raised cursor-pointer'
        }`}
      >
        {isPinned ? (
          <IconPin className="w-3 h-3 text-accent-bright" fill="currentColor" />
        ) : (
          <motion.span
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-muted/50"
          >
            <IconChevronDown className="w-3 h-3" />
          </motion.span>
        )}
        {!isPinned && (
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
        <span className="text-[10px] font-medium text-muted/50 tabular-nums">
          · <AnimatedNumber value={projectCount} />
        </span>
        <div className="flex-1 h-px bg-outline/50" />
      </button>

      {/* Content area — animates between projects and empty state */}
      <AnimatePresence initial={false} mode="wait">
        {!collapsed && (
          <motion.div
            key={hasProjects ? 'projects' : 'empty'}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex flex-col gap-2"
          >
            {hasProjects ? children : emptyState}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
