import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ViewHeader } from './components/ViewHeader'
import { useProjectsContext } from '../../hooks/projectsContext'
import { api } from '../../lib/api'
import type { GitStatus, Project } from '../../types'

import { SidebarNew } from './components/SidebarNew'
import { TitlebarNew } from './components/TitlebarNew'
import { OverlayScrollArea } from './components/OverlayScrollArea'
import { ConfirmDialog } from './components/modals/ConfirmDialog'
import { GitSidebar } from './components/git/GitSidebar'
import { ProjectsViewNew } from './views/ProjectsViewNew'
import { VersionsViewNew } from './views/VersionsViewNew'
import { SettingsViewNew } from './views/SettingsViewNew'
import { useSettings } from '../../hooks/useSettings'
import { useTauriEvent } from '../../lib/useTauriEvent'
import {
  IconBookOpen,
  IconCloudArrowDown,
  IconFolder,
  IconGear,
  IconNews,
  IconRocket,
  IconStore,
  type IconProps,
} from './lib/icons'
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
  icon: Icon,
  metric,
  children,
}: {
  title: string
  description: string
  icon: (props: IconProps) => ReactNode
  metric?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      <ViewHeader
        title={title}
        leadingAction={
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent text-ink">
            <Icon className="w-4.5 h-4.5" />
          </span>
        }
        metric={metric}
      />
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 text-center px-10">
        <div className="w-14 h-14 rounded-tile bg-accent/10 border border-accent-dim/30 flex items-center justify-center text-accent-bright">
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-sm text-muted max-w-sm leading-relaxed">{description}</p>
        {children}
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-tag bg-amber/10 text-amber border border-amber/20">
          New UI · under construction
        </span>
      </div>
    </div>
  )
}

export function AppNew() {
  const { t } = useTranslation('nav')
  const { t: tc } = useTranslation('common')
  const { settings } = useSettings()
  const { projects, refresh: refreshProjects } = useProjectsContext()
  const projectsRef = useRef(projects)
  projectsRef.current = projects
  const [tab, setTab] = useState<NewTab>('projects')
  const [pendingLaunch, setPendingLaunch] = useState<{
    id: string
    console?: boolean
  } | null>(null)
  const [gitSidebarProject, setGitSidebarProject] = useState<{
    project: Project
    gitStatus: GitStatus | null
  } | null>(null)

  const openProject = useCallback(
    async (projectId: string, withConsole?: boolean) => {
      try {
        await api.openProject(projectId, true, withConsole)
        refreshProjects()
      } catch (err) {
        alert(String(err))
      }
    },
    [refreshProjects],
  )

  useEffect(() => {
    const handleOpenProject = async (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | string
        | { id: string; console?: boolean }
      const projectId = typeof detail === 'string' ? detail : detail.id
      const withConsole = typeof detail === 'string' ? undefined : detail.console
      const project = projectsRef.current.find((p) => p.id === projectId)
      if (project?.session_started_at_ms) {
        setPendingLaunch({ id: projectId, console: withConsole })
        return
      }
      await openProject(projectId, withConsole)
    }
    window.addEventListener('app:open-project', handleOpenProject)
    return () =>
      window.removeEventListener('app:open-project', handleOpenProject)
  }, [openProject])

  useTauriEvent<{ id: string }>('project:exited', () => refreshProjects())

  useEffect(() => {
    const handleShowGitSidebar = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        project: Project
        gitStatus: GitStatus | null
      }
      setGitSidebarProject(detail)
    }
    window.addEventListener('app:show-git-sidebar', handleShowGitSidebar)
    return () =>
      window.removeEventListener('app:show-git-sidebar', handleShowGitSidebar)
  }, [])

  useEffect(() => {
    if (!gitSidebarProject) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGitSidebarProject(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gitSidebarProject])

  const tabs = TABS.map((tab) => ({
    id: tab.id,
    label: t(tab.navKey),
    icon: tab.icon,
    footer: 'footer' in tab ? tab.footer : undefined,
    iconOnly: 'iconOnly' in tab ? tab.iconOnly : undefined,
  }))

  const renderView = () => {
    switch (tab) {
      case 'projects':
        return <ProjectsViewNew onOpenSettings={() => setTab('settings')} />
      case 'versions':
        return <VersionsViewNew onOpenSettings={() => setTab('settings')} />
      case 'news':
        return (
          <PlaceholderView
            title={t('news')}
            icon={IconNews}
            description="The redesigned News view will live here as its own file in src/ui/new/views/."
          />
        )
      case 'templates':
        return (
          <PlaceholderView
            title={t('templates')}
            icon={IconRocket}
            description="The redesigned Templates view will live here as its own file in src/ui/new/views/."
          />
        )
      case 'asset-store':
        return (
          <PlaceholderView
            title={t('asset_store')}
            icon={IconStore}
            description="The redesigned Asset Store view will live here as its own file in src/ui/new/views/."
          />
        )
      case 'settings':
        return <SettingsViewNew />
      case 'changelog':
        return (
          <PlaceholderView
            title={t('changelog')}
            icon={IconBookOpen}
            description="The redesigned Changelog view will live here as its own file in src/ui/new/views/."
          />
        )
    }
  }

  return (
    <div className="new-ui h-screen w-screen flex flex-col bg-base text-ink font-body">
      <TitlebarNew />

      <div className="relative flex-1 flex min-h-0 p-4 pt-3 gap-4">
        <SidebarNew
          tabs={tabs}
          activeTab={tab}
          onTabChange={(id) => {
            setGitSidebarProject(null)
            setTab(id as NewTab)
          }}
        />

        {tab === 'projects' || tab === 'settings' || tab === 'versions' ? (
          renderView()
        ) : (
          <main className="flex-1 min-w-0 relative rounded-card bg-raised overflow-hidden">
            <OverlayScrollArea
              className="absolute inset-0"
              hideThumb={!settings.show_scrollbars}
            >
              <div className="min-h-full px-6 py-4">
                {renderView()}
              </div>
            </OverlayScrollArea>
          </main>
        )}

        <AnimatePresence>
          {gitSidebarProject && (
            <>
              <motion.div
                key="git-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setGitSidebarProject(null)}
                className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm"
              />
              <motion.aside
                key="git-panel"
                initial={{ x: 420, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 420, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                className="absolute right-3 top-3 bottom-3 z-40"
              >
                <GitSidebar
                  project={gitSidebarProject.project}
                  gitStatus={gitSidebarProject.gitStatus}
                  onClose={() => setGitSidebarProject(null)}
                  onRefresh={() => refreshProjects()}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {pendingLaunch && (
          <ConfirmDialog
            title={tc('project_already_open_title')}
            description={tc('project_already_open_desc', {
              name:
                projects.find((p) => p.id === pendingLaunch.id)?.name ??
                pendingLaunch.id,
            })}
            confirmLabel={tc('project_open_anyway')}
            onConfirm={() => {
              const pending = pendingLaunch
              setPendingLaunch(null)
              openProject(pending.id, pending.console)
            }}
            onCancel={() => setPendingLaunch(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
