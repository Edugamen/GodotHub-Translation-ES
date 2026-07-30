import { invoke } from '@tauri-apps/api/core'
import type { ChangelogEntry, ChangelogNote } from '../types'

export const changelogApi = {
  list: () => invoke<ChangelogEntry[]>('list_changelog_entries'),
  add: (version: string, date: string, notes: ChangelogNote[]) =>
    invoke<ChangelogEntry>('add_changelog_entry', { version, date, notes }),
  update: (id: string, version: string, date: string, notes: ChangelogNote[]) =>
    invoke<ChangelogEntry>('update_changelog_entry', { id, version, date, notes }),
  delete: (id: string) =>
    invoke<void>('delete_changelog_entry', { id }),
}
