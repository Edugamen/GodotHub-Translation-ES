import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Toggle } from '../components/ui/Toggle'
import { Slider } from '../components/ui/Slider'
import { viewTransition } from '../../../lib/motion'
import { useSettings } from '../../../hooks/useSettings'
import { useProjectsContext } from '../../../hooks/projectsContext'
import { api } from '../../../lib/api'
import {
  ACCENT_PRESETS_DARK,
  ACCENT_PRESETS_LIGHT,
  BG_PRESETS_DARK,
  BG_PRESETS_LIGHT,
  DEFAULT_BG,
  DEFAULT_BG_LIGHT,
  DEFAULT_RAISED_CONTRAST,
  LIGHT_THEME_PRESETS,
  DARK_THEME_PRESETS,
  buildCustomPalette,
  customThemeDefaults,
  getThemePreset,
  isDarkColor,
  resolveThemeMode,
  type ThemePreset,
} from '../../../lib/colors'
import { ColorSwatchPicker } from '../components/ui/ColorSwatchPicker'
import { OverlayScrollArea } from '../components/OverlayScrollArea'
import { DirList } from '../components/DirList'
import { KeyRecorder } from '../components/ui/KeyRecorder'
import { matchesSearch, useSectionSearch } from '../hooks/useSectionSearch'
import { Dropdown } from '../components/ui/Dropdown'
import { SearchBar } from '../components/ui/SearchBar'
import { ViewHeader } from '../components/reusables/ViewHeader'
import { ConfirmDialog } from '../components/modals/ConfirmDialog'
import { CheckForUpdatesModal } from '../components/modals/CheckForUpdatesModal'
import { BugReportModal } from '../components/modals/BugReportModal'
import { defaultCornerRadius, isMac, isWindows } from '../../../lib/platform'
import { relaunch } from '@tauri-apps/plugin-process'
import { flushPendingSave } from '../../../lib/pendingSave'
import {
  IconCheck,
  IconPalette,
  IconSun,
  IconMoon,
  IconHardDrive,
  IconGear,
  IconChevronDown,
  IconSearch,
  IconRefresh,
  IconBug,
  IconHeart,
  IconFlask,
  IconBomb,
} from '../lib/icons'
import type { IconProps } from '../lib/icons'
import type { AppSettings } from '../../../types'

type SettingsCat = 'appearance' | 'display' | 'storage' | 'behavior' | 'advanced'

interface CatDef {
  id: SettingsCat
  icon: ComponentType<IconProps>
}

const CATEGORIES: CatDef[] = [
  { id: 'appearance', icon: IconPalette },
  { id: 'display', icon: IconSun },
  { id: 'storage', icon: IconHardDrive },
  { id: 'behavior', icon: IconGear },
  { id: 'advanced', icon: IconFlask },
]

const DEFAULT_RADIUS = defaultCornerRadius
const DEFAULT_DENSITY = 1.05
const DEFAULT_FONT_SCALE = 1.0
const DEFAULT_PROJECT_ICON_OPACITY = 14

function Subsection({
  id,
  title,
  description,
  children,
  searchText,
  query,
  onMatch,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
  searchText?: string
  query: string
  onMatch?: (id: string, matched: boolean) => void
}) {
  const matches = matchesSearch(query, title, description, searchText)

  useEffect(() => {
    onMatch?.(id, matches)
    return () => onMatch?.(id, false)
  }, [id, matches, onMatch])

  if (!matches) return null

  return (
    <section className="flex flex-col gap-3 rounded-item bg-overlay px-4 py-4">
      <div>
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        {description && (
          <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function PalettePreview({ preset }: { preset: ThemePreset }) {
  return (
    <div
      className="w-full rounded-md overflow-hidden border"
      style={{ backgroundColor: preset.base, borderColor: preset.line }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1.5"
        style={{
          backgroundColor: preset.surface,
          borderBottom: `1px solid ${preset.line}`,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: preset.danger }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: preset.amber }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: preset.mint }}
        />
        <span
          className="ml-auto w-7 h-1 rounded-full"
          style={{ backgroundColor: preset.line }}
        />
      </div>

      <div className="flex gap-1.5 p-2">
        <div
          className="flex flex-col gap-1 p-1 rounded-[3px]"
          style={{ backgroundColor: preset.surface }}
        >
          <span
            className="w-2 h-1 rounded-full"
            style={{ backgroundColor: preset.accent }}
          />
          <span
            className="w-2 h-1 rounded-full"
            style={{ backgroundColor: preset.line }}
          />
          <span
            className="w-2 h-1 rounded-full"
            style={{ backgroundColor: preset.line }}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <div
            className="rounded-[3px] p-1.5"
            style={{
              backgroundColor: preset.raised,
              border: `1px solid ${preset.line}`,
            }}
          >
            <span
              className="block h-1 rounded-full w-3/4"
              style={{ backgroundColor: preset.ink }}
            />
            <span
              className="block h-1 rounded-full w-1/2 mt-1"
              style={{ backgroundColor: preset.muted }}
            />
          </div>
          <div className="flex items-center gap-1">
            <span
              className="flex-1 h-1 rounded-full"
              style={{ backgroundColor: preset.line }}
            />
            <span
              className="w-3 h-2 rounded-xs"
              style={{ backgroundColor: preset.accent }}
            />
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 px-2 py-1.5"
        style={{
          backgroundColor: preset.surface,
          borderTop: `1px solid ${preset.line}`,
        }}
      >
        <span
          className="w-2 h-2 rounded-full ring-1 ring-black/20"
          style={{ backgroundColor: preset.accent }}
        />
        <span
          className="w-2 h-2 rounded-full ring-1 ring-black/20"
          style={{ backgroundColor: preset.accentBright }}
        />
        <span
          className="w-2 h-2 rounded-full ring-1 ring-black/20"
          style={{ backgroundColor: preset.mint }}
        />
        <span
          className="w-2 h-2 rounded-full ring-1 ring-black/20"
          style={{ backgroundColor: preset.amber }}
        />
        <span
          className="w-2 h-2 rounded-full ring-1 ring-black/20"
          style={{ backgroundColor: preset.danger }}
        />
      </div>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
  divider = false,
}: {
  label: string
  description?: string
  children: ReactNode
  divider?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        divider ? 'pt-4 border-t border-line' : ''
      }`}
    >
      <div>
        <span className="text-xs font-medium text-muted block">{label}</span>
        {description && (
          <p className="text-[11px] text-muted mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; mono?: boolean }[]
}) {
  return (
    <div className="inline-flex self-start rounded-btn border border-outline/50 bg-overlay p-1 gap-1">
      {options.map(({ value: v, label, mono }) => {
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`focus-ring cursor-pointer px-3.5 py-1.5 rounded-btn text-xs font-medium transition-colors ${
              mono ? 'font-mono' : ''
            } ${active ? 'bg-accent text-white' : 'text-muted hover:text-ink hover:bg-raised'}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsView() {
  const { t } = useTranslation('nav')
  const { t: ts, i18n } = useTranslation('settings')
  const { settings, update, resetToDefaults } = useSettings()
  const { refresh: refreshProjects } = useProjectsContext()
  const [cat, setCat] = useState<SettingsCat>('appearance')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [statsBusy, setStatsBusy] = useState<'export' | 'import' | null>(null)
  const [statsMessage, setStatsMessage] = useState<string | null>(null)
  const [cssDraft, setCssDraft] = useState(settings.custom_css)
  const [cssStatus, setCssStatus] = useState<'idle' | 'applied'>('idle')
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [tokenTestState, setTokenTestState] = useState<
    'idle' | 'testing' | 'success' | 'warning' | 'error'
  >('idle')
  const [tokenTestMsg, setTokenTestMsg] = useState<string | null>(null)
  const tokenTestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [confirmingWipe, setConfirmingWipe] = useState(false)
  const [confirmingOsDec, setConfirmingOsDec] = useState<boolean | null>(null)
  const [showUpdates, setShowUpdates] = useState(false)
  const [showBugReport, setShowBugReport] = useState(false)
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    reportMatch,
    noResults,
    inputRef: searchRef,
    clear: clearSearch,
    reset: resetSearch,
  } = useSectionSearch()

  useEffect(() => {
    setCssDraft(settings.custom_css)
  }, [settings.custom_css])

  const handleApplyCss = () => {
    update({ ...settings, custom_css: cssDraft })
    setCssStatus('applied')
    setTimeout(() => setCssStatus('idle'), 1500)
  }

  const handleExportStats = async () => {
    setStatsBusy('export')
    setStatsMessage(null)
    try {
      const path = await api.pickSavePath('godothub-time-stats.json')
      if (!path) return
      await api.exportProjectStats(path)
      setStatsMessage(ts('stats_exported'))
    } catch (e) {
      setStatsMessage(String(e))
    } finally {
      setStatsBusy(null)
    }
  }

  const handleImportStats = async () => {
    setStatsBusy('import')
    setStatsMessage(null)
    try {
      const path = await api.pickDataFile()
      if (!path) return
      const count = await api.importProjectStats(path)
      await refreshProjects()
      setStatsMessage(ts('stats_imported', { count }))
    } catch (e) {
      setStatsMessage(String(e))
    } finally {
      setStatsBusy(null)
    }
  }

  const selectCustom = () =>
    update({
      ...settings,
      theme_preset: 'custom',
      ...customThemeDefaults(resolveThemeMode(settings.theme_mode)),
    })

  const setThemeMode = (mode: 'dark' | 'light' | 'system') => {
    const resolved = resolveThemeMode(mode)
    const targetDark = resolved === 'dark'
    const bg = isDarkColor(settings.background_color) === targetDark
      ? settings.background_color
      : targetDark ? DEFAULT_BG : DEFAULT_BG_LIGHT
    update({ ...settings, theme_mode: mode, background_color: bg })
  }

  const selectPreset = (id: string) => {
    if (id === settings.theme_preset) return
    if (id === 'custom') {
      const defaults = customThemeDefaults(resolveThemeMode(settings.theme_mode))
      update({ ...settings, theme_preset: id, ...defaults })
    } else {
      const preset = getThemePreset(id)
      if (preset) update({ ...settings, theme_preset: id, theme_mode: preset.mode })
    }
  }

  const customPalette =
    getThemePreset(settings.theme_preset) ??
    buildCustomPalette(
      settings.accent_color,
      settings.background_color,
      resolveThemeMode(settings.theme_mode),
      settings.raised_contrast,
    )

  const runScan = async () => {
    setScanMessage(ts('scanning'))
    const [projects, versions] = await Promise.all([
      settings.project_scan_dirs.length
        ? api.scanForProjects(settings.project_scan_dirs, settings.scan_depth)
        : Promise.resolve([]),
      settings.version_scan_dirs.length
        ? api.scanForVersions(settings.version_scan_dirs, settings.scan_depth)
        : Promise.resolve([]),
    ])
    setScanMessage(
      ts('scan_result', { projects: projects.length, versions: versions.length }),
    )
    await refreshProjects()
  }

  const resetThemeColors = () => {
    const resolvedMode = resolveThemeMode(settings.theme_mode)
    const defaults = customThemeDefaults(resolvedMode)
    update({ ...settings, ...defaults })
  }

  const resetAppearance = () => {
    const defaults = customThemeDefaults(resolveThemeMode(settings.theme_mode))
    update({
      ...settings,
      ...defaults,
      corner_radius: DEFAULT_RADIUS,
      ui_density: DEFAULT_DENSITY,
      font_scale: DEFAULT_FONT_SCALE,
      theme_mode: 'dark',
      custom_css: '',
      animation_intensity: 'full',
      view_entrance: 'fade',
      project_icon_opacity: DEFAULT_PROJECT_ICON_OPACITY,
      raised_contrast: DEFAULT_RAISED_CONTRAST,
      theme_preset: 'custom',
    })
    setCssDraft('')
  }

  const testGithubToken = async () => {
    if (tokenTestTimeout.current) clearTimeout(tokenTestTimeout.current)
    try {
      setTokenTestState('testing')
      const info = await api.testGithubToken()
      const mins = Math.max(
        1,
        Math.round((info.reset_at - Date.now() / 1000) / 60),
      )
      const status = info.used_token
        ? `${info.remaining}/${info.limit} (resets ~${mins}min)`
        : `${info.remaining}/${info.limit}`
      setTokenTestState(info.remaining > 0 ? 'success' : 'warning')
      setTokenTestMsg(ts('token_valid', { status }))
    } catch (e) {
      setTokenTestState('error')
      setTokenTestMsg(ts('test_failed', { error: e }))
    }
    tokenTestTimeout.current = setTimeout(() => {
      setTokenTestState('idle')
      setTokenTestMsg(null)
    }, 5000)
  }

  const resetAllSettings = async () => {
    setConfirmingReset(false)
    await resetToDefaults()
  }

  const wipeAppData = async () => {
    setConfirmingWipe(false)
    await api.resetAppData()
    window.location.reload()
  }

  const handleOsDecConfirm = async () => {
    const value = confirmingOsDec
    setConfirmingOsDec(null)
    if (value === null) return
    await update({ ...settings, use_os_decorations: value })
    await flushPendingSave()
    await relaunch()
  }

  useEffect(() => {
    return () => {
      void flushPendingSave()
    }
  }, [])

  const renderAppearance = () => (
    <div className="flex flex-col gap-3">
      <Subsection
        id="appearance-presets"
        title={ts('theme_preset_label')}
        description={ts('theme_preset_desc')}
        searchText={`${ts('theme_preset_label')} ${ts('theme_preset_custom')} ${ts('preset_light_group')} ${ts('preset_dark_group')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={selectCustom}
            className={`focus-ring cursor-pointer flex flex-col items-start gap-2 rounded-btn border p-3 text-left transition-colors ${
              settings.theme_preset === 'custom'
                ? 'border-accent bg-accent/10'
                : 'border-outline/50 hover:border-accent-dim hover:bg-raised'
            }`}
          >
            <PalettePreview preset={customPalette} />
            <span className="text-xs font-medium text-ink flex items-center gap-1">
              {settings.theme_preset === 'custom' && (
                <IconCheck className="w-3 h-3 text-accent-bright" />
              )}
              {ts('theme_preset_custom')}
            </span>
          </button>
          {([
            { id: 'light', label: ts('preset_light_group'), Icon: IconSun, presets: LIGHT_THEME_PRESETS },
            { id: 'dark', label: ts('preset_dark_group'), Icon: IconMoon, presets: DARK_THEME_PRESETS },
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {presets.map((preset) => {
                          const active = settings.theme_preset === preset.id
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => selectPreset(preset.id)}
                              className={`focus-ring cursor-pointer flex flex-col items-start gap-2 rounded-btn border p-3 text-left transition-colors ${
                                active
                                  ? 'border-accent bg-accent/10'
                                  : 'border-outline/50 hover:border-accent-dim hover:bg-raised'
                              }`}
                            >
                              <PalettePreview preset={preset} />
                              <span className="text-xs font-medium text-ink flex items-center gap-1">
                                {active && <IconCheck className="w-3 h-3 text-accent-bright" />}
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

        {settings.theme_preset === 'custom' && (
          <div className="flex flex-col gap-3 pt-4 border-t border-line">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted">{ts('theme')}</span>
              {settings.theme_mode === 'system' && (
                <p className="text-[11px] text-muted leading-relaxed">
                  {ts('theme_follow_desc')}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Segmented
                  value={settings.theme_mode}
                  onChange={(v) => setThemeMode(v as 'dark' | 'light' | 'system')}
                  options={[
                    { value: 'dark', label: ts('dark') },
                    { value: 'light', label: ts('light') },
                    { value: 'system', label: ts('system') },
                  ]}
                />
                <button
                  type="button"
                  onClick={resetThemeColors}
                  aria-label={ts('reset_colors')}
                  className="focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium text-muted hover:text-ink hover:bg-raised transition-colors"
                >
                  <IconHeart className="w-3.5 h-3.5" />
                  {ts('reset')}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-8">
              <ColorSwatchPicker
                label={ts('setting_accent_color')}
                value={settings.accent_color}
                presets={
                  resolveThemeMode(settings.theme_mode) === 'light'
                    ? ACCENT_PRESETS_LIGHT
                    : ACCENT_PRESETS_DARK
                }
                onChange={(hex) => update({ ...settings, accent_color: hex })}
              />
              <ColorSwatchPicker
                label={ts('setting_background_color')}
                value={settings.background_color}
                presets={
                  resolveThemeMode(settings.theme_mode) === 'light'
                    ? BG_PRESETS_LIGHT
                    : BG_PRESETS_DARK
                }
                onChange={(hex) => update({ ...settings, background_color: hex })}
              />
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              {ts('background_color_desc')}
            </p>

            <div className="flex flex-col gap-2">
              <Slider
                label={ts('raised_contrast_label')}
                display={
                  <span className="text-xs font-medium text-ink tabular-nums">
                    {ts('raised_contrast_value', {
                      value: settings.raised_contrast,
                    })}
                  </span>
                }
                value={settings.raised_contrast}
                min={0}
                max={40}
                step={1}
                defaultValue={DEFAULT_RAISED_CONTRAST}
                onChange={(value) =>
                  update({ ...settings, raised_contrast: value })
                }
              />
              <p className="text-[11px] text-muted leading-relaxed">
                {ts('raised_contrast_desc')}
              </p>
            </div>
          </div>
        )}
      </Subsection>

      <Subsection
        id="appearance-radius"
        title={ts('corner_radius_label')}
        description={ts('corner_radius_desc')}
        searchText={`${ts('corner_radius_label')} ${ts('corner_radius_desc')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-2">
          <Slider
            label={ts('corner_radius_label')}
            display={
              <span className="text-xs font-mono text-ink tabular-nums">
                {settings.corner_radius}px
              </span>
            }
            value={settings.corner_radius}
            min={0}
            max={20}
            step={1}
            defaultValue={DEFAULT_RADIUS}
            onChange={(v) => update({ ...settings, corner_radius: v })}
          />
        </div>
      </Subsection>

      <Subsection
        id="appearance-density"
        title={ts('ui_density_label')}
        description={ts('density_desc')}
        searchText={`${ts('ui_density_label')} ${ts('density_desc')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-2">
          <Slider
            label={ts('ui_density_label')}
            display={
              <span className="text-xs font-mono text-ink tabular-nums">
                {Math.round(settings.ui_density * 100)}%
              </span>
            }
            value={settings.ui_density}
            min={0.75}
            max={1.25}
            step={0.05}
            defaultValue={DEFAULT_DENSITY}
            onChange={(v) => update({ ...settings, ui_density: v })}
          />
        </div>
      </Subsection>

      <Subsection
        id="appearance-text-size"
        title={ts('text_size_label')}
        description={ts('text_size_desc')}
        searchText={`${ts('text_size_label')} ${ts('text_size_desc')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-2">
          <Slider
            label={ts('text_size_label')}
            display={
              <span className="text-xs font-mono text-ink tabular-nums">
                {Math.round(settings.font_scale * 100)}%
              </span>
            }
            value={settings.font_scale}
            min={0.85}
            max={1.3}
            step={0.05}
            defaultValue={DEFAULT_FONT_SCALE}
            onChange={(v) => update({ ...settings, font_scale: v })}
          />
        </div>
      </Subsection>

      <Subsection
        id="appearance-motion"
        title={ts('animation_intensity_label')}
        description={ts('animation_intensity_desc')}
        searchText={`${ts('animation_intensity_label')} ${ts('animation_intensity_desc')} ${ts('animation_full')} ${ts('animation_subtle')} ${ts('animation_none')} ${ts('view_entrance_label')} ${ts('view_entrance_desc')} ${ts('entrance_fade')} ${ts('entrance_slide')} ${ts('entrance_scale')} ${ts('entrance_none')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-3">
          <SettingRow label={ts('animation_intensity_label')}>
            <Segmented
              value={settings.animation_intensity}
              onChange={(v) =>
                update({
                  ...settings,
                  animation_intensity: v as AppSettings['animation_intensity'],
                })
              }
              options={[
                { value: 'full', label: ts('animation_full') },
                { value: 'subtle', label: ts('animation_subtle') },
                { value: 'none', label: ts('animation_none') },
              ]}
            />
          </SettingRow>

          <SettingRow label={ts('view_entrance_label')} divider>
            <Segmented
              value={settings.view_entrance}
              onChange={(v) =>
                update({
                  ...settings,
                  view_entrance: v as AppSettings['view_entrance'],
                })
              }
              options={[
                { value: 'fade', label: ts('entrance_fade') },
                { value: 'slide', label: ts('entrance_slide') },
                { value: 'scale', label: ts('entrance_scale') },
                { value: 'none', label: ts('entrance_none') },
              ]}
            />
          </SettingRow>
          <p className="text-[11px] text-muted leading-relaxed">
            {ts('view_entrance_desc')}
          </p>
        </div>
      </Subsection>

      <Subsection
        id="appearance-scrollbars"
        title={ts('show_scrollbar_label')}
        description={ts('scrollbar_desc')}
        searchText={`${ts('show_scrollbar_label')} ${ts('scrollbar_desc')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <SettingRow label={ts('show_scrollbar_label')}>
          <Toggle
            checked={settings.show_scrollbars}
            onChange={(checked) =>
              update({ ...settings, show_scrollbars: checked })
            }
            label={ts('show_scrollbar_label')}
          />
        </SettingRow>
      </Subsection>

      <Subsection
        id="appearance-icon-opacity"
        title={ts('project_icon_opacity_label')}
        description={ts('icon_opacity_desc')}
        searchText={`${ts('project_icon_opacity_label')} ${ts('icon_opacity_desc')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-2">
          <Slider
            label={ts('project_icon_opacity_label')}
            display={
              <span className="text-xs font-mono text-ink tabular-nums">
                {settings.project_icon_opacity}%
              </span>
            }
            value={settings.project_icon_opacity}
            min={0}
            max={50}
            step={1}
            defaultValue={DEFAULT_PROJECT_ICON_OPACITY}
            onChange={(v) =>
              update({ ...settings, project_icon_opacity: v })
            }
          />
        </div>
      </Subsection>

      <Subsection
        id="appearance-css"
        title={ts('custom_css_label')}
        description={ts('custom_css_desc')}
        searchText={`${ts('custom_css_label')} ${ts('custom_css_desc')} ${ts('custom_css_apply')} ${ts('custom_css_clear')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-2">
          <textarea
            value={cssDraft}
            onChange={(e) => {
              setCssDraft(e.target.value)
              setCssStatus('idle')
            }}
            spellCheck={false}
            placeholder={ts('custom_css_placeholder')}
            className="focus-ring w-full h-40 resize-y bg-base border border-outline/50 rounded-btn px-3.5 py-2.5 text-xs font-mono text-ink placeholder:text-muted/50 transition-colors focus:border-accent-dim"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyCss}
              className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-4 rounded-btn bg-accent text-white text-xs font-medium hover:bg-accent-dim transition-colors"
            >
              {ts('custom_css_apply')}
            </button>
            {settings.custom_css && (
              <button
                type="button"
                onClick={() => {
                  setCssDraft('')
                  update({ ...settings, custom_css: '' })
                  setCssStatus('applied')
                  setTimeout(() => setCssStatus('idle'), 1500)
                }}
                className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-3.5 rounded-btn bg-overlay border border-outline/50 text-muted text-xs font-medium hover:text-ink hover:bg-raised transition-colors"
              >
                {ts('custom_css_clear')}
              </button>
            )}
            {cssStatus === 'applied' && (
              <span className="text-xs text-mint font-medium">
                {ts('custom_css_applied')}
              </span>
            )}
          </div>
        </div>
      </Subsection>

      <button
        type="button"
        onClick={resetAppearance}
        className="focus-ring cursor-pointer self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-btn border border-outline/50 text-muted hover:text-ink hover:bg-raised text-xs font-medium transition-colors"
      >
        <IconRefresh className="w-3.5 h-3.5" />
        {ts('reset_appearance')}
      </button>
    </div>
  )

  const renderDisplay = () => (
    <div className="flex flex-col gap-3">
      <Subsection
        id="display-formats"
        title={ts('last_opened_title')}
        description={ts('last_opened_desc')}
        searchText={`${ts('last_opened_title')} ${ts('last_opened_desc')} ${ts('time_format_label')} ${ts('date_format_label')} ${ts('12h')} ${ts('24h')} ${ts('dd_mm_yyyy')} ${ts('mm_dd_yyyy')} ${ts('yyyy_mm_dd')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium text-muted">
              {ts('time_format_label')}
            </span>
            <Segmented
              value={settings.last_opened_time_format}
              onChange={(v) =>
                update({
                  ...settings,
                  last_opened_time_format: v as AppSettings['last_opened_time_format'],
                })
              }
              options={[
                { value: '12h', label: ts('12h') },
                { value: '24h', label: ts('24h') },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium text-muted">
              {ts('date_format_label')}
            </span>
            <Segmented
              value={settings.last_opened_date_format}
              onChange={(v) =>
                update({
                  ...settings,
                  last_opened_date_format: v as AppSettings['last_opened_date_format'],
                })
              }
              options={[
                { value: 'DD-MM-YYYY', label: ts('dd_mm_yyyy'), mono: true },
                { value: 'MM-DD-YYYY', label: ts('mm_dd_yyyy'), mono: true },
                { value: 'YYYY-MM-DD', label: ts('yyyy_mm_dd'), mono: true },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
            <span className="text-xs font-medium text-muted flex items-center gap-2">
              {ts('language_label')}
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-tag bg-amber/15 text-amber border border-amber/30">
                Beta
              </span>
            </span>
            <Segmented
              value={i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US'}
              onChange={(v) => {
                i18n.changeLanguage(v)
                update({ ...settings, language: v })
              }}
              options={[
                { value: 'en-US', label: 'English' },
                { value: 'zh-CN', label: '简体中文' },
              ]}
            />
          </div>
        </div>
      </Subsection>

      {!isMac && (
        <Subsection
          id="display-os-decorations"
          title={ts('use_os_decorations')}
          description={ts('use_os_decorations_desc')}
          searchText={`${ts('use_os_decorations')} ${ts('use_os_decorations_desc')}`}
          query={searchQuery}
          onMatch={reportMatch}
        >
          <SettingRow label={ts('use_os_decorations')}>
            <Toggle
              checked={settings.use_os_decorations}
              onChange={(checked) => setConfirmingOsDec(checked)}
              label={ts('use_os_decorations')}
            />
          </SettingRow>
        </Subsection>
      )}

      <Subsection
        id="display-animation-threshold"
        title={ts('animation_threshold_label')}
        description={ts('animation_threshold_desc')}
        searchText={`${ts('animation_threshold_label')} ${ts('animation_threshold_desc')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-2">
          <Slider
            label={ts('animation_threshold_label')}
            display={
              <span className="text-xs font-medium text-ink tabular-nums">
                {ts('n_projects', { count: settings.animation_threshold })}
              </span>
            }
            value={settings.animation_threshold}
            min={10}
            max={100}
            step={5}
            defaultValue={20}
            onChange={(value) =>
              update({ ...settings, animation_threshold: value })
            }
          />
        </div>
      </Subsection>
    </div>
  )

  const renderStorage = () => (
    <div className="flex flex-col gap-3">
      <Subsection
        id="storage-folders"
        title={ts('storage_title')}
        description={ts('storage_desc')}
        searchText={`${ts('storage_title')} ${ts('storage_desc')} ${ts('section_projects')} ${ts('section_godot_versions')} ${ts('section_templates')} ${ts('new_project_default')} ${ts('download_folder')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium text-muted">
              {ts('section_projects')}
            </span>
            <DirList
              dirs={settings.project_scan_dirs}
              onChange={(dirs) => update({ ...settings, project_scan_dirs: dirs })}
              emptyHint={ts('empty_hint_projects')}
              defaultDir={settings.default_project_location}
              onSetDefault={(dir) =>
                update({ ...settings, default_project_location: dir })
              }
              defaultLabel={ts('new_project_default')}
            />
            <p className="text-[11px] text-muted leading-relaxed">
              {ts('projects_desc')}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
            <span className="text-xs font-medium text-muted">
              {ts('section_godot_versions')}
            </span>
            <DirList
              dirs={settings.version_scan_dirs}
              onChange={(dirs) => update({ ...settings, version_scan_dirs: dirs })}
              emptyHint={ts('empty_hint_versions')}
              defaultDir={settings.download_dir}
              onSetDefault={(dir) => update({ ...settings, download_dir: dir })}
              defaultLabel={ts('download_folder')}
              showFallbackDescription
              fallbackDownloadPath="AppData\\Roaming\\com.ryko.godothub\\godot-versions\\"
            />
            <p className="text-[11px] text-muted leading-relaxed">
              {ts('godot_versions_desc')}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
            <span className="text-xs font-medium text-muted">
              {ts('section_templates')}
            </span>
            <div className="flex items-center gap-2.5">
              {settings.template_scan_dir ? (
                <>
                  <input
                    readOnly
                    value={settings.template_scan_dir}
                    className="flex-1 bg-base border border-outline/50 rounded-btn px-3.5 py-2.5 text-xs font-mono text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => update({ ...settings, template_scan_dir: null })}
                    className="focus-ring cursor-pointer px-3 py-2 rounded-btn border border-outline/50 text-xs text-muted hover:text-danger hover:border-danger/30 hover:bg-danger/10 transition-colors"
                  >
                    {ts('clear')}
                  </button>
                </>
              ) : (
                <span className="text-xs text-muted">{ts('no_folder_set')}</span>
              )}
              <button
                type="button"
                onClick={async () => {
                  const folder = await api.pickFolder()
                  if (folder) update({ ...settings, template_scan_dir: folder })
                }}
                className="focus-ring cursor-pointer px-3.5 py-2 rounded-btn border border-outline/50 text-xs hover:border-accent-dim hover:bg-raised transition-colors"
              >
                {ts('browse')}
              </button>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              {ts('template_scan_desc')}
            </p>
          </div>
        </div>
      </Subsection>

      <Subsection
        id="storage-scan-depth"
        title={ts('scan_depth_label')}
        description={ts('scan_depth_desc')}
        searchText={`${ts('scan_depth_label')} ${ts('scan_depth_desc')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-2">
          <Slider
            label={ts('scan_depth_label')}
            display={
              <span className="text-xs font-medium text-ink tabular-nums">
                {ts('folders_deep', { count: settings.scan_depth })}
              </span>
            }
            value={settings.scan_depth}
            min={1}
            max={10}
            defaultValue={2}
            onChange={(value) => update({ ...settings, scan_depth: value })}
          />
        </div>
      </Subsection>

      <Subsection
        id="storage-concurrency"
        title={ts('download_concurrency_label')}
        description={ts('download_concurrency_desc')}
        searchText={`${ts('download_concurrency_label')} ${ts('download_concurrency_desc')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-2">
          <Slider
            label={ts('download_concurrency_label')}
            display={
              <span className="text-xs font-medium text-ink tabular-nums">
                {ts('at_once', { count: settings.download_concurrency })}
              </span>
            }
            value={settings.download_concurrency}
            min={1}
            max={10}
            defaultValue={3}
            onChange={(value) =>
              update({ ...settings, download_concurrency: value })
            }
          />
        </div>
      </Subsection>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runScan}
          className="focus-ring cursor-pointer inline-flex items-center gap-1.5 px-5 py-2.5 rounded-item border border-outline/50 hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors"
        >
          <IconRefresh className="w-4 h-4" />
          {ts('scan_now')}
        </button>
        {scanMessage && (
          <span className="text-xs text-muted">{scanMessage}</span>
        )}
      </div>
    </div>
  )

  const renderBehavior = () => (
    <div className="flex flex-col gap-3">
      <Subsection
        id="behavior-launch"
        title={ts('behavior_title')}
        description={ts('behavior_desc')}
        searchText={`${ts('behavior_title')} ${ts('behavior_desc')} ${ts('launch_console_label')} ${ts('close_on_open_label')} ${ts('minimize_tray_label')} ${ts('reopen_label')} ${ts('tray_recent_label')} ${ts('palette_shortcut')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-5">
          <SettingRow
            label={ts('launch_console_label')}
            description={
              isWindows
                ? ts('launch_console_desc_windows')
                : ts('launch_console_desc')
            }
          >
            <Toggle
              checked={settings.launch_with_console}
              onChange={(checked) =>
                update({ ...settings, launch_with_console: checked })
              }
              label={ts('launch_console_label')}
            />
          </SettingRow>

          <SettingRow
            label={ts('close_on_open_label')}
            description={
              isMac ? ts('close_on_open_desc_mac') : ts('close_on_open_desc')
            }
            divider
          >
            <Toggle
              checked={settings.close_on_project_open}
              onChange={(checked) =>
                update({ ...settings, close_on_project_open: checked })
              }
              label={ts('close_on_open_label')}
            />
          </SettingRow>

          {!isMac && (
            <SettingRow
              label={ts('minimize_tray_label')}
              description={ts('minimize_tray_desc')}
              divider
            >
              <Toggle
                checked={settings.minimize_to_tray}
                onChange={(checked) =>
                  update({ ...settings, minimize_to_tray: checked })
                }
                label={ts('minimize_tray_label')}
              />
            </SettingRow>
          )}

          <AnimatePresence initial={false}>
            {settings.close_on_project_open &&
              (isMac || settings.minimize_to_tray) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <SettingRow
                    label={ts('reopen_label')}
                    description={
                      isMac ? ts('reopen_desc_mac') : ts('reopen_desc')
                    }
                    divider
                  >
                    <Toggle
                      checked={settings.reopen_after_godot_closes}
                      onChange={(checked) =>
                        update({ ...settings, reopen_after_godot_closes: checked })
                      }
                      label={ts('reopen_label')}
                    />
                  </SettingRow>
                </motion.div>
              )}
          </AnimatePresence>

          <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
            <Slider
              label={ts('tray_recent_label')}
              display={
                <span className="text-xs text-ink tabular-nums">
                  {ts('n_projects', {
                    count: settings.tray_recent_projects_count,
                  })}
                </span>
              }
              value={settings.tray_recent_projects_count}
              min={1}
              max={10}
              defaultValue={5}
              onChange={(value) => {
                update({ ...settings, tray_recent_projects_count: value })
                api.refreshTrayMenu().catch(() => {})
              }}
            />
            <p className="text-[11px] text-muted leading-relaxed">
              {ts('tray_recent_desc')}
            </p>
          </div>

          <KeyRecorder
            value={settings.command_palette_keybind}
            onChange={(value) =>
              update({ ...settings, command_palette_keybind: value })
            }
            onReset={() =>
              update({ ...settings, command_palette_keybind: 'p' })
            }
          />
        </div>
      </Subsection>

      <Subsection
        id="behavior-projects"
        title={ts('behavior_projects_title')}
        description={ts('behavior_projects_desc')}
        searchText={`${ts('behavior_projects_title')} ${ts('behavior_projects_desc')} ${ts('auto_scan_label')} ${ts('use_categories_label')} ${ts('use_workspaces_label')} ${ts('git_init_new_projects_label')} ${ts('naming_convention_label')} ${ts('tooltip_delay_label')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-5">
          <SettingRow
            label={ts('auto_scan_label')}
            description={ts('auto_scan_desc')}
          >
            <Toggle
              checked={settings.auto_scan_on_startup}
              onChange={(checked) =>
                update({ ...settings, auto_scan_on_startup: checked })
              }
              label={ts('auto_scan_label')}
            />
          </SettingRow>

          <SettingRow
            label={ts('use_categories_label')}
            description={ts('categories_off_desc')}
            divider
          >
            <Toggle
              checked={settings.categories_enabled}
              onChange={(checked) =>
                update({ ...settings, categories_enabled: checked })
              }
              label={ts('use_categories_label')}
            />
          </SettingRow>

          <SettingRow
            label={ts('use_workspaces_label')}
            description={ts('workspaces_off_desc')}
            divider
          >
            <Toggle
              checked={settings.workspaces_enabled}
              onChange={(checked) =>
                update({ ...settings, workspaces_enabled: checked })
              }
              label={ts('use_workspaces_label')}
            />
          </SettingRow>

          <SettingRow
            label={ts('git_init_new_projects_label')}
            description={ts('git_init_new_projects_desc')}
            divider
          >
            <Toggle
              checked={settings.git_init_new_projects}
              onChange={(checked) =>
                update({ ...settings, git_init_new_projects: checked })
              }
              label={ts('git_init_new_projects_label')}
            />
          </SettingRow>

          <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
            <span className="text-xs font-medium text-muted">
              {ts('naming_convention_label')}
            </span>
            {(() => {
              const conventionOptions = [
                { value: 'keep' as const, label: ts('naming_keep') },
                { value: 'kebab-case' as const, label: ts('naming_kebab') },
                { value: 'snake_case' as const, label: ts('naming_snake') },
                { value: 'camelCase' as const, label: ts('naming_camel') },
                { value: 'PascalCase' as const, label: ts('naming_pascal') },
                { value: 'Title Case' as const, label: ts('naming_title') },
              ]
              const currentLabel =
                conventionOptions.find(
                  (o) => o.value === settings.directory_naming_convention,
                )?.label ?? conventionOptions[0].label
              return (
                <Dropdown
                  align="right"
                  trigger={({ open, toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={open}
                      className="focus-ring cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-btn bg-overlay border border-outline/50 text-xs font-medium text-ink hover:border-accent-dim transition-colors"
                    >
                      {currentLabel}
                      <IconChevronDown
                        className={`w-3 h-3 text-muted transition-transform duration-200 ${
                          open ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  )}
                  items={conventionOptions.map(({ value, label }) => ({
                    key: value,
                    label,
                    active: settings.directory_naming_convention === value,
                    onClick: () =>
                      update({ ...settings, directory_naming_convention: value }),
                  }))}
                />
              )
            })()}
            <p className="text-[11px] text-muted leading-relaxed">
              {ts('naming_convention_desc')}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-5 border-t border-line">
            <Slider
              label={ts('tooltip_delay_label')}
              display={
                <span className="text-xs text-ink tabular-nums">
                  {settings.tooltip_delay}ms
                </span>
              }
              value={settings.tooltip_delay}
              min={100}
              max={1000}
              step={50}
              defaultValue={350}
              onChange={(value) =>
                update({ ...settings, tooltip_delay: value })
              }
            />
            <p className="text-[11px] text-muted leading-relaxed">
              {ts('tooltip_delay_desc')}
            </p>
          </div>
        </div>
      </Subsection>

      <Subsection
        id="behavior-watchers"
        title={ts('file_watchers_title')}
        description={ts('file_watchers_desc')}
        searchText={`${ts('file_watchers_title')} ${ts('file_watchers_desc')} ${ts('watch_projects_label')} ${ts('watch_versions_label')} ${ts('watch_template_label')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-5">
          <SettingRow
            label={ts('watch_projects_label')}
            description={ts('watch_projects_desc')}
          >
            <Toggle
              checked={settings.auto_watch_project_dirs}
              onChange={(checked) => {
                update({ ...settings, auto_watch_project_dirs: checked })
                api.restartWatchers().catch(() => {})
              }}
              label={ts('watch_projects_label')}
            />
          </SettingRow>

          <SettingRow
            label={ts('watch_versions_label')}
            description={ts('watch_versions_desc')}
            divider
          >
            <Toggle
              checked={settings.auto_watch_version_dirs}
              onChange={(checked) => {
                update({ ...settings, auto_watch_version_dirs: checked })
                api.restartWatchers().catch(() => {})
              }}
              label={ts('watch_versions_label')}
            />
          </SettingRow>

          <SettingRow
            label={ts('watch_template_label')}
            description={ts('watch_template_desc')}
            divider
          >
            <Toggle
              checked={settings.auto_watch_template_dir}
              onChange={(checked) => {
                update({ ...settings, auto_watch_template_dir: checked })
                api.restartWatchers().catch(() => {})
              }}
              label={ts('watch_template_label')}
            />
          </SettingRow>

          <p className="text-[10px] text-muted/50 mt-1 leading-relaxed">
            {ts('watcher_footer_desc')}
          </p>
        </div>
      </Subsection>
    </div>
  )

  const renderAdvanced = () => (
    <div className="flex flex-col gap-3">
      <Subsection
        id="advanced-token"
        title={ts('github_token_title')}
        description={ts('github_token_desc')}
        searchText={`${ts('github_token_title')} ${ts('github_token_desc')} ${ts('test')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <input
              type="password"
              value={settings.github_token ?? ''}
              onChange={(e) =>
                update({ ...settings, github_token: e.target.value || null })
              }
              placeholder={ts('setting_token_placeholder', { ns: 'common' })}
              className="focus-ring w-full bg-base border border-outline/50 rounded-btn px-3.5 py-2.5 text-sm font-mono focus:border-accent-dim transition-colors pr-20"
            />
            <button
              type="button"
              onClick={testGithubToken}
              className="focus-ring cursor-pointer absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-overlay border border-outline/50 text-xs font-medium text-muted hover:text-ink hover:border-accent-dim transition-colors"
            >
              {tokenTestState === 'testing' ? ts('testing') : ts('test')}
            </button>
          </div>
          {tokenTestMsg && (
            <span
              className={`text-[11px] ${
                tokenTestState === 'success'
                  ? 'text-mint'
                  : tokenTestState === 'warning'
                    ? 'text-amber'
                    : tokenTestState === 'error'
                      ? 'text-danger'
                      : 'text-muted'
              }`}
            >
              {tokenTestMsg}
            </span>
          )}
          <p className="text-[11px] text-muted leading-relaxed">
            {ts('token_help_desc')}{' '}
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
      </Subsection>

      <Subsection
        id="advanced-titlebar"
        title={ts('titlebar_buttons')}
        description={ts('titlebar_buttons_desc')}
        searchText={`${ts('titlebar_buttons')} ${ts('titlebar_buttons_desc')} ${ts('show_support_label')} ${ts('show_star_label')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex flex-col gap-4">
          <SettingRow label={ts('show_support_label')}>
            <Toggle
              checked={settings.show_support_button}
              onChange={(checked) =>
                update({ ...settings, show_support_button: checked })
              }
              label={ts('show_support_label')}
            />
          </SettingRow>
          <SettingRow label={ts('show_star_label')} divider>
            <Toggle
              checked={settings.show_star_button}
              onChange={(checked) =>
                update({ ...settings, show_star_button: checked })
              }
              label={ts('show_star_label')}
            />
          </SettingRow>
        </div>
      </Subsection>

      <Subsection
        id="advanced-time-stats"
        title={ts('time_tracking_title')}
        description={ts('time_tracking_desc')}
        searchText={`${ts('time_tracking_title')} ${ts('time_tracking_desc')} ${ts('export_stats_btn')} ${ts('import_stats_btn')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportStats}
            disabled={statsBusy !== null}
            className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-4 rounded-item bg-overlay border border-outline/50 text-muted hover:text-ink hover:bg-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {statsBusy === 'export' ? ts('saving') : ts('export_stats_btn')}
          </button>
          <button
            type="button"
            onClick={handleImportStats}
            disabled={statsBusy !== null}
            className="focus-ring cursor-pointer inline-flex items-center gap-1.5 h-8 px-4 rounded-item bg-overlay border border-outline/50 text-muted hover:text-ink hover:bg-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {statsBusy === 'import' ? ts('saving') : ts('import_stats_btn')}
          </button>
          {statsMessage && <span className="text-xs text-muted">{statsMessage}</span>}
        </div>
      </Subsection>

      <Subsection
        id="advanced-setup"
        title={ts('setup_wizard_again')}
        description={ts('setup_wizard_desc')}
        searchText={`${ts('setup_wizard_again')} ${ts('setup_wizard_desc')} ${ts('open_setup')}`}
        query={searchQuery}
        onMatch={reportMatch}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => update({ ...settings, setup_complete: false })}
            className="focus-ring cursor-pointer shrink-0 px-5 py-2.5 rounded-item border border-outline/50 hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors"
          >
            {ts('open_setup')}
          </button>
        </div>
      </Subsection>

      <div className="flex flex-col gap-3">
        <div className="rounded-item bg-overlay px-4 py-4 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-ink">
              {ts('check_updates_title')}
            </h3>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              {ts('updates_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUpdates(true)}
            className="focus-ring cursor-pointer shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-item border border-outline/50 hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors"
          >
            <IconRefresh className="w-4 h-4" />
            {ts('check_updates')}
          </button>
        </div>

        <div className="rounded-item bg-overlay px-4 py-4 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-ink">
              {ts('report_bug_title')}
            </h3>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              {ts('report_bug_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBugReport(true)}
            className="focus-ring cursor-pointer shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-item border border-outline/50 hover:border-accent-dim hover:bg-raised text-sm font-medium transition-colors"
          >
            <IconBug className="w-4 h-4" />
            {ts('report_bug')}
          </button>
        </div>

        <div className="rounded-item bg-overlay px-4 py-4 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-ink">
              {ts('reset_settings')}
            </h3>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              {ts('reset_settings_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="focus-ring cursor-pointer shrink-0 px-5 py-2.5 rounded-item border border-outline/50 text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/5 text-sm font-medium transition-colors"
          >
            {ts('reset')}
          </button>
        </div>

        <div className="rounded-item border border-danger/30 bg-danger/4 px-4 py-4 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-danger">
              {ts('delete_app_data')}
            </h3>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              {ts('delete_data_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingWipe(true)}
            className="focus-ring cursor-pointer shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-item border border-danger/40 text-danger hover:bg-danger/10 text-sm font-medium transition-colors"
          >
            <IconBomb className="w-4 h-4" />
            {ts('delete_all')}
          </button>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (cat) {
      case 'appearance':
        return renderAppearance()
      case 'display':
        return renderDisplay()
      case 'storage':
        return renderStorage()
      case 'behavior':
        return renderBehavior()
      case 'advanced':
        return renderAdvanced()
    }
  }

  const activeDef = CATEGORIES.find((c) => c.id === cat)!
  const railRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleCatChange = (next: SettingsCat) => {
    resetSearch()
    setCat(next)
  }

  const handleRailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const idx = CATEGORIES.findIndex((c) => c.id === cat)
    const next =
      e.key === 'ArrowDown'
        ? CATEGORIES[(idx + 1) % CATEGORIES.length]
        : CATEGORIES[(idx - 1 + CATEGORIES.length) % CATEGORIES.length]
    handleCatChange(next.id)
    railRefs.current[CATEGORIES.findIndex((c) => c.id === next.id)]?.focus()
  }

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      <ViewHeader
        title={t('settings')}
      >
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={ts('search_placeholder')}
          inputRef={searchRef}
        />
      </ViewHeader>

      <div className="flex-1 mt-2 min-h-0 flex gap-4">
        <nav
          onKeyDown={handleRailKeyDown}
          aria-label={ts('settings_title')}
          className="shrink-0 w-52 flex flex-col gap-1"
        >
          {CATEGORIES.map(({ id, icon: Icon }, railIndex) => {
            const active = cat === id
            return (
              <button
                key={id}
                ref={(el) => {
                  railRefs.current[railIndex] = el
                }}
                type="button"
                onClick={() => handleCatChange(id)}
                className={`focus-ring cursor-pointer relative flex items-center gap-2.5 px-3 py-2.5 rounded-item text-sm font-medium transition-colors ${
                  active
                    ? 'text-ink'
                    : 'text-muted hover:text-ink hover:bg-raised/60'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="new-ui-settings-cat-pill"
                    transition={{ type: 'spring', stiffness: 650, damping: 38 }}
                    className="absolute inset-0 rounded-item bg-overlay border border-outline/50 shadow-md shadow-black/10 pointer-events-none"
                  />
                )}
                <Icon
                  className={`relative w-4 h-4 shrink-0 transition-colors duration-200 ${
                    active ? 'text-accent' : 'text-muted'
                  }`}
                />
                <span className={`relative ${active ? 'text-ink' : ''}`}>
                  {ts(id)}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="flex-1 min-w-0 flex rounded-card bg-raised overflow-hidden">
          <OverlayScrollArea
            className="flex-1 min-w-0"
            hideThumb={!settings.show_scrollbars}
            hideTopButton
          >
            <div className="min-h-full px-5 pb-4">
              <div className="sticky top-0 z-10 -mx-5 px-5 pt-4 pb-3 bg-raised border-b border-line/60 mb-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-tile bg-accent/10 border border-accent-dim/30 flex items-center justify-center shrink-0">
                  <activeDef.icon className="w-4.5 h-4.5 text-accent-bright" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-ink leading-tight">
                    {ts(cat)}
                  </h2>
                  <p className="text-xs text-muted leading-relaxed">
                    {ts(`${cat}_desc`)}
                  </p>
                </div>
              </div>

              {noResults ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="w-12 h-12 rounded-tile bg-overlay border border-outline/50 flex items-center justify-center">
                    <IconSearch className="w-5 h-5 text-muted/50" />
                  </div>
                  <p className="text-sm text-muted">{ts('no_settings_match')}</p>
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="focus-ring cursor-pointer text-xs font-medium text-accent hover:text-accent-bright transition-colors"
                  >
                    {ts('clear')}
                  </button>
                </div>
              ) : (
                <motion.div
                  key={cat}
                  {...viewTransition(settings.view_entrance, settings.animation_intensity)}
                >
                  {renderContent()}
                </motion.div>
              )}
            </div>
          </OverlayScrollArea>
        </div>
      </div>

      <AnimatePresence>
        {confirmingReset && (
          <ConfirmDialog
            title={ts('reset_all_title')}
            description={ts('reset_all_desc')}
            confirmLabel={ts('reset_settings')}
            variant="danger"
            onConfirm={resetAllSettings}
            onCancel={() => setConfirmingReset(false)}
          />
        )}
        {confirmingWipe && (
          <ConfirmDialog
            title={ts('delete_all_title')}
            description={ts('delete_all_desc')}
            confirmLabel={ts('delete_app_data')}
            variant="danger"
            onConfirm={wipeAppData}
            onCancel={() => setConfirmingWipe(false)}
          />
        )}
        {confirmingOsDec !== null && (
          <ConfirmDialog
            title={ts('restart_required_title', { ns: 'common' })}
            description={ts('restart_required_desc', { ns: 'common' })}
            confirmLabel={ts('restart_now', { ns: 'common' })}
            variant="default"
            onConfirm={handleOsDecConfirm}
            onCancel={() => setConfirmingOsDec(null)}
          />
        )}
        {showUpdates && (
          <CheckForUpdatesModal
            onClose={() => setShowUpdates(false)}
            onOpenTokenSettings={() => {
              handleCatChange('advanced')
              setSearchQuery('')
            }}
          />
        )}
        {showBugReport && (
          <BugReportModal onClose={() => setShowBugReport(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
