import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Tooltip } from './Tooltip'
import { IconChevronUp } from '../Icons'

const SHOW_AFTER = 300

/**
 * Floating "back to top" button that appears once the main content area is
 * scrolled down. Rendered `fixed` at the bottom-right of the viewport so it
 * stays in place on every view — the app scrolls inside `<main>`, not the
 * window. Clicking scrolls to the top instantly.
 */
export function ScrollToTopButton() {
  const { t } = useTranslation('common')
  const [visible, setVisible] = useState(false)
  const scrollerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const scroller = document.querySelector('main')
    if (!scroller) return
    scrollerRef.current = scroller
    const update = () => setVisible(scroller.scrollTop > SHOW_AFTER)
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', update)
    }
  }, [])

  const scrollToTop = () => {
    scrollerRef.current?.scrollTo({ top: 0 })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="scroll-to-top"
          initial={{ opacity: 0, y: 12, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <Tooltip content={t('scroll_to_top')} side="left" delay={250}>
            <button
              type="button"
              aria-label={t('scroll_to_top')}
              onClick={scrollToTop}
              className="focus-ring cursor-pointer w-10 h-10 rounded-xl bg-surface border border-line text-muted shadow-2xl shadow-black/50 flex items-center justify-center transition-colors duration-150 hover:text-accent-bright hover:border-accent-dim/50 hover:bg-raised"
            >
              <IconChevronUp className="w-4 h-4" />
            </button>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
