import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { IconDownload, IconFolderPlus } from './Icons'

interface DragDropOverlayProps {
  visible: boolean
  type: 'project' | 'version'
}

export function DragDropOverlay({ visible, type }: DragDropOverlayProps) {
  const { t } = useTranslation('common')

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-100 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60"
          />

          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`relative z-10 flex flex-col items-center gap-5 px-14 py-11 rounded-2xl bg-surface border-2 border-dashed shadow-2xl ${
              type === 'version'
                ? 'border-amber/60'
                : 'border-accent/60'
            }`}
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                type === 'version'
                  ? 'bg-amber/10'
                  : 'bg-accent/10'
              }`}
            >
              {type === 'version' ? (
                <IconDownload className="w-7 h-7 text-amber" />
              ) : (
                <IconFolderPlus className="w-7 h-7 text-accent-bright" />
              )}
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-ink">
                {type === 'version'
                  ? t('drop_godot_zip')
                  : t('drop_project_folders')}
              </p>
              <p className="text-sm mt-1">
                {type === 'version' ? (
                  <span className="text-amber">
                    {t('drop_version_desc')}
                  </span>
                ) : (
                  <span className="text-muted">
                    {t('drop_project_desc')}{' '}
                    <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-raised border border-line">
                      {t('project_godot_file')}
                    </code>{' '}
                    {t('file')}
                  </span>
                )}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
