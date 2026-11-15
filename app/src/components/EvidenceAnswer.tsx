import { motion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import type { CitedAnswerSummary, CitedSource } from '../answerSummary'
import { scenarioFade } from '../motion'
import { AskBox } from './AskBox'
import './evidence-answer.css'

export interface CitationTarget {
  runIds: readonly string[]
  studyIds: readonly string[]
  mapStudyIds: readonly string[]
}

interface Props {
  scenario: string
  scenarioKey: string
  reduced: boolean
  summary: CitedAnswerSummary | null
  targets: ReadonlyMap<string, CitationTarget>
  activeSource?: CitedSource
  pinnedSourceId?: string
  selectedRun?: { id: string; studyId: string }
  matchedNumbers: ReadonlySet<number>
  showAirGap: boolean
  gapPinned: boolean
  onPreviewGap: (focus: boolean) => void
  onPinGap: () => void
  onShowStudy: (id: string) => void
  onPreview: (id: string | null) => void
  onPin: (id: string, showMap?: boolean) => void
  onClear: () => void
  asking: boolean
  onAsk: (question: string) => void
  askedNotice: ReactNode
  dataStatus: ReactNode
  exportAction: ReactNode
}

export function EvidenceAnswer({
  scenario, scenarioKey, reduced, summary, targets, activeSource, pinnedSourceId, selectedRun,
  matchedNumbers, showAirGap, gapPinned, onPreviewGap, onPinGap, onShowStudy, onPreview, onPin, onClear,
  asking, onAsk, askedNotice, dataStatus, exportAction,
}: Props) {
  const sourcesRef = useRef<HTMLDetailsElement>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const hasEvidenceFocus = Boolean(pinnedSourceId || selectedRun || gapPinned)
  const activeTarget = activeSource && targets.get(activeSource.id)

  function renderMarkers(numbers: number[]) {
    if (!numbers.length || !summary) return null
    return (
      <span className="cite-markers">
        {numbers.map((number) => {
          const source = summary.sources[number - 1]
          const label = `Citation ${number}, ${source.shortName}`
          const target = targets.get(source.id)
          return target ? (
            <button key={number} type="button" className="cite-marker" aria-pressed={pinnedSourceId === source.id}
              aria-label={`${label}. Highlight evidence`}
              data-active={activeSource?.id === source.id || matchedNumbers.has(number) || undefined}
              onPointerEnter={(event) => { if (event.pointerType !== 'touch') onPreview(source.id) }}
              onPointerLeave={(event) => { onPreview(event.currentTarget.matches(':focus-visible') ? source.id : null) }}
              onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) onPreview(source.id) }}
              onBlur={() => onPreview(null)}
              onClick={(event) => onPin(source.id, event.detail > 0 && Boolean(target.runIds.length || target.mapStudyIds.length))}>
              [{number}]
            </button>
          ) : (
            <a key={number} href={`#cited-source-${number}`} className="cite-reference" aria-label={label}
              onClick={() => { if (sourcesRef.current) sourcesRef.current.open = true }}>
              [{number}]
            </a>
          )
        })}
      </span>
    )
  }

  const isMatched = (numbers: number[]) => numbers.some((number) => matchedNumbers.has(number))
  const revealFullAnswer = summary?.columns.some(({ headline, bullets, fullClaims }) => {
    const shortNumbers = new Set([headline, ...bullets].flatMap((line) => line.sourceNumbers ?? line.citeNumbers))
    return fullClaims.some((line) => line.citeNumbers.some((number) => matchedNumbers.has(number) && !shortNumbers.has(number)))
  })

  function renderColumn(col: CitedAnswerSummary['columns'][number], lead = false) {
    return (
          <section className={[col.refusal && 'is-refusal', lead && 'answer-lead'].filter(Boolean).join(' ') || undefined} key={col.key}>
            <h3>{col.title}</h3>
            {col.refusal && <p className="refusal-tag"><i className="unknown-mark" aria-hidden="true" />No evidence here</p>}
            {col.refusal
              ? col.fullClaims.map((claim, index) => <p className="claim-headline" key={index}>{claim.text}</p>)
              : (
                <p className="claim-headline" data-cited-run={isMatched(col.headline.sourceNumbers ?? col.headline.citeNumbers) || undefined}>
                  {col.headline.text}{renderMarkers(col.headline.citeNumbers)}
                </p>
              )}
            {(col.refusal || (col.key === 'known' && showAirGap)) && gapLink}
            {!col.refusal && col.bullets.length > 0 && (
              <details className="claim-more" open={col.bullets.some((bullet) => isMatched(bullet.sourceNumbers ?? bullet.citeNumbers)) ? true : undefined}>
                <summary>{col.bullets.length} more {col.bullets.length === 1 ? 'point' : 'points'}</summary>
                <ul className="claim-bullets">
                  {col.bullets.map((bullet) => (
                    <li key={bullet.text} data-cited-run={isMatched(bullet.sourceNumbers ?? bullet.citeNumbers) || undefined}>
                      {bullet.text}{renderMarkers(bullet.citeNumbers)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
    )
  }

  const leadColumn = summary?.columns.find((col) => col.key === 'known') ?? summary?.columns[0]
  const supportColumns = summary?.columns.filter((col) => col !== leadColumn) ?? []

  const gapLink = (
    <a className="answer-gap-link" href="#evidence-plot"
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') onPreviewGap(true) }}
      onPointerLeave={(event) => onPreviewGap(event.currentTarget.matches(':focus-visible'))}
      onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) onPreviewGap(true) }}
      onBlur={() => onPreviewGap(false)}
      onClick={onPinGap}>
      {showAirGap ? 'See the gap on the map' : 'Locate these conditions on the map'} <span aria-hidden="true">↖</span>
    </a>
  )

  return (
    <section className="evidence-answer" id="answer" tabIndex={-1} aria-labelledby="answer-heading">
      <header className="answer-header">
        <p className="metadata">{scenario}</p>
        <h2 id="answer-heading">Evidence answer</h2>
        {exportAction}
      </header>
      <div className="answer-focus" hidden={!hasEvidenceFocus}>
        <p role="status">
          {activeSource && activeTarget
            ? <><strong>[{activeSource.number}]</strong> {activeSource.shortName}</>
            : selectedRun
              ? <><strong className="mono">{selectedRun.id}</strong> · {matchedNumbers.size ? 'Cited lines highlighted' : 'No citation in this answer'}</>
              : gapPinned && <strong>Selected conditions marked on the map</strong>}
        </p>
        {activeTarget && !activeTarget.runIds.length && !activeTarget.mapStudyIds.length && (
          <p>No plotted test for this citation in the selected material.</p>
        )}
        <div className="answer-actions">
          {activeTarget && Boolean(activeTarget.runIds.length || activeTarget.mapStudyIds.length) && (
            <a href="#evidence-plot">View map</a>
          )}
          {(activeTarget?.studyIds ?? (selectedRun ? [selectedRun.studyId] : [])).map((id) => (
            <button type="button" className="link-btn" key={id} onClick={() => onShowStudy(id)}>View {id}</button>
          ))}
          {hasEvidenceFocus && <button type="button" className="link-btn" onClick={onClear}>Clear highlight</button>}
        </div>
      </div>
      {/* Enter-only on purpose: an exit crossfade would stack two answers of different heights and jump the panel. */}
      <motion.div className="answer-body" key={scenarioKey} {...scenarioFade(reduced)}>
        {dataStatus}
        {!summary && showAirGap && gapLink}
        {askedNotice}
        {summary && <>
          {leadColumn && renderColumn(leadColumn, true)}
          <div className="answer-grid">
            {supportColumns.map((col) => renderColumn(col))}
          </div>
          <div className="answer-tools">
          {targets.size > 0 && <p className="answer-hint">Hover or focus a citation chip to trace it. Press it to keep the highlight.</p>}
          <details className="answer-disclosure" open={revealFullAnswer ? true : undefined}>
            <summary>Read the full cited answer</summary>
            <div className="full-answer-body">
              {summary.columns.map((col) => (
                <div key={col.key} className="full-answer-group">
                  <h4>{col.title}</h4>
                  {col.fullClaims.map((claim) => (
                    <p key={claim.text} data-cited-run={isMatched(claim.citeNumbers) || undefined}>
                      {claim.text}{renderMarkers(claim.citeNumbers)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </details>
          {summary.sources.length > 0 && (
            <details className="answer-disclosure" ref={sourcesRef} open={sourcesOpen}
              onToggle={(event) => setSourcesOpen(event.currentTarget.open)}>
              <summary>{sourcesOpen ? 'Hide' : 'Show'} {summary.sources.length} {summary.sources.length === 1 ? 'source' : 'sources'}</summary>
              <ol className="cited-source-list" aria-label="Cited sources">
                {summary.sources.map((source) => (
                  <li key={source.id} id={`cited-source-${source.number}`}>
                    <span className="cite-num">[{source.number}]</span>
                    <div>
                      <strong>{source.shortName}</strong>{' — '}
                      <span className="cite-desc">{source.description}</span>
                      {source.url && <a href={source.url} target="_blank" rel="noreferrer">Source ↗</a>}
                      {targets.has(source.id) && (
                        <button type="button" className="link-btn" onClick={() => {
                          onPin(source.id)
                        }}>Highlight evidence</button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          )}
          </div>
        </>}
      </motion.div>
      {summary && (
        <footer className="answer-footer">
          <details className="answer-disclosure">
            <summary>Ask your own question</summary>
            <AskBox busy={asking} onAsk={onAsk} />
          </details>
          <span className="metadata model-credit">SI-generated</span>
          <span className="visually-hidden" role="status">{asking ? 'Looking for an answer.' : ''}</span>
        </footer>
      )}
    </section>
  )
}
