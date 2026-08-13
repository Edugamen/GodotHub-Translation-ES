import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectsContext } from '../../../../hooks/projectsContext'
import { useSettings } from '../../../../hooks/useSettings'
import { useCategoriesContext } from '../../../../hooks/categoriesContext'
import { IconChevronDown, IconGitBranch } from '../../lib/icons'
import { api } from '../../../../lib/api'
import { ImportOverlay } from '../ImportOverlay'
import { CloneRepoModal } from '../modals/CloneRepoModal'
import { Dropdown } from '../ui/Dropdown'

const TOOL_BUTTON_CLASS =
  'text-muted hover:text-ink font-semibold text-[17px] bg-overlay shadow-md shadow-black/10 border border-outline/50 hover:bg-raised cursor-pointer h-10 flex items-center transition-colors'

const TOOL_BUTTON_SPRING = { type: 'spring', stiffness: 500, damping: 30 } as const

const TOOL_BUTTON_ANIMATION = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.94 },
  transition: TOOL_BUTTON_SPRING,
} as const

const MIN_IMPORT_TIME = 700

export function ImportButton() {
  const { t } = useTranslation('common')
  const { refresh } = useProjectsContext()
  const { settings } = useSettings()
  const { categories } = useCategoriesContext()
  const [importing, setImporting] = useState<{
    type: 'project' | 'version'
    total: number
    current: number
    label?: string | null
  } | null>(null)
  const [picking, setPicking] = useState(false)
  const [cloneRepoOpen, setCloneRepoOpen] = useState(false)

  const handleImport = async () => {
    if (importing || picking) return
    setPicking(true)
    try {
      const folder = await api.pickFolder()
      if (!folder) return
      const started = performance.now()
      setImporting({ type: 'project', total: 1, current: 0, label: folder })
      try {
        await api.importProject(folder, '')
        await refresh()
      } catch (e) {
        console.error('[new-ui] import failed:', e)
        alert(String(e))
      } finally {
        const remaining = MIN_IMPORT_TIME - (performance.now() - started)
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining))
        }
        setImporting(null)
      }
    } finally {
      setPicking(false)
    }
  }

  const handleCloneResult = () => {
    setCloneRepoOpen(false)
    refresh()
  }

  return (
    <>
      <div className="flex items-stretch gap-1">
        <motion.button
          type="button"
          {...(!importing && !picking ? TOOL_BUTTON_ANIMATION : {})}
          onClick={handleImport}
          disabled={!!importing || picking}
          className={`${TOOL_BUTTON_CLASS} px-6 rounded-l-dropdown-btn rounded-r-[4px] disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {t('import')}
        </motion.button>
        <Dropdown
          align="right"
          trigger={({ open, toggle }) => (
            <motion.button
              type="button"
              aria-label={t('more_import_options')}
              aria-expanded={open}
              {...TOOL_BUTTON_ANIMATION}
              onClick={toggle}
              className={`${TOOL_BUTTON_CLASS} px-[5px] rounded-r-dropdown rounded-l-[4px]`}
            >
              <IconChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  open ? 'rotate-180 text-ink' : ''
                }`}
              />
            </motion.button>
          )}
          items={[
            {
              key: 'clone-repo',
              label: t('clone_import_repo'),
              icon: IconGitBranch,
              onClick: () => setCloneRepoOpen(true),
            },
          ]}
        />
      </div>

      <ImportOverlay importing={importing} onDismiss={() => setImporting(null)} />

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
    </>
  )
}
