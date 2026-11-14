import { useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import type { CitedAnswerSummary, SummaryLine } from '../answerSummary'
import { BRIEF_LABEL, briefMarkdown, buildBrief } from '../brief'
import type { Brief } from '../brief'
import type { Ranked } from '../data'
import type { Dataset, Environment, FuelClass, Run } from '../types'
import './export-brief.css'

function BriefContents({ brief, titleId }: { brief: Brief; titleId?: string }) {
  function markers({ citeNumbers }: SummaryLine) {
    if (!citeNumbers.length) return null
    return (
      <span className="brief-markers">
        {' '}{citeNumbers.map((n) => {
          const source = brief.sources[n - 1]
          return source.url
            ? <a key={n} href={source.url} aria-label={`Citation ${n}, ${source.label}`}>[{n}]</a>
            : <span key={n}>[{n}]</span>
        })}
      </span>
    )
  }

  function line(item: SummaryLine) {
    return <>{item.text}{markers(item)}</>
  }

  return (
    <article className="brief-paper">
      <header className="brief-header">
        <p>EMBER evidence brief</p>
        <h2 id={titleId}>{brief.title}</h2>
        <p>{brief.fuelLabel} · <time dateTime={brief.date}>{brief.date}</time> · <strong>{BRIEF_LABEL}</strong></p>
        {brief.sample && <p>Sample data for preview.</p>}
      </header>
      <section>
        <h3>Atmosphere</h3>
        <p className="brief-atmosphere">{brief.atmosphere.map((item) => <span key={item.text}>{line(item)}</span>)}</p>
      </section>
      <div className="brief-answer">
        {brief.answer.map(({ title, lines }) => (
          <section key={title}>
            <h3>{title}</h3>
            {lines.map((item, index) => <p key={index}>{line(item)}</p>)}
          </section>
        ))}
      </div>
      <section>
        <h3>Top-ranked investigations</h3>
        {brief.studies.length ? (
          <ul className="brief-studies">
            {brief.studies.map(({ title, reasons }) => (
              <li key={title.text}>
                <strong>{line(title)}</strong>
                <ul className="brief-chips">
                  {reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        ) : <p>not reported</p>}
      </section>
      <section>
        <h3>Microgravity model</h3>
        <p>{line(brief.model)}</p>
      </section>
      <section>
        <h3>Citations</h3>
        <ol className="brief-sources">
          {brief.sources.map(({ label, url }, index) => (
            <li key={index}>{url ? <a href={url}>{label}</a> : label}</li>
          ))}
        </ol>
      </section>
    </article>
  )
}

export function ExportBrief({ env, fuel, fuelLabel, data, runs, ranked, getSummary }: {
  env: Environment
  fuel: FuelClass
  fuelLabel: string
  data: Dataset
  runs: Run[]
  ranked: Ranked[]
  getSummary: () => CitedAnswerSummary | null
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [brief, setBrief] = useState<Brief | null>(null)

  function openBrief() {
    const date = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
      .format(new Date())
    const snapshot = buildBrief({ env, fuel, fuelLabel, data, runs, ranked, summary: getSummary(), date })
    flushSync(() => setBrief(snapshot))
    dialog.current?.showModal()
  }

  function downloadMarkdown() {
    if (!brief) return
    const url = URL.createObjectURL(new Blob([briefMarkdown(brief)], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `ember-${env.id}-${fuel}.md`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <button type="button" className="button quiet brief-trigger" aria-haspopup="dialog" onClick={openBrief}>
        Export brief
      </button>
      {createPortal(
        <>
          <dialog ref={dialog} className="brief-dialog" aria-labelledby="export-brief-title" onClose={() => setBrief(null)}>
            {brief && (
              <>
                <div className="brief-actions">
                  <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
                  <button type="button" onClick={downloadMarkdown}>Download .md</button>
                  <button type="button" onClick={() => dialog.current?.close()}>Close</button>
                </div>
                <BriefContents brief={brief} titleId="export-brief-title" />
              </>
            )}
          </dialog>
          {brief && <div className="brief-print"><BriefContents brief={brief} /></div>}
        </>,
        document.body,
      )}
    </>
  )
}
