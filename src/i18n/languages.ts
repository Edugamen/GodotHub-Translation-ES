export type LanguageStatus = 'complete' | 'beta' | 'incomplete'

export interface LanguageOption {
  value: string
  label: string
  status: LanguageStatus
}

export const LANGUAGES: LanguageOption[] = [
  { value: 'en-US', label: 'English', status: 'complete' },
  { value: 'zh-CN', label: '简体中文', status: 'beta' },
  { value: 'ru-RU', label: 'Русский', status: 'incomplete' },
  { value: 'ar-MA', label: 'العربية', status: 'incomplete' },
]

export function languageStatusLabelKey(status: LanguageStatus): string {
  switch (status) {
    case 'complete':
      return 'language_complete'
    case 'beta':
      return 'language_beta'
    case 'incomplete':
      return 'language_incomplete'
  }
}
