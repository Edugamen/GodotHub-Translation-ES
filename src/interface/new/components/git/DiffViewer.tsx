import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { GitDiffResult } from '../../../../types'
import { api } from '../../../../lib/api'
import { IconX, IconRefresh } from '../../lib/icons'

interface Props {
  projectPath: string
  filePath: string
  onClose: () => void
}

export function DiffViewer({ projectPath, filePath, onClose }: Props) {
  const { t } = useTranslation('git')
  const [diff, setDiff] = useState<GitDiffResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.gitFileDiff(projectPath, filePath).then((d) => {
      if (!cancelled) { setDiff(d); setLoading(false) }
    }).catch((e) => {
      if (!cancelled) { setDiff(null); setLoading(false); alert(String(e)) }
    })
    return () => { cancelled = true }
  }, [projectPath, filePath])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-120 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="relative w-[760px] max-w-[calc(100vw-4rem)] max-h-[80vh] bg-surface border border-outline/50 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted/50 shrink-0">{t('diff')}</span>
            <span className="text-sm font-mono text-ink truncate">{filePath}</span>
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="focus-ring cursor-pointer p-2 rounded-item text-muted hover:text-ink hover:bg-raised transition-colors shrink-0"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <IconRefresh className="w-5 h-5 animate-spin text-muted" />
            </div>
          ) : !diff || diff.hunks.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted text-sm">
              {t('no_changes')}
            </div>
          ) : (
            diff.hunks.map((hunk, hunkIdx) => (
              <div key={hunkIdx}>
                <div className="sticky top-0 bg-raised border-b border-line px-4 py-1.5 text-[10px] font-semibold text-muted/60">
                  @@ -{hunk.old_start},{hunk.old_lines} +{hunk.new_start},{hunk.new_lines} @@
                </div>
                <div className="border-b border-line/50 last:border-b-0">
                  {hunk.lines.map((line, lineIdx) => {
                    let bg = ''
                    let prefix = ' '
                    let textColor = 'text-ink'
                    if (line.kind === 'add') { bg = 'bg-mint/10'; prefix = '+'; textColor = 'text-mint' }
                    else if (line.kind === 'delete') { bg = 'bg-danger/10'; prefix = '-'; textColor = 'text-danger' }
                    return (
                      <div
                        key={lineIdx}
                        className={`flex px-4 py-px ${bg}`}
                      >
                        <span className={`w-5 shrink-0 select-none ${textColor} font-bold`}>{prefix}</span>
                        <span className="text-ink whitespace-pre-wrap break-all">{line.content}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
