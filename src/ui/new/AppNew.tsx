import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaces } from '../../hooks/useWorkspaces'
import { useProjectsContext } from '../../hooks/projectsContext'
import { useGodotVersionsContext } from '../../hooks/godotVersionsContext'
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton'

const TABS = [
  { id: 'projects', navKey: 'projects' },
  { id: 'versions', navKey: 'versions' },
  { id: 'news', navKey: 'news' },
  { id: 'templates', navKey: 'templates' },
  { id: 'asset-store', navKey: 'asset_store' },
  { id: 'settings', navKey: 'settings' },
  { id: 'changelog', navKey: 'changelog' },
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
  const { projects } = useProjectsContext()
  const { installed } = useGodotVersionsContext()
  const [tab, setTab] = useState<NewTab>('projects')

  const activeWorkspace =
    workspaces.find((w) => w.id === activeId)?.name ?? ''

  const renderView = () => {
    switch (tab) {
      case 'projects':
        return (
          <PlaceholderView
            title={t('projects')}
            description="The redesigned Projects view will live here as its own file in src/ui/new/views/."
          >
            <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
              {projects.length} projects
            </span>
          </PlaceholderView>
        )
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
    <div className="h-screen w-screen flex flex-col bg-base text-ink font-body">
      <header className="shrink-0 h-12 px-5 flex items-center gap-3 border-b border-line">
        <span className="font-display font-semibold tracking-tight">GodotHub</span>
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/15 text-accent-bright border border-accent-dim/40">
          New UI
        </span>
        <span className="ml-auto text-xs text-muted truncate">
          {activeWorkspace}
        </span>
      </header>

      <div className="relative flex-1 flex min-h-0">
        <nav className="shrink-0 w-52 border-r border-line p-2 flex flex-col gap-1">
          {TABS.map(({ id, navKey }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`focus-ring cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent/15 text-accent-bright border border-accent-dim/40'
                    : 'text-muted border border-transparent hover:text-ink hover:bg-raised/60'
                }`}
              >
                {t(navKey)}
              </button>
            )
          })}
        </nav>

        {/* New view area */}
        <main className="flex-1 overflow-y-auto relative">
          {renderView()}
          <ScrollToTopButton />
        </main>
      </div>
    </div>
  )
}
