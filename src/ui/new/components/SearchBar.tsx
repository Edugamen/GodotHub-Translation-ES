import { useTranslation } from 'react-i18next'
import { IconSearch, IconX } from '../../../components/Icons'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholderKey?: string
  className?: string
}

export function SearchBar({
  value,
  onChange,
  placeholderKey = 'search_projects_placeholder',
  className = '',
}: SearchBarProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className={`shrink-0 flex items-center gap-2 px-3.5 h-12 rounded-item bg-overlay border border-outline/50 focus-within:border-accent-dim focus-within:bg-raised transition-colors ${className}`}
    >
      <IconSearch className="w-4 h-4 text-muted shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('search')}
        placeholder={t(placeholderKey)}
        className="flex-1 min-w-0 bg-transparent outline-none text-sm font-medium text-ink placeholder:text-muted/70"
      />
      {value && (
        <button
          type="button"
          aria-label={t('clear_search')}
          onClick={() => onChange('')}
          className="cursor-pointer flex items-center justify-center w-6 h-6 rounded-btn text-muted hover:text-ink hover:bg-raised transition-colors"
        >
          <IconX className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
