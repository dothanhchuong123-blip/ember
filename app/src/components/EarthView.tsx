// "On Earth" section: where NASA's microgravity combustion evidence applies on Earth, and where it does not.
// Uses Track E data and cited study summaries. Written with SI assistance; see AI-USE.md.
import type { JSX } from 'react'
import type { ReactNode } from 'react'
import type { EvidenceCard, Environment, FuelClass, Investigation, LocalFact, SourceLink, Spinoff } from '../types'
import { StudyEarthLine } from './StudyEarthLine'
import { ModelCollection, SuppressionModelComparison } from '../three3d/ModelViewer'
import { models, type ModelId } from '../three3d/models'
import { modelGroups } from '../three3d/placements'
import './earth-view.css'

export interface EarthViewProps {
  environments: Environment[]
  spinoffs: Spinoff[]
  evidenceCards: EvidenceCard[]
  localStory: LocalFact[]
  cardsStatus: ReactNode
  spinoffsStatus: ReactNode
  localStatus: ReactNode
  studiesStatus: ReactNode
  investigations: Investigation[]
  onOpenProfile: (id: string) => void
  currentEnvId: string
  onSelectPlace: (envId: string, fuel?: FuelClass) => void
}

const MOON_ID = 'moon-habitat'
const TWIN_ID = 'high-altitude-o2'

/** Fuel shown on the map for each "Show on map" button. Chosen from what the card data names:
 *  both compare cards relate to PSI-69 (droplet runs) and their gaps speak of "droplet or gas runs";
 *  the Kangding test burned cotton and polyester fabric (solid). */
const CARD_FUEL: Record<string, FuelClass> = {
  'oxygen-rich-medicine': 'droplet',
  'aircraft-cabin-cargo': 'droplet',
}

/** Spinoff that shows the ISS breathing apparatus as an illustration. */
const AIR_TANK_SPINOFF = 'air-tanks'
const SUPPRESSION_PAIR: readonly string[] = modelGroups.suppression

/** Models named in a card's metadata: the two extinguishers side by side, then any others (the breathing apparatus). */
function CardModels({ ids }: { ids: string[] }): JSX.Element | null {
  const known = ids.filter((id): id is ModelId => id in models)
  if (known.length === 0) return null
  const pair = SUPPRESSION_PAIR.every((id) => known.includes(id as ModelId))
  const others = pair ? known.filter((id) => !SUPPRESSION_PAIR.includes(id)) : known
  return (
    <div className="ev-models">
      <p className="ev-models-note">ISS hardware, shown as an illustration. These are not the devices used in hospitals.</p>
      {pair ? <SuppressionModelComparison /> : null}
      {others.length > 0 ? <ModelCollection ids={others} label="Choose a model" /> : null}
    </div>
  )
}

function range(value: [number, number] | null | undefined, unit: string): string {
  if (!value || value[0] == null || value[1] == null) return 'Not available'
  const [lo, hi] = value
  return lo === hi ? `${lo}${unit}` : `${lo}–${hi}${unit}`
}

function Sources({ items }: { items: SourceLink[] }): JSX.Element | null {
  if (!items || items.length === 0) return null
  return (
    <span className="ev-sources">
      <span className="ev-sources-label">{items.length === 1 ? 'Source: ' : 'Sources: '}</span>
      {items.map((s, i) => (
        <span key={s.url + i}>
          {i > 0 ? '; ' : ''}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.label}
          </a>
        </span>
      ))}
    </span>
  )
}

function SiLabel(): JSX.Element {
  return <span className="ev-si">SI-generated summary</span>
}

function MapButton(props: { onClick: () => void; current: boolean; placeName: string }): JSX.Element {
  return (
    <button type="button" className="ev-map-button" onClick={props.onClick} aria-label={`Show on map${props.current ? ' (selected)' : ''} · ${props.placeName}`}>
      Show on map{props.current ? ' (selected)' : ''}
    </button>
  )
}

export function EarthView(props: EarthViewProps): JSX.Element {
  const { environments, spinoffs, investigations, currentEnvId, onSelectPlace, onOpenProfile } = props
  const verifiedEnvs = environments.filter((e) => e.verified !== false)
  const envById = new Map(verifiedEnvs.map((e) => [e.id, e]))
  const moon = envById.get(MOON_ID)
  const twin = envById.get(TWIN_ID)

  const cards = props.evidenceCards.filter((card) => card.verified !== false)
  const local = props.localStory.filter((fact) => fact.verified !== false)

  const twinCard = (env: Environment, kicker: string, fuel?: FuelClass) => (
    <article className="ev-twin-card" aria-label={env.name}>
      <p className="ev-kicker">{kicker}</p>
      <h4 className="ev-card-title">{env.name}</h4>
      <dl className="ev-facts">
        <div>
          <dt>Oxygen</dt>
          <dd>{range(env.o2_pct, '%')}</dd>
        </div>
        <div>
          <dt>Pressure</dt>
          <dd>{range(env.pressure_kpa, ' kPa')}</dd>
        </div>
        <div>
          <dt>Gravity</dt>
          <dd>{env.gravity_g == null ? 'Not available' : `${env.gravity_g} g`}</dd>
        </div>
      </dl>
      <p className="ev-body">{env.why_it_matters}</p>
      <p className="ev-source-line">
        <Sources items={env.sources} />
      </p>
      <MapButton onClick={() => onSelectPlace(env.id, fuel)} current={currentEnvId === env.id} placeName={env.name} />
    </article>
  )

  return (
    <div className="earth-view">
      <p className="ev-limit">
        <strong>What does not carry over.</strong> On Earth, buoyancy shapes every flame. So the
        flame shapes and spread speeds measured in microgravity do not transfer to Earth. What does transfer is how oxygen and pressure
        change flammability, how materials rank against each other, and the detection and suppression technology built for spacecraft.
      </p>

      {moon && twin ? (
        <section className="ev-block" aria-labelledby="ev-twin-h">
          <h3 id="ev-twin-h" className="ev-h">
            The Moon habitat’s twin on Earth
          </h3>
          <p className="ev-lede">
            The air in these two places is similar in oxygen and pressure. Gravity is different, and that changes how a flame behaves, so
            this is a comparison of the air only.
          </p>
          <div className="ev-twin">
            {twinCard(moon, 'Space')}
            {twinCard(twin, 'Earth', 'solid')}
          </div>
        </section>
      ) : null}

      <section className="ev-block" aria-labelledby="ev-cards-h">
        <h3 id="ev-cards-h" className="ev-h">
          Where the evidence meets Earth
        </h3>
        {props.cardsStatus}
        {cards.length > 0 && (
          <div className="ev-cards">
            {cards.map((card) => {
              const isGap = card.mode === 'gap'
              const targetId = card.mode === 'compare' ? (card.environment_ids ?? []).find((id) => envById.has(id)) : undefined
              const target = targetId ? envById.get(targetId) : undefined
              const evidence = (card.evidence ?? []).filter((e) => e.verified !== false)
              return (
                <article key={card.id} className={isGap ? 'ev-card ev-card-gap' : 'ev-card'} aria-labelledby={`ev-card-${card.id}`}>
                  <header className="ev-card-head">
                    <h4 id={`ev-card-${card.id}`} className="ev-card-title">
                      {card.title}
                    </h4>
                    <span className="ev-tags">
                      {isGap ? <span className="ev-gap-tag">Evidence gap</span> : null}
                      {card.si_generated ? <SiLabel /> : null}
                    </span>
                  </header>
                  {isGap && card.gaps?.[0] ? <p className="ev-gap-lead">{card.gaps[0]}</p> : null}
                  <ul className="ev-list">
                    {evidence.map((e, i) => (
                      <li key={i}>
                        <span className="ev-body">{e.text}</span> <Sources items={e.sources} />
                      </li>
                    ))}
                  </ul>
                  {card.gaps && card.gaps.length > 0 ? (
                    <div className="ev-gaps">
                      <h5 className="ev-gaps-h">What this does not tell you</h5>
                      <ul className="ev-list">
                        {(isGap ? card.gaps.slice(1) : card.gaps).map((g, i) => (
                          <li key={i} className="ev-body">
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {card.model_ids && card.model_ids.length > 0 ? <CardModels ids={card.model_ids} /> : null}
                  {target ? (
                    <div className="ev-card-action">
                      <MapButton
                        onClick={() => onSelectPlace(target.id, CARD_FUEL[card.id])}
                        current={currentEnvId === target.id}
                        placeName={target.name}
                      />
                      <span className="ev-action-note">
                        {target.name}: {range(target.o2_pct, '%')} oxygen, {range(target.pressure_kpa, ' kPa')}
                      </span>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {props.spinoffsStatus}
      {spinoffs.length > 0 ? (
        <section className="ev-block" aria-labelledby="ev-spin-h">
          <h3 id="ev-spin-h" className="ev-h">
            Technology that already came down to Earth
          </h3>
          <ol className="ev-trail">
            {[...spinoffs]
              .sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity))
              .map((s) => {
                const si = (s as Spinoff & { si_generated?: boolean }).si_generated
                return (
                  <li key={s.id} className="ev-trail-item">
                    <p className="ev-year">{s.year ?? 'Year not available'}</p>
                    <h4 className="ev-card-title">{s.title}</h4>
                    <dl className="ev-trail-facts">
                      <dt>NASA origin</dt>
                      <dd>{s.nasa_origin}</dd>
                      <dt>Use on Earth</dt>
                      <dd>{s.earth_use}</dd>
                      <dt>Reported benefit</dt>
                      <dd>{s.benefit}</dd>
                    </dl>
                    {s.id === AIR_TANK_SPINOFF ? (
                      <div className="ev-models">
                        <p className="ev-models-note">
                          ISS hardware, shown as an illustration: the space station’s Portable Breathing Apparatus, not the firefighter
                          air tank.
                        </p>
                        <ModelCollection ids={modelGroups.breathingApparatus} label="Choose a model" />
                      </div>
                    ) : null}
                    <p className="ev-source-line">
                      {s.source_url ? (
                        <span className="ev-sources">
                          <span className="ev-sources-label">Source: </span>
                          <a href={s.source_url} target="_blank" rel="noreferrer">
                            NASA Spinoff{s.year ? ` (${s.year})` : ''}
                          </a>
                        </span>
                      ) : null}
                      {si ? <SiLabel /> : null}
                    </p>
                  </li>
                )
              })}
          </ol>
        </section>
      ) : null}

      {props.studiesStatus}
      {investigations.length > 0 && <details className="ev-study-applications">
        <summary>Earth applications by study ({investigations.length})</summary>
        <ul>
          {investigations.map(({ id, short, name }) => (
            <li key={id}>
              <button type="button" onClick={() => onOpenProfile(id)}>{short || name} · {id}</button>
              <StudyEarthLine studyId={id} />
            </li>
          ))}
        </ul>
      </details>}

      {props.localStatus}
      {local.length > 0 ? (
        <section className="ev-block" aria-labelledby="ev-local-h">
          <h3 id="ev-local-h" className="ev-h">
            Why fire in enclosed places matters
          </h3>
          <p className="ev-lede">
            These events are context only. They were not studied with NASA’s microgravity data, and nothing here suggests that data would
            have explained or prevented them.
          </p>
          <ul className="ev-local">
            {local.map((f) => (
              <li key={f.id} className="ev-local-item">
                <p className="ev-kicker">{f.geography}</p>
                <p className="ev-body">{f.text}</p>
                <p className="ev-source-line">
                  <Sources items={f.sources} />
                  {f.si_generated ? <SiLabel /> : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
