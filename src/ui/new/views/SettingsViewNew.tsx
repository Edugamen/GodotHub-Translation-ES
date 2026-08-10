import { useTranslation } from 'react-i18next'
import { Toggle } from '../../../components/ui/Toggle'
import { Slider } from '../../../components/ui/Slider'
import { useSettings } from '../../../hooks/useSettings'

/**
 * Temporary settings view for the new UI. Currently exposes the app-wide
 * scrollbar visibility toggle and the project-list animation threshold.
 */
export function SettingsViewNew() {
  const { t } = useTranslation('nav')
  const { t: ts } = useTranslation('settings')
  const { settings, update } = useSettings()

  return (
    <div className="flex flex-col gap-4">
      <header className="shrink-0 flex flex-row items-center gap-1.5">
        <h1 className="font-display text-4xl font-bold tracking-wide text-ink uppercase">
          {t('settings')}
        </h1>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 rounded-item bg-overlay px-4 py-3.5">
          <div>
            <span className="text-sm font-medium text-ink block">
              {ts('show_scrollbar_label')}
            </span>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {ts('scrollbar_desc')}
            </p>
          </div>
          <Toggle
            checked={settings.show_scrollbars}
            onChange={(checked) =>
              update({ ...settings, show_scrollbars: checked })
            }
            label={ts('show_scrollbar_label')}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-item bg-overlay px-4 py-3.5">
          <div>
            <span className="text-sm font-medium text-ink block">
              {ts('animation_threshold_label')}
            </span>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {ts('animation_threshold_desc')}
            </p>
          </div>
          <div className="w-56 shrink-0">
            <div className="text-right text-xs font-medium text-ink tabular-nums mb-1">
              {ts('n_projects', { count: settings.animation_threshold })}
            </div>
            <Slider
              value={settings.animation_threshold}
              min={10}
              max={100}
              step={5}
              onChange={(value) =>
                update({ ...settings, animation_threshold: value })
              }
              label={ts('animation_threshold_label')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
