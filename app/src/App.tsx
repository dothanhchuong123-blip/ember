import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { buildCitedAnswerSummary } from './answerSummary'
import { askLive, nearestCached } from './ask'
import { EvidenceMap } from './EvidenceMap'
import { DataStatus } from './components/DataStatus'
import { EnvThumbnail } from './components/EnvThumbnail'
import { ModelStill } from './components/ModelStill'
import { ScenarioNumber } from './components/ScenarioNumber'
import { SectionDetails } from './components/SectionDetails'
import { SectionNav } from './components/SectionNav'
import { StepHint } from './components/StepHint'
import { enterView, scenarioFade, scrollBehavior, useMotionPreference } from './motion'
import type { ModelId } from './three3d/models'
import { InvestigationDrawer } from './components/InvestigationDrawer'
import { EvidenceAnswer, type CitationTarget } from './components/EvidenceAnswer'
import { ExportBrief } from './components/ExportBrief'
import { EarthView } from './components/EarthView'
import { FlameCompare } from './components/FlameCompare'
import { StudyList } from './components/StudyList'
import { ModelCollection } from './three3d/ModelViewer'
import { PillarModels, TestExplainers } from './components/ModelPlacements'
import { GravityFlame } from './components/GravityFlame'
import { ScenarioBar } from './components/ScenarioBar'
import { environmentModels, modelGroups } from './three3d/placements'
import { distanceToRange, effectivePressure, rankInvestigations, runInEnvironment, type DataKey } from './data'
import { useAppData } from './useAppData'
import type { Answer, Environment, FuelClass, Pillar, Run } from './types'

const FUELS: { id: FuelClass; label: string; example: string }[] = [
  { id: 'solid', label: 'Solid materials', example: 'Plastic, fabric and more' },
  { id: 'droplet', label: 'Liquid droplets', example: 'Tiny drops of liquid fuel' },
  { id: 'gas', label: 'Gas flames', example: 'Burning gases like methane' },
]

const PILLARS: { id: 'all' | Pillar; label: string }[] = [
  { id: 'all', label: 'All topics' },
  { id: 'prevention', label: 'Preventing fires' },
  { id: 'detection', label: 'Detecting fires' },
  { id: 'suppression', label: 'Putting out fires' },
  { id: 'fundamentals', label: 'How fire behaves' },
]

const PLACE_NAMES: Record<string, string> = {
  iss: 'Space station',
  'moon-habitat': 'Moon habitat',
  'lunar-rover': 'Moon rover',
  'hospital-o2': 'Hospital oxygen',
  hyperbaric: 'Pressurized treatment chamber',
  airliner: 'Airplane cabin',
}

const PLACE_STILLS: Partial<Record<string, { id: ModelId; label?: string; zoom?: number; originY?: string }>> = {
  'moon-habitat': { id: 'lunar_hab', zoom: 1.16, originY: '58%' },
  iss: { id: 'gateway', label: 'Space station concept', zoom: 1.68, originY: '52%' },
  'lunar-rover': { id: 'lunar_rover', zoom: 1.5, originY: '56%' },
  hyperbaric: { id: 'chamber', label: 'Pressure chamber illustration' },
}

const phoneLayout = matchMedia('(max-width: 700px)')

function subscribeToLayout(onChange: () => void) {
  phoneLayout.addEventListener('change', onChange)
  return () => phoneLayout.removeEventListener('change', onChange)
}

const CLOSE_O2_POINTS = 2
const CLOSE_PRESSURE_FACTOR = 1.25
const NO_IDS: readonly string[] = []

function placeName(env: Environment) {
  return PLACE_NAMES[env.id] ?? env.name
}

function formatRange([start, end]: [number, number], unit: string) {
  return start === end ? `${start}${unit}` : `${start}–${end}${unit}`
}

function countTests(n: number) {
  return `${n.toLocaleString()} ${n === 1 ? 'test' : 'tests'}`
}

function showEvidencePlot() {
  const plot = document.getElementById('evidence-plot')
  if (!plot) return
  const bounds = plot.getBoundingClientRect()
  const headerHeight = document.querySelector('.site-header')?.clientHeight ?? 0
  if (bounds.top >= headerHeight && bounds.bottom <= window.innerHeight) return
  plot.scrollIntoView({ block: 'start', behavior: scrollBehavior() })
  plot.focus({ preventScroll: true })
}

/** Plotted tests near a place's air, using the "close" scale fixed in ml/MODEL-CARD.md, and the subset at its gravity. */
function closeToPlace(plotted: Run[], env: Environment) {
  const closeAir = plotted.filter((run) => {
    const pressure = effectivePressure(run) as number
    return distanceToRange(run.o2_pct as number, env.o2_pct) <= CLOSE_O2_POINTS
      && pressure >= env.pressure_kpa[0] / CLOSE_PRESSURE_FACTOR
      && pressure <= env.pressure_kpa[1] * CLOSE_PRESSURE_FACTOR
  })
  return { closeAir, closeGravity: closeAir.filter((run) => env.gravity_g === Number(run.gravity[0])) }
}

function hasAirOnRecord(run: Run) {
  return run.o2_pct !== null && effectivePressure(run) !== null
}

const QUICK_PLACES = ['moon-habitat', 'iss', 'hospital-o2', 'airliner']

/* Hero finding: one plain sentence built from the live hook counts. `atGravity` is a subset of `near`
   (closeToPlace filters closeAir by gravity). A null count is unknown and is said so, never shown as 0. */
function heroFinding(
  counts: { plotted: number | null; near: number | null; atGravity: number | null },
  words: { tests: string; air: string; gravity: string },
): ReactNode {
  const { plotted, near, atGravity } = counts
  const n = (value: number) => <strong>{value.toLocaleString()}</strong>
  const pool = plotted === null
    ? <>the {words.tests} tests</>
    : <>the {n(plotted)} {words.tests} {plotted === 1 ? 'test' : 'tests'}</>
  if (plotted === 0) return <>No {words.tests} tests with air on record yet, so none ran close to {words.air}.</>
  if (near === null) return <>How many of {pool} ran close to {words.air} is not known.</>
  if (near === 0) return <><strong>None</strong> of {pool} ran close to {words.air}.</>
  const lead = plotted !== null && near === plotted && near > 1
    ? <>All {pool} ran close to {words.air}</>
    : <>{n(near)} of {pool} ran close to {words.air}</>
  const one = near === 1
  if (atGravity === null) return <>{lead}; whether {one ? 'it was' : 'any were'} also at {words.gravity} is not known.</>
  if (atGravity === 0) return <>{lead}, but {one ? 'not' : <><strong>none</strong> of them</>} at {words.gravity}.</>
  if (atGravity === near) return <>{lead}, and {one ? 'it was' : near === 2 ? 'both were' : 'all of them were'} also at {words.gravity}.</>
  return <>{lead}, and {n(atGravity)} of them also at {words.gravity}.</>
}

function isCabinTest(run: Run) {
  return !run.flags.some((flag) =>
    flag === 'inverse_flame_o2_is_burner_stream' ||
    flag === 'summary_matrix_not_single_run' ||
    flag === 'duplicate_row_in_source',
  )
}

/** An answer to a typed question: live from /api/ask, or the nearest saved answer when the service is off. */
interface Asked {
  question: string
  answer: Answer
  kind: 'live' | 'saved'
  notice: string
}

function PlaceStill({ place }: { place: Environment }) {
  const still = PLACE_STILLS[place.id]
  return still ? <ModelStill {...still} compact /> : <EnvThumbnail id={place.id} domain={place.domain} />
}

function SelectedStill({ place, reduced }: { place: Environment; reduced: boolean }) {
  const present = useIsPresent()
  return (
    <motion.div className="selected-still-frame" aria-hidden={!present || undefined}
      {...scenarioFade(reduced, { rise: 0, from: 0 })} exit={{ opacity: 0 }}>
      <PlaceStill place={place} />
    </motion.div>
  )
}

function VerdictMessage({ label, headline, note, reduced }: {
  label: string; headline: string; note: string; reduced: boolean
}) {
  return (
    <div className="verdict-message">
      <motion.div key={`${label}|${headline}`} className="verdict-title"
        {...scenarioFade(reduced)}>
        <p className="metadata verdict-label">{label}</p>
        <h3 className="verdict-headline">{headline}</h3>
      </motion.div>
      <details className="verdict-more">
        <summary>Show details</summary>
        <p className="verdict-note">{note}</p>
      </details>
    </div>
  )
}

function MaterialOptions({ fuel, name, onSelect }: {
  fuel: FuelClass; name: string; onSelect: (fuel: FuelClass) => void
}) {
  return (
    <div className="fuel-options">
      {FUELS.map((option) => (
        <label className="choice fuel-choice" key={option.id}>
          <input type="radio" name={name} checked={fuel === option.id} onChange={() => onSelect(option.id)} />
          <span><strong>{option.label}</strong><small>{option.example}</small></span>
          <span className="fuel-indicator" aria-hidden="true" />
        </label>
      ))}
    </div>
  )
}

function PlacePicker({ environments, env, onSelect }: {
  environments: Environment[]
  env: Environment
  onSelect: (id: string) => void
}) {
  const featured = (env.domain === 'space' ? ['moon-habitat', 'iss', 'lunar-rover'] : ['hospital-o2', 'airliner', 'hyperbaric'])
    .map((id) => environments.find((place) => place.id === id))
    .filter((place): place is Environment => Boolean(place))
  const domainPlaces = environments.filter((place) => place.domain === env.domain)
  const options = featured.length > 0 ? featured : domainPlaces.slice(0, 3)
  if (!options.some((place) => place.id === env.id)) options[options.length - 1] = env

  return (
    <fieldset className="picker">
      <legend><span className="step-num" aria-hidden="true">1</span>Pick a place</legend>
      <div className="segmented" role="group" aria-label="Place type">
        {(['space', 'earth'] as const).map((domain) => {
          const first = environments.find((place) => place.id === (domain === 'space' ? 'moon-habitat' : 'hospital-o2'))
            ?? environments.find((place) => place.domain === domain)
          return first && (
            <button key={domain} type="button" aria-pressed={env.domain === domain}
              onClick={() => { if (env.domain !== domain) onSelect(first.id) }}>
              <span className={`flame-glyph ${domain}`} aria-hidden="true" />
              {domain === 'space' ? 'In space' : 'On Earth'}
            </button>
          )
        })}
      </div>
      <div className="place-options">
        {options.map((place) => {
          const selected = env.id === place.id
          return (
            <label className="place-option choice" key={place.id}>
              <input type="radio" name="place" aria-label={placeName(place)} checked={selected} onChange={() => onSelect(place.id)} />
              <div className="place-media">
                <PlaceStill place={place} />
              </div>
              <div className="place-card-body">
                <span className="place-name">{placeName(place)}</span>
                <span className="place-specs mono">
                  {formatRange(place.o2_pct, '% O₂')} · {formatRange(place.pressure_kpa, ' kPa')} · {place.gravity_g} g
                </span>
              </div>
              <span aria-hidden="true" className="place-selection" />
            </label>
          )
        })}
      </div>
      <label className="more-places" htmlFor="more-places-select">
        <span>All {env.domain === 'space' ? 'space' : 'Earth'} places</span>
        <select id="more-places-select" value={env.id} onChange={(event) => onSelect(event.target.value)}>
          {domainPlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
        </select>
      </label>
    </fieldset>
  )
}

function PlaceModels({ ids }: { ids: NonNullable<(typeof environmentModels)[string]> }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="place-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Models for this place</summary>
      {open && <ModelCollection ids={ids} label="Choose a model" />}
    </details>
  )
}

function App() {
  const compact = useSyncExternalStore(subscribeToLayout, () => phoneLayout.matches)
  const reduced = useMotionPreference()
  const { data, states, retry } = useAppData()
  const fileStatus = (file: DataKey) => <DataStatus file={file} state={states[file]} retry={retry} />
  const [envId, setEnvId] = useState(() => new URLSearchParams(location.search).get('env') ?? 'moon-habitat')
  const [fuel, setFuel] = useState<FuelClass>(() => {
    const value = new URLSearchParams(location.search).get('fuel')
    return value === 'gas' || value === 'droplet' ? value : 'solid'
  })
  const [pillar, setPillar] = useState<'all' | Pillar>('all')
  const [query, setQuery] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [evidenceFocus, setEvidenceFocus] = useState<{ source: string } | { run: Run } | { gap: true } | null>(null)
  // A citation chip under the pointer or keyboard focus: highlights its dots until the pointer or focus leaves.
  const [previewCiteId, setPreviewCiteId] = useState<string | null>(null)
  const [previewGap, setPreviewGap] = useState(false)
  const [asked, setAsked] = useState<Asked | null>(null)
  const [asking, setAsking] = useState(false)
  const askSeq = useRef(0)
  const [modelsOpen, setModelsOpen] = useState(false)

  const coreReady = states.environments === 'ready' && states.runs === 'ready'

  useEffect(() => {
    if (!coreReady) return
    // Page load jumps straight to the linked section; later link clicks scroll there smoothly (unless reduced motion).
    const reveal = (smooth: boolean) => {
      const section = document.getElementById(location.hash.slice(1))
      const details = section?.querySelector<HTMLDetailsElement>('.section-details')
      if (details) details.open = true
      if (section?.closest('main')) section.scrollIntoView({ behavior: smooth ? scrollBehavior() : 'auto' })
    }
    reveal(false)
    const onHashChange = () => reveal(true)
    const followLink = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      const link = event.target instanceof Element ? event.target.closest('a') : null
      if (link?.hash === location.hash) reveal(true)
    }
    window.addEventListener('hashchange', onHashChange)
    document.addEventListener('click', followLink)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      document.removeEventListener('click', followLink)
    }
  }, [coreReady])

  const environments = useMemo(() => data.environments.filter((env) => env.verified), [data.environments])
  const env = environments.find((place) => place.id === envId) ?? environments[0]
  const runs = useMemo(() => data.runs.filter(isCabinTest), [data.runs])
  const fuelRuns = useMemo(() => runs.filter((run) => run.fuel_class === fuel), [runs, fuel])
  // Same test the evidence map applies before it draws a dot: oxygen and a pressure (measured or assumed) on record.
  const plottedRuns = useMemo(() => fuelRuns.filter(hasAirOnRecord), [fuelRuns])
  // runInEnvironment is an exact range test: oxygen and pressure both inside the place's range, no tolerance.
  const sameAir = plottedRuns.filter((run) => env && runInEnvironment(run, env))
  // "Close" uses the scale fixed in ml/MODEL-CARD.md for the support score: 2 oxygen points and a factor 1.25 in pressure.
  const { closeAir, closeGravity } = env ? closeToPlace(plottedRuns, env) : { closeAir: [], closeGravity: [] }
  // Hero hook: the Moon habitat with solid materials, computed from the same records and rule as the verdict below.
  const moonHook = useMemo(() => {
    const moon = environments.find((place) => place.id === 'moon-habitat')
    if (!moon) return null
    const solids = runs.filter((run) => run.fuel_class === 'solid' && hasAirOnRecord(run))
    const { closeAir: near, closeGravity: atGravity } = closeToPlace(solids, moon)
    return { plotted: solids.length, near: near.length, atGravity: atGravity.length }
  }, [environments, runs])
  const assumedAir = closeAir.filter((run) => run.pressure_kpa === null).length
  const assumedGravity = closeGravity.filter((run) => run.pressure_kpa === null).length
  const scenarioRanked = useMemo(() => env
    ? rankInvestigations(data.investigations, runs, env, fuel)
    : [], [data.investigations, env, runs, fuel])
  const ranked = useMemo(() => {
    if (!env) return []
    const all = query.trim() ? rankInvestigations(data.investigations, runs, env, fuel, query) : scenarioRanked
    // The ranking only re-orders on a keyword, so a search keeps the studies whose own fields contain a search word.
    const list = query.trim()
      ? all.filter(({ reasons }) => reasons.some((reason) => reason.factor === 'keyword' && reason.verdict === 'match'))
      : all
    return pillar === 'all' ? list : list.filter(({ investigation }) => investigation.pillar === pillar)
  }, [data.investigations, env, runs, fuel, query, pillar, scenarioRanked])

  const cachedAnswer = env && data.answers[`${env.id}|${fuel}`]
  const answer = asked?.answer ?? cachedAnswer
  const runById = useMemo(() => new Map(data.runs.map((run) => [run.id, run])), [data.runs])
  const investigationById = useMemo(() => new Map(data.investigations.map((study) => [study.id, study])), [data.investigations])
  const passageById = useMemo(() => new Map(data.passages.map((passage) => [passage.id, passage])), [data.passages])
  const envByCitation = useMemo(() => new Map(data.environments.map((place) => [`env:${place.id}`, place])), [data.environments])
  const summarize = useCallback((answer: Answer) => buildCitedAnswerSummary({
    answer, fuel, fuelRuns, isCabinTest, placeNames: PLACE_NAMES, runById, investigationById, passageById, envByCitation,
  }), [fuel, fuelRuns, runById, investigationById, passageById, envByCitation])
  const citedSummary = useMemo(() => answer && states.passages === 'ready' ? summarize(answer) : null, [answer, states.passages, summarize])

  // These UI targets reuse the source IDs and explicit study references. The answer and brief keep their original citations.
  const citationTargets = useMemo(() => {
    const targets = new Map<string, CitationTarget>()
    const plottedIds = new Set(plottedRuns.map((run) => run.id))
    const plottedStudies = new Set(plottedRuns.map((run) => run.investigation))
    for (const source of citedSummary?.sources ?? []) {
      const run = runById.get(source.id)
      const passageStudyId = /^psi:(PSI-\d+):/.exec(source.id)?.[1]
      const passage = passageById.get(source.id)
      const referencedRuns = run ? [run] : [...(passage?.text?.matchAll(/\bPSI-\d+(?::[\w.-]+)+/g) ?? [])]
        .map(([id]) => runById.get(id.replace(/\.$/, '')))
        .filter((record): record is Run => record !== undefined)
      const spinoff = data.spinoffs.find((item) => source.id === `spinoff:${item.id}`)
      const studyTargets = [
        ...new Set([
          source.id, passageStudyId,
          ...referencedRuns.map((item) => item.investigation),
          ...data.investigations.filter((study) => study.findings.some((finding) => finding.cite === source.id)).map((study) => study.id),
          ...(spinoff?.linked_investigations ?? []),
        ].filter((id): id is string => Boolean(id && investigationById.has(id)))),
      ]
      const runIds = [...new Set(referencedRuns.map((item) => item.id).filter((id) => plottedIds.has(id)))]
      const mapStudyIds = referencedRuns.length ? NO_IDS : studyTargets.filter((id) => plottedStudies.has(id))
      if (runIds.length || studyTargets.length) targets.set(source.id, { runIds, studyIds: studyTargets, mapStudyIds })
    }
    return targets
  }, [citedSummary, data.investigations, data.spinoffs, investigationById, passageById, plottedRuns, runById])

  const pinnedSourceId = evidenceFocus && 'source' in evidenceFocus ? evidenceFocus.source : undefined
  const selectedRun = evidenceFocus && 'run' in evidenceFocus ? evidenceFocus.run : undefined
  const gapPinned = Boolean(evidenceFocus && 'gap' in evidenceFocus)
  const activeSource = citedSummary?.sources.find((source) => source.id === (previewCiteId ?? pinnedSourceId))
  const activeTarget = activeSource && citationTargets.get(activeSource.id)
  const citedNumbersForRun = useCallback((run: Run) => {
    const matches = citedSummary?.sources.filter((source) => {
      const target = citationTargets.get(source.id)
      return source.id === run.id || target?.runIds.includes(run.id) || target?.mapStudyIds.includes(run.investigation)
    })
    return new Set(matches?.map((source) => source.number))
  }, [citationTargets, citedSummary])
  const matchedNumbers = useMemo(() => selectedRun ? citedNumbersForRun(selectedRun) : new Set<number>(), [citedNumbersForRun, selectedRun])
  const citedRun = useCallback((run: Run) => citedNumbersForRun(run).size > 0, [citedNumbersForRun])
  const linkedStudyIds = activeTarget?.studyIds ?? (selectedRun ? [selectedRun.investigation] : NO_IDS)
  const highlightedRunIds = activeTarget?.runIds ?? (selectedRun ? [selectedRun.id] : NO_IDS)
  const linkedStudies = linkedStudyIds.map((id) => investigationById.get(id))
    .filter((study) => study !== undefined)

  useEffect(() => {
    if (!env) return
    const url = new URL(location.href)
    url.searchParams.set('env', env.id)
    url.searchParams.set('fuel', fuel)
    history.replaceState(null, '', url)
  }, [env, fuel])

  const openProfile = useCallback((id: string) => {
    setCompareOpen(false)
    setProfileId(id)
  }, [])

  function clearEvidenceFocus() {
    setEvidenceFocus(null)
    setPreviewCiteId(null)
    setPreviewGap(false)
  }

  const selectRun = useCallback((run: Run) => {
    setEvidenceFocus({ run })
    setPreviewCiteId(null)
    setPreviewGap(false)
  }, [])

  function changeScenario() {
    clearEvidenceFocus()
    setCompareIds([])
    setAsked(null)
    askSeq.current += 1
    setAsking(false)
  }

  function selectPlace(id: string) {
    if (env?.id === id) return
    changeScenario()
    setEnvId(id)
  }

  function selectMaterial(id: FuelClass) {
    if (fuel === id) return
    changeScenario()
    setFuel(id)
  }

  async function ask(question: string) {
    if (!env) return
    const seq = ++askSeq.current
    setAsking(true)
    const result = await askLive(question)
    if (seq !== askSeq.current) return
    setAsking(false)
    clearEvidenceFocus()
    const label = (id: string, material: FuelClass) => {
      const place = environments.find((item) => item.id === id)
      return `${place ? placeName(place) : id} / ${FUELS.find((option) => option.id === material)?.label ?? material}`
    }
    if (result.ok) {
      // Move the map to the place and material the service read from the question, when it is one this page shows.
      const place = environments.find((item) => item.id === result.environmentId)
      if (place) setEnvId(place.id)
      if (result.fuel) setFuel(result.fuel)
      setAsked({
        question,
        answer: result.answer,
        kind: 'live',
        notice: result.mode.startsWith('live-')
          ? 'Answered just now by a language model that may only use the records and sources on this page. Sentences with a number and no valid citation are removed before you see them.'
          : 'Answered just now by the EMBER server from its evidence records, using fixed rules and no language model.',
      })
      return
    }
    const match = nearestCached(question, environments, data.answers, { environmentId: env.id, fuel })
    const saved = data.answers[`${match.environmentId}|${match.fuel}`]
    if (!saved) return
    const why = result.reason === 'rate-limited'
      ? `Too many questions were sent in a short time${result.retryAfterSec ? `, so try again in about ${result.retryAfterSec} seconds` : ''}.`
      : result.reason === 'error'
        ? 'The live answer service returned an error.'
        : 'The live answer service is not available right now.'
    const what = match.placeFrom === 'selection' && match.fuelFrom === 'selection'
      ? `Your question did not name a place or material this page recognises, so this is the saved answer for your current selection, ${label(match.environmentId, match.fuel)}. It may not answer what you asked.`
      : `This is the closest saved answer instead, for ${label(match.environmentId, match.fuel)}${match.placeFrom === 'air-values' ? ' (the saved place closest to the oxygen or pressure in your question)' : ''}. It was written before you asked, so it may not address your exact wording.`
    setEnvId(match.environmentId)
    setFuel(match.fuel)
    setAsked({ question, answer: saved, kind: 'saved', notice: `${why} ${what}` })
  }

  const header = <><SectionNav reduced={reduced} /><StepHint /></>

  function jumpToPlace(id: string, nextFuel?: FuelClass) {
    if (env?.id !== id) { changeScenario(); setEnvId(id) }
    if (nextFuel && nextFuel !== fuel) { changeScenario(); setFuel(nextFuel) }
    document.getElementById('explore')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
  }

  const quickPlaces = QUICK_PLACES.map((id) => environments.find((place) => place.id === id))
    .filter((place): place is Environment => Boolean(place))

  const hero = (
    <div className="hero-band">
      <section className="hero wrap grid-12" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="hero-kicker">Flame in Freefall · NASA Space Apps 2026</p>
          <h1 id="hero-heading">If a fire starts in a <em>Moon habitat</em>, what will it do?</h1>
          <p className="hero-lede">
            NASA has run hundreds of fire experiments in space. EMBER shows what that evidence says about any place
            where people breathe, and <strong>where the evidence stops</strong>.
          </p>
          {coreReady && moonHook && (
            <div className="hero-evidence">
              <dl className="hero-stats" aria-label="NASA evidence for a Moon habitat, solid materials">
                <div><dt>NASA test records</dt><dd className="mono">{runs.length.toLocaleString()}</dd></div>
                <div><dt>Solid-material tests with air on record</dt><dd className="mono">{moonHook.plotted.toLocaleString()}</dd></div>
              </dl>
              <p className="hero-finding">
                {heroFinding(moonHook, { tests: 'solid-material', air: 'Moon-habitat air', gravity: 'Moon gravity' })}
              </p>
            </div>
          )}
          <div className="hero-actions">
            <button type="button" className="button primary" onClick={() => jumpToPlace('moon-habitat', 'solid')}>
              Check the Moon habitat <span aria-hidden="true">↓</span>
            </button>
            <a className="button quiet" href="#flames">Why fire is different in space</a>
          </div>
          {quickPlaces.length > 0 && (
            <div className="hero-places">
              <span className="metadata">Or start from</span>
              <ul>
                {quickPlaces.map((place) => (
                  <li key={place.id}>
                    <button type="button" className="hero-place" onClick={() => jumpToPlace(place.id)}>
                      <span className={`flame-glyph ${place.domain}`} aria-hidden="true" />
                      <span>
                        <strong>{placeName(place)}</strong>
                        <small className="mono">{formatRange(place.o2_pct, '% O₂')} · {formatRange(place.pressure_kpa, ' kPa')}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <figure className="hero-art hero-flame">
          <GravityFlame />
          <figcaption>
            <span className="metadata">Drag gravity · the candle answers</span>
            <button type="button" className="hero-model-button" aria-expanded={modelsOpen} aria-controls="space-models" onClick={() => setModelsOpen(!modelsOpen)}>
              {modelsOpen ? 'Hide 3D models' : 'See the Moon habitat in 3D'} <span aria-hidden="true">{modelsOpen ? '−' : '↗'}</span>
            </button>
          </figcaption>
        </figure>
      </section>
    </div>
  )

  if (!coreReady || !env) return (
    <div className="page" data-domain={env?.domain ?? 'space'}>
      <a href="#explore" className="skip-link visually-hidden">Skip to data status</a>
      {header}
      <main id="top">
        {hero}
        <section id="space-models" hidden={!modelsOpen} className="space-models wrap" aria-label="Spacecraft models">
          {modelsOpen && <ModelCollection ids={modelGroups.hero} label="Choose a spacecraft model" />}
        </section>
        <div id="explore" className="loading-shell" tabIndex={-1}>
          {fileStatus('environments')}
          {fileStatus('runs')}
          {coreReady && <p role="alert">There are no verified places in this dataset.</p>}
        </div>
      </main>
    </div>
  )

  const placeModels = environmentModels[env.id]
  const otherPlaces = environments
    .filter((place) => place.id !== env.id)
    .map((place) => ({ id: place.id, label: placeName(place), o2_pct: place.o2_pct, pressure_kpa: place.pressure_kpa }))
  const drawerIds = compareOpen ? compareIds : profileId ? [profileId] : []
  const drawerInvestigations = data.investigations.filter(({ id }) => drawerIds.includes(id))
  const airCount = closeAir.length
  const gravityCount = closeGravity.length
  const exactCount = sameAir.length
  const fuelLabel = FUELS.find((option) => option.id === fuel)?.label ?? ''
  const verdict = gravityCount - assumedGravity > 0 ? 'Nearby evidence' : airCount > 0 ? 'Partial match' : 'Evidence gap'
  const verdictStatement = airCount === 0
    ? 'No plotted test ran close to this air'
    : gravityCount === 0
      ? `${countTests(airCount)} ran close to this air, none at this gravity`
      : gravityCount === airCount
        ? `${countTests(airCount)} ran close to this air${airCount === 1 ? '' : ', all'} at this gravity`
        : `${countTests(airCount)} ran close to this air, ${gravityCount.toLocaleString()} at this gravity`
  const pressureNote = assumedAir === 0
    ? 'Pressure was measured in each of these tests.'
    : assumedAir === airCount
      ? 'Pressure was not measured in these tests. It is assumed from a NASA report (hollow dots on the map).'
      : `${assumedAir.toLocaleString()} of them did not measure pressure. For those it is assumed from a NASA report (hollow dots on the map).`
  const closeRule = `within ${CLOSE_O2_POINTS} points of oxygen and a factor of ${CLOSE_PRESSURE_FACTOR} in pressure of this place`
  const exactNote = exactCount === 0
    ? 'None sits exactly inside this place’s oxygen and pressure range.'
    : `${exactCount.toLocaleString()} ${exactCount === 1 ? 'sits' : 'sit'} exactly inside this place’s oxygen and pressure range.`
  const verdictNote = airCount === 0
    ? `No plotted test of this material is ${closeRule}.`
    : `“Close” means ${closeRule}, the same scale the model’s support score uses. ${exactNote} ${pressureNote} Each result describes the sample and setup of that test.`
  const assumedLabel = (n: number) => n > 0 ? `${n.toLocaleString()} with assumed pressure` : null
  const gravity = env.gravity_g === 0 ? 'Near weightlessness' : env.gravity_g === 1 ? 'Earth gravity' : 'Partial gravity'

  function showCitedStudy(id: string) {
    const studies = document.getElementById('studies')
    const details = studies?.querySelector<HTMLDetailsElement>('.section-details')
    if (details) details.open = true
    const row = document.getElementById(`study-${id}`)
    row?.focus({ preventScroll: true })
    row?.scrollIntoView({ block: 'start', behavior: scrollBehavior(reduced) })
  }

  return (
    <div className="page" data-domain={env.domain}>
      <a href="#explore" className="skip-link visually-hidden">Skip to place and material choices</a>
      {header}
      <ScenarioBar
        watchSelector=".explore-controls"
        places={(['space', 'earth'] as const).map((domain) => ({
          group: domain === 'space' ? 'In space' : 'On Earth',
          options: environments.filter((place) => place.domain === domain).map((place) => ({ id: place.id, label: placeName(place) })),
        }))}
        placeId={env.id}
        onPlace={selectPlace}
        fuels={FUELS.map((option) => ({ id: option.id, label: option.label }))}
        fuel={fuel}
        onFuel={(id) => selectMaterial(id as FuelClass)}
        plotted={plottedRuns.length}
        close={airCount}
        sameGravity={gravityCount}
        gravityLabel={`${env.gravity_g} g`}
      />

      <main id="top">
        {hero}

        <section id="flames" className="flame-band" tabIndex={-1} aria-labelledby="flame-heading">
          <div className="wrap">
            <SectionDetails compact={compact} headingId="flame-heading" title="The same candle, two different fires">
              <div className="flame-band-inner">
                <p>Take away gravity and a flame stops behaving like the fires we know. That is why a place where people breathe in space needs evidence from tests run in space.</p>
                <FlameCompare />
              </div>
            </SectionDetails>
          </div>
        </section>

        <section id="space-models" hidden={!modelsOpen} className="space-models wrap" aria-label="Spacecraft models">
          {modelsOpen && <ModelCollection ids={modelGroups.hero} label="Choose a spacecraft model" />}
        </section>

        {states.meta !== 'ready' && <div className="wrap">{fileStatus('meta')}</div>}
        {states.meta === 'ready' && data.meta.mock && <p className="notice wrap" role="status">Sample data for preview. Counts do not represent NASA’s records.</p>}

        <section id="explore" className="explore-band" tabIndex={-1} aria-labelledby="result-heading">
          <div className="wrap explore-grid">
            <motion.div className="explore-controls" {...enterView(reduced)}>
              <PlacePicker environments={environments} env={env} onSelect={selectPlace} />
              <fieldset className="picker material-picker">
                <legend><span className="step-num" aria-hidden="true">2</span>Pick a material</legend>
                <MaterialOptions fuel={fuel} name="fuel" onSelect={selectMaterial} />
              </fieldset>
            </motion.div>

            <motion.div id="evidence" className="explore-main" tabIndex={-1} {...enterView(reduced, 1)}>
              <div className="chart-heading">
                <div>
                  <p className="metadata">{placeName(env)} <span aria-hidden="true">/</span> {fuelLabel}</p>
                  <h2 id="result-heading"><span className="step-num" aria-hidden="true">3</span>Has anyone tested fire in air like this?</h2>
                </div>

              </div>

              <div className="verdict" role="group" aria-label="Evidence verdict"
                data-verdict={verdict === 'Evidence gap' ? 'gap' : undefined}>
                <VerdictMessage key={`${env.id}|${fuel}`} label={verdict} headline={verdictStatement} note={verdictNote} reduced={reduced} />
                <dl className="verdict-stats">
                  <div>
                    <dt>Tests plotted</dt>
                    <dd className="stat-value"><ScenarioNumber value={plottedRuns.length} /></dd>
                    <dd className="stat-note">{fuelLabel} with oxygen and pressure on record</dd>
                  </div>
                  <div>
                    <dt>Close to this air</dt>
                    <dd className="stat-value"><ScenarioNumber value={airCount} /></dd>
                    <dd className="stat-note">
                      Within {CLOSE_O2_POINTS} points of {formatRange(env.o2_pct, ' %')} oxygen and ×{CLOSE_PRESSURE_FACTOR} of {formatRange(env.pressure_kpa, ' kPa')}
                      {assumedLabel(assumedAir) && <span className="stat-assumed">{assumedLabel(assumedAir)}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Close air and same gravity</dt>
                    <dd className="stat-value"><ScenarioNumber value={gravityCount} /></dd>
                    <dd className="stat-note">
                      Also run at {env.gravity_g} g
                      {assumedLabel(assumedGravity) && <span className="stat-assumed">{assumedLabel(assumedGravity)}</span>}
                    </dd>
                  </div>
                </dl>
                <p className="visually-hidden" role="status">
                  {verdictStatement}. {plottedRuns.length} plotted, {airCount} close to this air, {gravityCount} also at the same gravity.
                </p>
              </div>

              {fileStatus('boundary')}
              {fileStatus('model')}
              <EvidenceMap
                fuel={fuel}
                boundary={data.boundary}
                model={data.model}
                placeLabel={placeName(env)}
                studies={data.investigations}
                runs={fuelRuns}
                env={env}
                highlightStudyIds={activeTarget?.mapStudyIds ?? NO_IDS}
                highlightRunIds={highlightedRunIds}
                highlightPlace={previewGap || gapPinned}
                onSelectRun={selectRun}
                citedRun={citedRun}
                hasAnswer={Boolean(citedSummary)}
                onSelectInvestigation={openProfile}
                otherPlaces={otherPlaces}
                answerPanel={(
                  <EvidenceAnswer
                    scenario={`${placeName(env)} / ${fuelLabel}`}
                    scenarioKey={`${env.id}|${fuel}|${asked?.question ?? ''}`}
                    reduced={reduced}
                    summary={citedSummary}
                    targets={citationTargets}
                    activeSource={activeSource}
                    pinnedSourceId={pinnedSourceId}
                    selectedRun={selectedRun && { id: selectedRun.id, studyId: selectedRun.investigation }}
                    matchedNumbers={matchedNumbers}
                    showAirGap={airCount === 0}
                    gapPinned={gapPinned}
                    onPreviewGap={setPreviewGap}
                    onPinGap={() => { clearEvidenceFocus(); setEvidenceFocus({ gap: true }) }}
                    onShowStudy={showCitedStudy}
                    onPreview={setPreviewCiteId}
                    onPin={(id, showMap) => {
                      clearEvidenceFocus()
                      if (pinnedSourceId === id) return
                      setEvidenceFocus({ source: id })
                      if (showMap) showEvidencePlot()
                    }}
                    onClear={clearEvidenceFocus}
                    asking={asking}
                    onAsk={ask}
                    askedNotice={citedSummary && asked && (
                      <div className={`asked${asked.kind === 'saved' ? ' is-fallback' : ''}`} role="status">
                        <p className="asked-question">You asked: “{asked.question}”</p>
                        <p>
                          <span className="asked-kind">{asked.kind === 'saved' ? 'Saved answer' : 'Live answer'}</span>
                          {asked.notice}
                        </p>
                        <button type="button" className="text-button" onClick={() => { setAsked(null); clearEvidenceFocus() }}>
                          Back to the saved summary for {placeName(env)} / {fuelLabel}
                        </button>
                      </div>
                    )}
                    dataStatus={<>
                      {fileStatus('answers')}
                      {fileStatus('passages')}
                      {states.answers === 'ready' && states.passages === 'ready' && !citedSummary &&
                        <p className="data-status">No saved answer for this place and material.</p>}
                    </>}
                    exportAction={states.meta === 'ready' && states.investigations === 'ready' && states.answers === 'ready' &&
                      states.passages === 'ready' && states.model === 'ready' && states.boundary === 'ready' && (
                        <ExportBrief env={env} fuel={fuel} fuelLabel={fuelLabel} data={data} runs={runs}
                          ranked={scenarioRanked} getSummary={() => cachedAnswer
                            ? asked ? summarize(cachedAnswer) : citedSummary
                            : null} />
                      )}
                  />
                )}
                controls={(
                  <div className="map-scenario">
                    <div className="selected-still">
                      <AnimatePresence initial={false}>
                        <SelectedStill key={env.id} place={env} reduced={reduced} />
                      </AnimatePresence>
                    </div>
                    <div className="map-scenario-label">
                      <strong title={placeName(env)}>{placeName(env)}</strong>
                      <small>{fuelLabel}</small>
                    </div>
                    <div className="map-scenario-inputs">
                      <select aria-label="Pick a place on the map" value={env.id} onChange={(event) => selectPlace(event.target.value)}>
                        {(['space', 'earth'] as const).map((domain) => (
                          <optgroup key={domain} label={domain === 'space' ? 'In space' : 'On Earth'}>
                            {environments.filter((place) => place.domain === domain).map((place) => (
                              <option key={place.id} value={place.id}>{placeName(place)}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <div role="group" aria-label="Pick a material on the map">
                        <MaterialOptions fuel={fuel} name="map-fuel" onSelect={selectMaterial} />
                      </div>
                    </div>
                  </div>
                )}
              />

              <div className="place-facts">
                <dl className="conditions" aria-label={env.name}>
                  <div><dt>Oxygen</dt><dd><ScenarioNumber value={formatRange(env.o2_pct, ' %')} /></dd></div>
                  <div><dt>Air pressure</dt><dd><ScenarioNumber value={formatRange(env.pressure_kpa, ' kPa')} /></dd></div>
                  <div><dt>{gravity}</dt><dd><ScenarioNumber value={`${env.gravity_g} g`} /></dd></div>
                </dl>
                <div className="place-notes">
                  <p><strong>{env.name}</strong> · {env.why_it_matters}</p>
                  <ul className="source-list">
                    {env.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}
                  </ul>
                  {placeModels && <PlaceModels key={env.id} ids={placeModels} />}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="studies" className="studies-band" tabIndex={-1} aria-labelledby="studies-heading">
          <div className="wrap">
            <SectionDetails compact={compact} headingId="studies-heading" title="Closest NASA studies">
              {fileStatus('investigations')}
              {states.investigations === 'ready' && <StudyList
                ranked={ranked}
                linkedStudies={linkedStudies}
                total={data.investigations.length}
                query={query}
                onQueryChange={setQuery}
                pillar={pillar}
                pillars={PILLARS}
                onPillarChange={setPillar}
                compareIds={compareIds}
                onToggleCompare={(id) => setCompareIds((ids) => ids.includes(id) ? ids.filter((other) => other !== id) : ids.length < 2 ? [...ids, id] : ids)}
                onCompare={() => { setProfileId(null); setCompareOpen(true) }}
                onClearCompare={() => setCompareIds([])}
                onOpenProfile={openProfile}
                topicAside={<PillarModels pillar={pillar} />}
              />}
            </SectionDetails>
          </div>
        </section>

        <section id="tests" className="tests-band" aria-labelledby="tests-heading">
          <div className="wrap">
            <SectionDetails compact={compact} headingId="tests-heading" title="How fire is tested on the ground">
              <TestExplainers />
            </SectionDetails>
          </div>
        </section>

        <section id="earth" className="earth-band" tabIndex={-1} aria-labelledby="earth-heading">
          <div className="wrap">
            <SectionDetails compact={compact} headingId="earth-heading" title="Where this applies on Earth">
              <EarthView
                environments={environments}
                spinoffs={data.spinoffs}
                evidenceCards={data.evidenceCards}
                localStory={data.localStory}
                cardsStatus={fileStatus('evidenceCards')}
                spinoffsStatus={fileStatus('spinoffs')}
                localStatus={fileStatus('localStory')}
                studiesStatus={fileStatus('investigations')}
                investigations={data.investigations}
                onOpenProfile={openProfile}
                currentEnvId={env.id}
                onSelectPlace={(id, nextFuel) => {
                  changeScenario()
                  setEnvId(id)
                  if (nextFuel) setFuel(nextFuel)
                  document.getElementById('explore')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
                }}
              />
            </SectionDetails>
          </div>
        </section>
      </main>

      <InvestigationDrawer
        open={drawerInvestigations.length > 0}
        mode={compareOpen && drawerInvestigations.length === 2 ? 'compare' : 'profile'}
        investigations={drawerInvestigations}
        runs={data.runs}
        onClose={() => { setProfileId(null); setCompareOpen(false) }}
        onSelectProfile={openProfile}
      />

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <div><strong>EMBER</strong><p>Built for NASA Space Apps 2026</p></div>
          <ul className="source-list" aria-label="Sources">
            <li><a href="https://psi.nasa.gov/" target="_blank" rel="noreferrer">NASA experiment archive ↗</a></li>
            {env.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}
          </ul>
          <span className="metadata">SI-assisted interface · SI-generated logo</span>
        </div>
      </footer>
    </div>
  )
}

export default App
