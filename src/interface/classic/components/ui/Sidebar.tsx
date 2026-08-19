import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { WorkspaceSwitcher } from '../../WorkspaceSwitcher'
import { useUpdatesBadge } from '../../../../hooks/useUpdatesBadge'
import { useChangelogBadge } from '../../../../hooks/useChangelogBadge'
import { Tooltip } from '../reusables/Tooltip'
import {
  IconBell,
  IconBookOpen,
  IconChevronsLeft,
  IconChevronsRight,
  IconCopy,
  IconGear,
  IconLayoutGrid,
  IconLayoutList,
  IconNews,
  IconStore,
} from '../../lib/Icons'

export type Tab =
  | 'projects'
  | 'versions'
  | 'news'
  | 'templates'
  | 'asset-store'
  | 'updates'
  | 'settings'
  | 'changelog'

const NAV_ITEMS: { tab: Tab; labelKey: string; icon: typeof IconLayoutGrid }[] = [
  { tab: 'projects', labelKey: 'projects', icon: IconLayoutGrid },
  { tab: 'versions', labelKey: 'versions', icon: IconLayoutList },
  { tab: 'templates', labelKey: 'templates', icon: IconCopy },
  { tab: 'asset-store', labelKey: 'asset_store', icon: IconStore },
  { tab: 'news', labelKey: 'news', icon: IconNews },
]

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed'
const SIDEBAR_COLLAPSED_WIDTH_KEY = 'sidebar_width_collapsed'
const SIDEBAR_EXPANDED_WIDTH_KEY = 'sidebar_width_expanded'

function loadCollapsedWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSED_WIDTH_KEY)
    const n = Number(raw)
    if (n >= 50 && n <= 120) return n
  } catch {}
  return 76
}

function loadExpandedWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_EXPANDED_WIDTH_KEY)
    const n = Number(raw)
    if (n >= 150 && n <= 350) return n
  } catch {}
  return 230
}

interface SidebarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  workspacesEnabled: boolean
  paletteKey: string
  onOpenCommandPalette: () => void
}

export function Sidebar({
  activeTab,
  onTabChange,
  workspacesEnabled,
  paletteKey,
  onOpenCommandPalette,
}: SidebarProps) {
  const { t: tNav } = useTranslation('nav')
  const { t } = useTranslation('common')
  const { hasUnseen } = useUpdatesBadge()
  const { hasNewEntry: hasNewChangelogEntry, markSeen: markChangelogSeen } = useChangelogBadge()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [sidebarCollapsedWidth, setSidebarCollapsedWidth] =
    useState(loadCollapsedWidth)
  const [sidebarExpandedWidth, setSidebarExpandedWidth] =
    useState(loadExpandedWidth)

  useEffect(() => {
    const handler = () => {
      setSidebarCollapsedWidth(loadCollapsedWidth())
      setSidebarExpandedWidth(loadExpandedWidth())
    }
    window.addEventListener('app:sidebar-width-changed', handler)
    return () =>
      window.removeEventListener('app:sidebar-width-changed', handler)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }

  const displayWidth = collapsed ? sidebarCollapsedWidth : sidebarExpandedWidth

  const renderNavButton = (
    tabId: Tab,
    label: string,
    Icon: typeof IconLayoutGrid,
  ) => {
    const active = activeTab === tabId
    const btn = (
      <button
        key={tabId}
        onClick={() => {
          if (tabId === 'changelog') markChangelogSeen()
          onTabChange(tabId)
        }}
        aria-label={label}
        className={`focus-ring cursor-pointer icon-wiggle relative flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          collapsed
            ? 'w-11 h-11 justify-center px-0'
            : 'w-full pl-4 pr-3'
        } ${
          active
            ? 'text-ink'
            : 'text-muted hover:text-ink hover:bg-raised/60'
        } ${
          hasNewChangelogEntry && tabId === 'changelog' && !active
            ? 'changelog-shine'
            : ''
        }`}
      >
        {active && (
          <motion.span
            layoutId="nav-active-pill"
            transition={{ type: 'spring', stiffness: 350, damping: 34 }}
            className="absolute inset-0 rounded-lg bg-raised border border-line"
          />
        )}
        <Icon
          className={`relative w-4 h-4 shrink-0 ${active ? 'text-accent-bright' : ''}`}
        />
        {!collapsed && (
          <span className="relative">{label}</span>
        )}
        {hasUnseen && tabId === 'updates' && !active && (
          <span className="absolute top-1 right-1 flex w-2 h-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent-bright opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-accent-bright shadow-[0_0_6px_2px] shadow-accent/50" />
          </span>
        )}
      </button>
    )
    return collapsed ? (
      <Tooltip key={tabId} content={label} side="right">
        {btn}
      </Tooltip>
    ) : (
      btn
    )
  }

  return (
    <aside
      className="group relative border-r border-line flex flex-col p-4 gap-1 bg-surface/40 transition-[width] duration-200 ease-out"
      style={{ width: displayWidth }}
    >
      <nav
        className={`flex flex-col gap-1.5 mt-3 w-full ${collapsed ? 'items-center' : ''}`}
      >
        {NAV_ITEMS.map(({ tab: tabId, labelKey, icon: Icon }) =>
          renderNavButton(tabId, tNav(labelKey), Icon),
        )}
      </nav>

      <div
        className={`mt-auto pt-4 border-t border-line w-full flex flex-col gap-1 ${collapsed ? 'items-center' : ''}`}
      >
        {workspacesEnabled && (
          <WorkspaceSwitcher collapsed={collapsed} />
        )}

        {!collapsed && (
          <div className="w-full px-3 mt-2 mb-1">
            <button
              onClick={onOpenCommandPalette}
              className="focus-ring cursor-pointer w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-line/50 text-[10px] font-medium text-muted/50 hover:text-muted hover:border-line hover:bg-raised/30 transition-colors"
            >
              <kbd className="font-mono text-[9px] px-1 py-0.5 rounded bg-raised border border-line">
                {navigator.platform.includes('Mac')
                  ? `⌘${paletteKey.toUpperCase()}`
                  : `Ctrl+${paletteKey.toUpperCase()}`}
              </kbd>
              <span>{t('quick_commands')}</span>
            </button>
          </div>
        )}

        {renderNavButton('updates', tNav('updates'), IconBell)}
        {renderNavButton('changelog', tNav('changelog'), IconBookOpen)}
        {renderNavButton('settings', tNav('settings'), IconGear)}
      </div>

      <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-20">
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? t('expand_sidebar') : t('collapse_sidebar')}
          className="focus-ring cursor-pointer w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-line text-muted hover:text-ink hover:border-accent-dim transition-opacity opacity-0 group-hover:opacity-100 shadow-sm"
        >
          {collapsed ? (
            <IconChevronsRight className="w-5 h-5" />
          ) : (
            <IconChevronsLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </aside>
  )
}
