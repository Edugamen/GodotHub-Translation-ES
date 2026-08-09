import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconSpinner } from './Icons'

interface ImportProgressCardProps {
  icon: ReactNode
  title: string
  label?: string | null
  progress: { current: number; total: number } | null
  onMinimize: () => void
}

export function ImportProgressCard({
  icon,
  title,
  label,
  progress,
  onMinimize,
}: ImportProgressCardProps) {
  const { t } = useTranslation('common')
  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : null

  return (
    <div className="bg-surface border border-line rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
      <div className="p-6">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent-dim/30 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-muted leading-snug">
              {title}
            </h3>
            {label && (
              <p className="text-xs font-mono text-muted mt-1 truncate">
                {label}
              </p>
            )}
          </div>
        </div>

        {percent !== null ? (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-muted">
                {progress!.current} / {progress!.total}
              </span>
              <span className="text-[11px] font-mono font-semibold text-accent-bright tabular-nums">
                {percent}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-line overflow-hidden">
              <motion.div
                className="h-full bg-accent rounded-full"
                initial={false}
                animate={{ width: `${percent}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-2">
            <IconSpinner className="w-4 h-4 animate-spin text-accent" />
            <span className="text-xs text-muted">{t('loading')}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end px-6 pb-4">
        <button
          onClick={onMinimize}
          className="focus-ring cursor-pointer text-xs text-muted hover:text-ink transition-colors"
        >
          {t('resume_background')}
        </button>
      </div>
    </div>
  )
}
