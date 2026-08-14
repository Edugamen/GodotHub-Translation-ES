import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../../../hooks/useSettings'
import { useWorkspaces } from '../../../hooks/useWorkspaces'
import { registerPendingSave, flushPendingSave } from '../../../lib/pendingSave'
import { DirList } from '../components/ui/DirList'
import { Dropdown } from '../components/ui/Dropdown'
import { Toggle } from '../components/ui/Toggle'
import { Tooltip } from '../components/reusables/Tooltip'
import { Slider } from '../components/ui/Slider'
import { ColorSwatchPicker } from '../components/ui/ColorSwatchPicker'
import { ConfirmDialog } from '../components/modals/ConfirmDialog'
import { IconSun, IconMoon, IconMonitor, IconHeart, IconBug, IconCheck } from '../lib/Icons'
import { viewTransition } from '../../../lib/motion'
import { api } from '../../../lib/api'
import {
  ACCENT_PRESETS_DARK,
  ACCENT_PRESETS_LIGHT,
  BG_PRESETS_DARK,
  BG_PRESETS_LIGHT,
  DEFAULT_ACCENT,
  DEFAULT_BG,
  DEFAULT_BG_LIGHT,
  DEFAULT_RAISED_CONTRAST,
  LIGHT_THEME_PRESETS,
  DARK_THEME_PRESETS,
  applyTheme,
  applyThemePreset,
  customThemeDefaults,
  getThemePreset,
  isDarkColor,
  resolveThemeMode,
  type ThemeModeSetting,
} from '../../../lib/colors'
import { isReducedMotion } from '../../../lib/appearance'
import { isMac, isWindows, defaultCornerRadius } from '../../../lib/platform'
import { markUiSwitchToSettings } from '../../../lib/uiTransition'
import {
  applyRadius,
  applyDensity,
  applyFontScale,
  applyProjectIconOpacity,
  applyNewUi,
} from '../../../lib/appearance'
import { SETTINGS_SEARCH_ITEMS } from '../components/modals/CommandPalette'
import { IconSearch, IconX, IconRefresh, IconChevronDown } from '../lib/Icons'
import { relaunch } from '@tauri-apps/plugin-process'
import type { AppSettings } from '../../../types'

const DEFAULT_RADIUS = defaultCornerRadius
const DEFAULT_DENSITY = 1.05
const DEFAULT_FONT_SCALE = 1.0
const DEFAULT_PROJECT_ICON_OPACITY = 14

const SAVE_DEBOUNCE_MS = 350

const DEFAULT_BG_DARK = DEFAULT_BG

type SettingsTab =
  'storage' | 'behavior' | 'display' | 'appearance' | 'advanced'

const TABS: { id: SettingsTab }[] = [
  { id: 'storage' },
  { id: 'behavior' },
  { id: 'display' },
  { id: 'appearance' },
  { id: 'advanced' },
]

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface/60 p-6">
      <div>
        <h3 className="font-display font-semibold">{title}</h3>
        <p className="text-xs text-muted mt-1.5 leading-relaxed">
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

type SaveState = 'idle' | 'saving' | 'saved'

function KeyRecorder({
  value,
  onChange,
  onReset,
}: {
  value: string
  onChange: (key: string) => void
  onReset?: () => void
}) {
  const { t } = useTranslation('settings')
  const [listening, setListening] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const mod = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'

  useEffect(() => {
    if (!listening) return

    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setListening(false)
        return
      }

      if (e.key.length !== 1) return

      const captured = e.key === ' ' ? ' ' : e.key.toLowerCase()
      onChangeRef.current(captured)
      setListening(false)

      const label = captured === ' ' ? t('key_space') : captured.toUpperCase()
      setConfirmMsg(`✓ ${mod}${label}`)
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmMsg(null), 1500)
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [listening])

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
  }, [])

  const displayKey =
    value === ' ' ? t('key_space') : value ? value.toUpperCase() : '—'

  return (
    <label className="flex flex-col gap-2.5 pt-5 border-t border-line">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted block">
          {t('palette_shortcut')}
        </span>
        {value !== 'p' && onReset && (
          <button
            type="button"
            onClick={() => {
              onReset()
              setConfirmMsg(`✓ ${mod}P`)
              if (confirmTimer.current) clearTimeout(confirmTimer.current)
              confirmTimer.current = setTimeout(() => setConfirmMsg(null), 1500)
            }}
            className="focus-ring cursor-pointer text-[10px] font-medium text-muted/60 hover:text-accent transition-colors"
          >
            {t('reset_to_default')}
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
        {t('keybind_instruction')}{' '}
        {t('press')}{' '}
        <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-raised border border-line">Esc</kbd>
        {' '}{t('to_cancel')}.
      </p>
      <div className="flex items-center gap-3">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setListening((l) => !l)}
          className={`focus-ring cursor-pointer relative flex items-center justify-center gap-2 px-5 py-3 rounded-xl border text-sm font-mono font-semibold transition-all ${
            listening
              ? 'border-accent bg-accent/10 text-accent-bright'
              : 'border-line bg-raised text-ink hover:border-accent-dim hover:bg-raised/80'
          }`}
        >
          {listening ? (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span>{t('press_key')}</span>
            </>
          ) : (
            <>
              <kbd className="text-xs px-2 py-0.5 rounded bg-surface border border-line/50">
                {mod}{displayKey}
              </kbd>
              <span className="text-xs font-normal text-muted">{t('click_to_rebind')}</span>
            </>
          )}
        </button>

        <AnimatePresence mode="wait">
          {confirmMsg && (
            <motion.span
              key={confirmMsg}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="text-xs text-accent font-medium shrink-0"
            >
              {confirmMsg}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </label>
  )
}

function SaveStatus({ state }: { state: SaveState }) {
  const { t } = useTranslation('settings')
  return (
    <div className="flex items-center gap-2 h-4">
      <AnimatePresence mode="wait">
        {state === 'saving' && (
          <motion.span
            key="saving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-muted"
          >
            {t('saving')}
          </motion.span>
        )}
        {state === 'saved' && (
          <motion.span
            key="saved"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-mint"
          >
            {t('saved')}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

interface SettingsViewProps {
  highlightSetting?: string | null
  onHighlightDone?: () => void
}

export function SettingsView({
  highlightSetting,
  onHighlightDone,
}: SettingsViewProps = {}) {
  const { t, i18n } = useTranslation('settings')
  const { settings, update, resetToDefaults, loaded } = useSettings()
  const { activeId } = useWorkspaces()
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const [current, setCurrent] = useState<AppSettings | null>(null)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [tokenTestState, setTokenTestState] = useState<'idle' | 'testing' | 'success' | 'warning' | 'error'>('idle')
  const [tokenTestMsg, setTokenTestMsg] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [confirmingWipe, setConfirmingWipe] = useState(false)
  const [confirmingOsDec, setConfirmingOsDec] = useState<boolean | null>(null)
  const [tab, setTab] = useState<SettingsTab>('storage')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('')
  const [cssDraft, setCssDraft] = useState('')
  const [cssStatus, setCssStatus] = useState<'idle' | 'applied'>('idle')

  const [sidebarExpandedWidth, setSidebarExpandedWidth] = useState(() => {
    try {
      return Math.min(
        400,
        Math.max(160, Number(localStorage.getItem('sidebar_width_expanded'))),
      )
    } catch {}
    return 230
  })
  const [sidebarCollapsedWidth, setSidebarCollapsedWidth] = useState(() => {
    try {
      return Math.min(
        120,
        Math.max(50, Number(localStorage.getItem('sidebar_width_collapsed'))),
      )
    } catch {}
    return 76
  })

  const tokenTestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  useEffect(() => {
    if (!highlightSetting) return

    if (highlightSetting === 'feeling_lucky') {
      onHighlightDone?.()
      return
    }
    if (highlightSetting === 'reset_colors') {
      onHighlightDone?.()
      resetThemeColors()
      return
    }

    const sectionMap: Record<string, { tab: SettingsTab; section: string }> = {
      project_scan_dirs: { tab: 'storage', section: 'storage-folders' },
      version_scan_dirs: { tab: 'storage', section: 'storage-folders' },
      default_project_location: { tab: 'storage', section: 'storage-folders' },
      download_dir: { tab: 'storage', section: 'storage-folders' },
      scan_depth: { tab: 'storage', section: 'storage-folders' },
      download_concurrency: { tab: 'storage', section: 'storage-folders' },
      launch_with_console: { tab: 'behavior', section: 'behavior' },
      close_on_project_open: { tab: 'behavior', section: 'behavior' },
      minimize_to_tray: { tab: 'behavior', section: 'behavior' },
      reopen_after_godot_closes: { tab: 'behavior', section: 'behavior' },              auto_scan_on_startup: { tab: 'behavior', section: 'behavior-projects' },
      auto_watch_project_dirs: { tab: 'behavior', section: 'behavior-projects' },
      auto_watch_version_dirs: { tab: 'behavior', section: 'behavior-projects' },
      auto_watch_template_dir: { tab: 'behavior', section: 'behavior-projects' },
      categories_enabled: { tab: 'behavior', section: 'behavior-projects' },
      workspaces_enabled: { tab: 'behavior', section: 'behavior-projects' },
      directory_naming_convention: { tab: 'behavior', section: 'behavior-projects' },
      git_init_new_projects: { tab: 'behavior', section: 'behavior-projects' },
      check_updates: { tab: 'advanced', section: 'advanced-updates' },
      github_token: { tab: 'advanced', section: 'advanced-github-token' },
      tooltip_delay: { tab: 'behavior', section: 'behavior-projects' },
      tray_recent_projects_count: { tab: 'behavior', section: 'behavior' },
      command_palette_keybind: { tab: 'behavior', section: 'behavior' },
      last_opened_time_format: { tab: 'display', section: 'display' },
      last_opened_date_format: { tab: 'display', section: 'display' },
      language: { tab: 'display', section: 'display' },
      theme_mode: { tab: 'appearance', section: 'appearance' },
      accent_color: { tab: 'appearance', section: 'appearance' },
      background_color: { tab: 'appearance', section: 'appearance' },
      corner_radius: { tab: 'appearance', section: 'appearance' },
      ui_density: { tab: 'appearance', section: 'appearance' },
      font_scale: { tab: 'appearance', section: 'appearance' },
      animation_intensity: { tab: 'appearance', section: 'appearance' },
      view_entrance: { tab: 'appearance', section: 'appearance' },
      custom_css: { tab: 'appearance', section: 'appearance' },
      show_scrollbars: { tab: 'appearance', section: 'appearance' },
      project_icon_opacity: { tab: 'appearance', section: 'appearance' },
      new_ui: { tab: 'appearance', section: 'appearance' },
      sidebar_width: { tab: 'appearance', section: 'appearance' },
      setup_wizard: { tab: 'advanced', section: 'advanced-setup' },
      reset_settings: { tab: 'advanced', section: 'advanced-reset' },
      delete_app_data: { tab: 'advanced', section: 'advanced-delete' },
      show_support_button: { tab: 'advanced', section: 'advanced-support' },
      show_star_button: { tab: 'advanced', section: 'advanced-support' },
    }

    const info = sectionMap[highlightSetting]
    if (!info) {
      onHighlightDone?.()
      return
    }
    setTab(info.tab)
    const t = setTimeout(() => {
      const el = document.querySelector(
        `[data-section-id="${info.section}"]`,
      )
      if (el) {
        el.scrollIntoView({ behavior: isReducedMotion() ? 'auto' : 'smooth', block: 'center' })
        el.classList.add('setting-highlight')
        setTimeout(() => {
          el.classList.remove('setting-highlight')
          onHighlightDone?.()
        }, 1500)
      } else {
        onHighlightDone?.()
      }
    }, 200)
    return () => clearTimeout(t)
  }, [highlightSetting])

  const prevSettingsRef = useRef(settings)

  useEffect(() => {
    if (!loaded) return
    if (current === null || settings !== prevSettingsRef.current) {
      prevSettingsRef.current = settings
      const projectDirs =
        settings.default_project_location &&
        !settings.project_scan_dirs.includes(settings.default_project_location)
          ? [...settings.project_scan_dirs, settings.default_project_location]
          : settings.project_scan_dirs
      const versionDirs =
        settings.download_dir &&
        !settings.version_scan_dirs.includes(settings.download_dir)
          ? [...settings.version_scan_dirs, settings.download_dir]
          : settings.version_scan_dirs
      setCurrent({
        ...settings,
        project_scan_dirs: projectDirs,
        version_scan_dirs: versionDirs,
      })
      setCssDraft(settings.custom_css)
    }
  }, [loaded, settings])

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      if (savedIndicatorTimeout.current)
        clearTimeout(savedIndicatorTimeout.current)
      flushPendingSave()
    }
  }, [])

  const persist = useCallback(
    (next: AppSettings) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      if (savedIndicatorTimeout.current)
        clearTimeout(savedIndicatorTimeout.current)
      setSaveState('saving')
      const scheduledFor = activeIdRef.current
      const flush = async () => {
        if (scheduledFor !== activeIdRef.current) {
          setSaveState('idle')
          return
        }
        await update(next)
        api.restartWatchers().catch(() => {})
        setSaveState('saved')
        savedIndicatorTimeout.current = setTimeout(
          () => setSaveState('idle'),
          1500,
        )
      }
      registerPendingSave(flush)
      saveTimeout.current = setTimeout(() => {
        flushPendingSave()
      }, SAVE_DEBOUNCE_MS)
    },
    [update],
  )

  const setField = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setCurrent((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      persist(next)
      return next
    })
  }

  const setFields = (patch: Partial<AppSettings>) => {
    setCurrent((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }

  if (!loaded || !current)
    return <div className="p-10 text-sm text-muted">{t('loading')}</div>

  const tabEntrance = viewTransition(
    current.view_entrance,
    current.animation_intensity,
  )

  const presetActive = current.theme_preset !== 'custom'

  const runScan = async () => {
    setScanMessage(t('scanning'))
    const [projects, versions] = await Promise.all([
      current.project_scan_dirs.length
        ? api.scanForProjects(current.project_scan_dirs, current.scan_depth)
        : Promise.resolve([]),
      current.version_scan_dirs.length
        ? api.scanForVersions(current.version_scan_dirs, current.scan_depth)
        : Promise.resolve([]),
    ])
    setScanMessage(
      t('scan_result', { projects: projects.length, versions: versions.length })
    )
  }

  const previewTheme = (
    accent: string,
    background: string,
    mode: ThemeModeSetting = current.theme_mode,
  ) =>
    applyTheme(
      accent,
      background,
      resolveThemeMode(mode),
      undefined,
      current.raised_contrast,
    )

  const resetThemeColors = () => {
    const resolvedMode = resolveThemeMode(current.theme_mode)
    const accent = DEFAULT_ACCENT
    const bg = resolvedMode === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK
    setFields({ accent_color: accent, background_color: bg })
    previewTheme(accent, bg)
  }

  const setThemeMode = (mode: 'dark' | 'light' | 'system') => {
    const resolved = resolveThemeMode(mode)
    const targetDark = resolved === 'dark'
    const bg = isDarkColor(current.background_color) === targetDark
      ? current.background_color
      : targetDark ? DEFAULT_BG : DEFAULT_BG_LIGHT
    setFields({ theme_mode: mode, background_color: bg })
    previewTheme(current.accent_color, bg, mode)
  }

  const selectPreset = (id: string) => {
    if (id === current.theme_preset) return
    if (id === 'custom') {
      const defaults = customThemeDefaults(resolveThemeMode(current.theme_mode))
      setFields({ theme_preset: id, ...defaults })
      applyTheme(
        defaults.accent_color,
        defaults.background_color,
        resolveThemeMode(current.theme_mode),
        undefined,
        current.raised_contrast,
      )
    } else {
      const preset = getThemePreset(id)
      if (preset) {
        setFields({ theme_preset: id, theme_mode: preset.mode })
        applyThemePreset(preset)
      }
    }
  }

  const handleApplyCss = () => {
    setField('custom_css', cssDraft)
    setCssStatus('applied')
    setTimeout(() => setCssStatus('idle'), 1500)
  }

  const resetAppearance = () => {
    setFields({
      accent_color: DEFAULT_ACCENT,
      background_color: DEFAULT_BG,
      corner_radius: DEFAULT_RADIUS,
      ui_density: DEFAULT_DENSITY,
      font_scale: DEFAULT_FONT_SCALE,
      theme_mode: 'dark',
      custom_css: '',
      animation_intensity: 'full',
      view_entrance: 'fade',
      project_icon_opacity: DEFAULT_PROJECT_ICON_OPACITY,
      raised_contrast: DEFAULT_RAISED_CONTRAST,
      new_ui: false,
      theme_preset: 'custom',
    })
    setCssDraft('')
    previewTheme(DEFAULT_ACCENT, DEFAULT_BG, 'dark')
    applyRadius(DEFAULT_RADIUS)
    applyDensity(DEFAULT_DENSITY)
    applyFontScale(DEFAULT_FONT_SCALE)
    applyProjectIconOpacity(DEFAULT_PROJECT_ICON_OPACITY)
    applyNewUi(false)
  }

  const resetAllSettings = async () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    if (savedIndicatorTimeout.current)
      clearTimeout(savedIndicatorTimeout.current)
    setConfirmingReset(false)
    setSaveState('saving')
    const defaults = await resetToDefaults()
    setCurrent(defaults)
    setSaveState('saved')
    savedIndicatorTimeout.current = setTimeout(() => setSaveState('idle'), 1500)
  }

  const wipeAppData = async () => {
    setConfirmingWipe(false)
    await api.resetAppData()
    window.location.reload()
  }

  return (
    <div className="p-10 pt-15 max-w-8xl mx-auto gap-6 flex flex-col">        <div className="flex items-start justify-between">
        <div>
          <h2 className="font-body font-semibold text-3xl tracking-tight">
            {t('settings_title')}
          </h2>
          <p className="text-xs text-muted">
            {t('settings_subtitle')}
          </p>
        </div>
        <SaveStatus state={saveState} />
      </div>

      <div className="relative">
        <div className="relative">
          <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50 pointer-events-none" />
          <input
            type="text"
            value={settingsSearchQuery}
            onChange={(e) => setSettingsSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSettingsSearchQuery('')
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            placeholder={t('search_placeholder')}
            className="focus-ring w-full bg-raised border border-line rounded-xl pl-10 pr-4 py-3 text-sm focus:border-accent-dim transition-colors"
          />
          {settingsSearchQuery && (
            <button
              onClick={() => setSettingsSearchQuery('')}
              className="focus-ring cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-ink hover:bg-surface transition-colors"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {settingsSearchQuery.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-0 right-0 top-full mt-2 bg-surface border border-line rounded-xl shadow-2xl shadow-black/30 overflow-hidden z-50"
          >
            {(() => {
              const q = settingsSearchQuery.trim().toLowerCase()
              const matches = SETTINGS_SEARCH_ITEMS.filter(
                (item) =>
                  (item.label ?? item.key.replace(/_/g, ' ')).toLowerCase().includes(q) ||
                  item.key.toLowerCase().includes(q),
              )
              if (matches.length === 0) {
                return (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-muted">
                      {t('no_settings_match')}{' '}
                      <span className="font-mono text-ink">"{settingsSearchQuery}"</span>
                    </p>
                  </div>
                )
              }
              return (
                <div className="max-h-60 overflow-y-auto p-1.5">
                  {matches.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setSettingsSearchQuery('')
                        setTab(item.tab as SettingsTab)
                        window.dispatchEvent(
                          new CustomEvent('app:open-setting', { detail: item.key }),
                        )
                      }}
                      className="focus-ring cursor-pointer w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors hover:bg-raised text-muted hover:text-ink"
                    >
                      <span className="flex-1">{item.label ?? item.key.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] font-medium text-muted/50 uppercase tracking-wider">
                        {item.tab}
                      </span>
                    </button>
                  ))}
                </div>
              )
            })()}
          </motion.div>
        )}
      </div>

      <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
        {TABS.map(({ id }) => {
          const label = t(id)
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.96 }}
              onClick={() => setTab(id)}
              className={
                'focus-ring cursor-pointer px-4 py-1.5 rounded-md text-xs font-medium transition-colors ' +
                (tab === id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-overlay/60')
              }
            >
              {label}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'storage' && (
          <motion.div key="storage" {...tabEntrance}>
            <div data-section-id="storage-folders">
            <SectionCard
              title={t('storage_title')}
              description={t('storage_desc')}
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-medium text-muted">
                    {t('section_projects')}
                  </span>
                  <DirList
                    dirs={current.project_scan_dirs}
                    onChange={(dirs) => setField('project_scan_dirs', dirs)}
                    emptyHint={t('empty_hint_projects')}
                    defaultDir={current.default_project_location}
                    onSetDefault={(dir) =>
                      setField('default_project_location', dir)
                    }
                    defaultLabel={t('new_project_default')}
                    showFallbackDescription={false}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('projects_desc')}
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
                  <span className="text-xs font-medium text-muted">
                    {t('section_godot_versions')}
                  </span>
                  <DirList
                    dirs={current.version_scan_dirs}
                    onChange={(dirs) => setField('version_scan_dirs', dirs)}
                    emptyHint={t('empty_hint_versions')}
                    defaultDir={current.download_dir}
                    onSetDefault={(dir) => setField('download_dir', dir)}
                    defaultLabel={t('download_folder')}
                    showFallbackDescription={true}
                    fallbackDownloadPath="AppData\\Roaming\\com.ryko.godothub\\godot-versions\\"
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('godot_versions_desc')}
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
                  <span className="text-xs font-medium text-muted">
                    {t('section_templates')}
                  </span>
                  <div className="flex items-center gap-2.5">
                    {current.template_scan_dir ? (
                      <>
                        <input
                          readOnly
                          value={current.template_scan_dir}
                          className="flex-1 bg-raised border border-line rounded-lg px-3.5 py-2.5 text-xs font-mono"
                        />
                        <motion.button
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setField('template_scan_dir', null)}
                          className="focus-ring cursor-pointer px-3 py-2 rounded-lg border border-line text-xs text-muted hover:text-danger hover:border-danger/30 hover:bg-danger/10 transition-colors"
                        >
                          {t('clear')}
                        </motion.button>
                      </>
                    ) : (
                      <span className="text-xs text-muted">
                        {t('no_folder_set')}
                      </span>
                    )}
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={async () => {
                        const folder = await api.pickFolder()
                        if (folder) setField('template_scan_dir', folder)
                      }}
                      className="focus-ring cursor-pointer px-3.5 py-2 rounded-lg border border-line text-xs hover:border-accent-dim hover:bg-raised transition-colors"
                    >
                      {t('browse')}
                    </motion.button>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('template_scan_desc')}
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-muted">
                      {t('scan_depth_label')}
                    </span>
                    <span className="text-xs text-ink tabular-nums">
                      {t('folders_deep', { count: current.scan_depth })}
                    </span>
                  </div>
                  <Slider
                    value={current.scan_depth}
                    min={1}
                    max={10}
                    defaultValue={2}
                    onChange={(value) => setField('scan_depth', value)}
                    label={t('scan_depth_label')}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('scan_depth_desc')}
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-muted">
                      {t('download_concurrency_label')}
                    </span>
                    <span className="text-xs text-ink tabular-nums">
                      {t('at_once', { count: current.download_concurrency })}
                    </span>
                  </div>
                  <Slider
                    value={current.download_concurrency}
                    min={1}
                    max={10}
                    defaultValue={3}
                    onChange={(value) =>
                      setField('download_concurrency', value)
                    }
                    label={t('download_concurrency_label')}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('download_concurrency_desc')}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-5 border-t border-line">
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={runScan}
                    className="focus-ring cursor-pointer px-5 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors"
                  >
                    {t('scan_now')}
                  </motion.button>
                  {scanMessage && (
                    <span className="text-xs text-muted">{scanMessage}</span>
                  )}
                </div>
              </div>
            </SectionCard>
            </div>
          </motion.div>
        )}

        {tab === 'behavior' && (
          <motion.div key="behavior" {...tabEntrance} className="flex flex-col gap-6">
            <div data-section-id="behavior">
            <SectionCard
              title={t('behavior_title')}
              description={t('behavior_desc')}
            >
              <div className="flex flex-col gap-5">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('launch_console_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {isWindows
                        ? t('launch_console_desc_windows')
                        : t('launch_console_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.launch_with_console}
                    onChange={(checked) =>
                      setField('launch_with_console', checked)
                    }
                    label={t('launch_console_label')}
                  />
                </label>

                <label className="flex items-center justify-between gap-4 pt-5 border-t border-line">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('close_on_open_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {isMac ? t('close_on_open_desc_mac') : t('close_on_open_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.close_on_project_open}
                    onChange={(checked) =>
                      setField('close_on_project_open', checked)
                    }
                    label={t('close_on_open_label')}
                  />
                </label>

                {!isMac && (
                  <label className="flex items-center justify-between gap-4 pt-5 border-t border-line">
                    <div>
                      <span className="text-xs font-medium text-muted block">
                        {t('minimize_tray_label')}
                      </span>
                      <p className="text-[11px] text-muted mt-1 leading-relaxed">
                        {t('minimize_tray_desc')}
                      </p>
                    </div>
                    <Toggle
                      checked={current.minimize_to_tray}
                      onChange={(checked) =>
                        setField('minimize_to_tray', checked)
                      }
                      label={t('minimize_tray_label')}
                    />
                  </label>
                )}

                <AnimatePresence initial={false}>
                  {current.close_on_project_open &&
                    (isMac || current.minimize_to_tray) && (
                      <motion.label
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="flex items-center justify-between gap-4 pt-5 border-t border-line overflow-hidden"
                      >
                        <div>
                          <span className="text-xs font-medium text-muted block">
                            {t('reopen_label')}
                          </span>
                          <p className="text-[11px] text-muted mt-1 leading-relaxed">
                            {isMac ? t('reopen_desc_mac') : t('reopen_desc')}
                          </p>
                        </div>
                        <Toggle
                          checked={current.reopen_after_godot_closes}
                          onChange={(checked) =>
                            setField('reopen_after_godot_closes', checked)
                          }
                          label={t('reopen_label')}
                        />
                      </motion.label>
                    )}
                </AnimatePresence>

                <label className="flex flex-col gap-2.5 pt-5 border-t border-line">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">
                      {t('tray_recent_label')}
                    </span>
                    <span className="text-xs text-ink tabular-nums">
                      {t('n_projects', { count: current.tray_recent_projects_count })}
                    </span>
                  </div>
                  <Slider
                    value={current.tray_recent_projects_count}
                    min={1}
                    max={10}
                    defaultValue={5}
                    onChange={(value) => {
                      setField('tray_recent_projects_count', value)
                      api.refreshTrayMenu().catch(() => {})
                    }}
                    label={t('tray_recent_label')}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('tray_recent_desc')}
                  </p>
                </label>

                <KeyRecorder
                  value={current.command_palette_keybind}
                  onChange={(value) => setField('command_palette_keybind', value)}
                  onReset={() => setField('command_palette_keybind', 'p')}
                />
              </div>
            </SectionCard>
            </div>

            <div data-section-id="behavior-projects">
            <SectionCard
              title={t('behavior_projects_title')}
              description={t('behavior_projects_desc')}
            >
              <div className="flex flex-col gap-5">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('auto_scan_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('auto_scan_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.auto_scan_on_startup}
                    onChange={(checked) =>
                      setField('auto_scan_on_startup', checked)
                    }
                    label={t('auto_scan_label')}
                  />
                </label>

                <label className="flex items-center justify-between gap-4 pt-5 border-t border-line">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('use_categories_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('categories_off_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.categories_enabled}
                    onChange={(checked) =>
                      setField('categories_enabled', checked)
                    }
                    label={t('use_categories_label')}
                  />
                </label>

                <label className="flex items-center justify-between gap-4 pt-5 border-t border-line">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('use_workspaces_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('workspaces_off_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.workspaces_enabled}
                    onChange={(checked) =>
                      setField('workspaces_enabled', checked)
                    }
                    label={t('use_workspaces_label')}
                  />
                </label>

                <label className="flex items-center justify-between gap-4 pt-5 border-t border-line">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('git_init_new_projects_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('git_init_new_projects_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.git_init_new_projects}
                    onChange={(checked) =>
                      setField('git_init_new_projects', checked)
                    }
                    label={t('git_init_new_projects_label')}
                  />
                </label>

                <label className="flex flex-col gap-2.5 pt-5 border-t border-line">
                  <span className="text-xs font-medium text-muted">
                    {t('naming_convention_label')}
                  </span>
                  <Dropdown
                    value={current.directory_naming_convention}
                    onChange={(value) =>
                      setField(
                        'directory_naming_convention',
                        value as AppSettings['directory_naming_convention'],
                      )
                    }
                    options={[
                      { value: 'keep', label: t('naming_keep') },
                      { value: 'kebab-case', label: t('naming_kebab') },
                      { value: 'snake_case', label: t('naming_snake') },
                      { value: 'camelCase', label: t('naming_camel') },
                      { value: 'PascalCase', label: t('naming_pascal') },
                      { value: 'Title Case', label: t('naming_title') },
                    ]}
                    hideEmpty
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('naming_convention_desc')}
                  </p>
                </label>

                <label className="flex flex-col gap-2.5 pt-5 border-t border-line">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">
                      {t('tooltip_delay_label')}
                    </span>
                    <span className="text-xs text-ink tabular-nums">
                      {current.tooltip_delay}ms
                    </span>
                  </div>
                  <Slider
                    value={current.tooltip_delay}
                    min={100}
                    max={1000}
                    step={50}
                    defaultValue={350}
                    onChange={(value) =>
                      setField('tooltip_delay', value)
                    }
                    label={t('tooltip_delay_label')}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('tooltip_delay_desc')}
                  </p>
                </label>

              </div>
            </SectionCard>
            </div>

            <div data-section-id="behavior-watchers">
            <SectionCard
              title={t('file_watchers_title')}
              description={t('file_watchers_desc')}
            >
              <div className="flex flex-col gap-5">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('watch_projects_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('watch_projects_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.auto_watch_project_dirs}
                    onChange={(checked) =>
                      setField('auto_watch_project_dirs', checked)
                    }
                    label={t('watch_projects_label')}
                  />
                </label>

                <label className="flex items-center justify-between gap-4 pt-5 border-t border-line">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('watch_versions_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('watch_versions_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.auto_watch_version_dirs}
                    onChange={(checked) =>
                      setField('auto_watch_version_dirs', checked)
                    }
                    label={t('watch_versions_label')}
                  />
                </label>

                <label className="flex items-center justify-between gap-4 pt-5 border-t border-line">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('watch_template_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('watch_template_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.auto_watch_template_dir}
                    onChange={(checked) =>
                      setField('auto_watch_template_dir', checked)
                    }
                    label={t('watch_template_label')}
                  />
                </label>

                <p className="text-[10px] text-muted/50 mt-1 leading-relaxed">
                  {t('watcher_footer_desc')}
                </p>
              </div>
            </SectionCard>
            </div>
          </motion.div>
        )}

        {tab === 'display' && (
          <motion.div key="display" {...tabEntrance}>
            <div data-section-id="display">
            <SectionCard
              title={t('last_opened_title')}
              description={
                t('last_opened_desc')
              }
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-medium text-muted">
                    {t('time_format_label')}
                  </span>
                  <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
                    {[
                      { value: '12h' as const, label: t('12h') },
                      { value: '24h' as const, label: t('24h') },
                    ].map(({ value, label }) => {
                      const active = current.last_opened_time_format === value
                      return (
                        <motion.button
                          key={value}
                          whileTap={{ scale: 0.96 }}
                          onClick={() =>
                            setField('last_opened_time_format', value)
                          }
                          className={
                            'focus-ring cursor-pointer px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ' +
                            (active
                              ? 'bg-accent text-white'
                              : 'text-muted hover:text-ink hover:bg-overlay/60')
                          }
                        >
                          {label}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-medium text-muted">
                    {t('date_format_label')}
                  </span>
                  <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
                    {[
                      { value: 'DD-MM-YYYY' as const, label: t('dd_mm_yyyy') },
                      { value: 'MM-DD-YYYY' as const, label: t('mm_dd_yyyy') },
                      { value: 'YYYY-MM-DD' as const, label: t('yyyy_mm_dd') },
                    ].map(({ value, label }) => {
                      const active = current.last_opened_date_format === value
                      return (
                        <motion.button
                          key={value}
                          whileTap={{ scale: 0.96 }}
                          onClick={() =>
                            setField('last_opened_date_format', value)
                          }
                          className={
                            'focus-ring cursor-pointer px-3.5 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ' +
                            (active
                              ? 'bg-accent text-white'
                              : 'text-muted hover:text-ink hover:bg-overlay/60')
                          }
                        >
                          {label}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
                <span className="text-xs font-medium text-muted flex items-center gap-2">
                  {t('language_label')}
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber/15 text-amber border border-amber/30">
                    Beta
                  </span>
                </span>
                <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
                  {[
                    { value: 'en-US', label: 'English' },
                    { value: 'zh-CN', label: '简体中文' },
                    { value: 'ru-RU', label: 'Русский' },
                    { value: 'ar-MA', label: 'العربية' },
                  ].map(({ value, label }) => {
                    const active = i18n.language === value || i18n.language.startsWith(value.split('-')[0])
                    return (
                      <motion.button
                        key={value}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          i18n.changeLanguage(value)
                          // document.documentElement.dir = i18n.dir()
                          setField('language', value)
                        }}
                        className={
                          'focus-ring cursor-pointer px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ' +
                          (active
                            ? 'bg-accent text-white'
                            : 'text-muted hover:text-ink hover:bg-overlay/60')
                        }
                      >
                        {label}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {!isMac && (
                <label className="flex items-center justify-between gap-4 pt-5 border-t border-line">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('use_os_decorations')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('use_os_decorations_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.use_os_decorations}
                    onChange={(checked) => setConfirmingOsDec(checked)}
                    label={t('use_os_decorations')}
                  />
                </label>
              )}
            </SectionCard>
            </div>
          </motion.div>
        )}

        {tab === 'appearance' && (
          <motion.div key="appearance" {...tabEntrance}>
            <div data-section-id="appearance">
            <SectionCard
              title={t('appearance_title')}
              description={t('appearance_desc')}
            >
              <div className="flex flex-col gap-7">
                <label className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-muted flex items-center gap-2">
                      {t('new_ui_label')}
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber/15 text-amber border border-amber/30">
                        {t('git_beta_badge', { ns: 'common' })}
                      </span>
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('new_ui_desc')}
                    </p>
                  </div>
                  <Tooltip content={t('new_ui_tooltip')} side="top">
                    <Toggle
                      checked={current.new_ui}
                      onChange={(checked) => {
                        setField('new_ui', checked)
                        applyNewUi(checked)
                        markUiSwitchToSettings()
                      }}
                      label={t('new_ui_label')}
                    />
                  </Tooltip>
                </label>

                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-medium text-muted">
                    {t('theme_preset_label')}
                  </span>
                  <div className="flex flex-col gap-4">
                    <button
                      type="button"
                      onClick={() => selectPreset('custom')}
                      className={`focus-ring cursor-pointer flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                        !presetActive
                          ? 'border-accent bg-accent/10'
                          : 'border-line hover:border-accent-dim hover:bg-raised'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-md ring-1 ring-black/10"
                          style={{ backgroundColor: current.accent_color }}
                        />
                        <span
                          className="w-4 h-4 rounded-md ring-1 ring-black/10"
                          style={{ backgroundColor: current.background_color }}
                        />
                      </span>
                      <span className="text-xs font-medium text-ink flex items-center gap-1">
                        {!presetActive && (
                          <IconCheck className="w-3 h-3 text-accent-bright" />
                        )}
                        {t('theme_preset_custom')}
                      </span>
                    </button>
                    {([
                      { id: 'light', label: t('preset_light_group'), Icon: IconSun, presets: LIGHT_THEME_PRESETS },
                      { id: 'dark', label: t('preset_dark_group'), Icon: IconMoon, presets: DARK_THEME_PRESETS },
                    ] as const).map(({ id, label, Icon, presets }) => {
                      const collapsed = !!collapsedGroups[id]
                      return (
                        <div className="flex flex-col gap-2" key={id}>
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedGroups((prev) => ({
                                ...prev,
                                [id]: !prev[id],
                              }))
                            }
                            aria-expanded={!collapsed}
                            className="focus-ring cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-ink transition-colors"
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                            <span className="text-[10px] font-medium text-muted/60">
                              {presets.length}
                            </span>
                            <IconChevronDown
                              className={`w-3 h-3 transition-transform duration-200 ${
                                collapsed ? '-rotate-90' : ''
                              }`}
                            />
                          </button>
                          <AnimatePresence initial={false}>
                            {!collapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {presets.map((preset) => {
                                    const active = current.theme_preset === preset.id
                                    return (
                                      <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => selectPreset(preset.id)}
                                        className={`focus-ring cursor-pointer flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                                          active
                                            ? 'border-accent bg-accent/10'
                                            : 'border-line hover:border-accent-dim hover:bg-raised'
                                        }`}
                                      >
                                        <span className="flex items-center gap-1.5">
                                          <span
                                            className="w-4 h-4 rounded-md ring-1 ring-black/10"
                                            style={{ backgroundColor: preset.base }}
                                          />
                                          <span
                                            className="w-4 h-4 rounded-md ring-1 ring-black/10"
                                            style={{ backgroundColor: preset.accent }}
                                          />
                                          <span
                                            className="w-4 h-4 rounded-md ring-1 ring-black/10"
                                            style={{ backgroundColor: preset.mint }}
                                          />
                                        </span>
                                        <span className="text-xs font-medium text-ink flex items-center gap-1">
                                          {active && (
                                            <IconCheck className="w-3 h-3 text-accent-bright" />
                                          )}
                                          {preset.name}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('theme_preset_desc')}
                  </p>
                </div>

                {!presetActive && (
                  <>
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-medium text-muted">{t('theme')}</span>
                  <div className="flex items-center gap-3 flex-wrap">

                    <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
                      {[
                        { mode: 'dark' as const, label: t('dark'), Icon: IconMoon },
                        { mode: 'light' as const, label: t('light'), Icon: IconSun },
                        { mode: 'system' as const, label: t('system'), Icon: IconMonitor },
                      ].map(({ mode, label, Icon }) => {
                        const active = current.theme_mode === mode
                        return (
                          <motion.button
                            key={mode}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setThemeMode(mode)}
                            className={
                              'focus-ring cursor-pointer flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ' +
                              (active
                                ? 'bg-accent text-white'
                                : 'text-muted hover:text-ink hover:bg-overlay/60')
                            }
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                          </motion.button>
                        )
                      })}
                    </div>
                    {current.theme_mode === 'system' && (
                      <p className="text-[11px] text-muted max-w-xs leading-relaxed">
                        {t('theme_follow_desc')}
                      </p>
                    )}

                    <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={resetThemeColors}
                        aria-label={t('reset_colors')}
                        className="focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted hover:text-ink hover:bg-overlay/60 transition-colors"
                      >
                        <IconHeart className="w-3.5 h-3.5" />
                        {t('reset')}
                      </motion.button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-8">
                  <ColorSwatchPicker
                    label={t('setting_accent_color')}
                    value={current.accent_color}
                    presets={
                      resolveThemeMode(current.theme_mode) === 'light'
                        ? ACCENT_PRESETS_LIGHT
                        : ACCENT_PRESETS_DARK
                    }
                    onChange={(hex) => {
                      setField('accent_color', hex)
                      previewTheme(hex, current.background_color)
                    }}
                  />
                  <ColorSwatchPicker
                    label={t('setting_background_color')}
                    value={current.background_color}
                    presets={
                      resolveThemeMode(current.theme_mode) === 'light'
                        ? BG_PRESETS_LIGHT
                        : BG_PRESETS_DARK
                    }
                    onChange={(hex) => {
                      setField('background_color', hex)
                      previewTheme(current.accent_color, hex)
                    }}
                  />
                </div>
                <p className="-mt-4 text-[11px] text-muted leading-relaxed">
                  {t('background_color_desc')}
                </p>

                <label className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">
                      {t('raised_contrast_label')}
                    </span>
                    <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
                      {t('raised_contrast_value', {
                        value: current.raised_contrast,
                      })}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={40}
                    step={1}
                    value={current.raised_contrast}
                    defaultValue={DEFAULT_RAISED_CONTRAST}
                    label={t('raised_contrast_label')}
                    onChange={(v) => {
                      setField('raised_contrast', v)
                      applyTheme(
                        current.accent_color,
                        current.background_color,
                        resolveThemeMode(current.theme_mode),
                        undefined,
                        v,
                      )
                    }}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('raised_contrast_desc')}
                  </p>
                </label>
                  </>
                )}

                <label className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">
                      {t('corner_radius_label')}
                    </span>
                    <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
                      {current.corner_radius}px
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={20}
                    step={1}
                    value={current.corner_radius}
                    defaultValue={DEFAULT_RADIUS}
                    label={t('corner_radius_label')}
                    onChange={(v) => {
                      setField('corner_radius', v)
                      applyRadius(v)
                    }}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('corner_radius_desc')}
                  </p>
                </label>

                <label className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">
                      {t('ui_density_label')}
                    </span>
                    <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
                      {Math.round(current.ui_density * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0.75}
                    max={1.25}
                    step={0.05}
                    value={current.ui_density}
                    defaultValue={DEFAULT_DENSITY}
                    label={t('ui_density_label')}
                    onChange={(v) => {
                      setField('ui_density', v)
                      applyDensity(v)
                    }}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('density_desc')}
                  </p>
                </label>

                <label className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">
                      {t('text_size_label')}
                    </span>
                    <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
                      {Math.round(current.font_scale * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0.85}
                    max={1.3}
                    step={0.05}
                    value={current.font_scale}
                    defaultValue={DEFAULT_FONT_SCALE}
                    label={t('text_size_label')}
                    onChange={(v) => {
                      setField('font_scale', v)
                      applyFontScale(v)
                    }}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('text_size_desc')}
                  </p>
                </label>

                <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-muted">
                      {t('animation_intensity_label')}
                    </span>
                    <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
                      {(
                        [
                          { value: 'full' as const, label: t('animation_full') },
                          { value: 'subtle' as const, label: t('animation_subtle') },
                          { value: 'none' as const, label: t('animation_none') },
                        ] as const
                      ).map(({ value, label }) => {
                        const active = current.animation_intensity === value
                        return (
                          <motion.button
                            key={value}
                            whileTap={{ scale: 0.96 }}
                            onClick={() =>
                              setField('animation_intensity', value)
                            }
                            className={
                              'focus-ring cursor-pointer px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
                              (active
                                ? 'bg-accent text-white'
                                : 'text-muted hover:text-ink hover:bg-overlay/60')
                            }
                          >
                            {label}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('animation_intensity_desc')}
                  </p>

                  <div className="flex items-center justify-between gap-4 pt-5 border-t border-line">
                    <span className="text-xs font-medium text-muted">
                      {t('view_entrance_label')}
                    </span>
                    <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
                      {(
                        [
                          { value: 'fade' as const, label: t('entrance_fade') },
                          { value: 'slide' as const, label: t('entrance_slide') },
                          { value: 'scale' as const, label: t('entrance_scale') },
                          { value: 'none' as const, label: t('entrance_none') },
                        ] as const
                      ).map(({ value, label }) => {
                        const active = current.view_entrance === value
                        return (
                          <motion.button
                            key={value}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setField('view_entrance', value)}
                            className={
                              'focus-ring cursor-pointer px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
                              (active
                                ? 'bg-accent text-white'
                                : 'text-muted hover:text-ink hover:bg-overlay/60')
                            }
                          >
                            {label}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('view_entrance_desc')}
                  </p>
                </div>

                <label className="flex flex-col gap-2.5 pt-5 border-t border-line">
                  <span className="text-xs font-medium text-muted">
                    {t('custom_css_label')}
                  </span>
                  <textarea
                    value={cssDraft}
                    onChange={(e) => {
                      setCssDraft(e.target.value)
                      setCssStatus('idle')
                    }}
                    spellCheck={false}
                    placeholder={t('custom_css_placeholder')}
                    className="focus-ring w-full h-40 resize-y bg-raised border border-line rounded-lg px-3.5 py-2.5 text-xs font-mono focus:border-accent-dim transition-colors"
                  />
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={handleApplyCss}
                      className="focus-ring cursor-pointer px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-dim transition-colors"
                    >
                      {t('custom_css_apply')}
                    </motion.button>
                    {current.custom_css && (
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setCssDraft('')
                          setField('custom_css', '')
                          setCssStatus('applied')
                          setTimeout(() => setCssStatus('idle'), 1500)
                        }}
                        className="focus-ring cursor-pointer px-3 py-2 rounded-lg border border-line text-xs text-muted hover:text-danger hover:border-danger/30 hover:bg-danger/10 transition-colors"
                      >
                        {t('custom_css_clear')}
                      </motion.button>
                    )}
                    {cssStatus === 'applied' && (
                      <span className="text-xs text-mint font-medium">
                        {t('custom_css_applied')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('custom_css_desc')}
                  </p>
                </label>

                <label className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-muted block">
                      {t('show_scrollbar_label')}
                    </span>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {t('scrollbar_desc')}
                    </p>
                  </div>
                  <Toggle
                    checked={current.show_scrollbars}
                    onChange={(checked) => {
                      setField('show_scrollbars', checked)
                    }}
                    label={t('show_scrollbar_label')}
                  />
                </label>

                <label className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">
                      {t('project_icon_opacity_label')}
                    </span>
                    <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
                      {current.project_icon_opacity}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={50}
                    step={1}
                    value={current.project_icon_opacity}
                    defaultValue={DEFAULT_PROJECT_ICON_OPACITY}
                    label={t('project_icon_opacity_label')}
                    onChange={(v) => {
                      setField('project_icon_opacity', v)
                      applyProjectIconOpacity(v)
                    }}
                  />
                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('icon_opacity_desc')}
                  </p>
                </label>

                <div className="pt-5 border-t border-line flex flex-col gap-5">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-medium text-muted">
                        {t('sidebar_expanded_label')}
                      </span>
                      <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
                        {sidebarExpandedWidth}px
                      </span>
                    </div>
                    <Slider
                      value={sidebarExpandedWidth}
                      min={160}
                      max={400}
                      step={10}
                      label={t('sidebar_expanded_label')}
                      onChange={(v) => {
                        setSidebarExpandedWidth(v)
                        try {
                          localStorage.setItem(
                            'sidebar_width_expanded',
                            String(v),
                          )
                          window.dispatchEvent(
                            new Event('app:sidebar-width-changed'),
                          )
                        } catch {}
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-medium text-muted">
                        {t('sidebar_collapsed_label')}
                      </span>
                      <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
                        {sidebarCollapsedWidth}px
                      </span>
                    </div>
                    <Slider
                      value={sidebarCollapsedWidth}
                      min={50}
                      max={120}
                      step={2}
                      label={t('sidebar_collapsed_label')}
                      onChange={(v) => {
                        setSidebarCollapsedWidth(v)
                        try {
                          localStorage.setItem(
                            'sidebar_width_collapsed',
                            String(v),
                          )
                          window.dispatchEvent(
                            new Event('app:sidebar-width-changed'),
                          )
                        } catch {}
                      }}
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={resetAppearance}
                  className="focus-ring cursor-pointer self-start px-4 py-2 rounded-lg border border-line text-muted hover:text-ink hover:bg-raised text-sm transition-colors"
                >
                  {t('reset_appearance')}
                </motion.button>
              </div>
            </SectionCard>
            </div>
          </motion.div>
        )}

        {tab === 'advanced' && (
          <motion.div key="advanced" {...tabEntrance} className="flex flex-col gap-6">
            <div data-section-id="advanced-github-token">
            <SectionCard
              title={t('github_token_title')}
              description={t('github_token_desc')}
            >
              <div className="flex flex-col gap-2.5">
                <div className="relative">
                  <input
                    type="password"
                    value={current.github_token ?? ''}
                    onChange={(e) =>
                      setField('github_token', e.target.value || null)
                    }
                    placeholder={t('setting_token_placeholder', { ns: 'common' })}
                    className="focus-ring w-full bg-raised border border-line rounded-lg px-3.5 py-2.5 text-sm font-mono focus:border-accent-dim transition-colors pr-20"
                  />
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={async () => {
                      if (tokenTestTimeout.current) clearTimeout(tokenTestTimeout.current)
                      try {
                        setTokenTestState('testing')
                        const info = await api.testGithubToken()
                        const mins = Math.max(1, Math.round((info.reset_at - Date.now() / 1000) / 60))
                        const status = info.used_token
                          ? `${info.remaining}/${info.limit} (resets ~${mins}min)`
                          : `${info.remaining}/${info.limit}`
                        setTokenTestState(info.remaining > 0 ? 'success' : 'warning')
                        setTokenTestMsg(t('token_valid', { status }))
                      } catch (e) {
                        setTokenTestState('error')
                        setTokenTestMsg(t('test_failed', { error: e }))
                      }
                      tokenTestTimeout.current = setTimeout(() => {
                        setTokenTestState('idle')
                        setTokenTestMsg(null)
                      }, 5000)
                    }}
                    className="focus-ring cursor-pointer absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-raised border border-line text-xs font-medium text-muted hover:text-ink hover:border-accent-dim transition-colors"
                  >
                    {tokenTestState === 'testing' ? t('testing') : t('test')}
                  </motion.button>
                </div>
                {tokenTestMsg && (
                  <span className={`text-[11px] ${
                    tokenTestState === 'success' ? 'text-mint' :
                    tokenTestState === 'warning' ? 'text-amber' :
                    tokenTestState === 'error' ? 'text-danger' :
                    'text-muted'
                  }`}>
                    {tokenTestMsg}
                  </span>
                )}
                <p className="text-[11px] text-muted leading-relaxed">
                  {t('token_help_desc')}{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-bright underline underline-offset-2"
                  >
                    github.com/settings/tokens
                  </a>
                  .
                </p>
              </div>
            </SectionCard>
            </div>

            <div data-section-id="advanced-support" className="rounded-xl border border-line bg-surface/60 p-6 flex items-center justify-between gap-6">
              <div className="min-w-0">
                <h3 className="font-display font-semibold">{t('titlebar_buttons')}</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  {t('titlebar_buttons_desc')}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Toggle
                    checked={current.show_support_button}
                    onChange={(checked) =>
                      setField('show_support_button', checked)
                    }
                    label={t('show_support_label')}
                  />
                  <span className="text-xs text-muted whitespace-nowrap">{t('support_dev_short')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Toggle
                    checked={current.show_star_button}
                    onChange={(checked) =>
                      setField('show_star_button', checked)
                    }
                    label={t('show_star_label')}
                  />
                  <span className="text-xs text-muted whitespace-nowrap">{t('star')}</span>
                </label>
              </div>
            </div>

            <div data-section-id="advanced-setup">
            <div className="rounded-xl border border-line bg-surface/60 p-6 flex items-center justify-between gap-6">
              <div className="min-w-0">
                <h3 className="font-display font-semibold">{t('setup_wizard_again')}</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  {t('setup_wizard_desc')}
                </p>
              </div>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setFields({ setup_complete: false })}
                className="focus-ring cursor-pointer shrink-0 px-5 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors"
              >
                {t('open_setup')}
              </motion.button>
            </div>
            </div>

            <div data-section-id="advanced-reset">
            <div className="rounded-xl border border-line bg-surface/60 p-6 flex items-center justify-between gap-6">
              <div className="min-w-0">
                <h3 className="font-display font-semibold">{t('reset_settings')}</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  {t('reset_settings_desc')}
                </p>
              </div>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setConfirmingReset(true)}
                className="focus-ring cursor-pointer shrink-0 px-5 py-2.5 rounded-lg border border-line text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/5 text-sm font-medium transition-colors"
              >
                {t('reset')}
              </motion.button>
            </div>
            </div>

            <div data-section-id="advanced-delete">
            <div className="rounded-xl border border-danger/30 bg-danger/4 p-6 flex items-center justify-between gap-6">
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-danger">{t('delete_app_data')}</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  {t('delete_data_desc')}
                </p>
              </div>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setConfirmingWipe(true)}
                className="focus-ring cursor-pointer shrink-0 px-5 py-2.5 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 text-sm font-medium transition-colors"
              >
                {t('delete_all')}
              </motion.button>
            </div>
            </div>

            <div data-section-id="advanced-updates" className="rounded-xl border border-line bg-surface/60 p-6 flex items-center justify-between gap-6">
              <div className="min-w-0">
                <h3 className="font-display font-semibold">{t('check_updates_title')}</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  {t('updates_desc')}
                </p>
              </div>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('app:check-updates'))
                }}
                className="focus-ring cursor-pointer shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors"
              >
                <IconRefresh className="w-4 h-4" />
                {t('check_updates')}
              </motion.button>
            </div>


            <div className="rounded-xl border border-line bg-surface/60 p-6 flex items-center justify-between gap-6">
              <div className="min-w-0">
                <h3 className="font-display font-semibold">{t('report_bug_title')}</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  {t('report_bug_desc')}
                </p>
              </div>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('app:report-bug'))
                }}
                className="focus-ring cursor-pointer shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors"
              >
                <IconBug className="w-4 h-4" />
                {t('report_bug')}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmingReset && (
          <ConfirmDialog
            title={t('reset_all_title')}
            description={t('reset_all_desc')}
            confirmLabel={t('reset_settings')}
            variant="danger"
            onConfirm={resetAllSettings}
            onCancel={() => setConfirmingReset(false)}
          />
        )}
        {confirmingWipe && (
          <ConfirmDialog
            title={t('delete_all_title')}
            description={t('delete_all_desc')}
            confirmLabel={t('delete_app_data')}
            variant="danger"
            onConfirm={wipeAppData}
            onCancel={() => setConfirmingWipe(false)}
          />
        )}
        {confirmingOsDec !== null && (
          <ConfirmDialog
            title={t('restart_required_title', { ns: 'common' })}
            description={t('restart_required_desc', { ns: 'common' })}
            confirmLabel={t('restart_now', { ns: 'common' })}
            variant="default"
            onConfirm={async () => {
              if (!current) return
              await update({ ...current, use_os_decorations: confirmingOsDec })
              setConfirmingOsDec(null)
              await relaunch()
            }}
            onCancel={() => setConfirmingOsDec(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
