import { AnimatePresence, motion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { IconProps } from '../../lib/icons'

export interface NewDropdownItem {
  key: string
  label: string
  icon?: ComponentType<IconProps>
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  active?: boolean
  dotColor?: string
  shortcut?: string
  dividerAfter?: boolean
  badge?: string
}

interface NewDropdownProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  items: NewDropdownItem[]
  align?: 'left' | 'right'
  menuClassName?: string
  compact?: boolean
}

const MENU_FALLBACK_HEIGHT = 220

const MENU_FALLBACK_WIDTH = 240

const GAP = 8

export function Dropdown({
  trigger,
  items,
  align = 'right',
  menuClassName = '',
  compact = false,
}: NewDropdownProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [pos, setPos] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => setOpen((v) => !v), [])

  useEffect(() => {
    if (!open) return
    window.dispatchEvent(new CustomEvent('app:dropdown-open'))
    return () => {
      window.dispatchEvent(new CustomEvent('app:dropdown-close'))
    }
  }, [open])

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const mh = menuRef.current?.offsetHeight ?? MENU_FALLBACK_HEIGHT
    const mw = menuRef.current?.offsetWidth ?? MENU_FALLBACK_WIDTH
    const spaceBelow = window.innerHeight - r.bottom
    const spaceAbove = r.top
    const up = spaceBelow < mh && spaceAbove > spaceBelow
    setOpenUp(up)

    const spaceLeft = r.right
    const spaceRight = window.innerWidth - r.left
    const leftSide =
      align === 'right'
        ? !(spaceLeft < mw && spaceRight > spaceLeft)
        : spaceRight < mw && spaceLeft > spaceRight

    setPos({
      left: leftSide ? r.right - mw : r.left,
      top: up ? r.top - mh - GAP : r.bottom + GAP,
      width: mw,
    })
  }, [align])

  useLayoutEffect(() => {
    if (open) measure()
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (menuRef.current?.contains(e.target as Node)) return
        setOpen(false)
      }
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const first = menuRef.current?.querySelector<HTMLButtonElement>(
      'button[role="menuitem"]:not(:disabled)',
    )
    first?.focus()
  }, [open])

  const handleMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? [],
    ).filter((b) => !b.disabled)
    if (items.length === 0) return
    const idx = items.indexOf(document.activeElement as HTMLButtonElement)
    let next = idx
    if (e.key === 'ArrowDown') next = (idx + 1) % items.length
    else if (e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else return
    e.preventDefault()
    items[next]?.focus()
  }

  return (
    <>
      <div ref={ref} className="relative flex items-stretch w-fit">
        {trigger({ open, toggle })}
      </div>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.96 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              role="menu"
              onKeyDown={handleMenuKey}
              style={{ left: pos?.left, top: pos?.top, width: pos?.width }}
              className={`fixed z-50 rounded-menu border border-outline/50 bg-overlay shadow-md shadow-black/10 min-w-60 ${compact ? 'p-1' : 'p-1.5'} ${
                openUp ? 'origin-bottom' : 'origin-top'
              } ${menuClassName}`}
            >
              {items.map((item) => (
                <div key={item.key}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false)
                      item.onClick?.()
                    }}
                    className={`w-full flex items-center gap-1 rounded-item text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      compact ? 'px-2 py-1.5' : 'px-2.5 py-2'
                    } ${
                      item.danger
                        ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                        : item.active
                          ? 'text-ink bg-accent hover:bg-accent'
                          : 'text-muted hover:bg-raised hover:text-ink'
                    }`}
                  >
                    {item.icon && (
                      <span
                        className={`${
                          compact ? 'w-6 h-6' : 'w-7 h-7'
                        } rounded-btn flex items-center justify-center shrink-0 ${
                          item.danger
                            ? 'bg-red-500/10'
                            : item.active
                              ? 'bg-accent/20'
                              : 'bg-transparent'
                        }`}
                      >
                        <item.icon
                          className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${item.danger ? 'text-red-400' : item.active ? 'text-accent-bright' : 'text-muted'}`}
                        />
                      </span>
                    )}
                    {item.dotColor && (
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.dotColor }}
                      />
                    )}
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-tag border ${
                          item.active
                            ? 'bg-black/15 text-ink border-black/10'
                            : 'bg-accent/10 text-accent-bright border-accent-dim/40'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.shortcut && (
                      <span className="text-[10px] text-muted font-mono shrink-0">{item.shortcut}</span>
                    )}
                  </button>
                  {item.dividerAfter && (
                    <div className={`h-px bg-white/6 ${compact ? 'my-0.5' : 'my-1'}`} />
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
