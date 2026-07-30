import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { IconPlay, IconX } from './Icons'
import { ConfirmDialog } from './modals/ConfirmDialog'

interface LaunchOverlayProps {
  launching: { id: string; name: string; version: string } | null
  confirmingStop: boolean
  onStop: () => void
  onCancelStop: () => void
  onDismiss: () => void
}

export function LaunchOverlay({
  launching,
  confirmingStop,
  onStop,
  onCancelStop,
  onDismiss,
}: LaunchOverlayProps) {
  const { t } = useTranslation('common')

  return (
    <>
      <AnimatePresence>
        {launching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="relative z-10 bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 p-8 w-full max-w-sm flex flex-col items-center gap-5 text-center"
            >
              <div className="relative w-16 h-16">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-accent/30"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent-bright" />
                </motion.div>
                <div className="absolute inset-3 rounded-full bg-accent/10 flex items-center justify-center">
                  <IconPlay className="w-5 h-5 text-accent-bright" />
                </div>
              </div>

              <div>
                <h3 className="font-display font-semibold text-lg text-ink">
                  {t('starting')}
                </h3>
                <p className="text-sm text-muted mt-1">
                  {launching.name}
                </p>
              </div>

              {launching.version && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-[11px] font-medium text-accent-bright">
                  <IconPlay className="w-3 h-3" />
                  Godot {launching.version}
                </span>
              )}

              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={onDismiss}
                className="focus-ring cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 hover:border-danger text-sm font-medium transition-colors"
              >
                <IconX className="w-4 h-4" />
                {t('stop_launch_btn')}
              </motion.button>

              <p className="text-[10px] text-muted/50">
                {t('launching_desc')}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmingStop && launching && (
          <ConfirmDialog
            title={t('stop_launch_title')}
            description={t('stop_launch_desc', { name: launching.name })}
            confirmLabel={t('stop')}
            variant="danger"
            onConfirm={onStop}
            onCancel={onCancelStop}
          />
        )}
      </AnimatePresence>
    </>
  )
}
