import { useEffect, useState } from 'react'
import './section-nav.css'

const STEPS = [
  { href: '#explore', label: 'Pick a place' },
  { href: '#explore', label: 'Pick a material' },
  { href: '#evidence-map', label: 'Read the map' },
]

// First-load hint. Clear it on scroll so it settles before the user reaches the chart.
export function StepHint() {
  const [shown, setShown] = useState(() => !location.hash)
  useEffect(() => {
    const hide = () => setShown(false)
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    for (const name of events) window.addEventListener(name, hide, { once: true, passive: true })
    return () => { for (const name of events) window.removeEventListener(name, hide) }
  }, [])

  if (!shown) return null
  return (
    <div className="step-hint" role="note" aria-label="How to start">
      <ol className="wrap">
        {STEPS.map((step, index) => (
          <li key={step.label}>
            <a href={step.href}><b aria-hidden="true">{index + 1}</b> {step.label}</a>
          </li>
        ))}
      </ol>
    </div>
  )
}
