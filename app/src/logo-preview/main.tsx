import { useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import { EmberLetterB, EmberReticle, EmberWordmark } from '../components/EmberLogo'
import '../index.css'
import { tokens } from '../tokens'
import './preview.css'

const concepts = [
  { key: 'reticle', letter: 'A', name: 'Reticle', description: 'A blue sphere inside a broken instrument ring.' },
  { key: 'wordmark', letter: 'B', name: 'Wordmark', description: 'The lower bowl of the B holds a small glowing dot.' },
  { key: 'boundary', letter: 'C', name: 'Boundary', description: 'A plotted point marks the bend in a boundary curve.' },
] as const

type Concept = (typeof concepts)[number]['key']

function Mark({ concept }: { concept: Concept }) {
  switch (concept) {
    case 'reticle':
      return <EmberReticle coreClassName="proof-dot" />
    case 'wordmark':
      return <g transform="translate(.6 -1.6) scale(1.1)"><EmberLetterB coreClassName="proof-dot" /></g>
    case 'boundary':
      return (
        <>
          <path d="M3 25c4.1 0 7.4-.8 10-3.25M21 10.4C23.2 7.5 25.7 6 29 6"
            fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <circle className="proof-dot" cx="17" cy="16" r="4.1" />
        </>
      )
  }
}

function HeaderLogo({ concept }: { concept: Concept }) {
  const isWordmark = concept === 'wordmark'
  return (
    <svg className="proof-lockup" width={isWordmark ? 116 : 157} height="32"
      viewBox={isWordmark ? '0 0 118 32' : '0 0 157 32'} role="img" aria-label="EMBER header logo">
      {!isWordmark && <Mark concept={concept} />}
      <g transform={isWordmark ? undefined : 'translate(41 0)'}>
        <EmberWordmark coreClassName={isWordmark ? 'proof-dot' : undefined} />
      </g>
    </svg>
  )
}

function Specimen({ concept, surface }: { concept: Concept; surface: 'dark' | 'light' }) {
  return (
    <div className="proof-surface" data-surface={surface}>
      <div className="proof-header">
        <span className="proof-caption">{surface} header</span>
        <HeaderLogo concept={concept} />
      </div>
      <div className="proof-favicon">
        <span className="proof-caption">16 px</span>
        <svg viewBox="0 0 32 32" width="16" height="16" role="img" aria-label="Favicon at actual size">
          <Mark concept={concept} />
        </svg>
      </div>
    </div>
  )
}

function LogoComparison() {
  const [monochrome, setMonochrome] = useState(false)

  return (
    <div className="logo-preview" data-monochrome={monochrome} style={{ '--proof-blue': tokens.color.emberBlue } as CSSProperties}>
      <header className="proof-bar">
        <div className="wrap">
          <a href={import.meta.env.BASE_URL}>← EMBER app</a>
          <span className="proof-caption">SI-generated concepts</span>
        </div>
      </header>
      <main className="wrap proof-main">
        <div className="proof-intro">
          <div>
            <h1>Three marks for EMBER</h1>
            <p>Compare the header logos and actual-size favicons.</p>
          </div>
          <fieldset className="proof-mode">
            <legend className="visually-hidden">Logo color mode</legend>
            <label>
              <input type="radio" name="color-mode" checked={!monochrome} onChange={() => setMonochrome(false)} />
              <span>Color</span>
            </label>
            <label>
              <input type="radio" name="color-mode" checked={monochrome} onChange={() => setMonochrome(true)} />
              <span>One color</span>
            </label>
          </fieldset>
        </div>
        <div className="proof-grid">
          {concepts.map(({ key, letter, name, description }) => (
            <section key={key} className="proof-concept" aria-labelledby={key}>
              <h2 id={key}><span>{letter}</span> {name}</h2>
              <p>{description}</p>
              <Specimen concept={key} surface="dark" />
              <Specimen concept={key} surface="light" />
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<LogoComparison />)
