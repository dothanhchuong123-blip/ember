import type { AppData, Environment, FuelClass, Investigation, Run } from './types'

const BASE = `${import.meta.env.BASE_URL}data/`

export type DataKey = keyof AppData
export type LoadState = 'loading' | 'ready' | 'failed'

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function records(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isObject(item) && typeof item.id === 'string')
}

const modelFile = (value: unknown) => isObject(value) && isObject(value.by_fuel_class)

// The files are built from the project data contracts. Check the envelope before
// handing it to the views so an HTML fallback, null, or mismatched file is a load error.
export const dataFiles = {
  meta: { name: 'meta.json', label: 'Dataset status', valid: (value: unknown) => isObject(value) && typeof value.mock === 'boolean' },
  runs: { name: 'runs.json', label: 'NASA experiment records', valid: records },
  investigations: { name: 'investigations.json', label: 'NASA study profiles', valid: records },
  environments: { name: 'environments.json', label: 'Place presets', valid: records },
  spinoffs: { name: 'spinoffs.json', label: 'NASA technology spinoffs', valid: records },
  boundary: { name: 'boundary.json', label: 'Map shading', valid: modelFile },
  model: { name: 'model.json', label: 'What-if model', valid: modelFile },
  answers: { name: 'answers.json', label: 'Saved answers', valid: (value: unknown) =>
    isObject(value) && Object.values(value).every((answer) => isObject(answer) &&
      ['known', 'nearest', 'missing', 'earth'].every((key) => Array.isArray(answer[key]))) },
  passages: { name: 'passages.json', label: 'Citation sources', valid: records },
  evidenceCards: { name: 'evidence-cards.json', label: 'Earth evidence cards', valid: records },
  localStory: { name: 'local-story.json', label: 'Local fire context', valid: records },
} satisfies Record<DataKey, { name: string; label: string; valid: (value: unknown) => boolean }>

const STALE_PSI_PATH = 'psi.nasa.gov/physci/repo/investigations/'
const CURRENT_PSI_PATH = 'psi.nasa.gov/physci/repo/data/investigations/'

export async function loadDataFile<K extends DataKey>(key: K, signal: AbortSignal): Promise<AppData[K]> {
  const file = dataFiles[key]
  const response = await fetch(BASE + file.name, { signal, cache: 'no-cache' })
  if (!response.ok) throw new Error(file.name)
  // PSI moved study pages from /physci/repo/investigations/<id> (now a 404 inside their site)
  // to /physci/repo/data/investigations/<id>, which is where each study's DOI resolves.
  const value: unknown = JSON.parse((await response.text()).replaceAll(STALE_PSI_PATH, CURRENT_PSI_PATH))
  if (!file.valid(value)) throw new Error(file.name)
  return value as AppData[K]
}

export function inRange(v: number | null, [lo, hi]: [number, number]): boolean {
  return v !== null && v >= lo && v <= hi
}

export function distanceToRange(v: number, [lo, hi]: [number, number]): number {
  if (v < lo) return lo - v
  if (v > hi) return v - hi
  return 0
}

export function rangeDistance(a: [number, number], b: [number, number]): number {
  if (a[1] < b[0]) return b[0] - a[1]
  if (b[1] < a[0]) return a[0] - b[1]
  return 0
}

/** Recorded pressure, or the cited assumed pressure when the table has no pressure column. */
export function effectivePressure(run: Run): number | null {
  return run.pressure_kpa ?? run.pressure_assumed_kpa ?? null
}

export function runInEnvironment(run: Run, env: Environment): boolean {
  return inRange(run.o2_pct, env.o2_pct) && inRange(effectivePressure(run), env.pressure_kpa)
}

export function kpaToPsi(kpa: number): number {
  return kpa * 0.1450377
}

export function kpaToAtm(kpa: number): number {
  return kpa / 101.325
}

export type ReasonFactor = 'overall' | 'material' | 'oxygen' | 'pressure' | 'gravity' | 'keyword'
/**
 * match: the study's values meet the chosen place. mismatch: they do not.
 * assumed: the source table has no value and a cited document supplies one. not_recorded: no value at all.
 */
export type ReasonVerdict = 'match' | 'mismatch' | 'assumed' | 'not_recorded'

export interface ReasonChip {
  state: 'ok' | 'partial' | 'no'
  text: string
  /** Which ranking term this chip explains. */
  factor?: ReasonFactor
  /** Structured result, computed with the same branch that writes `text`. */
  verdict?: ReasonVerdict
}

export interface Ranked {
  investigation: Investigation
  score: number
  reasons: ReasonChip[]
  insideCount: number
  o2Hits: number
  pHits: number
  totalRuns: number
}

function plural(k: number, word = 'run'): string {
  return `${k} ${k === 1 ? word : `${word}s`}`
}

/**
 * Weighted closeness ranking per PLAYBOOK § 7 C4:
 * 0.35 × fuel-class match + 0.25 × O2 closeness + 0.20 × pressure closeness + 0.10 × gravity + 0.10 × text relevance.
 * Every term is surfaced as a readable reason chip; never show a bare score number to the user.
 */
export function rankInvestigations(
  investigations: Investigation[],
  runs: Run[],
  env: Environment,
  fuel: FuelClass,
  query = '',
): Ranked[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2)

  return investigations
    .map((investigation) => {
      const mine = runs.filter((r) => r.investigation === investigation.id)
      const totalRuns = mine.length || investigation.n_runs || 0
      const o2Vals = mine.map((r) => r.o2_pct).filter((v): v is number => v !== null)
      const pVals = mine.map((r) => effectivePressure(r)).filter((v): v is number => v !== null)

      // 1. Fuel class match (0.35)
      const fuelMatch = investigation.fuel_class === fuel
      const fuelScore = fuelMatch ? 1 : 0
      const fuelChip: ReasonChip = {
        state: fuelMatch ? 'ok' : 'no',
        factor: 'material',
        verdict: fuelMatch ? 'match' : 'mismatch',
        text: fuelMatch ? 'Same type of material' : `Different material type (${investigation.fuel_class})`,
      }

      // 2. Oxygen closeness (0.25)
      const o2Hits = o2Vals.filter((v) => inRange(v, env.o2_pct)).length
      let o2Score = 0
      let o2Chip: ReasonChip
      if (o2Vals.length > 0) {
        if (o2Hits > 0) {
          o2Score = 0.5 + 0.5 * (o2Hits / o2Vals.length)
          o2Chip = {
            state: 'ok',
            factor: 'oxygen',
            verdict: 'match',
            text: `Oxygen matches (${plural(o2Hits)})`,
          }
        } else {
          const minDist = Math.min(...o2Vals.map((v) => distanceToRange(v, env.o2_pct)))
          o2Score = 0.45 * Math.exp(-minDist / 8)
          o2Chip = {
            state: minDist <= 5 ? 'partial' : 'no',
            factor: 'oxygen',
            verdict: 'mismatch',
            text: `Closest oxygen level is ${minDist.toFixed(1)} percentage points away`,
          }
        }
      } else if (investigation.o2_range) {
        const d = rangeDistance(investigation.o2_range, env.o2_pct)
        o2Score = d === 0 ? 0.65 : 0.4 * Math.exp(-d / 8)
        o2Chip = {
          state: d === 0 ? 'partial' : 'no',
          factor: 'oxygen',
          verdict: d === 0 ? 'match' : 'mismatch',
          text: d === 0
            ? `Study’s oxygen range ${investigation.o2_range[0]}–${investigation.o2_range[1]} % overlaps`
            : `Study’s oxygen range ${d.toFixed(1)} % away`,
        }
      } else {
        o2Chip = { state: 'no', factor: 'oxygen', verdict: 'not_recorded', text: 'Oxygen values unavailable' }
      }

      // 3. Pressure closeness (0.20)
      const pHits = pVals.filter((v) => inRange(v, env.pressure_kpa)).length
      const hasAssumedOnly =
        mine.length > 0 && mine.some((r) => r.pressure_kpa === null && r.pressure_assumed_kpa != null)
      let pScore = 0
      let pChip: ReasonChip
      if (pVals.length > 0) {
        if (pHits > 0) {
          pScore = 0.5 + 0.5 * (pHits / pVals.length)
          pChip = {
            state: hasAssumedOnly ? 'partial' : 'ok',
            factor: 'pressure',
            verdict: hasAssumedOnly ? 'assumed' : 'match',
            text: hasAssumedOnly
              ? `cabin pressure assumed in range (${plural(pHits)})`
              : `Pressure matches (${plural(pHits)})`,
          }
        } else {
          const minDist = Math.min(...pVals.map((v) => distanceToRange(v, env.pressure_kpa)))
          pScore = 0.45 * Math.exp(-minDist / 30)
          pChip = {
            state: minDist <= 18 ? 'partial' : 'no',
            factor: 'pressure',
            verdict: 'mismatch',
            text: `nearest pressure is ${minDist.toFixed(0)} kPa away`,
          }
        }
      } else if (investigation.pressure_range_kpa) {
        const d = rangeDistance(investigation.pressure_range_kpa, env.pressure_kpa)
        pScore = d === 0 ? 0.65 : 0.4 * Math.exp(-d / 30)
        pChip = {
          state: d === 0 ? 'partial' : 'no',
          factor: 'pressure',
          verdict: d === 0 ? 'match' : 'mismatch',
          text: d === 0 ? 'overview pressure overlaps' : `pressure ${d.toFixed(0)} kPa away`,
        }
      } else {
        pChip = { state: 'no', factor: 'pressure', verdict: 'not_recorded', text: 'no pressure column in source' }
      }

      // 4. Gravity relevance (0.10) — never claim 0g equals Moon or Earth
      const has0g = mine.some((r) => r.gravity === '0g')
      const has1g = mine.some((r) => r.gravity === '1g')
      let gScore = 0
      let gChip: ReasonChip
      if (mine.length === 0) {
        gChip = { state: 'no', factor: 'gravity', verdict: 'not_recorded', text: 'Test gravity unavailable' }
      } else if (env.gravity_g === 0) {
        gScore = has0g ? 1 : 0.2
        gChip = {
          state: has0g ? 'ok' : 'no',
          factor: 'gravity',
          verdict: has0g ? 'match' : 'mismatch',
          text: has0g ? 'Includes near-weightless tests' : 'Earth-gravity tests only',
        }
      } else if (env.gravity_g < 0.9) {
        gScore = has0g && has1g ? 0.8 : has0g || has1g ? 0.5 : 0
        gChip = { state: 'partial', factor: 'gravity', verdict: 'mismatch', text: 'Tests used different gravity' }
      } else {
        gScore = has1g ? 1 : 0.3
        gChip = {
          state: has1g ? 'ok' : 'no',
          factor: 'gravity',
          verdict: has1g ? 'match' : 'mismatch',
          text: has1g ? 'Includes Earth-gravity tests' : 'Near-weightless tests only',
        }
      }

      // 5. Text relevance (0.10)
      let textScore = 0
      let textChip: ReasonChip | null = null
      if (tokens.length > 0) {
        const haystack = [
          investigation.id,
          investigation.short,
          investigation.name,
          investigation.pillar,
          investigation.hardware,
          investigation.fuels,
          investigation.objective,
          investigation.conditions,
          ...mine.slice(0, 60).map((r) => r.fuel),
        ]
          .join(' ')
          .toLowerCase()
        const matched = tokens.filter((t) => haystack.includes(t))
        textScore = matched.length / tokens.length
        textChip = {
          state: matched.length === tokens.length ? 'ok' : matched.length > 0 ? 'partial' : 'no',
          factor: 'keyword',
          verdict: matched.length > 0 ? 'match' : 'mismatch',
          text:
            matched.length > 0
              ? `matches "${matched.join(' ')}"`
              : `no "${tokens.join(' ')}" match`,
        }
      }

      const insideCount = mine.filter((r) => runInEnvironment(r, env)).length
      const reasons: ReasonChip[] = [fuelChip, o2Chip, pChip, gChip]
      if (textChip) reasons.push(textChip)
      if (insideCount > 0) {
        reasons.unshift({ state: 'ok', factor: 'overall', verdict: 'match', text: `${plural(insideCount)} match oxygen and pressure` })
      }

      const score =
        0.35 * fuelScore + 0.25 * o2Score + 0.2 * pScore + 0.1 * gScore + 0.1 * textScore

      return {
        investigation,
        score,
        reasons,
        insideCount,
        o2Hits,
        pHits,
        totalRuns,
      }
    })
    .sort((a, b) => b.score - a.score)
}
