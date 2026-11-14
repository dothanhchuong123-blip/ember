import { useEffect, useRef, useState } from 'react'
import './scenario-bar.css'

type Option = { id: string; label: string }

/* A slim bar under the section tabs. It appears once the big place and material pickers have scrolled out of view,
   so the scenario can be changed from the map, the answer or the studies without scrolling back up. The numbers are
   the same three counts as the step 3 verdict. */
export function ScenarioBar({ watchSelector, places, placeId, onPlace, fuels, fuel, onFuel, plotted, close, sameGravity, gravityLabel }: {
  watchSelector: string
  places: { group: string; options: Option[] }[]
  placeId: string
  onPlace: (id: string) => void
  fuels: Option[]
  fuel: string
  onFuel: (id: string) => void
  plotted: number
  close: number
  sameGravity: number
  gravityLabel: string
}) {
  const [shown, setShown] = useState(false)
  const [top, setTop] = useState(68)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Read the layout on scroll rather than observing once: the pickers render only after the data has loaded.
    const update = () => {
      const header = document.querySelector('.site-header')
      const headerH = header instanceof HTMLElement ? header.offsetHeight : 68
      const watched = document.querySelector(watchSelector)
      setTop(headerH)
      // Section jumps leave room for this bar too (see --scenario-h in scenario-bar.css).
      document.documentElement.style.setProperty('--scenario-h', `${barRef.current?.offsetHeight ?? 0}px`)
      // Shown only after the pickers have gone up past the header, never while they are still below the fold.
      setShown(Boolean(watched && watched.getBoundingClientRect().bottom < headerH))
    }
    // setState with an unchanged value is a no-op, so running this on every scroll event stays cheap.
    const schedule = update
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [watchSelector])

  return (
    <div ref={barRef} className="scenario-bar" data-shown={shown} style={{ top }} aria-hidden={!shown} inert={!shown}>
      <div className="wrap scenario-bar-inner">
        <div className="scenario-bar-pickers">
          <label>
            <span className="visually-hidden">Place</span>
            <select value={placeId} onChange={(e) => onPlace(e.target.value)}>
              {places.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Material</span>
            <select value={fuel} onChange={(e) => onFuel(e.target.value)}>
              {fuels.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <dl className="scenario-bar-stats">
          <div><dt>tested</dt><dd>{plotted}</dd></div>
          <div data-zero={close === 0}><dt>close to this air</dt><dd>{close}</dd></div>
          <div data-zero={sameGravity === 0}><dt>also at {gravityLabel}</dt><dd>{sameGravity}</dd></div>
        </dl>
      </div>
    </div>
  )
}
