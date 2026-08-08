import { invoke } from '@tauri-apps/api/core'
import type { ChangelogEntry, ChangelogNote } from '../types'

export const changelogApi = {
  list: () => invoke<ChangelogEntry[]>('list_changelog_entries'),
  add: (
    version: string,
    date: string,
    notes: ChangelogNote[],
    knownIssues: string[],
  ) =>
    invoke<ChangelogEntry>('add_changelog_entry', {
      version,
      date,
      notes,
      knownIssues,
    }),
  update: (
    id: string,
    version: string,
    date: string,
    notes: ChangelogNote[],
    knownIssues: string[],
  ) =>
    invoke<ChangelogEntry>('update_changelog_entry', {
      id,
      version,
      date,
      notes,
      knownIssues,
    }),
  delete: (id: string) =>
    invoke<void>('delete_changelog_entry', { id }),
}
