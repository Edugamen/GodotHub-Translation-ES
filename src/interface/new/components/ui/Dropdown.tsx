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
  /** Submenu items — renders a hover-triggered sub-dropdown to the right */
  submenu?: NewDropdownItem[]
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
const SUBMENU_DELAY = 200
const SUBMENU_CLOSE_DELAY = 300

/** Recursively calculate the total rendered height of a menu item list */
function estimateMenuHeight(items: NewDropdownItem[], compact: boolean): number {
  let h = compact ? 4 : 6 // padding
  for (const item of items) {
    h += compact ? 28 : 34 // item row
    if (item.dividerAfter) h += compact ? 4 : 8
  }
  return h
}

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

  // Submenu state
  const [hoveredSubmenuKey, setHoveredSubmenuKey] = useState<string | null>(null)
  const [submenuPos, setSubmenuPos] = useState<{
    left: number
    top: number
  } | null>(null)
  const [submenuOpenUp, setSubmenuOpenUp] = useState(false)
  const submenuOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submenuRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => setOpen((v) => !v), [])

  useEffect(() => {
    if (!open) return
    setHoveredSubmenuKey(null)
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
    const vw = window.innerWidth
    const vh = window.innerHeight

    const spaceBelow = vh - r.bottom
    const spaceAbove = r.top
    const openDown = spaceBelow >= mh || spaceBelow >= spaceAbove
    setOpenUp(!openDown)

    let left: number
    if (align === 'right') {
      const preferredLeft = r.right - mw
      if (preferredLeft >= GAP) {
        left = preferredLeft
      } else if (r.left + mw <= vw - GAP) {
        left = r.left
      } else {
        left = GAP
      }
    } else {
      if (r.left + mw <= vw - GAP) {
        left = r.left
      } else if (r.right - mw >= GAP) {
        left = r.right - mw
      } else {
        left = vw - mw - GAP
      }
    }

    let top: number
    if (openDown) {
      top = r.bottom + GAP
      if (top + mh > vh - GAP) top = vh - mh - GAP
    } else {
      top = r.top - mh - GAP
    }
    if (top < GAP) top = GAP

    setPos({ left, top, width: mw })
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
      // Check if click is inside the menu or any submenu
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (menuRef.current?.contains(e.target as Node)) return
        if (submenuRef.current?.contains(e.target as Node)) return
        setOpen(false)
        setHoveredSubmenuKey(null)
      }
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setHoveredSubmenuKey(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])



  const handleMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const allItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? [],
    ).filter((b) => !b.disabled)
    if (allItems.length === 0) return
    const idx = allItems.indexOf(document.activeElement as HTMLButtonElement)
    let next = idx
    if (e.key === 'ArrowDown') next = (idx + 1) % allItems.length
    else if (e.key === 'ArrowUp') next = (idx - 1 + allItems.length) % allItems.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = allItems.length - 1
    else if (e.key === 'ArrowRight') {
      // Open submenu of focused item
      const focusedItem = allItems[idx]
      if (focusedItem) {
        const itemKey = focusedItem.getAttribute('data-item-key')
        const item = items.find((i) => i.key === itemKey)
        if (item?.submenu?.length) {
          openSubmenuForKey(itemKey!)
        }
      }
      return
    } else if (e.key === 'ArrowLeft') {
      // Close submenu
      setHoveredSubmenuKey(null)
      return
    } else return
    e.preventDefault()
    allItems[next]?.focus()
  }

  // --- Submenu logic ---

  const clearTimers = useCallback(() => {
    if (submenuOpenTimer.current) clearTimeout(submenuOpenTimer.current)
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current)
  }, [])

  const openSubmenuForKey = useCallback(
    (itemKey: string) => {
      clearTimers()
      setHoveredSubmenuKey(itemKey)
    },
    [clearTimers],
  )

  const handleItemMouseEnter = useCallback(
    (item: NewDropdownItem, itemEl: HTMLButtonElement) => {
      if (!item.submenu?.length) return
      clearTimers()
      submenuOpenTimer.current = setTimeout(() => {
        // Calculate submenu position
        const itemRect = itemEl.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight
        const subHeight = estimateMenuHeight(item.submenu!, compact)
        const subWidth = MENU_FALLBACK_WIDTH

        // Prefer right side
        let left = itemRect.right + 25
        let top = itemRect.top

        // If not enough space on right, go left
        if (left + subWidth > vw - GAP) {
          left = itemRect.left - subWidth - 25
        }
        // Clamp horizontal
        if (left < GAP) left = GAP
        if (left + subWidth > vw - GAP) left = vw - subWidth - GAP

        // Vertical: align with parent item, clamp to viewport
        if (top + subHeight > vh - GAP) {
          top = vh - subHeight - GAP
        }
        if (top < GAP) top = GAP

        // Determine if submenu opens up
        const opensUp = top + subHeight > vh - GAP && top - subHeight > GAP

        setSubmenuOpenUp(opensUp)
        setSubmenuPos({ left, top })
        setHoveredSubmenuKey(item.key)
      }, SUBMENU_DELAY)
    },
    [clearTimers, compact],
  )

  const handleItemMouseLeave = useCallback(() => {
    clearTimers()
    submenuCloseTimer.current = setTimeout(() => {
      setHoveredSubmenuKey(null)
    }, SUBMENU_CLOSE_DELAY)
  }, [clearTimers])

  const handleSubmenuMouseEnter = useCallback(() => {
    clearTimers()
  }, [clearTimers])

  const handleSubmenuMouseLeave = useCallback(() => {
    clearTimers()
    submenuCloseTimer.current = setTimeout(() => {
      setHoveredSubmenuKey(null)
    }, SUBMENU_CLOSE_DELAY)
  }, [clearTimers])

  // Clean up timers on unmount
  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  const hoveredSubmenuItems = items.find((i) => i.key === hoveredSubmenuKey)?.submenu

  const renderItem = (item: NewDropdownItem) => (
    <div key={item.key}>
      <button
        type="button"
        role="menuitem"
        data-item-key={item.key}
        disabled={item.disabled}
        onClick={() => {
          if (!item.submenu?.length) {
            setOpen(false)
            setHoveredSubmenuKey(null)
            item.onClick?.()
          }
        }}
        onMouseEnter={(e) => handleItemMouseEnter(item, e.currentTarget)}
        onMouseLeave={handleItemMouseLeave}
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
        {item.submenu?.length ? (
          <span className="text-[10px] text-muted/50 shrink-0 ml-1">▸</span>
        ) : null}
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
  )

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
              className={`fixed z-50 rounded-menu border border-outline/50 bg-overlay shadow-md shadow-black/10 min-w-60 ${
                compact ? 'p-1' : 'p-1.5'
              } ${openUp ? 'origin-bottom' : 'origin-top'} ${menuClassName}`}
            >
              {items.map(renderItem)}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Submenu */}
      {createPortal(
        <AnimatePresence>
          {open && hoveredSubmenuItems && submenuPos && (
            <motion.div
              ref={submenuRef}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              role="menu"
              onMouseEnter={handleSubmenuMouseEnter}
              onMouseLeave={handleSubmenuMouseLeave}
              style={{ left: submenuPos.left, top: submenuPos.top }}
              className={`fixed z-60 rounded-menu border border-outline/50 bg-overlay shadow-md shadow-black/10 min-w-60 ${
                compact ? 'p-1' : 'p-1.5'
              } ${submenuOpenUp ? 'origin-bottom' : 'origin-top'}`}
            >
              {hoveredSubmenuItems.map((item) => (
                <div key={item.key}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false)
                      setHoveredSubmenuKey(null)
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
