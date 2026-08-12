import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../../hooks/useSettings'
import { ConfirmDialog } from './modals/ConfirmDialog'
import { IconHistory } from '../lib/icons'
import { Tooltip } from './Tooltip'

export function RevertToClassicButton({
  variant = 'settings',
  collapsed = false,
}: {
  variant?: 'settings' | 'sidebar'
  collapsed?: boolean
}) {
  const { t } = useTranslation('settings')
  const { settings, update } = useSettings()
  const [confirming, setConfirming] = useState(false)

  const revert = async () => {
    setConfirming(false)
    try {
      await update({ ...settings, new_ui: false })
    } catch (e) {
      console.error('[new-ui] failed to switch to classic UI:', e)
    }
  }

  const button = (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={collapsed ? t('switch_to_classic_ui') : undefined}
      className={
        variant === 'sidebar'
          ? `focus-ring cursor-pointer relative flex items-center rounded-item text-sm font-medium transition-colors border border-transparent text-muted hover:text-ink hover:bg-raised/60 ${
              collapsed ? 'w-11 h-11 shrink-0 justify-center' : 'w-full gap-2.5 px-3 py-2.5'
            }`
          : 'focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-4 rounded-item bg-overlay border border-outline/50 text-muted hover:text-ink hover:bg-raised transition-colors'
      }
    >
      <IconHistory
        className={`w-4 h-4 shrink-0 ${variant === 'sidebar' ? 'text-muted' : ''}`}
      />
      {!collapsed && <span>{t('switch_to_classic_ui')}</span>}
    </button>
  )

  return (
    <>
      {variant === 'sidebar' && collapsed ? (
        <Tooltip content={t('switch_to_classic_ui')} side="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
      {confirming && (
        <ConfirmDialog
          title={t('switch_to_classic_confirm_title')}
          description={t('switch_to_classic_confirm_desc')}
          confirmLabel={t('switch_to_classic_ui')}
          onConfirm={revert}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
