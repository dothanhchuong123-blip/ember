import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { effectivePressure } from '../data'
import { ModelCollection } from '../three3d/ModelViewer'
import { profileModelNotes, profileModels } from '../three3d/placements'
import type { Investigation, Outcome, Run } from '../types'
import { StudyEarthLine } from './StudyEarthLine'

interface Props {
  open: boolean
  mode: 'profile' | 'compare'
  investigations: Investigation[] // 1 item for profile, 2 items for compare
  runs: Run[]
  onClose: () => void
  onSelectProfile?: (id: string) => void
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  sustained: 'kept burning',
  extinguished: 'went out',
  no_ignition: 'did not ignite',
  unknown: 'not recorded',
}

function fmtRange(range: [number, number] | null, unit: string): string {
  if (!range) return 'not tabulated'
  return range[0] === range[1] ? `${range[0]} ${unit}` : `${range[0]}–${range[1]} ${unit}`
}

export function InvestigationDrawer({
  open,
  mode,
  investigations,
  runs,
  onClose,
  onSelectProfile,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const tableCaptionId = useId()
  const [filterState, setFilterState] = useState<{ context: string; value: 'all' | Outcome }>({
    context: '',
    value: 'all',
  })

  // Sync open state with native showModal()
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Fallback light-dismiss for browsers lacking closedby="any" (per modern-web-guidance dialog guide)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return
    const outside = (e: PointerEvent, el: HTMLDialogElement) => {
      const r = el.getBoundingClientRect()
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    }
    let pressedOutside = false
    const onDown = (e: PointerEvent) => {
      pressedOutside = outside(e, dialog)
    }
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && outside(e, dialog)) dialog.close()
    }
    dialog.addEventListener('pointerdown', onDown)
    dialog.addEventListener('pointerup', onUp)
    return () => {
      dialog.removeEventListener('pointerdown', onDown)
      dialog.removeEventListener('pointerup', onUp)
    }
  }, [])

  const primary = investigations[0] ?? null
  const secondary = investigations[1] ?? null
  const modelIds = primary && profileModels[primary.id]
  const filterContext = `${mode}-${primary?.id ?? ''}-${secondary?.id ?? ''}`
  const outcomeFilter: 'all' | Outcome = filterState.context === filterContext ? filterState.value : 'all'
  const setOutcomeFilter = (value: 'all' | Outcome) => setFilterState({ context: filterContext, value })

  const primaryRuns = useMemo(() => {
    if (!primary) return []
    return runs.filter((r) => r.investigation === primary.id)
  }, [primary, runs])

  const filteredRuns = useMemo(() => {
    if (outcomeFilter === 'all') return primaryRuns
    return primaryRuns.filter((r) => r.outcome === outcomeFilter)
  }, [primaryRuns, outcomeFilter])

  const visibleRuns = filteredRuns.slice(0, 120)

  const compareRows: { label: string; a: string; b: string; differs: boolean }[] = useMemo(() => {
    if (mode !== 'compare' || !primary || !secondary) return []
    const rows = [
      { label: 'Fuel class', a: primary.fuel_class, b: secondary.fuel_class },
      { label: 'Safety pillar', a: primary.pillar, b: secondary.pillar },
      { label: 'Hardware family', a: primary.hardware, b: secondary.hardware },
      { label: 'Years active', a: primary.years || '—', b: secondary.years || '—' },
      { label: 'Run count', a: String(primary.n_runs), b: String(secondary.n_runs) },
      { label: 'Oxygen range', a: fmtRange(primary.o2_range, '% O₂'), b: fmtRange(secondary.o2_range, '% O₂') },
      { label: 'Pressure range', a: fmtRange(primary.pressure_range_kpa, 'kPa'), b: fmtRange(secondary.pressure_range_kpa, 'kPa') },
      { label: 'Fuels tested', a: primary.fuels, b: secondary.fuels },
      { label: 'Conditions', a: primary.conditions, b: secondary.conditions },
      { label: 'Variables', a: primary.variables, b: secondary.variables },
      { label: 'Sensors', a: primary.sensors, b: secondary.sensors },
    ]
    return rows.map((r) => ({ ...r, differs: r.a.trim().toLowerCase() !== r.b.trim().toLowerCase() }))
  }, [mode, primary, secondary])

  return (
    <dialog
      ref={dialogRef}
      className="drawer-dialog"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = ''
        onClose()
      }}
    >
      {primary && (
        <div className="drawer-shell">
          <header className="drawer-head">
            <div>
              <span className="drawer-eyebrow mono">
                {mode === 'compare' && secondary
                  ? `${primary.id} vs ${secondary.id}`
                  : `${primary.id} · ${primary.pillar} · ${primary.fuel_class}`}
              </span>
              <h2 id={titleId}>
                {mode === 'compare' && secondary
                  ? `Compare: ${primary.short || primary.id} vs ${secondary.short || secondary.id}`
                  : `${primary.name}`}
              </h2>
            </div>
            <button type="button" className="drawer-close" onClick={onClose} aria-label="Close dialog">
              Close ✕
            </button>
          </header>

          {mode === 'profile' && (
            <div className="drawer-body">
              <div className="profile-meta-strip">
                <span className="meta-pill">Hardware: {primary.hardware}</span>
                <span className="meta-pill">Years: {primary.years || '—'}</span>
                <span className="meta-pill mono">Runs: {primary.n_runs.toLocaleString()}</span>
                <span className="meta-pill mono">O₂: {fmtRange(primary.o2_range, '%')}</span>
                <span className="meta-pill mono">P: {fmtRange(primary.pressure_range_kpa, 'kPa')}</span>
                {primary.licence && <span className="meta-pill">Licence: {primary.licence}</span>}
              </div>

              <section className="profile-card-box">
                <h3>On Earth</h3>
                <StudyEarthLine studyId={primary.id} />
              </section>

              {open && modelIds && (
                <div className="study-models">
                  {profileModelNotes[primary.id] && <p className="muted-note">{profileModelNotes[primary.id]}</p>}
                  <ModelCollection key={primary.id} ids={modelIds} label="Choose a model" preview />
                </div>
              )}

              <div className="profile-grid">
                <section className="profile-card-box">
                  <h3>What the study looked at</h3>
                  <p>{primary.objective}</p>
                  <h3>What was burned</h3>
                  <p>{primary.fuels}</p>
                  <h3>Test conditions</h3>
                  <p>{primary.conditions}</p>
                </section>

                <section className="profile-card-box">
                  <h3>What researchers changed</h3>
                  <p>{primary.variables}</p>
                  <h3>How they measured it</h3>
                  <p>{primary.sensors}</p>

                </section>
              </div>

              {primary.findings.length > 0 && (
                <section className="profile-card-box">
                  <h3>Key documented findings</h3>
                  <ul className="findings-list">
                    {primary.findings.map((f) => (
                      <li key={`${f.cite}-${f.text}`}>
                        <span>{f.text}</span>
                        {f.cite && <span className="cite mono">{f.cite}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="profile-links">
                {primary.url && (
                  <a href={primary.url} target="_blank" rel="noopener noreferrer" className="ext-link">
                    NASA study page ↗
                  </a>
                )}
                {primary.doi && (
                  <a
                    href={primary.doi.startsWith('http') ? primary.doi : `https://doi.org/${primary.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ext-link"
                  >
                    DOI: {primary.doi} ↗
                  </a>
                )}
                {primary.profile_origin && (
                  <span className="origin-note">Record provenance: {primary.profile_origin}</span>
                )}
              </div>

              <section className="profile-runs-section">
                <div className="runs-header">
                  <h3 id={tableCaptionId}>
                    Test records ({filteredRuns.length.toLocaleString()}
                    {filteredRuns.length > visibleRuns.length ? `, showing first ${visibleRuns.length}` : ''})
                  </h3>
                  <div className="outcome-filters" role="group" aria-label="Filter runs by outcome">
                    {(['all', 'sustained', 'extinguished', 'no_ignition', 'unknown'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={outcomeFilter === key ? 'filter-pill on' : 'filter-pill'}
                        aria-pressed={outcomeFilter === key}
                        onClick={() => setOutcomeFilter(key)}
                      >
                        {key === 'all' ? 'All' : OUTCOME_LABEL[key]}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleRuns.length > 0 ? (
                  <div tabIndex={0} role="region" aria-labelledby={tableCaptionId} className="table-wrapper">
                    <table className="runs-table">
                      <caption className="visually-hidden">
                        Experimental runs for {primary.short}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Run ID</th>
                          <th scope="col">Fuel</th>
                          <th scope="col">O₂ (%)</th>
                          <th scope="col">Pressure (kPa)</th>
                          <th scope="col">Gravity</th>
                          <th scope="col">Outcome</th>
                          <th scope="col">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRuns.map((r) => {
                          const p = effectivePressure(r)
                          const isAssumed = r.pressure_kpa === null && r.pressure_assumed_kpa != null
                          return (
                            <tr key={r.id}>
                              <th scope="row" className="mono">{r.id}</th>
                              <td>{r.fuel}</td>
                              <td className="mono">{r.o2_pct !== null ? `${r.o2_pct} %` : 'Unavailable'}</td>
                              <td className="mono">
                                {p !== null
                                  ? isAssumed
                                    ? `${p.toFixed(1)} (assumed)`
                                    : p.toFixed(1)
                                  : 'Unavailable'}
                              </td>
                              <td className="mono">{r.gravity}</td>
                              <td>
                                <span className={`outcome-pill ${r.outcome}`}>
                                  {OUTCOME_LABEL[r.outcome]}
                                </span>
                              </td>
                              <td>
                                {r.source.url ? (
                                  <a href={r.source.url} target="_blank" rel="noopener noreferrer">
                                    row {r.source.row} ↗
                                  </a>
                                ) : (
                                  <span className="muted-note">
                                    {r.source.file}:{r.source.row}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted-note">
                    No tabulated runs match this filter (some PSI investigations such as Detection hardware studies do not include run-by-run combustion tables).
                  </p>
                )}
              </section>
            </div>
          )}

          {mode === 'compare' && secondary && (
            <div className="drawer-body">
              <div className="compare-actions">
                {onSelectProfile && (
                  <>
                    <button type="button" className="link-btn" onClick={() => onSelectProfile(primary.id)}>
                      Open {primary.short} full profile
                    </button>
                    <button type="button" className="link-btn" onClick={() => onSelectProfile(secondary.id)}>
                      Open {secondary.short} full profile
                    </button>
                  </>
                )}
              </div>

              <div tabIndex={0} role="region" aria-label="Side-by-side investigation comparison" className="table-wrapper compare-wrapper">
                <table className="compare-table">
                  <caption className="visually-hidden">
                    Side-by-side comparison of {primary.short} and {secondary.short}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">{primary.short} ({primary.id})</th>
                      <th scope="col">{secondary.short} ({secondary.id})</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row) => (
                      <tr key={row.label} className={row.differs ? 'row-differs' : ''}>
                        <th scope="row">{row.label}</th>
                        <td>{row.a}</td>
                        <td>{row.b}</td>
                        <td>
                          <span className={row.differs ? 'diff-badge' : 'same-badge'}>
                            {row.differs ? 'Δ differs' : '= match'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
