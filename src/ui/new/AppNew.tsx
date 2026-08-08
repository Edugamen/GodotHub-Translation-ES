import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaces } from '../../hooks/useWorkspaces'
import { useGodotVersionsContext } from '../../hooks/godotVersionsContext'

import { SidebarNew } from './components/SidebarNew'
import { ProjectsViewNew } from './views/ProjectsViewNew'
import {
  IconBookOpen,
  IconCloudArrowDown,
  IconFolder,
  IconGear,
  IconNews,
  IconRocket,
  IconStore,
} from '../../components/Icons'
import './colors.css'

const TABS = [
  { id: 'projects', navKey: 'projects', icon: IconFolder },
  { id: 'versions', navKey: 'versions', icon: IconCloudArrowDown },
  { id: 'templates', navKey: 'templates', icon: IconRocket },
  { id: 'asset-store', navKey: 'asset_store', icon: IconStore },
  { id: 'news', navKey: 'news', icon: IconNews },
  { id: 'settings', navKey: 'settings', icon: IconGear, footer: true },
  { id: 'changelog', navKey: 'changelog', icon: IconBookOpen, footer: true, iconOnly: true },
] as const

export type NewTab = (typeof TABS)[number]['id']

function PlaceholderView({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-10">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent-dim/30 flex items-center justify-center text-accent-bright text-lg font-semibold">
        {title.slice(0, 1)}
      </div>
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="text-sm text-muted max-w-sm leading-relaxed">{description}</p>
      {children}
      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-amber/10 text-amber border border-amber/20">
        New UI · under construction
      </span>
    </div>
  )
}

export function AppNew() {
  const { t } = useTranslation('nav')
  const { workspaces, activeId } = useWorkspaces()
  const { installed } = useGodotVersionsContext()
  const [tab, setTab] = useState<NewTab>('projects')

  const tabs = TABS.map((tab) => ({
    id: tab.id,
    label: t(tab.navKey),
    icon: tab.icon,
    footer: 'footer' in tab ? tab.footer : undefined,
    iconOnly: 'iconOnly' in tab ? tab.iconOnly : undefined,
  }))

  const activeWorkspace =
    workspaces.find((w) => w.id === activeId)?.name ?? ''

  const renderView = () => {
    switch (tab) {
      case 'projects':
        return <ProjectsViewNew onOpenSettings={() => setTab('settings')} />
      case 'versions':
        return (
          <PlaceholderView
            title={t('versions')}
            description="The redesigned Versions view will live here as its own file in src/ui/new/views/."
          >
            <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
              {installed.length} installed
            </span>
          </PlaceholderView>
        )
      case 'news':
        return (
          <PlaceholderView
            title={t('news')}
            description="The redesigned News view will live here as its own file in src/ui/new/views/."
          />
        )
      case 'templates':
        return (
          <PlaceholderView
            title={t('templates')}
            description="The redesigned Templates view will live here as its own file in src/ui/new/views/."
          />
        )
      case 'asset-store':
        return (
          <PlaceholderView
            title={t('asset_store')}
            description="The redesigned Asset Store view will live here as its own file in src/ui/new/views/."
          />
        )
      case 'settings':
        return (
          <PlaceholderView
            title={t('settings')}
            description="The redesigned Settings view will live here as its own file in src/ui/new/views/."
          />
        )
      case 'changelog':
        return (
          <PlaceholderView
            title={t('changelog')}
            description="The redesigned Changelog view will live here as its own file in src/ui/new/views/."
          />
        )
    }
  }

  return (
    <div className="new-ui h-screen w-screen flex flex-col bg-base text-ink font-body">
      {/* New top bar */}
      <header
        data-tauri-drag-region
        className="shrink-0 h-12 px-5 flex items-center gap-3 border-b border-line select-none"
      >
        <span className="font-display font-semibold tracking-tight">GodotHub</span>
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/15 text-accent-bright border border-accent-dim/40">
          New UI
        </span>
        <span className="ml-auto text-xs text-muted truncate">
          {activeWorkspace}
        </span>
      </header>

      <div className="relative flex-1 flex min-h-0 p-4 gap-4">
        {/* New sidebar */}
        <SidebarNew tabs={tabs} activeTab={tab} onTabChange={(id) => setTab(id as NewTab)} />

        {/* New view area */}
        <main className="flex-1 self-start min-w-0 px-6 py-4 relative rounded-3xl bg-raised">{renderView()}</main>
      </div>
    </div>
  )
}
