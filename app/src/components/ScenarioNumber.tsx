import { animate } from 'motion'
import { useLayoutEffect, useRef } from 'react'
import { numberTransition, useMotionPreference } from '../motion'

export function ScenarioNumber({ value }: { value: number | string | null }) {
  const reduced = useMotionPreference()
  const display = useRef<HTMLSpanElement>(null)
  const current = useRef(value)
  const label = value?.toLocaleString() ?? 'Not tested'

  useLayoutEffect(() => {
    const element = display.current!
    const from = current.current
    if (reduced || typeof value !== 'number' || typeof from !== 'number' || from === value) {
      element.textContent = label
      current.current = value
      return
    }
    const animation = animate(from, value, {
      ...numberTransition,
      onUpdate: (next) => {
        const count = Math.round(next)
        if (current.current !== count) element.textContent = count.toLocaleString()
        current.current = count
      },
    })
    return () => animation.stop()
  }, [label, reduced, value])

  return (
    <span className="scenario-number">
      <span className="visually-hidden">{label}</span>
      <span className="number-value" data-value={label} aria-hidden="true"><span ref={display} /></span>
    </span>
  )
}
