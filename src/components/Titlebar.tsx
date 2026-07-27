import { useEffect, useState } from 'react'
import {
  getCurrentWindow,
  type Window as TauriWindow,
} from '@tauri-apps/api/window'
import { motion } from 'framer-motion'
import { openUrl } from '@tauri-apps/plugin-opener'
import { version } from '../../package.json'
import { IconStar, IconHeart } from './Icons'
import { TaskTray } from './TaskTray'
import { Tooltip } from './ui/Tooltip'

export function TitleBar() {
  const [appWindow, setAppWindow] = useState<TauriWindow | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    try {
      const w = getCurrentWindow()
      setAppWindow(w)
      w.isMaximized()
        .then(setIsMaximized)
        .catch(() => {})
      w.onResized(() => {
        w.isMaximized()
          .then(setIsMaximized)
          .catch(() => {})
      })
        .then((f) => {
          unlisten = f
        })
        .catch(() => {})
    } catch {}
    return () => unlisten?.()
  }, [])

  const safe = (fn: (w: TauriWindow) => void) => {
    if (appWindow) {
      try {
        fn(appWindow)
      } catch {}
    }
  }

  return (
    <div className="relative h-10 flex items-stretch bg-surface border-line border-b select-none shrink-0">
      <div
        data-tauri-drag-region
        onDoubleClick={() => safe((w) => w.toggleMaximize())}
        className="flex-1 flex items-center px-4 min-w-0"
      ></div>

      <div
        data-tauri-drag-region
        onDoubleClick={() => safe((w) => w.toggleMaximize())}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto select-none"
      >
        <motion.h1
          layoutId="brand-title"
          layout
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          animate={{
            opacity: isHovered ? 0 : 1,
            y: isHovered ? -10 : 0,
            transition: { duration: 0.22, ease: 'easeInOut' },
          }}
          className="font-black italic tracking-tight text-xl text-muted flex items-center gap-2 pointer-events-none"
        >
          GodotHub
        </motion.h1>
        <motion.p
          initial={false}
          animate={{
            opacity: isHovered ? 1 : 0,
            y: isHovered ? 0 : 10,
          }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center font-mono text-xs text-muted/70 pointer-events-none"
        >
          v{version}
        </motion.p>
      </div>

      <div className="flex items-stretch gap-1">
        <div className="flex items-center gap-1 pl-3 pr-5">
          <Tooltip content="Star on GitHub" side="bottom">
            <motion.button
              onClick={() => openUrl('https://github.com/RykoTheDev/GodotHub')}
              aria-label="Star on GitHub"
              className="focus-ring cursor-pointer w-7 h-7 flex items-center justify-center rounded-md text-muted/60 hover:text-amber hover:bg-amber/10 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <IconStar className="w-3.5 h-3.5" />
            </motion.button>
          </Tooltip>
          <Tooltip content="Support the Development" side="bottom">
            <motion.button
              onClick={() => openUrl('https://www.patreon.com/cw/TheRyko/membership')}
              aria-label="Support the Development"
              className="focus-ring cursor-pointer w-7 h-7 flex items-center justify-center rounded-md text-muted/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <IconHeart className="w-3.5 h-3.5" />
            </motion.button>
          </Tooltip>
        </div>
        <div className="w-px h-5 self-center bg-line/40" />
        <TaskTray />
        <div className="w-px h-5 self-center bg-line/40" />
        <div className="flex items-stretch gap-1 px-3">
          <motion.button
            onClick={() => safe((w) => w.minimize())}
            aria-label="Minimize"
            className="w-6 cursor-pointer flex items-center justify-center text-muted hover:text-ink transition-colors shrink-0"
            whileHover={{
              y: -2,
              scale: 1.1,
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
            }}
          >
            <div className="w-4 h-4 bg-green-400 rounded-full" />
          </motion.button>

          <motion.button
            onClick={() => safe((w) => w.toggleMaximize())}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            className="w-6 cursor-pointer flex items-center justify-center text-muted hover:text-ink transition-colors shrink-0"
            whileHover={{
              y: -2,
              scale: 1.1,
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
            }}
          >
            <div className="w-4 h-4 bg-amber rounded-full" />
          </motion.button>

          <motion.button
            onClick={() => safe((w) => w.close())}
            aria-label="Close"
            className="w-6 cursor-pointer flex items-center justify-center text-muted hover:text-white transition-colors shrink-0"
            whileHover={{
              y: -2,
              scale: 1.1,
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
            }}
          >
            <div className="w-4 h-4 bg-red-400 rounded-full" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
