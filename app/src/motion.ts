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

// Section-tab pill: a quick spring with a barely visible overshoot (damping ratio ~0.85, settles in ~0.3s).
export const pillSpring: Transition = { type: 'spring', stiffness: 500, damping: 36, mass: .9 }

const SCENARIO_SWAP = .22

/**
 * New content after a place or fuel change. By default it rises 6px and starts partly visible, for enter-only swaps
 * where the old content is gone at once (the panel never shows empty). Pass `{ rise: 0, from: 0 }` for a pure
 * crossfade beside an exit animation, and always for SVG groups in the map.
 */
export function scenarioFade(reduced: boolean, { rise = 6, from = .35 }: { rise?: number; from?: number } = {}) {
  return {
    initial: reduced ? false as const : rise ? { opacity: from, y: rise } : { opacity: from },
    animate: rise ? { opacity: 1, y: 0 } : { opacity: 1 },
    transition: reduced ? { duration: 0 } : { duration: SCENARIO_SWAP, ease: easeOut },
  }
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/** For code outside React (no hook): read the reduced-motion preference at call time. */
export function prefersReducedMotion() {
  return reducedMotion.matches
}

/** Scroll behaviour for a user-initiated jump: smooth unless reduced motion is on. */
export function scrollBehavior(reduced = prefersReducedMotion()): ScrollBehavior {
  return reduced ? 'auto' : 'smooth'
}

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

export function enterView(reduced: boolean | null, order = 0) {
  if (reduced) return { initial: false as const }
  return {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '0px 0px -20px 0px' } as const,
    transition: { duration: normal, delay: Math.min(order * .045, .135), ease: easeOut },
  }
}
