import { useState } from 'react'
import type { AppSettings } from '../../types'
import { OnboardingView as ClassicOnboarding } from '../classic/views/OnboardingView'
import { OnboardingView as NewOnboarding } from '../new/views/OnboardingView'

interface Props {
  settings: AppSettings
  onComplete: (settings: AppSettings) => Promise<AppSettings> | void
}

export function Onboarding({ settings, onComplete }: Props) {
  const [ui, setUi] = useState<'classic' | 'new'>(() =>
    settings.new_ui ? 'new' : 'classic',
  )

  if (ui === 'classic') {
    return (
      <ClassicOnboarding
        settings={{ ...settings, new_ui: false }}
        onComplete={onComplete}
        onChooseNew={() => setUi('new')}
      />
    )
  }

  return (
    <NewOnboarding
      settings={{ ...settings, new_ui: true }}
      onComplete={onComplete}
      onChooseClassic={() => setUi('classic')}
    />
  )
}
