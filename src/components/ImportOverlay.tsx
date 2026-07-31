import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ImportProgressCard } from './ImportProgressCard'
import { IconImport } from './Icons'

interface ImportOverlayProps {
  importing: {
    type: 'project' | 'version'
    total: number
    current: number
    label?: string | null
  } | null
  onDismiss: () => void
}

export function ImportOverlay({ importing, onDismiss }: ImportOverlayProps) {
  const { t } = useTranslation('common')

  return (
    <AnimatePresence>
      {importing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full flex justify-center"
          >
            <ImportProgressCard
              icon={<IconImport className="w-5 h-5 text-accent-bright" />}
              title={
                importing.type === 'version'
                  ? t('importing_version')
                  : t('importing_project')
              }
              label={importing.label ?? null}
              progress={
                importing.total > 1
                  ? { current: importing.current, total: importing.total }
                  : null
              }
              onMinimize={onDismiss}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
