import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Toggle } from '../../../components/ui/Toggle'
import { useSettings } from '../../../hooks/useSettings'

const STICKY_HEADER_KEY = 'godothub_new_ui_sticky_header'

/**
 * Temporary settings view for the new UI. Currently exposes the app-wide
 * scrollbar visibility toggle and the projects "sticky header" toggle that
 * used to live in the projects toolbar.
 */
export function SettingsViewNew() {
  const { t } = useTranslation('nav')
  const { t: ts } = useTranslation('settings')
  const { settings, update } = useSettings()

  const [stickyHeader, setStickyHeader] = useState(() => {
    try {
      return localStorage.getItem(STICKY_HEADER_KEY) === '1'
    } catch {
      return false
    }
  })

  const toggleStickyHeader = (checked: boolean) => {
    setStickyHeader(checked)
    try {
      localStorage.setItem(STICKY_HEADER_KEY, checked ? '1' : '0')
    } catch {}
  }

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
              {ts('sticky_header')}
            </span>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {ts('sticky_header_desc')}
            </p>
          </div>
          <Toggle
            checked={stickyHeader}
            onChange={toggleStickyHeader}
            label={ts('sticky_header')}
          />
        </div>
      </div>
    </div>
  )
}
