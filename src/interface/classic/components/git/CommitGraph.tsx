import { useMemo } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useTranslation } from 'react-i18next'
import { IconExternalLink } from '../../lib/Icons'
import type { GitLogEntry } from '../../../../types'

const LANE_COLORS = [
  '#5865f2',
  '#23a55a',
  '#f0b132',
  '#f23f42',
  '#eb459e',
  '#00b8d4',
  '#a855f7',
  '#10b981',
  '#f97316',
  '#e11d48',
]

const LANE_W = 20
const ROW_H = 44
const DOT_R = 4.5

function colorFor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length]
}

function shortHash(hash: string): string {
  return hash.length > 7 ? hash.slice(0, 7) : hash
}

export type LaneCell =
  | { type: 'empty' }
  | { type: 'line'; lane: number }
  | { type: 'dot'; lane: number }

export interface GraphRow {
  commit: GitLogEntry
  lane: number
  cells: LaneCell[]
  joins: number[]
}

export function buildGraphRows(commits: GitLogEntry[]): GraphRow[] {
  let tips: (string | null)[] = []
  const rows: GraphRow[] = []

  for (const commit of commits) {
    const firstParent = commit.parents[0]

    let lane = tips.findIndex((t) => t === commit.hash)
    if (lane === -1 && commit.parents.length > 1) {
      lane = tips.findIndex((t) => t === firstParent)
    }
    if (lane === -1) {
      lane = tips.length
      tips.push(commit.hash)
    }

    const closes: number[] = []
    for (let i = 0; i < tips.length; i++) {
      if (i !== lane && tips[i] === commit.hash) closes.push(i)
    }

    const cells: LaneCell[] = tips.map((tip, i) => {
      if (tip === null) return { type: 'empty' }
      if (i === lane) return { type: 'dot', lane: i }
      return { type: 'line', lane: i }
    })

    const joins: number[] = [...closes]
    for (const parent of commit.parents.slice(1)) {
      let pLane = tips.findIndex((t) => t === parent)
      if (pLane === -1) {
        pLane = tips.length
        tips.push(parent)
        cells.push({ type: 'line', lane: pLane })
      }
      joins.push(pLane)
    }

    rows.push({ commit, lane, cells, joins })

    tips[lane] = firstParent ?? null
    for (const i of closes) tips[i] = null
    while (tips.length > 0 && tips[tips.length - 1] === null) tips.pop()
  }

  return rows
}

function RowGraph({ row }: { row: GraphRow }) {
  const cols = Math.max(1, row.cells.length)
  return (
    <svg width={cols * LANE_W} height={ROW_H} className="shrink-0">
      {row.cells.map((cell, i) => {
        if (cell.type === 'empty') return null
        const x = i * LANE_W + LANE_W / 2
        const color = colorFor(cell.lane)
        const isDot = cell.type === 'dot'
        return (
          <g key={i}>
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={ROW_H}
              stroke={color}
              strokeWidth={1.6}
              opacity={isDot ? 0.9 : 0.45}
            />
            {isDot && (
              <circle
                cx={x}
                cy={ROW_H / 2}
                r={DOT_R}
                fill={color}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            )}
          </g>
        )
      })}
      {row.joins.length > 0 && (
        <g>
          {row.joins.map((j) => {
            const x1 = row.lane * LANE_W + LANE_W / 2
            const x2 = j * LANE_W + LANE_W / 2
            return (
              <line
                key={`join-${j}`}
                x1={x1}
                y1={ROW_H / 2}
                x2={x2}
                y2={ROW_H / 2}
                stroke={colorFor(j)}
                strokeWidth={1.6}
                opacity={0.45}
              />
            )
          })}
        </g>
      )}
    </svg>
  )
}

interface Props {
  commits: GitLogEntry[]
  remoteUrl?: string | null
}

export function CommitGraph({ commits, remoteUrl }: Props) {
  const { t } = useTranslation('git')
  const rows = useMemo(() => buildGraphRows(commits), [commits])

  if (commits.length === 0) {
    return (
      <div className="border border-dashed border-line rounded-xl py-6 text-center">
        <p className="text-xs text-muted">{t('no_commits_found')}</p>
      </div>
    )
  }

  const baseUrl = remoteUrl ? remoteUrl.replace(/\/+$/, '') : null

  return (
    <div className="git-graph w-full overflow-x-auto">
      <div className="flex flex-col">
        {rows.map((row) => {
          const c = row.commit
          const url = baseUrl ? `${baseUrl}/commit/${c.hash}` : null
          return (
            <div key={c.hash} className="flex items-center gap-1.5">
              <RowGraph row={row} />
              <div
                title={c.message}
                onClick={() => {
                  if (url) openUrl(url)
                }}
                className={`flex items-center gap-2 pr-2 rounded-md transition-colors ${
                  url ? 'cursor-pointer hover:bg-raised' : 'cursor-default'
                }`}
                style={{ height: ROW_H }}
              >
                <span className="font-mono text-[10px] font-semibold text-accent-bright shrink-0">
                  {shortHash(c.hash)}
                </span>
                <div className="min-w-0 flex-1 max-w-[240px]">
                  <p className="text-xs text-ink truncate leading-snug">{c.message}</p>
                  {(c.author || c.date) && (
                    <p className="text-[10px] text-muted truncate mt-0.5">
                      {[c.author, c.date].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                {url && <IconExternalLink className="w-2.5 h-2.5 text-muted/40 shrink-0" />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
