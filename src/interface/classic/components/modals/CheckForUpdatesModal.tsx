import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { check } from '@tauri-apps/plugin-updater'
import { getVersion } from '@tauri-apps/api/app'
import { relaunch } from '@tauri-apps/plugin-process'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  IconRefresh,
  IconDownload,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconChevronRight,
  IconFlask,
  IconExternalLink,
} from '../../lib/Icons'
import { useSettings } from '../../../../hooks/useSettings'
import { api } from '../../../../lib/api'

type UpdateState =
  | { type: 'checking' }
  | {
      type: 'available'
      version: string
      notes: string | null
      releaseUrl: string | null
      portable?: boolean
      downloadAndInstall: () => Promise<void>
    }
  | { type: 'downloading'; progress: number }
  | { type: 'done' }
  | { type: 'uptodate' }
  | { type: 'error'; message: string }

interface Props {
  onClose: () => void
  mode?: 'background' | 'manual' | 'preview'
}

type TokenHint = 'rate-limited' | 'token-rejected'

function githubTokenHint(message: string, hasToken: boolean): TokenHint | null {
  if (/\b401\b/.test(message)) return 'token-rejected'
  if (/\b403\b/.test(message) || /rate limit/i.test(message)) {
    return hasToken ? 'token-rejected' : 'rate-limited'
  }
  return null
}

function downloadsFromGithubApi(rawJson: Record<string, unknown> | undefined) {
  const platforms = rawJson?.platforms as
    | Record<string, { url?: unknown }>
    | undefined
  if (!platforms) return false
  const urls = Object.values(platforms)
    .map((p) => p?.url)
    .filter((u): u is string => typeof u === 'string')
  if (urls.length === 0) return false
  return urls.every((u) => {
    try {
      return new URL(u).host === 'api.github.com'
    } catch {
      return false
    }
  })
}

interface ReleaseSection {
  title: string
  items: string[]
}

interface ParsedReleaseNotes {
  intro: string[]
  sections: ReleaseSection[]
}

function parseReleaseNotes(md: string | null): ParsedReleaseNotes {
  const result: ParsedReleaseNotes = { intro: [], sections: [] }
  if (!md) return result
  let current: ReleaseSection | null = null
  for (const rawLine of md.split('\n')) {
    const line = rawLine.trimEnd()
    if (/^#{2,4}\s+/.test(line)) {
      current = { title: line.replace(/^#{2,4}\s+/, '').trim(), items: [] }
      result.sections.push(current)
    } else if (current) {
      const trimmed = line.trim()
      if (!trimmed) continue
      current.items.push(trimmed.replace(/^[-*]\s+/, ''))
    } else if (line.trim()) {
      result.intro.push(line.trim())
    }
  }
  result.sections = result.sections.filter((s) => s.items.length > 0)
  return result
}

function isKnownIssueSection(s: ReleaseSection): boolean {
  return /known issue/i.test(s.title)
}

const PREVIEW_VERSION = '1.4.0'

const PREVIEW_NOTES = [
  `## What's new in v1.4.0 - The Preview Update`,
  '',
  '## 🚀 New',
  '',
  '- Revamped the Check for Updates modal with structured release notes',
  '- Added a "Known Issues" section so you can see known problems before updating',
  '',
  '## 🐛 Fixes',
  '',
  '- Fixed a crash when switching workspaces with pinned projects',
  '- Fixed update checks failing silently when GitHub rate limits are hit',
  '',
  '## ✨ Improvements',
  '',
  '- Faster startup times across all platforms',
  '- Reduced memory usage when browsing large project libraries',
  '',
  '## ⚠️ Known Issues',
  '',
  "- Linux OS: AppImage won't work on some distros, use the .rpm or .deb package instead",
  '- Windows: the taskbar may briefly show a duplicate icon until the app restarts',
].join('\n')

const REPO_RELEASES_URL = 'https://github.com/RykoTheDev/GodotHub/releases'

function releaseUrlForVersion(version: string): string {
  return `${REPO_RELEASES_URL}/tag/v${version.replace(/^v/i, '')}`
}

const PREVIEW_STATES = [
  'checking',
  'available',
  'portable',
  'downloading',
  'done',
  'uptodate',
  'error',
] as const

export function CheckForUpdatesModal({ onClose, mode = 'manual' }: Props) {
  const { t } = useTranslation('common')
  const { settings } = useSettings()
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const simulateRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastReleaseUrlRef = useRef<string | null>(null)

  const isPreview = mode === 'preview'
  const githubToken = settings.github_token?.trim() || null

  const [state, setState] = useState<UpdateState>(() =>
    isPreview
      ? {
          type: 'available',
          version: PREVIEW_VERSION,
          notes: PREVIEW_NOTES,
          releaseUrl: releaseUrlForVersion(PREVIEW_VERSION),
          portable: false,
          downloadAndInstall: () => Promise.resolve(),
        }
      : { type: 'checking' },
  )

  const clearSimulation = () => {
    if (simulateRef.current) {
      clearInterval(simulateRef.current)
      simulateRef.current = null
    }
  }

  const simulateDownload = useCallback(() => {
    clearSimulation()
    return new Promise<void>((resolve) => {
      setState({ type: 'downloading', progress: 0 })
      let progress = 0
      simulateRef.current = setInterval(() => {
        progress = Math.min(progress + 0.045 + Math.random() * 0.06, 1)
        setState({ type: 'downloading', progress })
        if (progress >= 1) {
          clearSimulation()
          setTimeout(() => {
            setState({ type: 'done' })
            resolve()
          }, 350)
        }
      }, 200)
    })
  }, [])

  const doCheck = useCallback(async () => {
    if (mode === 'preview') {
      setState({
        type: 'available',
        version: PREVIEW_VERSION,
        notes: PREVIEW_NOTES,
        releaseUrl: releaseUrlForVersion(PREVIEW_VERSION),
        portable: false,
        downloadAndInstall: simulateDownload,
      })
      return
    }
    setState({ type: 'checking' })
    try {
      const [update, portable] = await Promise.all([
        check(),
        api.isPortableInstall().catch(() => false),
      ])
      if (update) {
        const rawHtmlUrl = (update.rawJson as Record<string, unknown> | undefined)
          ?.html_url
        const releaseUrl =
          typeof rawHtmlUrl === 'string' && rawHtmlUrl.trim()
            ? rawHtmlUrl
            : releaseUrlForVersion(update.version)
        lastReleaseUrlRef.current = releaseUrl
        setState({
          type: 'available',
          version: update.version,
          notes: update.body ?? null,
          releaseUrl,
          portable,
          downloadAndInstall: async () => {
            setState({ type: 'downloading', progress: 0 })
            let downloaded = 0
            let total: number | null = null
            try {
              const sendToken =
                githubToken && downloadsFromGithubApi(update.rawJson)
              await update.downloadAndInstall(
                (progressEvent) => {
                  if (progressEvent.event === 'Started') {
                    downloaded = 0
                    total = progressEvent.data.contentLength ?? null
                  } else if (progressEvent.event === 'Progress') {
                    downloaded += progressEvent.data.chunkLength
                    if (total) {
                      setState({
                        type: 'downloading',
                        progress: Math.min(downloaded / total, 1),
                      })
                    }
                  } else if (progressEvent.event === 'Finished') {
                    setState({ type: 'downloading', progress: 1 })
                  }
                },
                sendToken
                  ? { headers: { Authorization: `Bearer ${githubToken}` } }
                  : undefined,
              )
              setState({ type: 'done' })
            } catch (e) {
              setState({ type: 'error', message: String(e) })
            }
          },
        })
      } else if (mode === 'background') {
        onCloseRef.current()
        return
      } else {
        setState({ type: 'uptodate' })
      }
    } catch (e) {
      if (mode === 'background') {
        onCloseRef.current()
        return
      }
      setState({ type: 'error', message: String(e) })
    }
  }, [mode, githubToken, simulateDownload])

  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(() => setCurrentVersion(null))
  }, [])

  useEffect(() => {
    doCheck()
  }, [doCheck])

  useEffect(() => () => clearSimulation(), [])

  const switchPreviewState = (to: (typeof PREVIEW_STATES)[number]) => {
    clearSimulation()
    switch (to) {
      case 'checking':
        setState({ type: 'checking' })
        break
      case 'available':
        setState({
          type: 'available',
          version: PREVIEW_VERSION,
          notes: PREVIEW_NOTES,
          releaseUrl: releaseUrlForVersion(PREVIEW_VERSION),
          portable: false,
          downloadAndInstall: simulateDownload,
        })
        break
      case 'portable':
        setState({
          type: 'available',
          version: PREVIEW_VERSION,
          notes: PREVIEW_NOTES,
          releaseUrl: releaseUrlForVersion(PREVIEW_VERSION),
          portable: true,
          downloadAndInstall: simulateDownload,
        })
        break
      case 'downloading':
        setState({ type: 'downloading', progress: 0 })
        let progress = 0
        simulateRef.current = setInterval(() => {
          progress = Math.min(progress + 0.05 + Math.random() * 0.07, 1)
          setState({ type: 'downloading', progress })
          if (progress >= 1) clearSimulation()
        }, 160)
        break
      case 'done':
        setState({ type: 'done' })
        break
      case 'uptodate':
        setState({ type: 'uptodate' })
        break
      case 'error':
        setState({
          type: 'error',
          message:
            'Preview error: GitHub API rate limit reached (HTTP 403). Add a token in Settings to keep checking.',
        })
        break
    }
  }

  const handleInstall = async () => {
    if (state.type === 'available') {
      await state.downloadAndInstall()
    }
  }

  const openTokenSettings = () => {
    onClose()
    window.dispatchEvent(
      new CustomEvent('app:open-setting', { detail: 'github_token' }),
    )
  }

  const headerTitle =
    state.type === 'available' || state.type === 'downloading'
      ? t('check_updates_update_available_title')
      : t('check_updates_title_modal')

  const notes = state.type === 'available' ? parseReleaseNotes(state.notes) : null
  const knownIssues =
    notes?.sections.filter(isKnownIssueSection).flatMap((s) => s.items) ?? []
  const hasReleaseNotesContent =
    (notes?.sections.some((s) => !isKnownIssueSection(s)) ?? false) ||
    (notes?.intro.length ?? 0) > 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="relative w-full max-w-2xl max-h-[min(88vh,680px)] bg-surface border border-line rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 shrink-0">
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-lg text-ink leading-tight">
              {headerTitle}
            </h3>
            {isPreview && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-amber/15 text-amber text-[10px] font-semibold uppercase tracking-wider">
                <IconFlask className="w-3 h-3" />
                {t('check_updates_preview_badge')}
              </span>
            )}
            {state.type === 'available' && state.portable && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-amber/15 text-amber text-[10px] font-semibold uppercase tracking-wider">
                <IconExternalLink className="w-3 h-3" />
                {t('check_updates_portable_badge')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring cursor-pointer p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors shrink-0"
            aria-label={t('check_updates_close_aria')}
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={state.type}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="flex flex-col items-center gap-5 w-full"
            >
              {state.type === 'checking' && (
                <>
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping opacity-40" />
                    <div className="relative w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                      <IconRefresh className="w-7 h-7 text-accent animate-spin" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-ink">
                      {t('checking_updates')}
                    </p>
                    {currentVersion && (
                      <p className="text-xs text-muted mt-1 font-mono">
                        v{currentVersion}
                      </p>
                    )}
                  </div>
                </>
              )}

              {state.type === 'uptodate' && (
                <>
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full bg-mint/20 animate-ping opacity-30" />
                    <div className="relative w-16 h-16 rounded-full bg-mint/10 flex items-center justify-center">
                      <IconCheck className="w-7 h-7 text-mint" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-ink">
                      {t('up_to_date')}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {t('is_latest', { version: currentVersion ?? '?' })}
                    </p>
                  </div>
                </>
              )}

              {state.type === 'available' && (
                <>
                <div className="w-full grid grid-cols-1 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] gap-6 items-start">
                  <div className="flex flex-col gap-5 min-w-0">
                    <div className="flex items-center gap-3.5">
                      <div className="relative w-12 h-12 shrink-0">
                          <div className="absolute inset-0 rounded-xl bg-accent/25 animate-ping opacity-30" />
                          <div className="relative w-12 h-12 rounded-xl bg-linear-to-br from-accent/25 to-accent-bright/25 border border-accent/30 flex items-center justify-center">
                            {state.portable ? (
                              <IconExternalLink className="w-5 h-5 text-accent-bright" />
                            ) : (
                              <IconDownload className="w-5 h-5 text-accent-bright" />
                            )}
                          </div>
                        </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink leading-snug">
                          {t('check_updates_version_available', {
                            version: state.version,
                          })}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {state.portable
                            ? t('check_updates_portable_desc')
                            : t('check_updates_ask_download')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-raised border border-line">
                        <span className="w-1.5 h-1.5 rounded-full bg-mint" />
                        <span className="font-mono text-xs text-ink">
                          v{currentVersion ?? '?'}
                        </span>
                      </span>
                      <IconChevronRight className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-bright animate-pulse" />
                        <span className="font-mono text-xs font-semibold text-accent-bright">
                          v{state.version}
                        </span>
                      </span>
                    </div>

                    {state.portable && (
                      <div className="w-full rounded-xl border border-amber/30 bg-amber/10 p-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-2">
                          <IconAlertTriangle className="w-3.5 h-3.5" />
                          {t('check_updates_portable_hint_title')}
                        </p>
                        <p className="text-xs text-muted leading-relaxed">
                          {t('check_updates_portable_hint')}
                        </p>
                      </div>
                    )}

                    {knownIssues.length > 0 && (
                      <div className="w-full rounded-xl border border-amber/30 bg-amber/10 p-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-2">
                          <IconAlertTriangle className="w-3.5 h-3.5" />
                          {t('check_updates_known_issues')}
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {knownIssues.map((issue, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted leading-relaxed flex gap-2"
                            >
                              <span className="shrink-0 text-amber-400">•</span>
                              <span className="whitespace-pre-wrap wrap-break-word">
                                {issue}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  </div>

                  <div className="min-w-0">
                    {notes && hasReleaseNotesContent && (
                      <div className="w-full bg-raised/50 rounded-xl border border-line overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-line/70 bg-raised">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                            {t('check_updates_release_notes')}
                          </p>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {notes.intro.length > 0 && (
                            <p className="px-4 pt-3 text-xs text-muted leading-relaxed">
                              {notes.intro.join(' ')}
                            </p>
                          )}
                          {notes.sections
                            .filter((s) => !isKnownIssueSection(s))
                            .map((section, i) => (
                              <div
                                key={i}
                                className="px-4 py-3 border-b border-line/50 last:border-b-0"
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 text-muted">
                                  {section.title}
                                </p>
                                <ul className="flex flex-col gap-1.5">
                                  {section.items.map((item, j) => (
                                    <li
                                      key={j}
                                      className="text-xs text-ink/90 leading-relaxed flex gap-2"
                                    >
                                      <span className="shrink-0 text-muted">
                                        •
                                      </span>
                                      <span className="whitespace-pre-wrap wrap-break-word">
                                        {item}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2.5 flex-wrap">
                  {state.portable ? (
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        if (state.type === 'available' && state.releaseUrl) {
                          openUrl(state.releaseUrl)
                        }
                      }}
                      className="focus-ring cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-bright text-sm font-medium text-white transition-colors"
                    >
                      <IconExternalLink className="w-4 h-4" />
                      {t('check_updates_go_to_release')}
                    </motion.button>
                  ) : (
                    <>
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleInstall}
                        className="focus-ring cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-bright text-sm font-medium text-white transition-colors"
                      >
                        <IconDownload className="w-4 h-4" />
                        {t('install_update')}
                      </motion.button>
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          if (state.type === 'available' && state.releaseUrl) {
                            openUrl(state.releaseUrl)
                          }
                        }}
                        className="focus-ring cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm font-medium text-ink transition-colors"
                      >
                        <IconExternalLink className="w-4 h-4" />
                        {t('check_updates_download_from_github')}
                      </motion.button>
                    </>
                  )}
                </div>
                </>
              )}

              {state.type === 'downloading' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                    <IconDownload className="w-7 h-7 text-accent animate-pulse" />
                  </div>
                  <div className="text-center w-full">
                    <p className="text-sm font-medium text-ink">
                      {t('downloading_update')}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {t('percent_complete', {
                        percent: Math.round(state.progress * 100),
                      })}
                    </p>
                  </div>
                  <div className="w-full h-2 rounded-full bg-line overflow-hidden">
                    <motion.div
                      className="h-full bg-linear-to-r from-accent to-accent-bright rounded-full"
                      initial={{ width: '0%' }}
                      animate={{
                        width: `${Math.round(state.progress * 100)}%`,
                      }}
                      transition={{ duration: 0.25 }}
                    />
                  </div>
                </>
              )}

              {state.type === 'done' && (
                <>
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full bg-mint/20 animate-ping opacity-30" />
                    <div className="relative w-16 h-16 rounded-full bg-mint/10 flex items-center justify-center">
                      <IconCheck className="w-7 h-7 text-mint" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-ink">
                      {t('update_downloaded')}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {t('restart_to_apply')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => relaunch().catch(() => {})}
                      className="focus-ring cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-bright text-sm font-medium text-white transition-colors"
                    >
                      <IconRefresh className="w-4 h-4" />
                      {t('restart_now')}
                    </motion.button>
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={onClose}
                      className="focus-ring cursor-pointer px-5 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm font-medium text-ink transition-colors"
                    >
                      {t('check_updates_close_btn')}
                    </motion.button>
                  </div>
                  <p className="text-[11px] text-muted/70 text-center max-w-xs">
                    {t('update_applied_desc')}
                  </p>
                </>
              )}

              {state.type === 'error' &&
                (() => {
                  const hint = githubTokenHint(state.message, !!githubToken)
                  return (
                    <>
                      <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
                        <IconX className="w-7 h-7 text-danger" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-ink">
                          {hint === 'rate-limited'
                            ? t('check_updates_rate_limited')
                            : hint === 'token-rejected'
                              ? t('check_updates_token_rejected')
                              : t('check_updates_failed')}
                        </p>
                        <p className="text-xs text-muted mt-1 max-w-xs wrap-break-word">
                          {state.message}
                        </p>
                      </div>
                      {hint && (
                        <div className="w-full bg-raised rounded-xl border border-line p-4 flex flex-col gap-3">
                          <p className="text-[11px] text-muted leading-relaxed">
                            {hint === 'token-rejected'
                              ? t('check_updates_rate_limited_token_hint')
                              : t('check_updates_rate_limited_hint')}
                          </p>
                          <motion.button
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={openTokenSettings}
                            className="focus-ring cursor-pointer self-start px-4 py-2 rounded-lg bg-accent hover:bg-accent-bright text-xs font-medium text-white transition-colors"
                          >
                            {hint === 'token-rejected'
                              ? t('check_updates_open_token_settings')
                              : t('check_updates_add_token')}
                          </motion.button>
                        </div>
                      )}
                      {/404/.test(state.message) && lastReleaseUrlRef.current && (
                        <div className="w-full bg-raised rounded-xl border border-line p-4 flex flex-col gap-3">
                          <p className="text-[11px] text-muted leading-relaxed">
                            {t('check_updates_404_hint')}
                          </p>
                          <motion.button
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => openUrl(lastReleaseUrlRef.current!)}
                            className="focus-ring cursor-pointer flex items-center gap-2 self-start px-4 py-2 rounded-lg bg-accent hover:bg-accent-bright text-xs font-medium text-white transition-colors"
                          >
                            <IconExternalLink className="w-3.5 h-3.5" />
                            {t('check_updates_download_from_github')}
                          </motion.button>
                        </div>
                      )}
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={doCheck}
                        className="focus-ring cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg border border-line hover:border-accent-dim hover:bg-raised text-sm font-medium text-ink transition-colors"
                      >
                        <IconRefresh className="w-4 h-4" />
                        {t('check_updates_try_again')}
                      </motion.button>
                    </>
                  )
                })()}
            </motion.div>
          </AnimatePresence>
        </div>

        {isPreview && (
          <div className="px-6 pb-4 shrink-0">
            <div className="rounded-xl border border-dashed border-line bg-raised/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/70 mb-2">
                {t('check_updates_preview_mode_hint')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PREVIEW_STATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => switchPreviewState(s)}
                    className="focus-ring cursor-pointer px-2.5 py-1 rounded-md bg-raised border border-line text-[10px] font-medium text-muted hover:text-ink hover:border-accent-dim transition-colors"
                  >
                    {t(`preview_state_${s}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 pb-5 px-6 border-t border-line shrink-0">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            className="focus-ring cursor-pointer px-4 py-2 rounded-lg text-xs font-medium text-muted hover:text-ink hover:bg-raised transition-colors"
          >
            {t('check_updates_close_btn')}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
