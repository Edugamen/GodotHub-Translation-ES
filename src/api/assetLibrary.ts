import { invoke } from '@tauri-apps/api/core'
import type { AssetLibraryResponse, ProjectTemplate } from '../types'

export const assetLibraryApi = {
  search: (
    filter: string | null,
    godotVersion: string | null,
    page: number,
    maxResults: number,
  ) =>
    invoke<AssetLibraryResponse>('search_asset_library', {
      filter,
      godotVersion,
      page,
      maxResults,
    }),
  installAsTemplate: (assetId: string) =>
    invoke<ProjectTemplate>('install_asset_as_template', { assetId }),
}
