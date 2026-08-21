import { lazy, Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window'

const ProjectsView = lazy(() =>
  import('./views/ProjectsView').then((m) => ({ default: m.ProjectsView })),
)
const VersionsView = lazy(() =>
  import('./views/VersionsView').then((m) => ({ default: m.VersionsView })),
)
const NewsView = lazy(() =>
  import('./views/NewsView').then((m) => ({ default: m.NewsView })),
)
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView })),
)
const ChangelogView = lazy(() =>
  import('./views/ChangelogView').then((m) => ({ default: m.ChangelogView })),
)
const TemplatesView = lazy(() =>
  import('./views/TemplatesView').then((m) => ({ default: m.TemplatesView })),
)
const UpdatesView = lazy(() =>
  import('./views/UpdatesView').then((m) => ({ default: m.UpdatesView })),
)
const OnboardingView = lazy(() =>
  import('../onboarding/Onboarding').then((m) => ({ default: m.Onboarding })),
)
const AssetStoreView = lazy(() =>
  import('./views/AssetStoreView').then((m) => ({ default: m.AssetStoreView })),
)
const AppNew = lazy(() => import('../new').then((m) => ({ default: m.App })))
import { useSettings } from '../../hooks/useSettings'
import { ScreenReaderAnnouncer } from '../../lib/screenReader'
import { useWorkspaces } from '../../hooks/useWorkspaces'
import { useProjectsContext } from '../../hooks/projectsContext'
import { useDiscordRpc } from '../../hooks/useDiscordRpc'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { relaunch } from '@tauri-apps/plugin-process'
import { BugReportModal } from './components/modals/BugReportModal'
import { CheckForUpdatesModal } from './components/modals/CheckForUpdatesModal'
import { CommandPalette } from './components/modals/CommandPalette'

import { ShortcutCheatsheet } from './components/modals/ShortcutCheatsheet'
import { CreateWorkspaceModal } from './components/modals/CreateWorkspaceModal'
import { api } from '../../lib/api'
import { setPendingAction } from '../../lib/pendingAction'
import { isMac } from '../../lib/platform'
import {
  clearUiSwitchToSettings,
  markSplashConsumed,
  shouldOpenSettingsAfterSwitch,
  shouldShowSplash,
} from '../../lib/uiTransition'
import { TitleBar } from './components/titlebar/Titlebar'
import { SplashScreen, type SplashPhase } from './components/reusables/SplashScreen'
import { ViewErrorBoundary } from './components/reusables/ViewErrorBoundary'
import { ScrollToTopButton } from './components/ui/ScrollToTopButton'
import { GitSidebar } from './components/git/GitSidebar'
import { Sidebar, type Tab } from './components/ui/Sidebar'
import { SuccessToast, ErrorToast } from './components/reusables/ToastNotification'
import { useTauriEvent } from '../../lib/useTauriEvent'

import '../../index.css'
import { GodotVersionsProvider, useGodotVersionsContext,
} from '../../hooks/godotVersionsContext'
import { TaskTrayProvider } from '../../hooks/useTaskTray'
import { ChangelogBadgeProvider } from '../../hooks/useChangelogBadge'
import type { GitStatus, Project } from '../../types'

function ViewLoading() {
  const { t } = useTranslation('common')
  return (
    <div
      className="flex items-center justify-center py-24"
      role="status"
      aria-label={t('loading')}
    >
      <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
    </div>
  )
}

function AppContent() {
  const [uiSwitchIntent] = useState(() => shouldOpenSettingsAfterSwitch())
  const [tab, setTab] = useState<Tab>(uiSwitchIntent ? 'settings' : 'projects')
  const tabRef = useRef(tab)
  tabRef.current = tab
  const landingTabRef = useRef<string | null>(null)

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app:view-changed', { detail: tab }))
  }, [tab])

  const { projects, refresh: refreshProjects } = useProjectsContext()
  const { installed, refreshInstalled } = useGodotVersionsContext()
  const {
    workspaces,
    activeId,
    switchWorkspace,
    createWorkspace,
  } = useWorkspaces()
  const { settings, loaded: settingsLoaded, settingsWorkspaceId } = useSettings()
  const settingsReady = settingsLoaded && settingsWorkspaceId === activeId

  const [gitSidebarProject, setGitSidebarProject] = useState<{
    project: Project
    gitStatus: GitStatus | null
  } | null>(null)

  const [bugReportOpen, setBugReportOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [highlightSetting, setHighlightSetting] = useState<string | null>(
    uiSwitchIntent ? 'new_ui' : null,
  )
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [updatesModalOpen, setUpdatesModalOpen] = useState(false)
  const [updateModalMode, setUpdateModalMode] = useState<
    'background' | 'manual' | 'preview'
  >('manual')
  const scannedWorkspaceRef = useRef<string | null>(null)
  const [errorNotification, setErrorNotification] = useState<string | null>(null)
  const [successNotification, setSuccessNotification] = useState<{
    count: number
    firstId: string
    firstProjectName: string
    failCount?: number
  } | null>(null)

  const paletteKey = settings.command_palette_keybind || 'k'

  useEffect(() => {
    if (isMac) return
    const w = getCurrentWindow()
    w.setDecorations(settings.use_os_decorations).catch((e) =>
      console.error('Failed to set window decorations:', e),
    )
  }, [settings.use_os_decorations])

  useEffect(() => {
    if (!settingsReady || uiSwitchIntent) return
    if (landingTabRef.current !== null) return
    landingTabRef.current = settings.default_landing_tab
    const landing = settings.default_landing_tab as Tab
    const valid: Tab[] = [
      'projects',
      'versions',
      'news',
      'templates',
      'asset-store',
      'updates',
      'settings',
      'changelog',
    ]
    if (valid.includes(landing)) setTab(landing)
  }, [settingsReady, settings.default_landing_tab, uiSwitchIntent])

  useTauriEvent('watcher:template-synced', () => {
    if (tabRef.current === 'templates') {
      window.dispatchEvent(new CustomEvent('app:refresh-templates'))
    }
  })

  useEffect(() => {
    if (!settingsReady) return
    if (scannedWorkspaceRef.current === activeId) return
    scannedWorkspaceRef.current = activeId
    if (!settings.auto_scan_on_startup) return
    const depth = settings.scan_depth
    if (settings.project_scan_dirs.length > 0) {
      api.scanForProjects(settings.project_scan_dirs, depth).catch(() => {})
    }
    if (settings.version_scan_dirs.length > 0) {
      api.scanForVersions(settings.version_scan_dirs, depth).catch(() => {})
    }
  }, [settingsReady, activeId, settings])

  useEffect(() => {
    if (uiSwitchIntent) clearUiSwitchToSettings()
  }, [uiSwitchIntent])

  const requestNewProject = useCallback(() => {
    if (tabRef.current === 'projects') {
      window.dispatchEvent(new CustomEvent('app:new-project'))
    } else {
      setPendingAction('new-project')
      setTab('projects')
    }
  }, [])

  const requestImportProject = useCallback(() => {
    if (tabRef.current === 'projects') {
      window.dispatchEvent(new CustomEvent('app:import-project'))
    } else {
      setPendingAction('import-project')
      setTab('projects')
    }
  }, [])

  const requestScanProjects = useCallback(() => {
    if (tabRef.current === 'projects') {
      window.dispatchEvent(new CustomEvent('app:scan-projects'))
    } else {
      setPendingAction('scan-projects')
      setTab('projects')
    }
  }, [])

  const requestImportVersion = useCallback(() => {
    if (tabRef.current === 'versions') {
      window.dispatchEvent(new CustomEvent('app:import-version'))
    } else {
      setPendingAction('import-version')
      setTab('versions')
    }
  }, [])

  const requestSyncTemplates = useCallback(() => {
    if (tabRef.current === 'templates') {
      window.dispatchEvent(new CustomEvent('app:sync-templates'))
    } else {
      setPendingAction('sync-templates')
      setTab('templates')
    }
  }, [])

  const openCreateWorkspace = useCallback(
    () => setCreateWorkspaceOpen(true),
    [],
  )

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow()
    const unlistenPromise = appWindow.onDragDropEvent((event) => {
      const { type } = event.payload

      if (type === 'drop') {
        const paths = (event.payload as { paths: string[] }).paths
        if (!paths || paths.length === 0) return

        const isVersionZipDrop =
          tabRef.current === 'versions' &&
          paths.length === 1 &&
          paths[0].toLowerCase().endsWith('.zip')

        if (isVersionZipDrop) {
          ;(async () => {
            try {
              const version = await api.importVersionZip(paths[0])
              await refreshInstalled()
              setSuccessNotification({
                count: 1,
                firstId: version.tag,
                firstProjectName: version.tag,
              })
            } catch (e) {
              setErrorNotification(String(e))
            }
          })()
        } else {
          const imported: Project[] = []
          const errors: unknown[] = []

          ;(async () => {
            for (const p of paths) {
              try {
                const project = await api.importProject(p, '')
                imported.push(project)
              } catch (e) {
                errors.push(e)
              }
            }

            await refreshProjects()

            if (imported.length > 0) {
              const last = imported[imported.length - 1]
              setSuccessNotification({
                count: imported.length,
                firstId: last.id,
                firstProjectName: last.name,
                failCount: errors.length > 0 ? errors.length : undefined,
              })
              window.dispatchEvent(
                new CustomEvent('app:scroll-to-project', {
                  detail: last.id,
                }),
              )
            }

            if (imported.length === 0 && errors.length > 0) {
              setErrorNotification(String(errors[0]))
            }
          })()
        }
      }
    })

    return () => {
      unlistenPromise.then((fn) => fn())
    }
  }, [refreshProjects])

  useEffect(() => {
    if (!errorNotification) return
    const t = setTimeout(() => setErrorNotification(null), 6000)
    return () => clearTimeout(t)
  }, [errorNotification])

  useEffect(() => {
    if (!successNotification) return
    const t = setTimeout(() => setSuccessNotification(null), 4000)
    return () => clearTimeout(t)
  }, [successNotification])

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const idx = (e as CustomEvent).detail as number
      const tabs: Tab[] = ['projects', 'versions', 'news', 'templates', 'asset-store', 'updates', 'settings', 'changelog']
      if (tabs[idx]) setTab(tabs[idx])
    }
    const handleOpenSetting = (e: Event) => {
      const settingKey = (e as CustomEvent).detail as string
      setTab('settings')
      setHighlightSetting(settingKey)
    }
    const handleOpenProject = async (e: Event) => {
      const detail = (e as CustomEvent).detail as string | { id: string; console?: boolean }
      const projectId = typeof detail === 'string' ? detail : detail.id
      const withConsole = typeof detail === 'string' ? undefined : detail.console
      try {
        await api.openProject(projectId, true, withConsole)
        refreshProjects()
      } catch (e) {
        alert(String(e))
      }
    }
    const handleSwitchWorkspace = (e: Event) => {
      const id = (e as CustomEvent).detail as string
      switchWorkspace(id)
    }
    const handleShowShortcuts = () => setShowShortcuts(true)
    const handleCheckUpdates = () => {
      setUpdateModalMode('manual')
      setUpdatesModalOpen(true)
    }
    const handlePreviewUpdate = () => {
      setUpdateModalMode('preview')
      setUpdatesModalOpen(true)
    }
    const handleReportBug = () => setBugReportOpen(true)

    window.addEventListener('app:switch-tab', handleSwitchTab)
    window.addEventListener('app:new-project-request', requestNewProject)
    window.addEventListener('app:import-project-request', requestImportProject)
    window.addEventListener('app:scan-projects-request', requestScanProjects)
    window.addEventListener('app:import-version-request', requestImportVersion)
    window.addEventListener('app:sync-templates-request', requestSyncTemplates)
    window.addEventListener('app:create-workspace-request', openCreateWorkspace)
    window.addEventListener('app:open-project', handleOpenProject)
    window.addEventListener('app:open-setting', handleOpenSetting)
    window.addEventListener('app:switch-workspace', handleSwitchWorkspace)
    window.addEventListener('app:show-shortcuts', handleShowShortcuts)
    window.addEventListener('app:check-updates', handleCheckUpdates)
    window.addEventListener('app:preview-update-modal', handlePreviewUpdate)
    window.addEventListener('app:report-bug', handleReportBug)

    return () => {
      window.removeEventListener('app:switch-tab', handleSwitchTab)
      window.removeEventListener('app:new-project-request', requestNewProject)
      window.removeEventListener('app:import-project-request', requestImportProject)
      window.removeEventListener('app:scan-projects-request', requestScanProjects)
      window.removeEventListener('app:create-workspace-request', openCreateWorkspace)
      window.removeEventListener('app:import-version-request', requestImportVersion)
      window.removeEventListener('app:sync-templates-request', requestSyncTemplates)
      window.removeEventListener('app:open-project', handleOpenProject)
      window.removeEventListener('app:open-setting', handleOpenSetting)
      window.removeEventListener('app:switch-workspace', handleSwitchWorkspace)
      window.removeEventListener('app:show-shortcuts', handleShowShortcuts)
      window.removeEventListener('app:check-updates', handleCheckUpdates)
      window.removeEventListener('app:preview-update-modal', handlePreviewUpdate)
      window.removeEventListener('app:report-bug', handleReportBug)
    }
  }, [
    requestNewProject,
    requestImportProject,
    requestScanProjects,
    requestImportVersion,
    requestSyncTemplates,
    openCreateWorkspace,
    switchWorkspace,
  ])

  useKeyboardShortcuts(
    {
      onNewProject: requestNewProject,
      onOpenSettings: () => setTab('settings'),
      onSwitchTab: (i: number) => {
        const tabs: Tab[] = ['projects', 'versions', 'news', 'templates', 'asset-store']
        if (tabs[i]) setTab(tabs[i])
      },
      onCommandPalette: () => setCommandPaletteOpen((o) => !o),
      onRestart: () => {
        void relaunch()
      },
      onEscape: () => {
        setGitSidebarProject(null)
        setCommandPaletteOpen(false)
        setShowShortcuts(false)
      },
    },
    paletteKey,
  )

  const renderView = () => {
    switch (tab) {
      case 'projects':
        return (
          <ViewErrorBoundary name="Projects">
            <Suspense fallback={<ViewLoading />}>
              <ProjectsView
                key={activeId}
                onShowGitSidebar={(p, s) => setGitSidebarProject({ project: p, gitStatus: s })}
              />
            </Suspense>
          </ViewErrorBoundary>
        )
      case 'versions':
        return (
          <ViewErrorBoundary name="Versions">
            <Suspense fallback={<ViewLoading />}>
              <VersionsView />
            </Suspense>
          </ViewErrorBoundary>
        )
      case 'news':
        return (
          <ViewErrorBoundary name="News">
            <Suspense fallback={<ViewLoading />}>
              <NewsView />
            </Suspense>
          </ViewErrorBoundary>
        )
      case 'templates':
        return (
          <ViewErrorBoundary name="Templates">
            <Suspense fallback={<ViewLoading />}>
              <TemplatesView />
            </Suspense>
          </ViewErrorBoundary>
        )
      case 'asset-store':
        return (
          <ViewErrorBoundary name="Asset Store">
            <Suspense fallback={<ViewLoading />}>
              <AssetStoreView />
            </Suspense>
          </ViewErrorBoundary>
        )
      case 'updates':
        return (
          <ViewErrorBoundary name="Updates from Dev">
            <Suspense fallback={<ViewLoading />}>
              <UpdatesView />
            </Suspense>
          </ViewErrorBoundary>
        )
      case 'changelog':
        return (
          <ViewErrorBoundary name="Changelog">
            <Suspense fallback={<ViewLoading />}>
              <ChangelogView />
            </Suspense>
          </ViewErrorBoundary>
        )
      case 'settings':
        return (
          <ViewErrorBoundary name="Settings">
            <Suspense fallback={<ViewLoading />}>
              <SettingsView
                highlightSetting={highlightSetting}
                onHighlightDone={() => setHighlightSetting(null)}
              />
            </Suspense>
          </ViewErrorBoundary>
        )
      default:
        return null
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-base text-ink font-body">
      <ScreenReaderAnnouncer enabled={settings.screen_reader_announcements} />
      <div className="shrink-0">
        <TitleBar />
      </div>
      <div className="relative flex-1 flex min-h-0">
        <Sidebar
          activeTab={tab}
          onTabChange={setTab}
          workspacesEnabled={settings.workspaces_enabled}
          paletteKey={paletteKey}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        <main className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>

          {tab !== 'settings' && <ScrollToTopButton />}
        </main>

        <AnimatePresence>
          {gitSidebarProject && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setGitSidebarProject(null)}
                className="absolute inset-0 z-20 bg-black/40"
              />
              <motion.aside
                key={gitSidebarProject.project.id}
                initial={{ x: 380 }}
                animate={{ x: 0 }}
                exit={{ x: 380 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className="absolute right-0 top-0 bottom-0 z-30 w-[380px] border-l border-line bg-surface shadow-2xl shadow-black/30 flex flex-col overflow-hidden"
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
        {commandPaletteOpen && (
          <CommandPalette
            onClose={() => setCommandPaletteOpen(false)}
            currentTab={tab}
            projects={projects}
            installedVersions={installed}
            workspaces={workspaces}
            activeWorkspaceId={activeId}
            paletteKey={paletteKey}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createWorkspaceOpen && (
          <CreateWorkspaceModal
            onClose={() => setCreateWorkspaceOpen(false)}
            onCreate={async (name, icon, color) => {
              await createWorkspace(name, icon, color)
              setCreateWorkspaceOpen(false)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bugReportOpen && (
          <BugReportModal onClose={() => setBugReportOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updatesModalOpen && (
          <CheckForUpdatesModal
            mode={updateModalMode}
            onClose={() => setUpdatesModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShortcuts && (
          <ShortcutCheatsheet
            onClose={() => setShowShortcuts(false)}
            paletteKey={paletteKey}
          />
        )}
      </AnimatePresence>

      <SuccessToast
        notification={successNotification}
        onDismiss={() => setSuccessNotification(null)}
      />
      <ErrorToast
        message={errorNotification}
        onDismiss={() => setErrorNotification(null)}
      />
    </div>
  )
}

export default function App() {
  const { t } = useTranslation('common')
  const { settings, update, loaded } = useSettings()
  const { loaded: workspacesLoaded } = useWorkspaces()
  const { projects } = useProjectsContext()
  useDiscordRpc(settings, projects)
  useEffect(() => {
    api.clearProjectIconCache()
    api.clearProjectNameCache()
  }, [settings.scan_depth, settings.icon_scan_depth])
  const [splashPhase, setSplashPhase] = useState<SplashPhase | 'done'>(() =>
    shouldShowSplash() ? 'enter' : 'done',
  )

  useEffect(() => {
    if (splashPhase === 'enter') {
      const t = setTimeout(() => setSplashPhase('fly'), 1200)
      return () => clearTimeout(t)
    }
    if (splashPhase === 'fly') {
      const t = setTimeout(() => setSplashPhase('fade'), 600)
      return () => clearTimeout(t)
    }
    if (splashPhase === 'fade') {
      const t = setTimeout(() => {
        markSplashConsumed()
        setSplashPhase('done')
      }, 450)
      return () => clearTimeout(t)
    }
  }, [splashPhase])

  if (!loaded || !workspacesLoaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-base text-muted text-sm">
        {t('app_loading')}
      </div>
    )
  }

  if (!settings.setup_complete) {
    return (
      <TaskTrayProvider>
        <Suspense fallback={<ViewLoading />}>
          <OnboardingView settings={settings} onComplete={update} />
        </Suspense>
      </TaskTrayProvider>
    )
  }

  return (
    <GodotVersionsProvider>
      <TaskTrayProvider>
        {settings.new_ui ? (
          <Suspense fallback={<ViewLoading />}>
            <AppNew />
          </Suspense>
        ) : (
          <ChangelogBadgeProvider>
            <AppContent />
          </ChangelogBadgeProvider>
        )}
        {splashPhase !== 'done' && <SplashScreen phase={splashPhase} />}
      </TaskTrayProvider>
    </GodotVersionsProvider>
  )
}
