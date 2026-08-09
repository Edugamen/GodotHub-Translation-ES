import { invoke } from '@tauri-apps/api/core'
import type { UpdatesResponse } from '../types'

export const updatesApi = {
  fetch: () => invoke<UpdatesResponse>('fetch_updates'),
}
