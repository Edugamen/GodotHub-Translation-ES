import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  DARK_THEME_PRESETS,
  LIGHT_THEME_PRESETS,
} from '../../../../lib/colors'
import { IconCheck, IconMoon, IconSun, IconX } from '../../lib/icons'
import { ThemePresetPreview } from '../reusables/ThemePresetPreview'

interface Props {
  mode: 'light' | 'dark'
  currentId: string
  onSelect: (id: string) => void
  onClose: () => void
}

export function ThemePresetsModal({
  mode,
  currentId,
  onSelect,
  onClose,
}: Props) {
  const { t: ts } = useTranslation('settings')
  const presets =
    mode === 'light' ? LIGHT_THEME_PRESETS : DARK_THEME_PRESETS
  const Icon = mode === 'light' ? IconSun : IconMoon
  const title =
    mode === 'light' ? ts('preset_light_group') : ts('preset_dark_group')

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-surface border border-line rounded-card w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-line">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-tile bg-accent/10 border border-accent-dim/30 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-accent-bright" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-semibold text-lg text-ink truncate">
                {title}
              </h3>
              <span className="text-[10px] font-medium text-muted/60">
                {presets.length}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="focus-ring cursor-pointer p-1.5 rounded-btn text-muted hover:text-ink hover:bg-raised transition-colors shrink-0"
            aria-label={ts('close', { ns: 'common' })}
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
            {presets.map((preset) => {
              const active = preset.id === currentId
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelect(preset.id)}
                  className={`focus-ring cursor-pointer flex flex-col items-start gap-2 rounded-btn border p-3 text-left transition-colors ${
                    active
                      ? 'border-accent bg-accent/10'
                      : 'border-outline/50 hover:border-accent-dim hover:bg-raised'
                  }`}
                >
                  <ThemePresetPreview preset={preset} />
                  <span className="text-xs font-medium text-ink flex items-center gap-1 w-full min-w-0">
                    {active && (
                      <IconCheck className="w-3 h-3 text-accent-bright shrink-0" />
                    )}
                    <span className="truncate">{preset.name}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
