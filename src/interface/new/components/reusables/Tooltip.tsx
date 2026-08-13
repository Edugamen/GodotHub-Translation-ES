import { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../../../../hooks/useSettings'

interface TooltipProps {
  content: string
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  maxWidth?: number
  delay?: number
}

const MAX_TOOLTIP_WIDTH = 320
const VIEWPORT_PADDING = 14
const GAP = 10
const DEFAULT_DELAY = 350

export function Tooltip({ content, children, side: sideProp, className, maxWidth = MAX_TOOLTIP_WIDTH, delay: delayProp }: TooltipProps) {
  const { settings } = useSettings()
  const delay = delayProp ?? settings.tooltip_delay ?? DEFAULT_DELAY
  const [show, setShow] = useState(false)
  const [shimmerDone, setShimmerDone] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [arrowSide, setArrowSide] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sizeKnownRef = useRef(false)

  const pickSideAndCalc = useCallback((rect: DOMRect, tw: number, th: number) => {
    const spaceRight = window.innerWidth - rect.right - VIEWPORT_PADDING - GAP
    const spaceLeft = rect.left - VIEWPORT_PADDING - GAP
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING - GAP
    const spaceAbove = rect.top - VIEWPORT_PADDING - GAP

    const sides = (() => {
      if (sideProp) return [sideProp]

      const candidates: { side: 'top' | 'bottom' | 'left' | 'right'; space: number }[] = []
      if (spaceBelow >= th + GAP) candidates.push({ side: 'bottom', space: spaceBelow })
      if (spaceAbove >= th + GAP) candidates.push({ side: 'top', space: spaceAbove })
      if (spaceRight >= tw + GAP) candidates.push({ side: 'right', space: spaceRight })
      if (spaceLeft >= tw + GAP) candidates.push({ side: 'left', space: spaceLeft })

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.space - a.space)
        return [candidates[0].side]
      }

      const allSides: { side: 'top' | 'bottom' | 'left' | 'right'; space: number }[] = [
        { side: 'bottom', space: spaceBelow },
        { side: 'top', space: spaceAbove },
        { side: 'right', space: spaceRight },
        { side: 'left', space: spaceLeft },
      ]
      allSides.sort((a, b) => b.space - a.space)
      return [allSides[0].side]
    })()

    const side = sides[0]

    let x: number
    let y: number

    if (side === 'right') {
      x = rect.right + GAP
      y = rect.top + rect.height / 2 - th / 2
    } else if (side === 'left') {
      x = rect.left - tw - GAP
      y = rect.top + rect.height / 2 - th / 2
    } else if (side === 'top') {
      x = rect.left + rect.width / 2 - tw / 2
      y = rect.top - th - GAP
    } else {
      x = rect.left + rect.width / 2 - tw / 2
      y = rect.bottom + GAP
    }

    const maxX = window.innerWidth - tw - VIEWPORT_PADDING
    const maxY = window.innerHeight - th - VIEWPORT_PADDING
    x = Math.max(VIEWPORT_PADDING, Math.min(x, maxX))
    y = Math.max(VIEWPORT_PADDING, Math.min(y, maxY))

    return { x, y, side }
  }, [sideProp])

  const getAnchorRect = useCallback((): DOMRect | null => {
    const el = triggerRef.current
    if (!el) return null
    if (el.childElementCount === 1 && el.firstElementChild) {
      return el.firstElementChild.getBoundingClientRect()
    }
    return el.getBoundingClientRect()
  }, [])

  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      const rect = getAnchorRect()
      if (!rect) return
      sizeKnownRef.current = false

      setPosition({ x: rect.left, y: rect.top })
      setShow(true)

      requestAnimationFrame(() => {
        if (!tooltipRef.current) return
        const tw = tooltipRef.current.offsetWidth
        const th = tooltipRef.current.offsetHeight
        const result = pickSideAndCalc(rect, tw, th)
        setPosition({ x: result.x, y: result.y })
        setArrowSide(result.side)
        sizeKnownRef.current = true
      })
    }, delay)
  }, [getAnchorRect, pickSideAndCalc, delay])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setShimmerDone(false)
    setShow(false)
    sizeKnownRef.current = false
  }, [])

  useEffect(() => {
    if (!show) return
    const handler = () => {
      if (!tooltipRef.current || !sizeKnownRef.current) return
      const rect = getAnchorRect()
      if (!rect) return
      const tw = tooltipRef.current.offsetWidth
      const th = tooltipRef.current.offsetHeight
      const result = pickSideAndCalc(rect, tw, th)
      setPosition({ x: result.x, y: result.y })
      setArrowSide(result.side)
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [show, getAnchorRect, pickSideAndCalc])

  const effectiveMaxWidth = Math.min(maxWidth, window.innerWidth - VIEWPORT_PADDING * 2)

  const getArrowStyle = () => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 10,
      height: 10,
      transform: 'rotate(45deg)',
      background: 'var(--color-surface, #1e2028)',
      zIndex: -1,
    }
    if (arrowSide === 'top') {
      base.bottom = -5
      base.left = '50%'
      base.marginLeft = -5
    } else if (arrowSide === 'bottom') {
      base.top = -5
      base.left = '50%'
      base.marginLeft = -5
    } else if (arrowSide === 'left') {
      base.right = -5
      base.top = '50%'
      base.marginTop = -5
    } else {
      base.left = -5
      base.top = '50%'
      base.marginTop = -5
    }
    return base
  }

  const getExitTransform = () => {
    const offset = 8
    switch (arrowSide) {
      case 'top': return { y: offset }
      case 'bottom': return { y: -offset }
      case 'left': return { x: offset }
      case 'right': return { x: -offset }
    }
  }

  const getInitialTransform = () => {
    const offset = 10
    switch (arrowSide) {
      case 'top': return { y: offset }
      case 'bottom': return { y: -offset }
      case 'left': return { x: offset }
      case 'right': return { x: -offset }
    }
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {children}

      {createPortal(
        <AnimatePresence>
          {show && (
            <motion.div
              ref={tooltipRef}
              initial={{
                opacity: 0,
                scale: 0.85,
                ...getInitialTransform(),
              }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{
                opacity: 0,
                scale: 0.85,
                ...getExitTransform(),
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 28, mass: 0.8 }}
              className="fixed z-999 pointer-events-none"
              style={{
                left: position.x,
                top: position.y,
              }}
            >
              <div
                className="absolute z-[-1]"
                style={getArrowStyle()}
              />

              <div
                className="relative overflow-hidden px-3.5 py-2 rounded-xl border border-line/80 bg-surface/96 text-xs text-ink font-medium shadow-2xl shadow-black/60 backdrop-blur-12px"
                style={{
                  maxWidth: effectiveMaxWidth,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {!shimmerDone && (
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    onAnimationComplete={() => setShimmerDone(true)}
                    transition={{
                      duration: 0.7,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.04,
                    }}
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                    }}
                  />
                )}
                <span className="relative z-1">{content}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
