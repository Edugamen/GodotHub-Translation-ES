import { useCallback, useEffect, useRef } from 'react'

/**
 * Scroll-position compensation for scroll containers whose content height can
 * change underneath the user (list reorders, filters collapsing sections,
 * exiting cards, …). The browser clamps `scrollTop` the instant the container
 * shrinks, snapping the viewport; this hook tracks the live scroll position
 * and lets the caller re-apply it (clamped to the new bounds) right after the
 * commit, so the view never jumps while the list settles.
 *
 * Usage — pass `viewportRef` to `OverlayScrollArea`'s `scrollRef`, then call
 * `restoreScroll()` from a layout effect keyed on whatever changes the list:
 *
 *   const { viewportRef, restoreScroll } = useScrollCompensation()
 *   useLayoutEffect(() => restoreScroll(), [pinnedSignature, tagFilter, restoreScroll])
 */
export function useScrollCompensation() {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  // Last-known scroll position, updated on every scroll event so a restore
  // always has the position from *before* the list change, no matter what
  // triggered it (wheel, track drag, back-to-top, programmatic scroll).
  const savedScrollTopRef = useRef(0)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const trackScroll = () => {
      savedScrollTopRef.current = el.scrollTop
    }
    trackScroll()
    el.addEventListener('scroll', trackScroll, { passive: true })
    return () => el.removeEventListener('scroll', trackScroll)
  }, [])

  /** Re-applies the last-known scroll position, clamped to the current bounds. */
  const restoreScroll = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    el.scrollTop = Math.min(savedScrollTopRef.current, Math.max(0, max))
  }, [])

  return { viewportRef, restoreScroll }
}
