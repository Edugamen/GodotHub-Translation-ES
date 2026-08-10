function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

function shift(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + amount, g + amount, b + amount)
}

export type ThemeMode = 'dark' | 'light'

const DARK_NEUTRALS = {
  overlay: '#3a3c43',
  ink: '#f2f3f5',
  muted: '#949ba4',
}

/** Palette used to color project tag pills (hash-based, deterministic). */
const TAG_COLORS = [
  '#457ff2', '#f28b45', '#45c97f', '#e74c8a', '#a855f7',
  '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#6366f1',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
  '#84cc16', '#d946ef', '#0ea5e9', '#eab308', '#3b82f6',
]

/** Deterministic color for a project tag, stable across renders and cards. */
export function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

export function applyTheme(
  accent: string,
  background: string,
  mode: ThemeMode = 'dark',
) {
  const root = document.documentElement
  const style = root.style

  root.classList.add('theme-transitioning')
  setTimeout(() => root.classList.remove('theme-transitioning'), 450)

  style.setProperty('--color-accent', accent)
  style.setProperty('--color-accent-dim', shift(accent, -45))
  style.setProperty('--color-accent-bright', shift(accent, 35))

  if (mode === 'light') {
    style.setProperty('--color-base', background)
    style.setProperty('--color-surface', shift(background, 15))
    style.setProperty('--color-raised', shift(background, -6))
    style.setProperty('--color-overlay', shift(background, -12))
    style.setProperty('--color-line', shift(background, -18))
    style.setProperty('--color-ink', '#1b1c1f')
    style.setProperty('--color-muted', '#6b7280')
  } else {
    style.setProperty('--color-base', background)
    style.setProperty('--color-surface', shift(background, 9))
    style.setProperty('--color-raised', shift(background, 18))
    style.setProperty('--color-overlay', DARK_NEUTRALS.overlay)
    style.setProperty('--color-line', shift(background, 28))
    style.setProperty('--color-ink', DARK_NEUTRALS.ink)
    style.setProperty('--color-muted', DARK_NEUTRALS.muted)
  }
}
