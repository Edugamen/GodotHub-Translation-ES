import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import arMANav from './locales/ar-MA/nav.json'
import arMACommon from './locales/ar-MA/common.json'
import arMASettings from './locales/ar-MA/settings.json'
import arMAGit from './locales/ar-MA/git.json'
import arMAChangelog from './locales/ar-MA/changelog.json'
import arMAOnboarding from './locales/ar-MA/onboarding.json'
import arMAVersions from './locales/ar-MA/versions.json'

import enUSNav from './locales/en-US/nav.json'
import enUSCommon from './locales/en-US/common.json'
import enUSSettings from './locales/en-US/settings.json'
import enUSGit from './locales/en-US/git.json'
import enUSChangelog from './locales/en-US/changelog.json'
import enUSOnboarding from './locales/en-US/onboarding.json'
import enUSVersions from './locales/en-US/versions.json'

import esMXNav from "./locales/es-MX/nav.json"
import esMXCommon from './locales/es-MX/common.json'
import esMXSettings from './locales/es-MX/settings.json'
import esMXGit from './locales/es-MX/git.json'
import esMXChangelog from './locales/es-MX/changelog.json'
import esMXOnboarding from './locales/es-MX/onboarding.json'
import esMXVersions from './locales/es-MX/versions.json'


import zhCNNav from './locales/zh-CN/nav.json'
import zhCNCommon from './locales/zh-CN/common.json'
import zhCNSettings from './locales/zh-CN/settings.json'
import zhCNGit from './locales/zh-CN/git.json'
import zhCNChangelog from './locales/zh-CN/changelog.json'
import zhCNOnboarding from './locales/zh-CN/onboarding.json'
import zhCNVersions from './locales/zh-CN/versions.json'

import ruRUNav from './locales/ru-RU/nav.json'
import ruRuCommon from './locales/ru-RU/common.json'
import ruRUSettings from './locales/ru-RU/settings.json'
import ruRUGit from './locales/ru-RU/git.json'
import ruRUChangelog from './locales/ru-RU/changelog.json'
import ruRUOnboarding from './locales/ru-RU/onboarding.json'
import ruRUVersions from './locales/ru-RU/versions.json'



const arMAResources = {
  nav: arMANav,
  common: arMACommon,
  settings: arMASettings,
  git: arMAGit,
  changelog: arMAChangelog,
  onboarding: arMAOnboarding,
  versions: arMAVersions,
}

const esMXResources = {
  nav: esMXNav,
  common: esMXCommon,
  settings: esMXSettings,
  git: esMXGit,
  changelog: esMXChangelog,
  onboarding: esMXOnboarding,
  versions: esMXVersions
}

const zhCNResources = {
  nav: zhCNNav,
  common: zhCNCommon,
  settings: zhCNSettings,
  git: zhCNGit,
  changelog: zhCNChangelog,
  onboarding: zhCNOnboarding,
  versions: zhCNVersions,
}

const resources = {
  'en-US': {
    nav: enUSNav,
    common: enUSCommon,
    settings: enUSSettings,
    git: enUSGit,
    changelog: enUSChangelog,
    onboarding: enUSOnboarding,
    versions: enUSVersions,
  },

  'es-MX': esMXResources,
  es: esMXResources,

  'zh-CN': zhCNResources,
  zh: zhCNResources,
  
  'ru-RU': {
    nav: ruRUNav,
    common: ruRuCommon,
    settings: ruRUSettings,
    git: ruRUGit,
    changelog: ruRUChangelog,
    onboarding: ruRUOnboarding,
    versions: ruRUVersions,
  },

  'ar-MA': arMAResources,
  ar: arMAResources,
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
