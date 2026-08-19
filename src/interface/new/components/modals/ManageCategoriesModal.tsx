import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import type { Category } from '../../../../types'
import { useCategoriesContext } from '../../../../hooks/categoriesContext'
import {
  IconGrip,
  IconPlus,
  IconPencil,
  IconTrash,
  IconX,
  IconCheck,
  IconTags,
} from '../../lib/icons'
import { ConfirmDialog } from './ConfirmDialog'

const CATEGORY_COLORS = [
  '#5865f2',
  '#eb459e',
  '#fee75c',
  '#57f287',
  '#ed4245',
  '#ff9046',
  '#5865f2',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#3498db',
  '#e74c3c',
  '#2ecc71',
  '#f1c40f',
  '#e91e63',
  '#00bcd4',
  '#ff5722',
  '#795548',
  '#607d8b',
  '#673ab7',
  '#4caf50',
  '#ff9800',
  '#2196f3',
  '#f44336',
]

interface Props {
  onClose: () => void
}

export function ManageCategoriesModal({ onClose }: Props) {
  const { t } = useTranslation('common')
  const {
    categories,
    create,
    update,
    remove,
    reorder,
  } = useCategoriesContext()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const newInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    newInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleCreate = async () => {
    const trimmed = newName.trim()
    if (!trimmed || busy) return
    if (
      categories.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setError(t('category_already_exists'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await create(trimmed, newColor)
      setNewName('')
      setNewColor(
        CATEGORY_COLORS[(categories.length + 1) % CATEGORY_COLORS.length],
      )
      newInputRef.current?.focus()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (cat: Category) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditColor('')
    setError(null)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const trimmed = editName.trim()
    if (!trimmed || busy) return
    if (
      categories.some(
        (c) =>
          c.id !== editingId &&
          c.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setError(t('category_already_exists'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await update(editingId, trimmed, editColor)
      cancelEdit()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId || busy) return
    setBusy(true)
    try {
      await remove(deletingId)
      setDeletingId(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDragStart = (id: string) => {
    setDragId(id)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOverId(id)
  }

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setDragOverId(null)
      return
    }
    const ids = categories.map((c) => c.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) {
      setDragId(null)
      setDragOverId(null)
      return
    }
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, dragId)
    reorder(ids)
    setDragId(null)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDragId(null)
    setDragOverId(null)
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        role="dialog"
        aria-modal="true"
        className="bg-surface rounded-modal w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl overflow-clip"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-btn bg-accent/15 flex items-center justify-center">
              <IconTags className="w-4 h-4 text-accent-bright" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">
                {t('manage_categories_title')}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {t('manage_categories_desc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring cursor-pointer w-8 h-8 rounded-btn flex items-center justify-center text-muted hover:text-ink hover:bg-raised transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Create new category */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                /* open color picker inline */
              }}
              className="w-7 h-7 rounded-full border-2 border-black/20 shrink-0 cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: newColor }}
              aria-label={t('color_label')}
            />
            <input
              ref={newInputRef}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setNewName('')
                  setError(null)
                }
              }}
              placeholder={t('new_category_placeholder')}
              className="focus-ring flex-1 min-w-0 h-9 px-3 rounded-btn bg-overlay border border-outline/50 text-sm text-ink placeholder:text-muted/50 focus:border-accent-dim transition-colors"
            />
            <motion.button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || busy}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.9 }}
              className="focus-ring cursor-pointer w-9 h-9 rounded-btn bg-accent text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
            >
              <IconPlus className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Inline color picker row */}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {CATEGORY_COLORS.slice(0, 16).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                className={`w-5 h-5 rounded-full cursor-pointer border transition-transform hover:scale-125 hover:z-10 ${
                  color === newColor
                    ? 'border-2 border-ink scale-110'
                    : 'border-black/20'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-danger mt-2">{error}</p>
          )}
        </div>

        {/* Category list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-muted gap-2">
              <IconTags className="w-5 h-5 text-muted/50" />
              <span>{t('no_categories_yet')}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {categories.map((cat) => {
                const isEditing = editingId === cat.id
                const isDragging = dragId === cat.id
                const isDragOver = dragOverId === cat.id

                return (
                  <div
                    key={cat.id}
                    draggable={!isEditing}
                    onDragStart={() => handleDragStart(cat.id)}
                    onDragOver={(e) => handleDragOver(e, cat.id)}
                    onDrop={() => handleDrop(cat.id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-2 py-2 rounded-btn transition-colors ${
                      isDragging
                        ? 'opacity-40'
                        : isDragOver
                          ? 'bg-accent/10 ring-1 ring-accent/30'
                          : 'hover:bg-raised'
                    }`}
                  >
                    <div className="cursor-grab active:cursor-grabbing text-muted/50 hover:text-muted shrink-0">
                      <IconGrip className="w-3 h-3" />
                    </div>

                    {isEditing ? (
                      <>
                        <input
                          ref={editInputRef}
                          value={editName}
                          onChange={(e) => {
                            setEditName(e.target.value)
                            if (error) setError(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          className="focus-ring flex-1 min-w-0 h-7 px-2 rounded-item bg-overlay border border-accent-dim text-sm text-ink focus:border-accent-dim transition-colors"
                        />
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={busy}
                            className="focus-ring cursor-pointer w-7 h-7 rounded-item flex items-center justify-center text-accent-bright hover:bg-accent/10 transition-colors"
                          >
                            <IconCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="focus-ring cursor-pointer w-7 h-7 rounded-item flex items-center justify-center text-muted hover:text-ink hover:bg-raised transition-colors"
                          >
                            <IconX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span
                          className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="flex-1 min-w-0 text-sm text-ink truncate">
                          {cat.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEdit(cat)}
                          aria-label={t('edit_category', { name: cat.name })}
                          className="focus-ring cursor-pointer w-7 h-7 rounded-item flex items-center justify-center text-muted/50 hover:text-ink hover:bg-raised transition-colors shrink-0"
                        >
                          <IconPencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(cat.id)}
                          aria-label={t('delete_category', { name: cat.name })}
                          className="focus-ring cursor-pointer w-7 h-7 rounded-item flex items-center justify-center text-muted/50 hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                        >
                          <IconTrash className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-line shrink-0">
          <span className="text-xs text-muted tabular-nums">
            {t('category_count', { count: categories.length })}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring cursor-pointer px-4 py-2.5 rounded-btn text-sm text-muted hover:text-ink hover:bg-raised transition-colors"
          >
            {t('done')}
          </button>
        </div>

        {/* Delete confirm */}
        {deletingId && (
          <ConfirmDialog
            title={t('delete_category_title')}
            description={t('delete_category_desc', {
              name: categories.find((c) => c.id === deletingId)?.name ?? '',
            })}
            confirmLabel={t('delete')}
            variant="danger"
            onConfirm={handleDelete}
            onCancel={() => setDeletingId(null)}
          />
        )}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
