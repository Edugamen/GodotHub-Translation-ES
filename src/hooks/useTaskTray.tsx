import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTauriEvent } from '../lib/useTauriEvent'
import type {
  AssetDownloadError,
  AssetDownloadProgress,
  DownloadProgress,
} from '../types'
import i18n from '../i18n'

export interface Task {
  id: string
  type:
    | 'download-godot'
    | 'download-asset'
    | 'scan-projects'
    | 'scan-versions'
    | 'sync-templates'
    | 'clone-repo'
    | 'import-projects'
  label: string
  description?: string
  progress: { current: number; total: number } | null
  status: 'queued' | 'running' | 'paused' | 'completed' | 'error'
  errorMessage?: string
}

interface TaskTrayContextValue {
  tasks: Task[]
  activeCount: number
  registerTask: (task: Task) => void
  updateTask: (id: string, partial: Partial<Task>) => void
  unregisterTask: (id: string) => void
  clearCompleted: () => void
}

const TaskTrayContext = createContext<TaskTrayContextValue | null>(null)

export function TaskTrayProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  const clearTimer = useCallback((id: string) => {
    const existing = timersRef.current.get(id)
    if (existing) {
      clearTimeout(existing)
      timersRef.current.delete(id)
    }
  }, [])

  const scheduleRemoval = useCallback(
    (id: string, delay = 4000) => {
      clearTimer(id)
      const timer = setTimeout(() => {
        setTasks((prev) => prev.filter((t) => t.id !== id))
        timersRef.current.delete(id)
      }, delay)
      timersRef.current.set(id, timer)
    },
    [clearTimer],
  )

  const registerTask = useCallback((task: Task) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === task.id)
      if (exists) {
        return prev.map((t) => (t.id === task.id ? task : t))
      }
      return [...prev, task]
    })
  }, [])

  const updateTask = useCallback(
    (id: string, partial: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...partial } : t)),
      )
    },
    [],
  )

  const unregisterTask = useCallback(
    (id: string) => {
      clearTimer(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
    },
    [clearTimer],
  )

  // --- Tauri event listeners ---

  useTauriEvent<[number, number]>('project-scan-progress', ([current, total]) => {
    if (current < total) {
      registerTask({
        id: 'scan-projects',
        type: 'scan-projects',
        label: i18n.t('common:scanning_projects'),
        description: total > 0 ? `${current} / ${total}` : undefined,
        progress: { current, total },
        status: 'running',
      })
    } else if (total > 0) {
      updateTask('scan-projects', { status: 'completed', progress: { current, total } })
      scheduleRemoval('scan-projects')
    }
  })

  useTauriEvent<[number, number]>('version-scan-progress', ([current, total]) => {
    if (current < total) {
      registerTask({
        id: 'scan-versions',
        type: 'scan-versions',
        label: i18n.t('common:scanning_versions'),
        description: total > 0 ? `${current} / ${total}` : undefined,
        progress: { current, total },
        status: 'running',
      })
    } else if (total > 0) {
      updateTask('scan-versions', { status: 'completed', progress: { current, total } })
      scheduleRemoval('scan-versions')
    }
  })

  useTauriEvent<string>('godot-download-queued', (key) => {
    registerTask({
      id: `download-${key}`,
      type: 'download-godot',
      label: i18n.t('common:downloading_version', { version: key }),
      description: i18n.t('common:queued'),
      progress: null,
      status: 'queued',
    })
  })

  useTauriEvent<DownloadProgress>('godot-download-progress', (payload) => {
    const { tag, downloaded, total } = payload
    const id = `download-${tag}`
    const pct =
      total > 0 ? Math.round((downloaded / total) * 100) : 0
    registerTask({
      id,
      type: 'download-godot',
      label: i18n.t('common:downloading_version', { version: tag }),
      description:
        total > 0
          ? `${(downloaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB (${pct}%)`
          : `${(downloaded / 1024 / 1024).toFixed(1)} MB`,
      progress: total > 0 ? { current: downloaded, total } : null,
      status: 'running',
    })
  })

  useTauriEvent<string>('godot-download-paused', (key) => {
    updateTask(`download-${key}`, { status: 'paused' })
  })

  useTauriEvent<string>('godot-download-canceled', (key) => {
    unregisterTask(`download-${key}`)
  })

  useTauriEvent<{ tag: string; message: string }>('godot-download-error', (payload) => {
    updateTask(`download-${payload.tag}`, {
      status: 'error',
      errorMessage: payload.message,
    })
    scheduleRemoval(`download-${payload.tag}`, 6000)
  })

  useTauriEvent<string>('godot-download-complete', (key) => {
    updateTask(`download-${key}`, { status: 'completed' })
    scheduleRemoval(`download-${key}`, 3000)
  })

  // --- Asset Library template download ---

  useTauriEvent<AssetDownloadProgress>('asset-download-queued', (payload) => {
    registerTask({
      id: `download-asset-${payload.asset_id}`,
      type: 'download-asset',
      label: i18n.t('common:downloading_asset', {
        title: payload.title,
      }),
      description: i18n.t('common:queued'),
      progress: null,
      status: 'queued',
    })
  })

  useTauriEvent<AssetDownloadProgress>('asset-download-progress', (payload) => {
    const { asset_id, title, downloaded, total } = payload
    const id = `download-asset-${asset_id}`
    const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0
    registerTask({
      id,
      type: 'download-asset',
      label: i18n.t('common:downloading_asset', { title }),
      description:
        total > 0
          ? `${(downloaded / 1024 / 1024).toFixed(1)} / ${(
              total /
              1024 /
              1024
            ).toFixed(1)} MB (${pct}%)`
          : `${(downloaded / 1024 / 1024).toFixed(1)} MB`,
      progress: total > 0 ? { current: downloaded, total } : null,
      status: 'running',
    })
  })

  useTauriEvent<AssetDownloadError>('asset-download-error', (payload) => {
    // Use registerTask (upsert) rather than updateTask: failures that happen
    // before the queued event (fetch/validation errors) never registered a
    // task, so the error must be able to create one from scratch.
    registerTask({
      id: `download-asset-${payload.asset_id}`,
      type: 'download-asset',
      label: payload.title
        ? i18n.t('common:downloading_asset', { title: payload.title })
        : i18n.t('common:asset_download_failed'),
      progress: null,
      status: 'error',
      errorMessage: payload.message,
    })
    scheduleRemoval(`download-asset-${payload.asset_id}`, 6000)
  })

  useTauriEvent<AssetDownloadProgress>('asset-download-complete', (payload) => {
    updateTask(`download-asset-${payload.asset_id}`, {
      status: 'completed',
    })
    scheduleRemoval(`download-asset-${payload.asset_id}`, 3000)
  })

  const clearCompleted = useCallback(() => {
    setTasks((prev) =>
      prev.filter(
        (t) =>
          t.status === 'queued' ||
          t.status === 'running' ||
          t.status === 'paused',
      ),
    )
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  const activeCount = tasks.filter(
    (t) => t.status === 'queued' || t.status === 'running',
  ).length

  return createElement(
    TaskTrayContext.Provider,
    {
      value: {
        tasks,
        activeCount,
        registerTask,
        updateTask,
        unregisterTask,
        clearCompleted,
      },
    },
    children,
  )
}

export function useTaskTray() {
  const ctx = useContext(TaskTrayContext)
  if (!ctx)
    throw new Error('useTaskTray must be used within a <TaskTrayProvider>')
  return ctx
}
