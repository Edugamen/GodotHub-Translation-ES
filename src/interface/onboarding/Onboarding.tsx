import { useState } from 'react'
import type { AppSettings } from '../../types'
import { OnboardingView as ClassicOnboarding } from '../classic/views/OnboardingView'
import { OnboardingView as NewOnboarding } from '../new/views/OnboardingView'

interface Props {
  settings: AppSettings
  onComplete: (settings: AppSettings) => Promise<AppSettings> | void
}

/**
 * Entry point for the first-run setup wizard.
 *
 * The interface isn't chosen yet when setup runs, so we render the wizard in
 * the style of the interface the user will land in after setup:
 * - new_ui on  -> the new interface onboarding (can hand off to classic)
 * - new_ui off -> the classic interface onboarding
 */
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
