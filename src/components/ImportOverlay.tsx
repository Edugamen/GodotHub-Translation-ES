import { AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { IconRefresh } from './Icons'

interface ImportOverlayProps {
  importing: {
    type: 'project' | 'version'
    total: number
    current: number
  } | null
  onDismiss: () => void
}

export function ImportOverlay({ importing, onDismiss }: ImportOverlayProps) {
  const { t } = useTranslation('common')

  return (
    <AnimatePresence>
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-line rounded-2xl px-8 py-6 flex flex-col items-center gap-3 min-w-64">
            <IconRefresh className="w-6 h-6 animate-spin text-accent" />
            <p className="text-sm font-medium text-ink">
              {importing.type === 'version'
                ? t('importing_version')
                : importing.total > 1
                  ? t('importing_progress', { current: importing.current, total: importing.total })
                  : t('importing_project')}
            </p>
            {importing.total > 1 && (
              <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{
                    width: `${(importing.current / importing.total) * 100}%`,
                  }}
                />
              </div>
            )}
            <button
              onClick={onDismiss}
              className="focus-ring cursor-pointer text-xs text-muted hover:text-ink transition-colors mt-1"
            >
              {t('resume_background')}
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
