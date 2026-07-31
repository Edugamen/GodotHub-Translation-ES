import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useTauriEvent } from '../lib/useTauriEvent'
import { useWorkspaces } from './useWorkspaces'
import type {
  DownloadProgress,
  GodotRelease,
  InstalledGodotVersion,
} from '../types'

export interface DownloadState extends DownloadProgress {
  status: 'queued' | 'downloading' | 'paused'
}

const keyOf = (tag: string, assetName: string) =>
  assetName.toLowerCase().includes('mono') ? `${tag}-mono` : tag

export function useGodotVersions() {
  const { activeId } = useWorkspaces()
  const [installed, setInstalled] = useState<InstalledGodotVersion[]>([])
  const [available, setAvailable] = useState<GodotRelease[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [availableError, setAvailableError] = useState<string | null>(null)
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({})
  const [scanProgress, setScanProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  const refreshInstalled = useCallback(
    async () => setInstalled(await api.listInstalledGodotVersions()),
    [],
  )

  const refreshAvailable = useCallback(async () => {
    setLoadingAvailable(true)
    setAvailableError(null)
    try {
      setAvailable(await api.fetchAvailableGodotVersions())
    } catch (e) {
      setAvailableError(String(e))
    } finally {
      setLoadingAvailable(false)
    }
  }, [])

  const clearKey = (key: string) =>
    setDownloads((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })

  useEffect(() => {
    refreshInstalled()

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshInstalled()
      }
    }, 15000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshInstalled()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshInstalled, activeId])

  useEffect(() => {
    refreshAvailable()
  }, [refreshAvailable, activeId])

  // --- Tauri event listeners ---
  useTauriEvent('watcher:version-scan-done', () => refreshInstalled(), [
    refreshInstalled,
  ])

  useTauriEvent<[number, number]>('version-scan-progress', ([current, total]) => {
    setScanProgress({ current, total })
    if (current >= total) {
      setTimeout(() => setScanProgress(null), 800)
    }
  })

  useTauriEvent<string>('godot-download-queued', (key) => {
    setDownloads((prev) => ({
      ...prev,
      [key]: {
        tag: key,
        downloaded: prev[key]?.downloaded ?? 0,
        total: prev[key]?.total ?? 0,
        status: 'queued',
      },
    }))
  })

  useTauriEvent<DownloadProgress>('godot-download-progress', (payload) => {
    setDownloads((prev) => ({
      ...prev,
      [payload.tag]: { ...payload, status: 'downloading' },
    }))
  })

  useTauriEvent<string>('godot-download-paused', (key) => {
    setDownloads((prev) =>
      prev[key]
        ? { ...prev, [key]: { ...prev[key], status: 'paused' } }
        : prev,
    )
  })

  useTauriEvent<string>('godot-download-canceled', (key) => clearKey(key))

  useTauriEvent<{ tag: string; message: string }>('godot-download-error', (payload) => {
    clearKey(payload.tag)
  })

  useTauriEvent<string>('godot-download-complete', (key) => {
    clearKey(key)
    refreshInstalled()
  })

  const download = useCallback(
    async (tag: string, assetName: string, url: string) => {
      const key = keyOf(tag, assetName)
      setDownloads((prev) => ({
        ...prev,
        [key]: { tag: key, downloaded: 0, total: 0, status: 'queued' },
      }))
      await api.downloadGodotVersion(tag, assetName, url)
    },
    [],
  )

  const pause = useCallback((key: string) => api.pauseDownload(key), [])
  const resume = useCallback((key: string) => api.resumeDownload(key), [])
  const cancel = useCallback(async (key: string) => {
    await api.cancelDownload(key)
    clearKey(key)
  }, [])

  const remove = useCallback(
    async (tag: string) => {
      await api.deleteGodotVersion(tag)
      await refreshInstalled()
    },
    [refreshInstalled],
  )

  const rename = useCallback(async (tag: string, customName: string | null) => {
    const updated = await api.renameGodotVersion(tag, customName)
    setInstalled((prev) => prev.map((v) => (v.tag === tag ? updated : v)))
    return updated
  }, [])

  return {
    installed,
    available,
    loadingAvailable,
    availableError,
    downloads,
    download,
    pause,
    resume,
    cancel,
    remove,
    rename,
    refreshAvailable,
    refreshInstalled,
    scanProgress,
  }
}
