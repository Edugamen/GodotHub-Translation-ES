import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useProjectsContext } from '../../../hooks/projectsContext'
import { IconChevronDown, IconPlus } from '../../../components/Icons'

const TOOL_BUTTON_CLASS =
  'text-muted hover:text-ink font-semibold bg-overlay border border-line hover:bg-raised cursor-pointer py-2.5 flex items-center transition-colors'

const TOOL_BUTTON_SPRING = { type: 'spring', stiffness: 500, damping: 30 } as const

const TOOL_BUTTON_ANIMATION = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.94 },
  transition: TOOL_BUTTON_SPRING,
} as const

export function ProjectsViewNew() {
  const { t } = useTranslation('nav')
  const { projects } = useProjectsContext()

  return (
    <div className="h-full flex flex-col gap-2">
      <header className="shrink-0 p-6 pb-0 flex flex-row items-center gap-3">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-5xl font-bold tracking-wide text-ink uppercase">
            {t('projects')}
          </h1>
          <motion.button
            type="button"
            aria-label={t('new_project')}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="w-10 h-10 cursor-pointer flex items-center justify-center rounded-full bg-accent text-ink hover:bg-accent-bright transition-colors"
          >
            <IconPlus className="w-5 h-5" />
          </motion.button>
        </div>

        <div className="ml-auto flex items-baseline gap-2">
          <h2 className="text-4xl font-black text-muted tabular-nums">
            {projects.length}
          </h2>
          <p className="text-lg font-black uppercase text-muted">
            {t('projects')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <motion.button
              type="button"
              {...TOOL_BUTTON_ANIMATION}
              className={`${TOOL_BUTTON_CLASS} pl-5 pr-3 rounded-l-lg`}
            >
              Import
            </motion.button>
            <motion.button
              type="button"
              aria-label="More import options"
              {...TOOL_BUTTON_ANIMATION}
              className={`${TOOL_BUTTON_CLASS} -ml-px px-2 rounded-r-lg`}
            >
              <IconChevronDown className="w-3 h-3" />
            </motion.button>
          </div>
          <motion.button
            type="button"
            {...TOOL_BUTTON_ANIMATION}
            className={`${TOOL_BUTTON_CLASS} px-6 rounded-xl`}
          >
            Scan
          </motion.button>
        </div>
      </header>
    </div>
  )
}