import { useEffect, useState, type RefObject } from 'react'

export function useStageActivity(stage: RefObject<HTMLElement | null>, rootMargin = '0px') {
  const [visible, setVisible] = useState(false)
  const [nearby, setNearby] = useState(false)
  const [foreground, setForeground] = useState(() => !document.hidden)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const target = stage.current
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    const preloader = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), { rootMargin })
    observer.observe(target)
    preloader.observe(target)
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const motionChanged = () => setReduced(media.matches)
    const visibilityChanged = () => setForeground(!document.hidden)
    media.addEventListener('change', motionChanged)
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => {
      observer.disconnect()
      preloader.disconnect()
      media.removeEventListener('change', motionChanged)
      document.removeEventListener('visibilitychange', visibilityChanged)
    }
  }, [stage, rootMargin])

  return { active: visible && foreground && !reduced, nearby: nearby && foreground && !reduced, reduced }
}

export function useDeferredActivation(enabled: boolean) {
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (!enabled || started) return
    // Give the browser a paint and time for higher-priority work before mounting WebGL.
    let cancelIdle: (() => void) | undefined
    const frame = requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) {
        const idle = requestIdleCallback(() => setStarted(true), { timeout: 450 })
        cancelIdle = () => cancelIdleCallback(idle)
      } else {
        const timer = setTimeout(() => setStarted(true), 0)
        cancelIdle = () => clearTimeout(timer)
      }
    })
    return () => {
      cancelAnimationFrame(frame)
      cancelIdle?.()
    }
  }, [enabled, started])
  return started
}
