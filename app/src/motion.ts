import type { Transition } from 'motion/react'
import { useEffect, useSyncExternalStore, type RefObject } from 'react'
import { tokens } from './tokens'

const { fast, normal, easeOut } = tokens.motion
export const layoutTransition: Transition = { duration: normal, ease: easeOut }
export const numberTransition = { duration: normal, ease: easeOut }
export const fadeTransition: Transition = { duration: fast, ease: easeOut }

export function useBrandPulse(core: RefObject<SVGCircleElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const pulse = core.current?.animate(
      [{ opacity: 1 }, { opacity: .72 }],
      { duration: tokens.motion.idle * 1000, easing: 'ease-in-out', iterations: Infinity, direction: 'alternate' },
    )
    return () => pulse?.cancel()
  }, [core, enabled])
}

export function scenarioFade(reduced: boolean) {
  return {
    initial: reduced ? false as const : { opacity: 0 },
    animate: { opacity: 1 },
    transition: reduced ? { duration: 0 } : fadeTransition,
  }
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

function subscribeToMotion(onChange: () => void) {
  reducedMotion.addEventListener('change', onChange)
  return () => reducedMotion.removeEventListener('change', onChange)
}

export function useMotionPreference() {
  return useSyncExternalStore(subscribeToMotion, () => reducedMotion.matches)
}

export function runEntryDelay(index: number) {
  return fast * Math.min(1, Math.max(0, index) / 80)
}

export function slideSection(element: Element, direction: number) {
  return element.animate(
    [{ transform: `translateY(${direction * 12}px)`, opacity: .65 }, { transform: 'translateY(0)', opacity: 1 }],
    { duration: normal * 1000, easing: `cubic-bezier(${easeOut.join(',')})` },
  )
}

export function enterView(reduced: boolean | null, order = 0) {
  if (reduced) return { initial: false as const }
  return {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '0px 0px -20px 0px' } as const,
    transition: { duration: normal, delay: Math.min(order * .045, .135), ease: easeOut },
  }
}
