import { invoke } from '@tauri-apps/api/core'
import type { AppSettings, Project } from '../types'

export const settingsApi = {
  get: () => invoke<AppSettings>('get_settings'),
  update: (settings: AppSettings) =>
    invoke<AppSettings>('update_settings', { settings }),
  reset: () => invoke<AppSettings>('reset_settings'),
  resetData: () => invoke<void>('reset_app_data'),
  scanForProjects: (dirs: string[], depth: number) =>
    invoke<Project[]>('scan_for_projects', { dirs, depth }),
  refreshTrayMenu: () => invoke<void>('refresh_tray_menu'),
  restartWatchers: () => invoke<void>('restart_watchers'),
}
