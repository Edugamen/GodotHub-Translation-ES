import { useTranslation } from 'react-i18next'
import { IconStore } from '../lib/Icons'
import { AssetStoreBrowser } from '../components/asset-library/AssetStoreBrowser'

export function AssetStoreView() {
  const { t } = useTranslation('common')
  return (
    <div className="p-10 pt-6 max-w-8xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-raised border border-line flex items-center justify-center shrink-0">
          <IconStore className="w-4.5 h-4.5 text-accent-bright" />
        </div>
        <div>
          <h2 className="font-body font-semibold text-3xl tracking-tight">
            {t('asset_store_title')}
          </h2>
          <p className="text-xs text-muted mt-1">
            {t('asset_subtitle')}
          </p>
        </div>
      </div>

      <AssetStoreBrowser />
    </div>
  )
}
