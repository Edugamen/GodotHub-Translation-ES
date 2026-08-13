import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { IconChevronDown } from '../../lib/Icons'

export interface DropdownOption {
  value: string
  label: string
  dotClassName?: string
  dotColor?: string
  badge?: string
}

interface Props {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  emptyLabel?: string
  className?: string
  openUp?: boolean
  hideEmpty?: boolean
}

const GAP = 8
const OPEN_UP_THRESHOLD = 160
const EDGE_PADDING = 8

export function Dropdown({
  value,
  options,
  onChange,
  emptyLabel: emptyLabelProp,
  className = '',
  openUp,
  hideEmpty,
}: Props) {
  const { t } = useTranslation('versions')
  const emptyLabel = emptyLabelProp ?? t('choose_version')
  const [open, setOpen] = useState(false)
  const [dir, setDir] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (listRef.current?.contains(e.target as Node)) return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const measure = useCallback(() => {
    const el = ref.current
    if (!el || !listRef.current) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const d = openUp !== undefined ? openUp : spaceBelow < OPEN_UP_THRESHOLD
    const h = listRef.current.offsetHeight
    setDir(d)
    setPos({
      left: r.left,
      top: Math.max(EDGE_PADDING, d ? r.top - h - GAP : r.bottom + GAP),
      width: r.width,
    })
  }, [openUp])

  const handleToggle = useCallback(() => {
    setOpen((o) => !o)
  }, [])

  useLayoutEffect(() => {
    if (open) measure()
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    const reposition = () => measure()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, measure])

  const selected = options.find((o) => o.value === value)

  return (
    <>
      <div ref={ref} className={`relative ${className}`}>
        <button
          type="button"
          onClick={handleToggle}
          className={`focus-ring cursor-pointer w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-raised border text-xs text-ink transition-colors ${
            open ? 'border-accent' : 'border-line hover:border-accent-dim'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            {selected?.dotColor ? (
              <span
                className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10"
                style={{ backgroundColor: selected.dotColor }}
              />
            ) : (
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${selected?.dotClassName ?? 'bg-line'}`}
              />
            )}
            <span className="flex items-center gap-2 min-w-0">
              <span className="truncate font-mono">
                {selected ? selected.label : emptyLabel}
              </span>
              {selected?.badge && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent-bright border border-accent-dim/40 font-semibold">
                  {selected.badge}
                </span>
              )}
            </span>
          </span>
          <IconChevronDown
            className={`w-3.5 h-3.5 text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`}
          />
        </button>
      </div>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={listRef}
              initial={{ opacity: 0, y: dir ? 6 : -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: dir ? 6 : -6, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={`fixed z-50 ${dir ? 'origin-bottom' : 'origin-top'} min-w-44 rounded-xl border border-line bg-surface shadow-2xl shadow-black/40 p-1.5 max-h-60 overflow-y-auto`}
              style={{ left: pos?.left, top: pos?.top, width: pos?.width }}
            >
              {!hideEmpty && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                  }}
                  className={`w-full flex items-center cursor-pointer gap-2 text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                    value === ''
                      ? 'bg-accent/20 text-accent-bright'
                      : 'text-muted hover:bg-raised hover:text-ink'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-line" />
                  {emptyLabel}
                </button>
              )}
              {options.map((o, idx) => (
                <button
                  key={`${o.value}__${idx}`}
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center cursor-pointer gap-2 text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                    value === o.value
                      ? 'bg-accent/20 text-accent-bright'
                      : 'text-ink hover:bg-raised'
                  }`}
                >
                  {o.dotColor ? (
                    <span
                      className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10"
                      style={{ backgroundColor: o.dotColor }}
                    />
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${o.dotClassName ?? 'bg-line'}`}
                    />
                  )}
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{o.label}</span>
                    {o.badge && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent-bright border border-accent-dim/40 font-semibold">
                        {o.badge}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
