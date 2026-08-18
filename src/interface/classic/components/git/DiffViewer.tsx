import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { GitDiffHunk, GitDiffResult, GitDiffLine } from '../../../../types'
import { api } from '../../../../lib/api'
import { IconCheck, IconCode, IconCopy, IconRefresh, IconX } from '../../lib/Icons'
import { Tooltip } from '../reusables/Tooltip'

interface Props {
  projectPath: string
  filePath: string
  onClose: () => void
}

interface Seg {
  t: string
  c: boolean
}

function splitChanged(oldT: string, newT: string): { old: Seg[]; next: Seg[] } {
  const max = Math.min(oldT.length, newT.length)
  let p = 0
  while (p < max && oldT[p] === newT[p]) p++
  let s = 0
  while (s < oldT.length - p && s < newT.length - p && oldT[oldT.length - 1 - s] === newT[newT.length - 1 - s]) s++
  const oldMid = oldT.slice(p, oldT.length - s)
  const newMid = newT.slice(p, newT.length - s)
  const old: Seg[] = []
  const next: Seg[] = []
  if (p > 0) {
    old.push({ t: oldT.slice(0, p), c: false })
    next.push({ t: newT.slice(0, p), c: false })
  }
  old.push({ t: oldMid, c: true })
  next.push({ t: newMid, c: true })
  if (s > 0) {
    old.push({ t: oldT.slice(oldT.length - s), c: false })
    next.push({ t: newT.slice(newT.length - s), c: false })
  }
  return { old, next }
}

function computeHighlights(hunk: GitDiffHunk): Map<number, Seg[]> {
  const map = new Map<number, Seg[]>()
  const pendingDeletes: { idx: number; text: string }[] = []
  hunk.lines.forEach((line, idx) => {
    if (line.kind === 'delete') {
      pendingDeletes.push({ idx, text: line.content })
    } else if (line.kind === 'add') {
      const d = pendingDeletes[pendingDeletes.length - 1]
      if (d && d.idx === idx - 1) {
        pendingDeletes.pop()
        const { old, next } = splitChanged(d.text, line.content)
        map.set(d.idx, old)
        map.set(idx, next)
      } else {
        map.set(idx, [{ t: line.content, c: true }])
      }
    }
  })
  for (const d of pendingDeletes) map.set(d.idx, [{ t: d.text, c: true }])
  hunk.lines.forEach((line, idx) => {
    if (line.kind === 'context' && !map.has(idx)) map.set(idx, [{ t: line.content, c: false }])
  })
  return map
}

function countHunkDelta(hunk: GitDiffHunk): { adds: number; dels: number } {
  let adds = 0
  let dels = 0
  for (const line of hunk.lines) {
    if (line.kind === 'add') adds++
    else if (line.kind === 'delete') dels++
  }
  return { adds, dels }
}

function DiffLineRow({
  line,
  oldNum,
  newNum,
  segs,
  wrap,
}: {
  line: GitDiffLine
  oldNum: number | null
  newNum: number | null
  segs: Seg[]
  wrap: boolean
}) {
  const isAdd = line.kind === 'add'
  const isDel = line.kind === 'delete'
  const bg = isAdd ? 'bg-mint/10' : isDel ? 'bg-danger/10' : 'hover:bg-raised/60'
  const prefix = isAdd ? '+' : isDel ? '-' : ' '
  const prefixColor = isAdd ? 'text-mint' : isDel ? 'text-danger' : 'text-muted/40'
  const markCls = isAdd ? 'bg-mint/20 text-mint' : 'bg-danger/20 text-danger'
  const numCls = 'w-11 shrink-0 text-right pr-2 select-none text-muted/25 group-hover:text-muted/45 transition-colors tabular-nums'
  return (
    <div className={`group flex items-stretch px-2 ${bg} transition-colors`}>
      <span className={numCls}>{oldNum ?? ''}</span>
      <span className={`${numCls} border-r border-line/40 mr-2`}>{newNum ?? ''}</span>
      <span className={`w-4 shrink-0 select-none font-bold ${prefixColor}`}>{prefix}</span>
      <span
        className={`py-px flex-1 min-w-0 text-ink ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre shrink-0'}`}
      >
        {segs.map((seg, i) =>
          seg.c && seg.t !== '' ? (
            <mark key={i} className={`${markCls} rounded-xs px-px`}>
              {seg.t}
            </mark>
          ) : (
            <span key={i}>{seg.t}</span>
          ),
        )}
      </span>
    </div>
  )
}

export function DiffViewer({ projectPath, filePath, onClose }: Props) {
  const { t } = useTranslation('git')
  const [diff, setDiff] = useState<GitDiffResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wrap, setWrap] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .gitFileDiff(projectPath, filePath)
      .then((d) => {
        if (!cancelled) {
          setDiff(d)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDiff(null)
          setError(String(e))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectPath, filePath, reload])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { adds, dels } = useMemo(() => {
    let a = 0
    let d = 0
    for (const hunk of diff?.hunks ?? []) {
      for (const line of hunk.lines) {
        if (line.kind === 'add') a++
        else if (line.kind === 'delete') d++
      }
    }
    return { adds: a, dels: d }
  }, [diff])

  const copyDiff = () => {
    if (!diff) return
    const text = diff.hunks
      .map((h) => {
        const head = `@@ -${h.old_start},${h.old_lines} +${h.new_start},${h.new_lines} @@`
        const body = h.lines
          .map((l) => `${l.kind === 'add' ? '+' : l.kind === 'delete' ? '-' : ' '}${l.content}`)
          .join('\n')
        return `${head}\n${body}`
      })
      .join('\n\n')
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setCopyFailed(false)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {
        setCopyFailed(true)
        window.setTimeout(() => setCopyFailed(false), 1600)
      })
  }

  const actionBtn =
    'focus-ring cursor-pointer flex items-center gap-1 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors shrink-0'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-120 flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="relative w-[860px] max-w-[calc(100vw-48px)] max-h-[85vh] bg-surface border border-line rounded-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-raised border border-line flex items-center justify-center">
                <IconCode className="w-3.5 h-3.5 text-accent-bright" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent-bright/80 shrink-0">
                    {t('diff')}
                  </span>
                  {adds + dels > 0 && (
                    <span className="text-[10px] font-semibold tabular-nums shrink-0">
                      <span className="text-mint">+{adds}</span>
                      <span className="text-muted/50 mx-1">·</span>
                      <span className="text-danger">−{dels}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-ink truncate" title={filePath}>
                  {filePath}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Tooltip content={wrap ? t('unwrap_lines') : t('wrap_lines')} side="bottom">
                <button
                  onClick={() => setWrap((v) => !v)}
                  className={`${actionBtn} text-[10px] font-semibold ${wrap ? '' : 'text-accent-bright bg-accent-dim/10'}`}
                  aria-label={wrap ? t('unwrap_lines') : t('wrap_lines')}
                >
                  {wrap ? t('unwrap_lines') : t('wrap_lines')}
                </button>
              </Tooltip>
              <Tooltip content={t('copy_diff')} side="bottom">
                <button onClick={copyDiff} disabled={!diff || diff.hunks.length === 0} className={`${actionBtn} disabled:opacity-30 disabled:cursor-not-allowed`} aria-label={t('copy_diff')}>
                  {copied ? <IconCheck className="w-4 h-4 text-mint" /> : copyFailed ? <IconX className="w-4 h-4 text-danger" /> : <IconCopy className="w-4 h-4" />}
                </button>
              </Tooltip>
              <Tooltip content={t('refresh', { ns: 'common' })} side="bottom">
                <button onClick={() => setReload((r) => r + 1)} disabled={loading} className={`${actionBtn} disabled:opacity-40`} aria-label={t('refresh', { ns: 'common' })}>
                  <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </Tooltip>
              <Tooltip content={t('close', { ns: 'common' })} side="bottom">
                <button onClick={onClose} className={actionBtn} aria-label={t('close', { ns: 'common' })}>
                  <IconX className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>

          {adds + dels > 0 && (
            <div className="flex h-[3px] shrink-0 bg-line/40" title={`+${adds} −${dels}`}>
              {adds > 0 && <div className="bg-mint/80" style={{ flexGrow: adds }} />}
              {dels > 0 && <div className="bg-danger/80" style={{ flexGrow: dels }} />}
            </div>
          )}

          <div className={`flex-1 font-mono text-xs leading-normal ${wrap ? 'overflow-y-auto' : 'overflow-auto'}`}>
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted">
                <IconRefresh className="w-5 h-5 animate-spin" />
                <span className="text-xs">{t('loading_diff')}</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
                <span className="text-sm text-danger">{t('diff_error')}</span>
                <span className="text-xs text-muted/70 max-w-md break-all">{error}</span>
                <button
                  onClick={() => setReload((r) => r + 1)}
                  className="focus-ring cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-bright text-white text-xs font-medium transition-colors"
                >
                  <IconRefresh className="w-3.5 h-3.5" />
                  {t('retry')}
                </button>
              </div>
            ) : !diff || diff.hunks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted">
                <IconCode className="w-8 h-8 text-muted/30" />
                <span className="text-sm">{t('no_changes')}</span>
              </div>
            ) : (
              <div className="py-2">
                {diff.hunks.map((hunk, hunkIdx) => {
                  const { adds: hAdds, dels: hDels } = countHunkDelta(hunk)
                  const highlights = computeHighlights(hunk)
                  let oldLine = hunk.old_start
                  let newLine = hunk.new_start
                  return (
                    <div key={hunkIdx} className="mb-1">
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-raised/95 backdrop-blur-sm border-y border-line px-4 py-1.5 text-[10px] font-semibold text-muted/70">
                        <span className="tabular-nums">
                          <span className="text-muted/50">@@</span> -{hunk.old_start},{hunk.old_lines}{' '}
                          +{hunk.new_start},{hunk.new_lines} <span className="text-muted/50">@@</span>
                        </span>
                        {(hAdds > 0 || hDels > 0) && (
                          <span className="tabular-nums shrink-0">
                            <span className="text-mint">+{hAdds}</span>
                            <span className="text-muted/50 mx-1">·</span>
                            <span className="text-danger">−{hDels}</span>
                          </span>
                        )}
                      </div>
                      {hunk.lines.map((line, lineIdx) => {
                        const isAdd = line.kind === 'add'
                        const isDel = line.kind === 'delete'
                        const oldNum = isAdd ? null : oldLine++
                        const newNum = isDel ? null : newLine++
                        const segs = highlights.get(lineIdx) ?? [
                          { t: line.content, c: line.kind !== 'context' },
                        ]
                        return (
                          <DiffLineRow
                            key={lineIdx}
                            line={line}
                            oldNum={oldNum}
                            newNum={newNum}
                            segs={segs}
                            wrap={wrap}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
