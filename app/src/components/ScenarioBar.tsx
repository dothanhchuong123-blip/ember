import { useEffect, useRef, useState } from 'react'
import './scenario-bar.css'

type Option = { id: string; label: string }

const known = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)
const num = (value: number, orange: boolean) => <b className="sb-num" data-hot={orange}>{value.toLocaleString()}</b>

/* Compact words for the counts. A zero is the finding "none", never a big 0; a missing value is "not known", never 0. */
function testedPart(plotted: number | null | undefined) {
  return known(plotted)
    ? <span>{num(plotted, false)} tested</span>
    : <span className="sb-none">tested: not known</span>
}
function closePart(close: number | null | undefined) {
  if (!known(close)) return <span className="sb-none">close to this air: not known</span>
  if (close === 0) return <span className="sb-none">none close to this air</span>
  return <span>{num(close, true)} close to this air</span>
}
function gravityPart(close: number | null | undefined, same: number | null | undefined, gravity: string) {
  if (close === 0) return null // none close to this air, so necessarily none at this gravity
  if (!known(same)) return <span className="sb-none">also at {gravity}: not known</span>
  if (same === 0) return <span className="sb-none">none at {gravity}</span>
  return <span>{num(same, true)} also at {gravity}</span>
}

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
  plotted: number | null | undefined
  close: number | null | undefined
  sameGravity: number | null | undefined
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
        <p className="scenario-bar-stats">
          {testedPart(plotted)}
          {closePart(close)}
          {gravityPart(close, sameGravity, gravityLabel)}
        </p>
      </div>
    </div>
  )
}
