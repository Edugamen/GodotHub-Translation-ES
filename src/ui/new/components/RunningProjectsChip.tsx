import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { api } from '../../../lib/api'
import { useTauriEvent } from '../../../lib/useTauriEvent'
import { IconPlay, IconTerminal, IconX } from '../../../components/Icons'

interface RunningProject {
  id: string
  name: string
  version: string
}

/**
 * Shows which projects are currently running (launched via a card or
 * elsewhere) as a chip in the new UI header. The chip pulses while projects
 * are active and opens a small tray listing each running project with a stop
 * button — the new-UI equivalent of the classic task tray, scoped to running
 * projects. Hides (with an exit animation) when nothing is running.
 *
 * Lives inside the app header's drag region, so every interactive surface
 * stops mousedown propagation — otherwise pressing in the tray would drag the
 * window instead of clicking (Tauri v2 only excludes real buttons/inputs).
 */
export function RunningProjectsChip() {
  const { t } = useTranslation('common')
  const [running, setRunning] = useState<RunningProject[]>([])
  const [open, setOpen] = useState(false)
  // Open the tray upward when there isn't enough room below the chip (e.g. a
  // tall list on a short window) instead of spawning off-screen.
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useTauriEvent<RunningProject>('project:launched', (p) => {
    setRunning((prev) =>
      prev.some((x) => x.id === p.id) ? prev : [...prev, p],
    )
  })

  useTauriEvent<{ id: string }>('project:exited', ({ id }) => {
    setRunning((prev) => prev.filter((x) => x.id !== id))
  })

  const measureOpenUp = useCallback(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const mh = menuRef.current?.offsetHeight ?? 220
    const spaceBelow = window.innerHeight - r.bottom
    const spaceAbove = r.top
    setOpenUp(spaceBelow < mh && spaceAbove > spaceBelow)
  }, [])

  useLayoutEffect(() => {
    if (open) measureOpenUp()
  }, [open, measureOpenUp])

  // Re-evaluate while open (resizing the window can change the room available).
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', measureOpenUp, true)
    window.addEventListener('resize', measureOpenUp)
    return () => {
      window.removeEventListener('scroll', measureOpenUp, true)
      window.removeEventListener('resize', measureOpenUp)
    }
  }, [open, measureOpenUp])

  // Close the tray when clicking anywhere outside it.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const stop = (id: string) => {
    api.stopProject(id).catch((e) => alert(String(e)))
  }

  // Everything inside the drag-region header must stop mousedown so a press
  // here never starts a window drag.
  const noDrag = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div ref={ref} className="relative shrink-0">
      <AnimatePresence>
        {running.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            onMouseDown={noDrag}
            className="relative"
          >
            <motion.button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={t('running')}
              aria-haspopup="menu"
              aria-expanded={open}
              title={t('running')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-item bg-overlay border border-outline/50 text-muted hover:text-ink hover:border-accent-dim transition-colors"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full w-2 h-2 bg-mint" />
              </span>
              <IconPlay className="w-3 h-3 text-mint" />
              <span className="text-[13px] font-semibold tabular-nums">
                {running.length}
              </span>
            </motion.button>

            <AnimatePresence>
              {open && (
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  onMouseDown={noDrag}
                  className={`absolute right-0 z-50 w-72 rounded-card bg-surface border border-line shadow-2xl shadow-black/40 p-1.5 origin-top-right ${
                    openUp
                      ? 'bottom-full mb-2 origin-bottom'
                      : 'top-full mt-2 origin-top'
                  }`}
                >
                  <div className="px-3 py-2 border-b border-line/50 mb-1">
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
                      {t('running')}
                    </h3>
                    <p className="text-[10px] text-muted/50 mt-0.5">
                      {t('running_projects_desc', { count: running.length })}
                    </p>
                  </div>
                  <div className="flex flex-col max-h-[min(60vh,26rem)] overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      {running.map((p) => (
                        <motion.div
                          key={p.id}
                          layout
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-item hover:bg-raised transition-colors"
                        >
                          <IconTerminal className="w-3.5 h-3.5 text-mint shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">
                              {p.name}
                            </p>
                            {p.version && (
                              <p className="text-[10px] text-muted/60 font-mono truncate">
                                Godot {p.version}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => stop(p.id)}
                            aria-label={t('stop')}
                            title={t('stop')}
                            className="focus-ring cursor-pointer w-6 h-6 rounded-item inline-flex items-center justify-center text-muted/50 hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                          >
                            <IconX className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
