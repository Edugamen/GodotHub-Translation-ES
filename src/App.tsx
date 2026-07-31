import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { ProjectsView } from './views/ProjectsView'
import { VersionsView } from './views/VersionsView'
import { NewsView } from './views/NewsView'
import { SettingsView } from './views/SettingsView'
import { ChangelogView } from './views/ChangelogView'
import { TemplatesView } from './views/TemplatesView'
import { OnboardingView } from './views/OnboardingView'
import { AssetStoreView } from './views/AssetStoreView'
import { useSettings } from './hooks/useSettings'
import { useWorkspaces } from './hooks/useWorkspaces'
import { useProjectsContext } from './hooks/projectsContext'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { check } from '@tauri-apps/plugin-updater'
import { BugReportModal } from './components/modals/BugReportModal'
import { CheckForUpdatesModal } from './components/modals/CheckForUpdatesModal'
import { CommandPalette } from './components/modals/CommandPalette'

import { ShortcutCheatsheet } from './components/modals/ShortcutCheatsheet'
import { CreateWorkspaceModal } from './components/modals/CreateWorkspaceModal'
import { api } from './lib/api'
import { TitleBar } from './components/Titlebar'
import { SplashScreen, type SplashPhase } from './components/SplashScreen'
import { OnboardingTips } from './components/OnboardingTips'
import { ViewErrorBoundary } from './components/ViewErrorBoundary'
import { GitSidebar } from './components/git/GitSidebar'
import { Sidebar, type Tab } from './components/Sidebar'
import { SuccessToast, ErrorToast } from './components/ToastNotification'
import { DragDropOverlay } from './components/DragDropOverlay'
import { LaunchOverlay } from './components/LaunchOverlay'
import { ImportOverlay } from './components/ImportOverlay'
import { useTauriEvent } from './lib/useTauriEvent'

import './index.css'
import {
  GodotVersionsProvider,
  useGodotVersionsContext,
} from './hooks/godotVersionsContext'
import { TaskTrayProvider } from './hooks/useTaskTray'
import type { GitStatus, Project } from './types'

function AppContent() {
  const [tab, setTab] = useState<Tab>('projects')
  const tabRef = useRef(tab)
  tabRef.current = tab
  const pendingActionRef = useRef<
    'new-project' | 'import-project' | 'scan-projects' | 'import-version' | 'sync-templates' | null
  >(null)

  const { projects, refresh: refreshProjects } = useProjectsContext()
  const { installed, refreshInstalled } = useGodotVersionsContext()
  const {
    workspaces,
    activeId,
    switchWorkspace,
    createWorkspace,
  } = useWorkspaces()
  const { settings } = useSettings()

  const [gitSidebarProject, setGitSidebarProject] = useState<{
    project: Project
    gitStatus: GitStatus | null
  } | null>(null)

  const [bugReportOpen, setBugReportOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [highlightSetting, setHighlightSetting] = useState<string | null>(null)
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [updatesModalOpen, setUpdatesModalOpen] = useState(false)
  const [updateModalMode, setUpdateModalMode] = useState<'background' | 'manual'>('manual')
  const [showTips, setShowTips] = useState(() => {
    try {
      return localStorage.getItem('godothub_tips_shown') !== '1'
    } catch {
      return false
    }
  })
  const [splashPhase, setSplashPhase] = useState<SplashPhase | 'done'>('enter')
  const [dragOver, setDragOver] = useState(false)
  const [dragType, setDragType] = useState<'project' | 'version'>('project')
  const [importingOverlay, setImportingOverlay] = useState<{
    type: 'project' | 'version'
    total: number
    current: number
    label?: string | null
  } | null>(null)
  const projectsRef = useRef(projects)
  projectsRef.current = projects
  const [launchingProject, setLaunchingProject] = useState<{
    id: string
    name: string
    version: string
  } | null>(null)
  const [confirmingStop, setConfirmingStop] = useState(false)
  const [errorNotification, setErrorNotification] = useState<string | null>(null)
  const [successNotification, setSuccessNotification] = useState<{
    count: number
    firstId: string
    firstProjectName: string
    failCount?: number
  } | null>(null)

  const paletteKey = settings.command_palette_keybind || 'k'

  // Sync window decorations when setting changes
  useEffect(() => {
    const w = getCurrentWindow()
    w.setDecorations(settings.use_os_decorations).catch((e) =>
      console.error('Failed to set window decorations:', e),
    )
  }, [settings.use_os_decorations])

  // --- Event listeners ---

  useTauriEvent('watcher:project-scan-done', () => refreshProjects())
  useTauriEvent('watcher:version-scan-done', () => refreshInstalled())
  useTauriEvent('watcher:template-synced', () => {
    if (tabRef.current === 'templates') {
      window.dispatchEvent(new CustomEvent('app:refresh-templates'))
    }
  })

  useEffect(() => {
    if (settings.auto_scan_on_startup) {
      const dirs = settings.project_scan_dirs
      const depth = settings.scan_depth
      if (dirs.length > 0) {
        api
          .scanForProjects(dirs, depth)
          .then((added) => {
            if (added.length > 0) refreshProjects()
          })
          .catch(() => {})
      }
      const versionDirs = settings.version_scan_dirs
      if (versionDirs.length > 0) {
        api
          .scanForVersions(versionDirs, depth)
          .then((added) => {
            if (added.length > 0) refreshInstalled()
          })
          .catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    if (splashPhase === 'enter') {
      const t = setTimeout(() => setSplashPhase('fly'), 1000)
      return () => clearTimeout(t)
    }
    if (splashPhase === 'fly') {
      const t = setTimeout(() => setSplashPhase('fade'), 500)
      return () => clearTimeout(t)
    }
    if (splashPhase === 'fade') {
      const t = setTimeout(() => setSplashPhase('done'), 400)
      return () => clearTimeout(t)
    }
  }, [splashPhase])

  const requestNewProject = useCallback(() => {
    if (tabRef.current === 'projects') {
      window.dispatchEvent(new CustomEvent('app:new-project'))
    } else {
      pendingActionRef.current = 'new-project'
      setTab('projects')
    }
  }, [])

  const requestImportProject = useCallback(() => {
    if (tabRef.current === 'projects') {
      window.dispatchEvent(new CustomEvent('app:import-project'))
    } else {
      pendingActionRef.current = 'import-project'
      setTab('projects')
    }
  }, [])

  const requestScanProjects = useCallback(() => {
    if (tabRef.current === 'projects') {
      window.dispatchEvent(new CustomEvent('app:scan-projects'))
    } else {
      pendingActionRef.current = 'scan-projects'
      setTab('projects')
    }
  }, [])

  const requestImportVersion = useCallback(() => {
    if (tabRef.current === 'versions') {
      window.dispatchEvent(new CustomEvent('app:import-version'))
    } else {
      pendingActionRef.current = 'import-version'
      setTab('versions')
    }
  }, [])

  const requestSyncTemplates = useCallback(() => {
    if (tabRef.current === 'templates') {
      window.dispatchEvent(new CustomEvent('app:sync-templates'))
    } else {
      pendingActionRef.current = 'sync-templates'
      setTab('templates')
    }
  }, [])

  const openCreateWorkspace = useCallback(
    () => setCreateWorkspaceOpen(true),
    [],
  )

  // Drag & drop
  useEffect(() => {
    const appWindow = getCurrentWebviewWindow()
    const unlistenPromise = appWindow.onDragDropEvent((event) => {
      const { type } = event.payload

      if (type === 'enter' || type === 'over') {
        setDragOver(true)
        if (type === 'enter') {
          const paths = (event.payload as { paths: string[] }).paths
          if (paths && paths.length > 0) {
            setDragType(
              paths[0].toLowerCase().endsWith('.zip')
                ? 'version'
                : 'project',
            )
          }
        }
      } else if (type === 'leave') {
        setDragOver(false)
      } else if (type === 'drop') {
        setDragOver(false)
        const paths = (event.payload as { paths: string[] }).paths
        if (!paths || paths.length === 0) return

        const isVersionZipDrop =
          tabRef.current === 'versions' &&
          paths.length === 1 &&
          paths[0].toLowerCase().endsWith('.zip')

        if (isVersionZipDrop) {
          setImportingOverlay({ type: 'version', total: 1, current: 0, label: paths[0] })
          ;(async () => {
            try {
              setImportingOverlay({ type: 'version', total: 1, current: 1, label: paths[0] })
              const version = await api.importVersionZip(paths[0])
              await refreshInstalled()
              setSuccessNotification({
                count: 1,
                firstId: version.tag,
                firstProjectName: version.tag,
              })
            } catch (e) {
              setErrorNotification(String(e))
            } finally {
              setImportingOverlay(null)
            }
          })()
        } else {
          const imported: Project[] = []
          const errors: unknown[] = []

          setImportingOverlay({
            type: 'project',
            total: paths.length,
            current: 0,
            label: paths[0],
          })

          ;(async () => {
            for (const [i, p] of paths.entries()) {
              try {
                const project = await api.importProject(p, '')
                imported.push(project)
              } catch (e) {
                errors.push(e)
              }
              setImportingOverlay({
                type: 'project',
                total: paths.length,
                current: i + 1,
                label: p,
              })
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
            setImportingOverlay(null)
          })()
        }
      }
    })

    return () => {
      unlistenPromise.then((fn) => fn())
    }
  }, [refreshProjects])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const update = await check()
        if (update && !cancelled) {
          setUpdateModalMode('background')
          setUpdatesModalOpen(true)
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const dismissTimeout: { current: ReturnType<typeof setTimeout> | null } = { current: null }
    const unlistenLaunched = listen<{ id: string; name: string; version: string }>('project:launched', (event) => {
      setLaunchingProject(event.payload)
      if (dismissTimeout.current) clearTimeout(dismissTimeout.current)
      dismissTimeout.current = setTimeout(() => setLaunchingProject(null), 3000)
    })
    const unlistenExited = listen('project:exited', () => {
      if (dismissTimeout.current) clearTimeout(dismissTimeout.current)
      setLaunchingProject(null)
    })
    return () => {
      if (dismissTimeout.current) clearTimeout(dismissTimeout.current)
      unlistenLaunched.then((fn) => fn())
      unlistenExited.then((fn) => fn())
    }
  }, [])

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

  // Window event handlers
  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const idx = (e as CustomEvent).detail as number
      const tabs: Tab[] = ['projects', 'versions', 'news', 'templates', 'asset-store', 'settings', 'changelog']
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
      const proj = projectsRef.current.find((p) => p.id === projectId)
      if (proj) {
        setLaunchingProject({
          id: proj.id,
          name: proj.name,
          version: proj.godot_version,
        })
      }
      try {
        await api.openProject(projectId, true, withConsole)
        refreshProjects()
      } catch (e) {
        setLaunchingProject(null)
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
            <ProjectsView
              key={activeId}
              onShowGitSidebar={(p, s) => setGitSidebarProject({ project: p, gitStatus: s })}
            />
          </ViewErrorBoundary>
        )
      case 'versions':
        return (
          <ViewErrorBoundary name="Versions">
            <VersionsView />
          </ViewErrorBoundary>
        )
      case 'news':
        return (
          <ViewErrorBoundary name="News">
            <NewsView />
          </ViewErrorBoundary>
        )
      case 'templates':
        return (
          <ViewErrorBoundary name="Templates">
            <TemplatesView />
          </ViewErrorBoundary>
        )
      case 'asset-store':
        return (
          <ViewErrorBoundary name="Asset Store">
            <AssetStoreView />
          </ViewErrorBoundary>
        )
      case 'changelog':
        return (
          <ViewErrorBoundary name="Changelog">
            <ChangelogView />
          </ViewErrorBoundary>
        )
      case 'settings':
        return (
          <ViewErrorBoundary name="Settings">
            <SettingsView
              highlightSetting={highlightSetting}
              onHighlightDone={() => setHighlightSetting(null)}
            />
          </ViewErrorBoundary>
        )
      default:
        return null
    }
  }

  const handleStopLaunch = () => {
    if (launchingProject) {
      api.stopProject(launchingProject.id).catch(() => {})
      setLaunchingProject(null)
      setConfirmingStop(false)
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-base text-ink font-body">
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
          <AnimatePresence
            mode="wait"
            onExitComplete={() => {
              if (pendingActionRef.current) {
                const action = pendingActionRef.current
                pendingActionRef.current = null
                window.dispatchEvent(new CustomEvent(`app:${action}`))
              }
            }}
          >
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
        </main>

        {/* Git sidebar overlay + backdrop */}
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

      {splashPhase !== 'done' && <SplashScreen phase={splashPhase} />}

      <AnimatePresence>
        {splashPhase === 'done' && showTips && (
          <OnboardingTips
            onDismiss={() => {
              setShowTips(false)
              try {
                localStorage.setItem('godothub_tips_shown', '1')
              } catch {}
            }}
          />
        )}
      </AnimatePresence>

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

      {/* Extracted overlay components */}
      <DragDropOverlay visible={dragOver} type={dragType} />
      <SuccessToast
        notification={successNotification}
        onDismiss={() => setSuccessNotification(null)}
      />
      <ErrorToast
        message={errorNotification}
        onDismiss={() => setErrorNotification(null)}
      />
      <LaunchOverlay
        launching={launchingProject}
        confirmingStop={confirmingStop}
        onStop={handleStopLaunch}
        onCancelStop={() => setConfirmingStop(false)}
        onDismiss={() => setConfirmingStop(true)}
      />
      <ImportOverlay
        importing={importingOverlay}
        onDismiss={() => setImportingOverlay(null)}
      />
    </div>
  )
}

export default function App() {
  const { t } = useTranslation('common')
  const { settings, update, loaded } = useSettings()
  const { loaded: workspacesLoaded } = useWorkspaces()

  if (!loaded || !workspacesLoaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-base text-muted text-sm">
        {t('app_loading')}
      </div>
    )
  }

  if (!settings.setup_complete) {
    return <OnboardingView settings={settings} onComplete={update} />
  }

  return (
    <GodotVersionsProvider>
      <TaskTrayProvider>
        <AppContent />
      </TaskTrayProvider>
    </GodotVersionsProvider>
  )
}
