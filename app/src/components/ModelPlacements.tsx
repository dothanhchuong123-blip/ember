// F3 placements: where each remaining 3D model explains something.
// Nothing here loads 3D until a visitor presses "Open 3D"; each card shows a still image first.
// Written with SI assistance; see AI-USE.md.
import type { JSX } from 'react'
import { ModelCollection, SuppressionModelComparison } from '../three3d/ModelViewer'
import { modelGroups } from '../three3d/placements'
import type { Pillar } from '../types'

interface SourceLink {
  label: string
  url: string
}

function Sources({ items }: { items: SourceLink[] }): JSX.Element {
  return (
    <ul className="source-list">
      {items.map((source) => (
        <li key={source.url}>
          <a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>
        </li>
      ))}
    </ul>
  )
}

/** Panel shown under the topic buttons when a pillar with models is selected. */
export function PillarModels({ pillar }: { pillar: 'all' | Pillar }): JSX.Element | null {
  if (pillar === 'prevention') {
    return (
      <section className="pillar-models" aria-labelledby="pillar-models-h">
        <div className="pillar-models-copy">
          <h3 id="pillar-models-h">What burns in a habitat</h3>
          <p>
            Preventing a fire starts with knowing the materials on board. These models show test-sample shapes and everyday crew items
            made of materials that can burn. They are illustrations, not records of any test.
          </p>
        </div>
        <ModelCollection ids={modelGroups.prevention} label="Choose a material or item" />
      </section>
    )
  }
  if (pillar === 'suppression') {
    return (
      <section className="pillar-models" aria-labelledby="pillar-models-h">
        <div className="pillar-models-copy">
          <h3 id="pillar-models-h">Two ways to put a fire out</h3>
          <p>
            A carbon dioxide extinguisher beside a water-mist extinguisher. The models show the hardware only. They say nothing about
            which one works better in a given place.
          </p>
        </div>
        <SuppressionModelComparison />
      </section>
    )
  }
  return null
}

const DROP_SOURCES: SourceLink[] = [
  { label: 'NASA Glenn 2.2 Second Drop Tower', url: 'https://www.nasa.gov/centers-and-facilities/glenn/2-2-second-drop-tower/' },
]

const TEST1_SOURCES: SourceLink[] = [
  { label: 'Hirsch et al. 2011, NASA-STD-6001 Test 1', url: 'https://ntrs.nasa.gov/citations/20110008636' },
  { label: 'Olson, Ruff and Miller 2008, NASA/TM-2008-215260', url: 'https://ntrs.nasa.gov/citations/20080034883' },
]

/** The two ground-test explainers and the Mars habitat concept card. */
export function TestExplainers(): JSX.Element {
  return (
    <div className="model-cards">
      <article className="model-card" aria-labelledby="explainer-drop-h">
        <h3 id="explainer-drop-h">How do you get microgravity on the ground?</h3>
        <p>
          You drop the whole experiment. While the rig falls freely, the flame inside it feels almost no gravity. NASA Glenn’s 2.2 Second
          Drop Tower is named for how long each drop lasts. Tests that need more time than a drop allows run in orbit.
        </p>
        <ModelCollection ids={modelGroups.microgravity} label="Choose drop hardware" />
        <Sources items={DROP_SOURCES} />
      </article>

      <article className="model-card" aria-labelledby="explainer-1g-h">
        <h3 id="explainer-1g-h">The standard 1 g test</h3>
        <p>
          NASA screens spacecraft materials with NASA-STD-6001 Test 1. A vertical sample is lit at the bottom inside a chamber and must go
          out by itself within 15 cm. On Earth, hot gas rises and pulls fresh air into the flame. In microgravity that flow is missing,
          and NASA has reported materials burning at lower oxygen levels than Test 1 predicts. A pass on the ground can overstate safety
          in space.
        </p>
        <ModelCollection ids={modelGroups.groundTest} label="Choose a model" />
        <Sources items={TEST1_SOURCES} />
      </article>

      <article className="model-card" aria-labelledby="concept-mars-h">
        <p className="model-card-kicker">Concept only · not on the evidence map</p>
        <h3 id="concept-mars-h">Mars habitat</h3>
        <p>
          EMBER has no sourced oxygen and pressure values for a Mars habitat, so it has no point on the evidence map and no evidence
          verdict. The model is an SI-generated concept from a text prompt. It is not a NASA design.
        </p>
        <ModelCollection ids={modelGroups.mars} label="Choose a Mars model" />
      </article>
    </div>
  )
}
