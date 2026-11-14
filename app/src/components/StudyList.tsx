import { useEffect, useId, useRef, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { Ranked, ReasonChip, ReasonFactor, ReasonVerdict } from '../data'
import type { Investigation, Pillar } from '../types'
import { profileModels } from '../three3d/placements'
import { ModelStill } from './ModelStill'
import { StudyEarthLine } from './StudyEarthLine'
import './study-list.css'

export interface StudyListProps {
  ranked: Ranked[]
  linkedStudies: Investigation[]
  total: number
  query: string
  onQueryChange: (q: string) => void
  pillar: 'all' | Pillar
  pillars: { id: 'all' | Pillar; label: string }[]
  onPillarChange: (p: 'all' | Pillar) => void
  /** Shown under the topic buttons, e.g. models for the selected topic. */
  topicAside?: ReactNode
  compareIds: string[]
  onToggleCompare: (id: string) => void
  onCompare: () => void
  onClearCompare: () => void
  onOpenProfile: (id: string) => void
}

const TOP_N = 5

/** Each word was checked against app/public/data/investigations.json: fabric 5, smoke 5, droplet 6, soot 9 studies. */
const EXAMPLES = ['fabric', 'smoke', 'droplet', 'soot']

const FACTORS: { id: ReasonFactor; label: string }[] = [
  { id: 'material', label: 'Material' },
  { id: 'oxygen', label: 'Oxygen' },
  { id: 'pressure', label: 'Pressure' },
  { id: 'gravity', label: 'Gravity' },
]

const VERDICTS: Record<ReasonVerdict, { glyph: string; label: string }> = {
  match: { glyph: '✓', label: 'Match' },
  mismatch: { glyph: '✗', label: 'No match' },
  assumed: { glyph: '?', label: 'Assumed, not recorded' },
  not_recorded: { glyph: '?', label: 'Not recorded' },
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function plural(n: number): string {
  return `${n} ${n === 1 ? 'study' : 'studies'}`
}

function FactorChip({ label, reason }: { label: string; reason: ReasonChip | undefined }) {
  // A factor with no chip or no verdict is shown as not recorded, never as a mismatch.
  const verdict: ReasonVerdict = reason?.verdict ?? 'not_recorded'
  const { glyph, label: verdictLabel } = VERDICTS[verdict]
  return (
    <li className="sl-chip" data-verdict={verdict}>
      <span className="sl-chip-mark" aria-hidden="true">{glyph}</span>
      <span className="sl-chip-body">
        <span className="sl-chip-factor">
          {label}
          <span className="sl-sr">: {verdictLabel}.</span>
        </span>
        <span className="sl-chip-text">{reason ? sentence(reason.text) : 'Not recorded'}</span>
      </span>
    </li>
  )
}

export function StudyList({
  ranked,
  linkedStudies,
  total,
  query,
  onQueryChange,
  pillar,
  pillars,
  onPillarChange,
  topicAside,
  compareIds,
  onToggleCompare,
  onCompare,
  onClearCompare,
  onOpenProfile,
}: StudyListProps): JSX.Element {
  const uid = useId()
  const inputId = `${uid}-search`
  const listId = `${uid}-list`
  const hintId = `${uid}-hint`
  const inputRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(false)

  const trimmed = query.trim()
  const filtering = trimmed.length > 0 || pillar !== 'all'
  const canCollapse = !filtering && ranked.length > TOP_N
  const visible = canCollapse && !expanded ? ranked.slice(0, TOP_N) : ranked
  const linkedIds = new Set(linkedStudies.map(({ id }) => id))
  const linkedOutsideList = linkedStudies.filter(({ id }) =>
    !visible.some((row) => row.investigation.id === id))
  const pillarLabel = pillars.find((p) => p.id === pillar)?.label

  // Collapse back to the top five whenever a filter is cleared.
  useEffect(() => {
    if (filtering) setExpanded(false)
  }, [filtering])

  const clearSearch = () => {
    onQueryChange('')
    inputRef.current?.focus()
  }

  let countLine = `Showing ${visible.length} of ${plural(total)}`
  if (trimmed) countLine += ` matching “${trimmed}”`
  if (pillar !== 'all' && pillarLabel) countLine += ` in ${pillarLabel}`
  if (!filtering) countLine += ', closest to your chosen place first'

  return (
    <div className="study-list">
      {linkedOutsideList.length > 0 && (
        <ul className="sl-linked" aria-label="Highlighted studies outside the current list">
          {linkedOutsideList.map((investigation) => (
            <li key={investigation.id} id={`study-${investigation.id}`} tabIndex={-1} data-linked="true">
              <div>
                <p className="metadata">Highlighted study · {investigation.id}</p>
                <h3>{investigation.short || investigation.name}</h3>
              </div>
              <button type="button" className="button quiet" onClick={() => onOpenProfile(investigation.id)}>View study</button>
            </li>
          ))}
        </ul>
      )}
      <form className="sl-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="sl-search-label" htmlFor={inputId}>Search NASA studies</label>
        <div className="sl-search-box">
          <svg className="sl-search-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M15.5 15.5 21 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault()
                onQueryChange('')
              }
            }}
            placeholder="Type a material, a hazard or a study name"
            aria-describedby={hintId}
          />
          {query && (
            <button type="button" className="sl-search-clear" onClick={clearSearch} aria-label="Clear search">
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <div className="sl-examples">
          <span id={hintId} className="sl-examples-label">Type any word, or try one:</span>
          {EXAMPLES.map((word) => (
            <button
              key={word}
              type="button"
              className="sl-example"
              aria-pressed={trimmed.toLowerCase() === word}
              aria-label={`Search for ${word}`}
              onClick={() => onQueryChange(word)}
            >
              {word}
            </button>
          ))}
        </div>
      </form>

      <div className="sl-topics" role="group" aria-label="Study topic">
        <span className="sl-topics-label" aria-hidden="true">Topic</span>
        {pillars.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="sl-topic"
            aria-pressed={pillar === id}
            onClick={() => onPillarChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {topicAside}

      <p className="sl-count" role="status" aria-live="polite">{countLine}.</p>

      {compareIds.length > 0 && (
        <div className="sl-compare-bar" role="region" aria-label="Compare studies">
          <span role="status">
            {compareIds.length === 1 ? 'Choose another study to compare.' : 'Two studies selected.'}
            <span className="sl-compare-ids"> {compareIds.join(' and ')}</span>
          </span>
          <span className="sl-compare-actions">
            {compareIds.length === 2 && (
              <button type="button" className="button primary" onClick={onCompare}>Compare studies</button>
            )}
            <button type="button" className="button quiet" onClick={onClearCompare}>Clear selection</button>
          </span>
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="sl-empty">
          <p className="sl-empty-title">
            {trimmed ? `No study mentions “${trimmed}”` : 'No studies in this topic'}
            {trimmed && pillar !== 'all' && pillarLabel ? ` in ${pillarLabel}` : ''}.
          </p>
          <p>
            {trimmed
              ? 'The search looks at study names, equipment, materials, goals and test conditions. Try a shorter word, or one of the examples above.'
              : 'Choose another topic to see more studies.'}
          </p>
          <div className="sl-empty-actions">
            {trimmed && <button type="button" className="button primary" onClick={clearSearch}>Clear search</button>}
            {pillar !== 'all' && (
              <button type="button" className="button quiet" onClick={() => onPillarChange('all')}>Show all topics</button>
            )}
          </div>
        </div>
      ) : (
        <ol className="sl-list" id={listId} aria-label="Ranked studies">
          {visible.map(({ investigation, reasons }, index) => {
            const { id } = investigation
            const selected = compareIds.includes(id)
            const locked = !selected && compareIds.length >= 2
            const model = profileModels[id]?.[0]
            const title = investigation.short || investigation.name
            const overall = reasons.find((r) => r.factor === 'overall')
            const keyword = reasons.find((r) => r.factor === 'keyword' && r.verdict === 'match')
            return (
              <li key={id} id={`study-${id}`} tabIndex={-1} className="sl-row" data-selected={selected ? 'true' : undefined}
                data-linked={linkedIds.has(id) || undefined}>
                <span className="sl-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span>
                {model && (
                  <div className="sl-thumb">
                    <ModelStill
                      id={model}
                      label={model === 'bass_ii_insert' && id !== 'PSI-25' ? 'BASS-II equipment illustration' : undefined}
                    />
                  </div>
                )}
                <div className="sl-main">
                  <span className="sl-id">{id}</span>
                  {linkedIds.has(id) && <span className="sl-linked-tag">Highlighted study</span>}
                  <h3 className="sl-title">{title}</h3>
                  {investigation.short && <p className="sl-name">{investigation.name}</p>}
                  {(overall || keyword) && (
                    <p className="sl-notes">
                      {overall && <span className="sl-note sl-note-strong">{sentence(overall.text)}</span>}
                      {keyword && <span className="sl-note">{sentence(keyword.text)}</span>}
                    </p>
                  )}
                  <div>
                    <strong className="study-earth-label">On Earth</strong>
                    <StudyEarthLine studyId={id} />
                  </div>
                  <ul className="sl-chips" aria-label={`Why ${id} is ranked here`}>
                    {FACTORS.map((factor) => (
                      <FactorChip
                        key={factor.id}
                        label={factor.label}
                        reason={reasons.find((r) => r.factor === factor.id)}
                      />
                    ))}
                  </ul>
                </div>
                <div className="sl-actions">
                  <button
                    type="button"
                    className="button quiet"
                    onClick={() => onOpenProfile(id)}
                    aria-label={`View study ${id}, ${title}`}
                  >
                    View study <span aria-hidden="true">→</span>
                  </button>
                  <label className="sl-compare" data-disabled={locked ? 'true' : undefined}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={locked}
                      onChange={() => onToggleCompare(id)}
                      aria-label={`Compare ${id}`}
                    />
                    <span>Compare</span>
                  </label>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {canCollapse && (
        <button
          type="button"
          className="button quiet sl-more"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show top five' : `Show all ${ranked.length} studies`}
        </button>
      )}

      <p className="sl-legend">
        <span><span className="sl-legend-mark" data-verdict="match" aria-hidden="true">✓</span> matches your chosen place</span>
        <span><span className="sl-legend-mark" data-verdict="mismatch" aria-hidden="true">✗</span> does not match</span>
        <span><span className="sl-legend-mark" data-verdict="not_recorded" aria-hidden="true">?</span> not recorded in the NASA source, or assumed</span>
      </p>
    </div>
  )
}
