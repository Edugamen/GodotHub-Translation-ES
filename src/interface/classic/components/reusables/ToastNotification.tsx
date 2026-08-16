import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { announce } from '../../../../lib/screenReader'
import { IconCheck, IconX } from '../../lib/Icons'

interface SuccessNotificationData {
  count: number
  firstId: string
  firstProjectName: string
  failCount?: number
}

interface SuccessToastProps {
  notification: SuccessNotificationData | null
  onDismiss: () => void
}

export function SuccessToast({ notification, onDismiss }: SuccessToastProps) {
  const { t } = useTranslation('common')

  useEffect(() => {
    if (notification) {
      announce(
        notification.count === 1
          ? `${t('imported_successfully')}: ${notification.firstProjectName}`
          : t('imported_count', { count: notification.count }),
      )
    }
  }, [notification, t])

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-110 flex items-center gap-3 px-5 py-3 rounded-xl bg-mint/10 border border-mint/30 shadow-lg backdrop-blur-md max-w-lg"
        >
          <div className="w-8 h-8 rounded-full bg-mint/15 flex items-center justify-center shrink-0">
            <IconCheck className="w-4 h-4 text-mint" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-mint uppercase tracking-wide">
              {notification.count === 1
                ? t('imported_successfully')
                : t('imported_count', { count: notification.count })}
            </p>
            <p className="text-sm text-ink mt-0.5 truncate">
              {notification.count === 1
                ? notification.firstProjectName
                : notification.failCount && notification.failCount > 0
                  ? t('succeeded_failed', { succeeded: notification.count, failed: notification.failCount })
                  : t('all_imported', { count: notification.count })}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="focus-ring cursor-pointer shrink-0 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-black/10 transition-colors"
            aria-label={t('dismiss')}
          >
            <IconX className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ErrorToastProps {
  message: string | null
  onDismiss: () => void
}

export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  const { t } = useTranslation('common')

  useEffect(() => {
    if (message) announce(message)
  }, [message])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-110 flex items-center gap-3 px-5 py-3 rounded-xl bg-danger/10 border border-danger/30 shadow-lg backdrop-blur-md max-w-lg"
        >
          <div className="w-8 h-8 rounded-full bg-danger/15 flex items-center justify-center shrink-0">
            <IconX className="w-4 h-4 text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-danger uppercase tracking-wide">
              {t('import_failed')}
            </p>
            <p className="text-sm text-ink mt-0.5">
              {message}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="focus-ring cursor-pointer shrink-0 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-black/10 transition-colors"
            aria-label={t('dismiss')}
          >
            <IconX className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
