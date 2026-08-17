import { US, CN, RU, MA, MX } from 'country-flag-icons/react/3x2'

const FLAGS: Record<string, typeof US> = {
  US,
  CN,
  RU,
  MA,
  MX,
}

export function LanguageFlag({
  country,
  className = 'w-4 h-4',
  title,
}: {
  /** ISO 3166-1 alpha-2 country code (upper-case). */
  country: string
  className?: string
  title?: string
}) {
  const Flag = FLAGS[country]
  if (!Flag) return null
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10 ${className}`}
    >
      <Flag className="w-full h-full" title={title ?? country} />
    </span>
  )
}
