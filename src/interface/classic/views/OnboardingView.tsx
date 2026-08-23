import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ACCENT_PRESETS_DARK,
  ACCENT_PRESETS_LIGHT,
  BG_PRESETS_DARK,
  BG_PRESETS_LIGHT,
  LIGHT_THEME_PRESETS,
  DARK_THEME_PRESETS,
  resolveThemeMode,
} from '../../../lib/colors'
import { defaultCornerRadius } from '../../../lib/platform'
import {
  useOnboarding,
  STARTER_CATEGORIES,
} from '../../../hooks/useOnboarding'
import { DirList } from '../components/ui/DirList'
import { ColorSwatchPicker } from '../components/ui/ColorSwatchPicker'
import { Slider } from '../components/ui/Slider'
import { TitleBar } from '../components/titlebar/Titlebar'
import { api } from '../../../lib/api'
import {
  IconLayoutGrid,
  IconLayoutList,
  IconNews,
  IconTags,
  IconPlus,
  IconTrash,
  IconCheck,
  IconFolderPlus,
  IconDownload,
  IconArrowUpDown,
  IconCopy,
  IconRefresh,
  IconRocket,
  IconSun,
  IconMoon,
  IconMonitor,
  IconChevronDown,
} from '../lib/Icons'
import type { AppSettings } from '../../../types'

interface Props {
  settings: AppSettings
  onComplete: (settings: AppSettings) => Promise<AppSettings> | void
  onChooseNew?: () => void
}

function StepShell({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-8 w-full max-w-xl">
      <div className="flex flex-col gap-3">
        <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent-dim/40 flex items-center justify-center text-accent-bright">
          {icon}
        </div>
        <div>
          <h2 className="font-display font-semibold text-2xl tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}

function ProgressRow({
  label,
  progress,
  running,
}: {
  label: string
  progress: { current: number; total: number } | null
  running: boolean
}) {
  const { t } = useTranslation('common')
  const hasProgress = !!progress && progress.total > 0
  const pct = hasProgress
    ? Math.min((progress.current / progress.total) * 100, 100)
    : 0

  return (
    <div className="flex flex-col gap-2 px-4 py-3 rounded-lg bg-surface/60 border border-line">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        {hasProgress ? (
          <span className="font-mono text-xs text-muted shrink-0">
            {progress.current} / {progress.total}
          </span>
        ) : running ? (
          <span className="flex items-center gap-1.5 text-xs text-accent-bright shrink-0">
            <IconRefresh className="w-3 h-3 animate-spin" />
            <span className="font-mono">…</span>
          </span>
        ) : (
          <span className="font-mono text-xs text-muted shrink-0">{t('none')}</span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-line/60 overflow-hidden">
        {hasProgress ? (
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        ) : running ? (
          <motion.div
            className="h-full rounded-full bg-accent/60"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            style={{ width: '30%' }}
          />
        ) : (
          <div className="h-full w-0" />
        )}
      </div>
    </div>
  )
}

export function OnboardingView({ settings, onComplete, onChooseNew }: Props) {
  const { t } = useTranslation('onboarding')
  const { t: tc, i18n } = useTranslation('common')
  const { t: ts } = useTranslation('settings')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const {
    STEPS,
    stepIndex,
    step,
    goNext,
    goBack,
    draft,
    setDraft,
    setField,
    finishing,
    finish,
    presetActive,
    selectPreset,
    setThemeMode,
    setAccentColor,
    setBackgroundColor,
    setCornerRadius,
    projectSuggestions,
    versionSuggestions,
    pendingTemplateSuggestions,
    scanProgress,
    categories,
    removeCategory,
    categoryDraft,
    setCategoryDraft,
    categoryBusy,
    addStarterCategory,
    addCustomCategory,
    categoryLabels,
  } = useOnboarding({ settings, onComplete })

  return (
    <div className="h-screen w-screen flex flex-col bg-base text-ink font-body select-none">
      <TitleBar minimal />
      <div className="flex-1 flex flex-col min-h-0 px-8 pb-8">
        <div className="shrink-0 flex items-center justify-center pt-8 pb-6">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              title={t(s.id)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? 'w-8 bg-accent'
                  : i < stepIndex
                    ? 'w-4 bg-accent-dim'
                    : 'w-4 bg-line'
              }`}
            />
          ))}
        </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex justify-center">
        <div className="w-full max-w-xl flex flex-col items-center py-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full flex flex-col items-center"
          >
            {step.id === 'welcome' && (
              <StepShell
                icon={<span className="font-black italic text-lg">GH</span>}
                title={t('welcome_title')}
                description={t('welcome_desc')}
              >
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {t('language_heading')}
                    </span>
                    <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
                      {[
                        { value: 'en-US', label: 'English' },
                        { value: 'zh-CN', label: '简体中文' },
                        { value: 'ja-JP', label: '日本語' },
                        { value: 'ru-RU', label: 'Русский' },
                        { value: 'ar-MA', label: 'العربية' }
                      ].map(({ value, label }) => {
                        const active = i18n.language === value || i18n.language.startsWith(value.split('-')[0])
                        return (
                          <motion.button
                            key={value}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => {
                              i18n.changeLanguage(value)
                              setDraft((prev) => ({ ...prev, language: value }))
                            }}
                            className={
                              'focus-ring cursor-pointer px-4 py-2 rounded-md text-sm font-medium transition-colors ' +
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
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-2 p-4 rounded-xl border border-line bg-surface/60">
                      <IconLayoutGrid className="w-4 h-4 text-accent-bright" />
                      <span className="text-xs font-medium">{tc('section_projects')}</span>
                      <p className="text-[11px] text-muted leading-relaxed">
                        {t('onboarding_keep_organized', { ns: 'common' })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 p-4 rounded-xl border border-line bg-surface/60">
                      <IconLayoutList className="w-4 h-4 text-accent-bright" />
                      <span className="text-xs font-medium">{tc('section_versions')}</span>
                      <p className="text-[11px] text-muted leading-relaxed">
                        {t('onboarding_download_manage', { ns: 'common' })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 p-4 rounded-xl border border-line bg-surface/60">
                      <IconNews className="w-4 h-4 text-accent-bright" />
                      <span className="text-xs font-medium">{tc('section_news')}</span>
                      <p className="text-[11px] text-muted leading-relaxed">
                        {t('onboarding_stay_current', { ns: 'common' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {ts('interface_label')}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col items-start gap-1.5 rounded-lg border border-accent bg-accent/10 p-3.5 text-left">
                        <span className="flex items-center gap-2 w-full">
                          <IconLayoutList className="w-3.5 h-3.5 text-accent-bright" />
                          <span className="text-xs font-medium text-ink">
                            {ts('classic_ui_label')}
                          </span>
                          <IconCheck className="w-3.5 h-3.5 text-accent-bright ml-auto" />
                        </span>
                        <p className="text-[11px] text-muted leading-relaxed">
                          {ts('switch_to_classic_ui_desc')}
                        </p>
                      </div>

                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={onChooseNew}
                        className="focus-ring cursor-pointer flex flex-col items-start gap-1.5 rounded-lg border border-line p-3.5 text-left hover:border-accent-dim hover:bg-raised transition-colors"
                      >
                        <span className="flex items-center gap-2 w-full">
                          <IconRocket className="w-3.5 h-3.5 text-muted" />
                          <span className="text-xs font-medium text-ink">
                            {ts('new_ui_label')}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber/15 text-amber border border-amber/30">
                            {tc('git_beta_badge')}
                          </span>
                        </span>
                        <p className="text-[11px] text-muted leading-relaxed">
                          {ts('new_ui_desc')}
                        </p>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </StepShell>
            )}

            {step.id === 'projects' && (
              <StepShell
                icon={<IconFolderPlus className="w-5 h-5" />}
                title={t('onboarding_projects_title', { ns: 'common' })}
                description={t('onboarding_projects_desc', { ns: 'common' })}
              >
                <DirList
                  dirs={draft.project_scan_dirs}
                  onChange={(dirs) => setField('project_scan_dirs', dirs)}
                  emptyHint={t('onboard_empty_projects')}
                  defaultDir={draft.default_project_location}
                  onSetDefault={(dir) =>
                    setField('default_project_location', dir)
                  }
                  defaultLabel={t('new_project_default', { ns: 'settings' })}
                  suggestions={projectSuggestions}
                />
              </StepShell>
            )}

            {step.id === 'versions' && (
              <StepShell
                icon={<IconDownload className="w-5 h-5" />}
                title={t('onboarding_versions_title', { ns: 'common' })}
                description={t('onboarding_versions_desc', { ns: 'common' })}
              >
                <DirList
                  dirs={draft.version_scan_dirs}
                  onChange={(dirs) => setField('version_scan_dirs', dirs)}
                  emptyHint={t('onboard_empty_versions')}
                  defaultDir={draft.download_dir}
                  onSetDefault={(dir) => setField('download_dir', dir)}
                  defaultLabel={t('download_folder', { ns: 'settings' })}
                  suggestions={versionSuggestions}
                />
              </StepShell>
            )}

            {step.id === 'templates' && (
              <StepShell
                icon={<IconCopy className="w-5 h-5" />}
                title={t('onboarding_templates_title', { ns: 'common' })}
                description={t('onboarding_templates_desc', { ns: 'common' })}
              >
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-2.5">
                    {draft.template_scan_dir ? (
                      <input
                        readOnly
                        value={draft.template_scan_dir}
                        className="flex-1 bg-raised border border-line rounded-lg px-3.5 py-2.5 text-xs font-mono text-muted"
                      />
                    ) : (
                      <span className="text-xs text-muted">
                        {t('onboard_no_template_folder')}
                      </span>
                    )}
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={async () => {
                        const folder = await api.pickFolder()
                        if (folder) setField('template_scan_dir', folder)
                      }}
                      className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm transition-colors"
                    >
                      {t('browse', { ns: 'common' })}
                    </motion.button>
                    {draft.template_scan_dir && (
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setField('template_scan_dir', null)}
                        className="focus-ring cursor-pointer px-3 py-2.5 rounded-lg border border-line text-xs text-muted hover:text-danger hover:border-danger/30 hover:bg-danger/10 transition-colors"
                      >
                        {t('clear', { ns: 'common' })}
                      </motion.button>
                    )}
                  </div>

                  {pendingTemplateSuggestions.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/70">
                        {tc('suggested_from_workspaces')}
                      </span>
                      {pendingTemplateSuggestions.map((s) => (
                        <motion.button
                          key={s.path}
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setField('template_scan_dir', s.path)}
                          className="focus-ring cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-line text-left hover:border-accent-dim hover:bg-raised/70 transition-colors"
                        >
                          <span className="shrink-0 flex items-center justify-center w-4 h-4 rounded bg-accent/15 text-accent-bright">
                            <IconCopy className="w-3 h-3" />
                          </span>
                          <span className="text-[11px] font-mono text-ink truncate">
                            {s.path}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted truncate max-w-32">
                            {tc('from_workspace', { name: s.source })}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </StepShell>
            )}

            {step.id === 'categories' && (
              <StepShell
                icon={<IconTags className="w-5 h-5" />}
                title={t('onboarding_categories_title', { ns: 'common' })}
                description={t('onboarding_categories_desc_full', { ns: 'common' })}
              >
                <div className="flex flex-col gap-4 w-full">
                  <div className="flex flex-wrap gap-2">
                    {STARTER_CATEGORIES.map((name) => {
                      const added = categories.some(
                        (c) => c.name.toLowerCase() === name.toLowerCase(),
                      )
                      return (
                        <motion.button
                          key={name}
                          whileHover={added ? undefined : { y: -1 }}
                          whileTap={added ? undefined : { scale: 0.96 }}
                          disabled={added || categoryBusy}
                          onClick={() => addStarterCategory(name)}
                          className={`focus-ring cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors disabled:cursor-default ${
                            added
                              ? 'border-accent-dim/50 bg-accent/10 text-accent-bright'
                              : 'border-dashed border-line text-muted hover:text-accent-bright hover:border-accent-dim'
                          }`}
                        >
                          {added ? (
                            <IconCheck className="w-3 h-3" />
                          ) : (
                            <IconPlus className="w-3 h-3" />
                          )}
                          {categoryLabels[name] || name}
                        </motion.button>
                      )
                    })}
                  </div>

                  <div className="flex gap-2.5">
                    <input
                      value={categoryDraft}
                      onChange={(e) => setCategoryDraft(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && addCustomCategory()
                      }
                      placeholder={t('onboarding_custom_category_placeholder', { ns: 'common' })}
                      className="focus-ring flex-1 bg-raised border border-line rounded-lg px-3.5 py-2.5 text-sm focus:border-accent-dim transition-colors"
                    />
                    <motion.button
                      whileHover={categoryBusy ? undefined : { y: -1 }}
                      whileTap={categoryBusy ? undefined : { scale: 0.96 }}
                      onClick={addCustomCategory}
                      disabled={categoryBusy || !categoryDraft.trim()}
                      className="focus-ring cursor-pointer shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
                    >
                      <IconPlus className="w-3.5 h-3.5" />
                      {t('add', { ns: 'common' })}
                    </motion.button>
                  </div>

                  {categories.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-medium text-muted uppercase tracking-wide">
                        {t('onboarding_your_categories', { ns: 'common' })}
                      </span>
                      <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                        {categories.map((c) => (
                          <div
                            key={c.id}
                            className="group flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-raised border border-line"
                          >
                            <span className="text-xs">{c.name}</span>
                            <button
                              onClick={() => removeCategory(c.id)}
                              aria-label={t('remove_category_aria', { ns: 'common', name: c.name })}
                              className="icon-wiggle cursor-pointer text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-colors"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-muted leading-relaxed">
                    {t('onboard_categories_desc')}
                  </p>
                </div>
              </StepShell>
            )}

            {step.id === 'customize' && (
              <StepShell
                icon={<IconArrowUpDown className="w-5 h-5" />}
                title={t('onboarding_customize_title', { ns: 'common' })}
                description={t('onboarding_customize_desc', { ns: 'common' })}
              >
                <div className="flex flex-col gap-7 w-full">
                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs font-medium text-muted">
                      {t('theme_preset_label', { ns: 'settings' })}
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
                            style={{ backgroundColor: draft.accent_color }}
                          />
                          <span
                            className="w-4 h-4 rounded-md ring-1 ring-black/10"
                            style={{ backgroundColor: draft.background_color }}
                          />
                        </span>
                        <span className="text-xs font-medium text-ink flex items-center gap-1">
                          {!presetActive && (
                            <IconCheck className="w-3 h-3 text-accent-bright" />
                          )}
                          {t('theme_preset_custom', { ns: 'settings' })}
                        </span>
                      </button>
                      {([
                        { id: 'light', label: t('preset_light_group', { ns: 'settings' }), Icon: IconSun, presets: LIGHT_THEME_PRESETS },
                        { id: 'dark', label: t('preset_dark_group', { ns: 'settings' }), Icon: IconMoon, presets: DARK_THEME_PRESETS },
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
                                      const active = draft.theme_preset === preset.id
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
                      {t('theme_preset_desc', { ns: 'settings' })}
                    </p>
                  </div>

                  {!presetActive && (
                    <>
                  <div className="flex gap-8">
                    <ColorSwatchPicker
                      label={t('onboarding_accent_color', { ns: 'common' })}
                      value={draft.accent_color}
                      presets={
                      resolveThemeMode(draft.theme_mode) === 'light'
                        ? ACCENT_PRESETS_LIGHT
                        : ACCENT_PRESETS_DARK
                    }
                      onChange={(hex) => {
                        setAccentColor(hex)
                      }}
                    />
                    <ColorSwatchPicker
                      label={t('onboarding_bg_color', { ns: 'common' })}
                      value={draft.background_color}
                      presets={
                      resolveThemeMode(draft.theme_mode) === 'light'
                        ? BG_PRESETS_LIGHT
                        : BG_PRESETS_DARK
                    }
                      onChange={(hex) => {
                        setBackgroundColor(hex)
                      }}
                    />
                  </div>

                  <div className="inline-flex self-start rounded-lg border border-line bg-raised p-1 gap-1">
                    {[
                      { mode: 'dark' as const, label: t('dark', { ns: 'settings' }), Icon: IconMoon },
                      { mode: 'light' as const, label: t('light', { ns: 'settings' }), Icon: IconSun },
                      { mode: 'system' as const, label: t('system', { ns: 'settings' }), Icon: IconMonitor },
                    ].map(({ mode, label, Icon }) => {
                      const active = draft.theme_mode === mode
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
                  </>
                  )}

                  <label className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted">
                        {t('onboarding_corner_radius', { ns: 'common' })}
                      </span>
                      <span className="text-xs font-mono text-ink bg-raised px-2 py-0.5 rounded-md">
                        {draft.corner_radius}px
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={20}
                      step={1}
                      value={draft.corner_radius}
                      defaultValue={defaultCornerRadius}
                      label={t('onboarding_corner_radius', { ns: 'common' })}
                      onChange={(v) => {
                        setCornerRadius(v)
                      }}
                    />
                  </label>
                </div>
              </StepShell>
            )}

            {step.id === 'finish' && (
              <StepShell
                icon={<IconCheck className="w-5 h-5" />}
                title={t(
                  finishing
                    ? 'onboarding_setting_up_title'
                    : 'onboarding_finish_title',
                  { ns: 'common' },
                )}
                description={
                  finishing
                    ? t('onboarding_setting_up_desc', { ns: 'common' })
                    : t('onboarding_finish_desc', { ns: 'common' })
                }
              >
                {finishing ? (
                  <div className="flex flex-col gap-3 w-full">
                    <ProgressRow
                      label={
                        draft.project_scan_dirs.length > 0
                          ? tc('scanning_projects')
                          : tc('skipped')
                      }
                      progress={
                        draft.project_scan_dirs.length > 0
                          ? scanProgress.projects
                          : null
                      }
                      running={draft.project_scan_dirs.length > 0}
                    />
                    <ProgressRow
                      label={
                        draft.version_scan_dirs.length > 0
                          ? tc('scanning_versions')
                          : tc('skipped')
                      }
                      progress={
                        draft.version_scan_dirs.length > 0
                          ? scanProgress.versions
                          : null
                      }
                      running={draft.version_scan_dirs.length > 0}
                    />
                    {draft.template_scan_dir && (
                      <ProgressRow
                        label={tc('syncing')}
                        progress={null}
                        running
                      />
                    )}
                    {settings.categories_enabled && (
                      <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface/60 border border-line opacity-70">
                        <span className="text-muted text-sm">{t('categories')}</span>
                        <span className="font-mono text-xs text-muted">
                          {categories.length || tc('none')}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 w-full text-sm">
                    <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface/60 border border-line">
                      <span className="text-muted">{t('project_folders')}</span>
                      <span className="font-mono text-xs">
                        {draft.project_scan_dirs.length || tc('none')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface/60 border border-line">
                      <span className="text-muted">{t('version_folders')}</span>
                      <span className="font-mono text-xs">
                        {draft.version_scan_dirs.length || tc('none')}
                      </span>
                    </div>
                    {settings.categories_enabled && (
                      <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface/60 border border-line">
                        <span className="text-muted">{t('categories')}</span>
                        <span className="font-mono text-xs">
                          {categories.length || tc('none')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </StepShell>
            )}
          </motion.div>
        </AnimatePresence>
        </div>
        </div>

        <div className="shrink-0 w-full max-w-xl mx-auto flex items-center justify-between mt-6">
          <button
            onClick={() => (stepIndex === 0 ? finish(true) : goBack())}
            disabled={finishing}
            className="focus-ring cursor-pointer px-4 py-2.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-raised transition-colors disabled:opacity-50"
          >
            {stepIndex === 0 ? tc('skip_setup') : tc('back')}
          </button>

          {step.id === 'finish' ? (
            <motion.button
              whileHover={finishing ? undefined : { y: -1 }}
              whileTap={finishing ? undefined : { scale: 0.96 }}
              onClick={() => finish(false)}
              disabled={finishing}
              className="focus-ring cursor-pointer px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-bright disabled:opacity-60 text-sm font-medium text-white transition-colors"
            >
              {finishing ? tc('finishing') : tc('get_started')}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={goNext}
              className="focus-ring cursor-pointer px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-bright text-sm font-medium text-white transition-colors"
            >
              {t('onboarding_continue', { ns: 'common' })}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
