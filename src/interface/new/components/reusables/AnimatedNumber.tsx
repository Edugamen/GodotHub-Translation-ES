import NumberFlow from '@number-flow/react'
import { useSettings } from '../../../../hooks/useSettings'

// Animated counter used across the new UI header metrics. Honors the
// "Animated numbers" setting — when disabled, renders a plain number.
export function AnimatedNumber({ value }: { value: number }) {
  const { settings } = useSettings()
  if (!settings.animated_numbers) return <span>{value}</span>
  return <NumberFlow value={value} />
}
