import { motion } from 'motion/react'
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { layoutTransition, slideSection } from '../motion'
import { EmberReticle, EmberWordmark } from './EmberLogo'
import './section-nav.css'

type TabId = 'explore' | 'evidence' | 'answer' | 'studies' | 'earth'

const icon = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
)

const TABS: { id: TabId; target: string; label: string; icon: ReactNode }[] = [
  { id: 'explore', target: 'explore', label: 'Explore', icon: icon(<><circle cx="12" cy="12" r="8" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>) },
  { id: 'evidence', target: 'evidence-map', label: 'Evidence map', icon: icon(<><path d="M4 3v17h17" /><circle cx="9" cy="14" r="1.2" /><circle cx="13" cy="9" r="1.2" /><circle cx="17" cy="12" r="1.2" /></>) },
  { id: 'answer', target: 'answer', label: 'Answer', icon: icon(<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>) },
  { id: 'studies', target: 'studies', label: 'NASA studies', icon: icon(<><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" /><path d="M7.5 15h9" /></>) },
  { id: 'earth', target: 'earth', label: 'On Earth', icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>) },
]

const top = (element: Element | null) => element ? element.getBoundingClientRect().top : null

// Which section the reading line is in. Sections are stacked top to bottom: pickers and verdict (Explore), the map,
// the cited answer, the studies and Earth.
function sectionAtProbe(probe: number): TabId | null {
  const starts: [TabId, number | null][] = TABS.map((tab) => [tab.id, top(document.getElementById(tab.target))])
  if (starts[0][1] === null || starts[0][1] > probe) return null
  let found: TabId | null = null
  for (const [id, start] of starts) if (start !== null && start <= probe) found = id
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
  if (atBottom && starts.at(-1)?.[1] != null) found = 'earth'
  return found
}

export function SectionNav({ reduced }: { reduced: boolean | null }) {
  const headerRef = useRef<HTMLElement>(null)
  const sectionAnimation = useRef<Animation | null>(null)
  const [active, setActive] = useState<TabId | null>(null)

  useEffect(() => {
    if (reduced) sectionAnimation.current?.cancel()
    return () => sectionAnimation.current?.cancel()
  }, [reduced])

  useEffect(() => {
    const update = () => setActive(sectionAtProbe((headerRef.current?.offsetHeight ?? 64) + 40))
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // Sections load and resize after first paint (data, models), so re-read the layout when the page height changes.
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [])

  function navigate(event: MouseEvent<HTMLAnchorElement>, target: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const section = document.getElementById(target)
    if (!section) return
    event.preventDefault()
    sectionAnimation.current?.cancel()
    const readingLine = (headerRef.current?.offsetHeight ?? 64) + 40
    const distance = section.getBoundingClientRect().top - readingLine
    const details = section.querySelector<HTMLDetailsElement>('.section-details')
    if (details) details.open = true
    const hash = event.currentTarget.hash
    const newLocation = location.hash !== hash
    if (newLocation) history.pushState(null, '', hash)
    section.scrollIntoView()
    section.focus({ preventScroll: true })
    if (!reduced && (newLocation || Math.abs(distance) > 32)) {
      sectionAnimation.current = slideSection(section, distance >= 0 ? 1 : -1)
    }
  }

  return (
    <header className="site-header" ref={headerRef}>
      <div className="wrap header-inner">
        <a className="brand" href="#top" aria-label="EMBER, back to top">
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <EmberReticle coreClassName="brand-core" pulse={reduced === false} />
          </svg>
          <svg className="brand-name" width="118" height="32" viewBox="0 0 118 32" aria-hidden="true" focusable="false">
            <EmberWordmark />
          </svg>
        </a>
        <nav aria-label="Main navigation">
          <ul className="section-tabs">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <a className="section-tab" href={`#${tab.target}`} aria-current={active === tab.id ? 'location' : undefined}
                  onClick={(event) => navigate(event, tab.target)}>
                  {active === tab.id && (
                    <motion.span className="section-tab-pill" aria-hidden="true"
                      layoutId={reduced ? undefined : 'section-tab-pill'} transition={layoutTransition} />
                  )}
                  {tab.icon}
                  <span className="section-tab-label">{tab.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <span className="event-name">NASA Space Apps 2026</span>
      </div>
    </header>
  )
}
