import { useTranslation } from 'react-i18next'
import { ViewHeader } from '../components/reusables/ViewHeader'
import { IconHouse } from '../lib/icons'

export function DashboardView({ connected = false }: { connected?: boolean }) {
  const { t } = useTranslation('nav')

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      <ViewHeader
        connected={connected}
        title={t('dashboard')}
        leadingAction={
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent text-ink">
            <IconHouse className="w-4.5 h-4.5" />
          </span>
        }
      />
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 text-center px-10">
        <div className="w-14 h-14 rounded-tile bg-accent/10 border border-accent-dim/30 flex items-center justify-center text-accent-bright">
          <IconHouse className="w-6 h-6" />
        </div>
        <p className="text-sm text-muted max-w-sm leading-relaxed">
          The dashboard will live here, giving you a quick overview of your
          projects, recent activity, and installed engines at a glance.
        </p>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-tag bg-amber/10 text-amber border border-amber/20">
          New UI · under construction
        </span>
      </div>
    </div>
  )
}
