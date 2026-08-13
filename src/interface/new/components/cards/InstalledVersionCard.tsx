import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { InstalledGodotVersion } from '../../../../types'
import { api } from '../../../../lib/api'
import { Dropdown } from '../ui/Dropdown'
import { ConfirmDialog } from '../modals/ConfirmDialog'
import {
  IconCheck,
  IconExternalLink,
  IconMore,
  IconPencil,
  IconRocket,
  IconTerminal,
  IconTrash,
} from '../../lib/icons'

interface InstalledVersionCardProps {
  version: InstalledGodotVersion
  onOpen: (console?: boolean) => void
  onRename: (name: string | null) => void
  onUninstall: () => void
}

export function InstalledVersionCard({
  version: v,
  onOpen,
  onRename,
  onUninstall,
}: InstalledVersionCardProps) {
  const { t: tc } = useTranslation('common')
  const { t: tv } = useTranslation('versions')

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const [consoleEnabled, setConsoleEnabled] = useState(false)
  const [confirmingUninstall, setConfirmingUninstall] = useState(false)

  const startEditing = () => {
    setEditing(true)
    setEditValue(v.custom_name ?? v.tag)
    requestAnimationFrame(() => editInputRef.current?.focus())
  }

  const commitEdit = () => {
    if (editing) {
      const trimmed = editValue.trim()
      onRename(trimmed || null)
    }
    setEditing(false)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditValue('')
  }

  const installedExecDir = (path?: string) =>
    path ? path.replace(/[/\\][^/\\]*$/, '') : null

  return (
    <div className="flex items-center justify-between gap-3 rounded-item bg-overlay border border-outline/50 px-4 py-3.5 hover:border-accent-dim transition-colors">
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              onBlur={commitEdit}
              className="focus-ring w-48 bg-raised border border-accent rounded-btn px-3 py-2 text-sm font-mono text-ink outline-none"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={commitEdit}
              aria-label={tc('version_save_name_aria')}
              className="focus-ring cursor-pointer p-1.5 rounded-btn text-accent hover:bg-accent/10 transition-colors"
            >
              <IconCheck className="w-4 h-4" />
            </motion.button>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-mint shrink-0" />
              <h4 className="font-display font-semibold text-lg text-ink truncate leading-tight">
                {v.custom_name || v.tag}
              </h4>
              {v.custom_name && v.custom_name !== v.tag && (
                <span className="text-xs font-mono text-muted truncate min-w-0">
                  {v.tag}
                </span>
              )}
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={startEditing}
                aria-label={tc('version_rename_aria')}
                title={tc('version_rename_tooltip')}
                className="focus-ring cursor-pointer p-1 rounded-btn text-muted/60 hover:text-ink hover:bg-raised transition-colors shrink-0"
              >
                <IconPencil className="w-3.5 h-3.5" />
              </motion.button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-tag text-[10px] font-semibold shrink-0 border ${
                  v.is_mono
                    ? 'bg-accent/10 text-accent-bright border-accent-dim/40'
                    : 'bg-black/15 text-muted border-outline/40'
                }`}
              >
                {v.is_mono ? tv('mono') : tv('standard')}
              </span>
              {v.supports_console && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag bg-mint/10 text-mint border border-mint/30 text-[10px] font-semibold shrink-0">
                  {tv('console_label')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-stretch gap-1 shrink-0 justify-end">
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          type="button"
          onClick={() => onOpen(consoleEnabled || undefined)}
          className="focus-ring cursor-pointer flex items-center px-6 h-12 rounded-l-dropdown-btn rounded-r-[4px] font-semibold text-[17px] shadow-md shadow-black/10 bg-accent text-ink hover:bg-accent-bright border border-outline/50 transition-colors"
        >
          {tv('open')}
        </motion.button>
        {v.supports_console && (
          <motion.button
            key={consoleEnabled ? 'console-on' : 'console-off'}
            initial={{ scale: 0.9, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={() => setConsoleEnabled((prev) => !prev)}
            aria-label={tc('open_with_console')}
            aria-pressed={consoleEnabled}
            title={tc('open_with_console')}
            className={`focus-ring cursor-pointer p-2 h-12 rounded-[4px] font-semibold text-[17px] shadow-md shadow-black/10 border transition-colors duration-200 ${
              consoleEnabled
                ? 'bg-raised text-ink border-mint'
                : 'bg-overlay text-muted border-outline/50 hover:text-mint hover:border-mint/50'
            }`}
          >
            <IconTerminal
              className={`w-4 h-4 ${consoleEnabled ? 'text-mint' : ''}`}
            />
          </motion.button>
        )}
        <Dropdown
          align="right"
          trigger={({ open, toggle }) => (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              type="button"
              aria-expanded={open}
              onClick={toggle}
              aria-label={tv('more_editor_launch_options')}
              className={`focus-ring cursor-pointer px-[5px] h-12 rounded-r-dropdown rounded-l-[4px] font-semibold text-[17px] shadow-md shadow-black/10 border border-outline/50 transition-colors ${
                open
                  ? 'bg-raised text-ink border-accent-dim/60'
                  : 'bg-overlay text-muted hover:text-ink hover:bg-raised'
              }`}
            >
              <IconMore className="w-4 h-4" />
            </motion.button>
          )}
          items={[
            {
              key: 'rename',
              label: tv('rename'),
              icon: IconPencil,
              onClick: startEditing,
            },
            {
              key: 'open',
              label: tv('open_editor'),
              icon: IconRocket,
              onClick: () => onOpen(),
            },
            ...(v.supports_console
              ? [
                  {
                    key: 'open-console',
                    label: tv('open_editor_with_console'),
                    icon: IconTerminal,
                    onClick: () => onOpen(true),
                  },
                ]
              : []),
            {
              key: 'folder',
              label: tv('open_install_folder'),
              icon: IconExternalLink,
              onClick: () => {
                const dir = installedExecDir(v.executable_path)
                if (dir) api.openProjectFolder(dir).catch(() => {})
              },
            },
            {
              key: 'uninstall',
              label: tv('uninstall'),
              icon: IconTrash,
              danger: true,
              dividerAfter: true,
              onClick: () => setConfirmingUninstall(true),
            },
          ]}
        />
      </div>

      <AnimatePresence>
        {confirmingUninstall && (
          <ConfirmDialog
            title={tc('version_uninstall_title')}
            description={tc('version_uninstall_desc', { tag: v.tag })}
            confirmLabel={tc('version_uninstall_confirm')}
            variant="danger"
            onConfirm={() => {
              setConfirmingUninstall(false)
              onUninstall()
            }}
            onCancel={() => setConfirmingUninstall(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
