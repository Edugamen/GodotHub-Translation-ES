import { useTranslation } from 'react-i18next'
import { IconRefresh } from '../../lib/Icons'
import { beginScaleSmoothing } from '../../../../lib/appearance'

interface Props {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  disabled?: boolean
  label?: string
  defaultValue?: number
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  label,
  defaultValue,
}: Props) {
  const { t } = useTranslation('settings')
  const percent = ((value - min) / (max - min)) * 100
  const thumbSize = 16
  const canReset =
    defaultValue !== undefined && Math.abs(value - defaultValue) >= step / 2

  return (
    <div className="flex items-center gap-2 w-full">
      <div
        className={`group relative flex items-center flex-1 h-5 ${disabled ? 'opacity-40' : ''}`}
      >
        <div
          className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-raised border overflow-hidden transition-colors ${
            disabled ? 'border-line' : 'border-line group-hover:border-accent-dim'
          }`}
        >
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-lg bg-white shadow-md border border-line transition-transform duration-150 group-active:scale-90 group-hover:scale-110"
          style={{ left: `calc(${percent}% - ${(percent / 100) * thumbSize}px)` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => {
            beginScaleSmoothing()
            onChange(Number(e.target.value))
          }}
          className="focus-ring relative z-10 m-0 w-full h-5 appearance-none bg-transparent disabled:cursor-not-allowed cursor-pointer
          [&::-webkit-slider-runnable-track]:h-5 [&::-webkit-slider-runnable-track]:bg-transparent
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-track]:h-5 [&::-moz-range-track]:bg-transparent [&::-moz-range-progress]:bg-transparent
          [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-transparent [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
        />
      </div>
      {canReset && (
        <button
          type="button"
          onClick={() => {
            beginScaleSmoothing()
            onChange(defaultValue)
          }}
          disabled={disabled}
          aria-label={t('reset_to_default')}
          title={t('reset_to_default')}
          className="focus-ring cursor-pointer shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-raised border border-line text-muted transition-colors duration-150 hover:text-accent-bright hover:border-accent-dim/50 hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconRefresh className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
