import type { Answer, Claim, Environment, FuelClass } from './types'

// C6 Ask box. Sends a free-text question to Track D's endpoint (app/api/ask.ts). When that endpoint is
// missing, failing or rate-limited, the page falls back to the nearest precomputed answer in answers.json.
// Code written with SI assistance (Claude Code) during the event; see AI-USE.md.

export const MAX_QUESTION_CHARS = 500
const TIMEOUT_MS = 12_000

export type AskFailure = 'offline' | 'rate-limited' | 'error'

export type AskOutcome =
  | { ok: true; answer: Answer; mode: string; environmentId: string | null; fuel: FuelClass | null }
  | { ok: false; reason: AskFailure; retryAfterSec: number | null }

const FUEL_CLASSES: FuelClass[] = ['solid', 'droplet', 'gas']

function isClaimList(value: unknown): value is Claim[] {
  return Array.isArray(value) && value.every((claim) =>
    claim !== null && typeof claim === 'object' &&
    typeof (claim as Claim).text === 'string' &&
    Array.isArray((claim as Claim).cites) &&
    (claim as Claim).cites.every((cite) => typeof cite === 'string'))
}

function readAnswer(value: unknown): Answer | null {
  if (value === null || typeof value !== 'object') return null
  const { known, nearest, missing, earth } = value as Record<string, unknown>
  if (!isClaimList(known) || !isClaimList(nearest) || !isClaimList(missing) || !isClaimList(earth)) return null
  return { known, nearest, missing, earth }
}

// Static builds use saved answers directly. A host with the server function can opt
// in at build time. A 404 or 405 still switches that session back to saved answers.
let routeMissing = import.meta.env.VITE_ASK_API !== 'on'

export async function askLive(question: string): Promise<AskOutcome> {
  if (routeMissing) return { ok: false, reason: 'offline', retryAfterSec: null }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.slice(0, MAX_QUESTION_CHARS) }),
      signal: controller.signal,
    })
    if (res.status === 429) {
      const retry = Number(res.headers.get('Retry-After'))
      return { ok: false, reason: 'rate-limited', retryAfterSec: Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : null }
    }
    // A static host answers /api/ask with 404, 405 or an HTML page: all of those mean "no live service here".
    if (res.status === 404 || res.status === 405) {
      routeMissing = true
      return { ok: false, reason: 'offline', retryAfterSec: null }
    }
    if (!res.ok) return { ok: false, reason: 'error', retryAfterSec: null }
    const body = await res.json().catch(() => null) as Record<string, unknown> | null
    const answer = readAnswer(body?.answer)
    if (!body || !answer) return { ok: false, reason: 'offline', retryAfterSec: null }
    const parsed = (body.parsed ?? {}) as { environment_id?: unknown; fuel_class?: unknown }
    return {
      ok: true,
      answer,
      mode: typeof body.mode === 'string' ? body.mode : '',
      environmentId: typeof parsed.environment_id === 'string' ? parsed.environment_id : null,
      fuel: FUEL_CLASSES.includes(parsed.fuel_class as FuelClass) ? parsed.fuel_class as FuelClass : null,
    }
  } catch {
    return { ok: false, reason: 'offline', retryAfterSec: null }
  } finally {
    clearTimeout(timer)
  }
}

// Plain keyword lists for matching a question to a saved place and material. Longer phrases are listed
// first so "moon rover" wins over "moon".
const PLACE_WORDS: [string, string[]][] = [
  ['lunar-rover', ['moon rover', 'lunar rover', 'rover']],
  ['iss-spacesuit', ['spacesuit', 'space suit', 'spacewalk suit', 'emu']],
  ['shuttle-pre-eva', ['space shuttle', 'shuttle']],
  ['iss', ['international space station', 'space station', 'iss']],
  ['moon-habitat', ['moon habitat', 'lunar habitat', 'moon base', 'lunar base', 'moon', 'lunar', 'artemis']],
  ['skylab', ['skylab']],
  ['apollo-1', ['apollo']],
  ['hyperbaric', ['hyperbaric', 'pressure chamber', 'treatment chamber']],
  ['hospital-o2', ['hospital', 'oxygen ward', 'oxygen therapy', 'patient', 'clinic']],
  ['airliner', ['airliner', 'airplane', 'aeroplane', 'aircraft', 'plane cabin', 'flight cabin']],
  ['high-altitude-o2', ['high altitude', 'high-altitude', 'kangding', 'plateau', 'mountain']],
]

const FUEL_WORDS: [FuelClass, string[]][] = [
  ['droplet', ['droplet', 'liquid', 'heptane', 'methanol', 'decane', 'fuel drop']],
  ['gas', ['gas', 'methane', 'ethylene', 'propane', 'hydrogen', 'burner']],
  ['solid', ['solid', 'plastic', 'fabric', 'cloth', 'cotton', 'pmma', 'acrylic', 'paper', 'wire', 'material', 'nomex', 'silicone']],
]

function hasWord(text: string, word: string) {
  const at = text.indexOf(word)
  if (at < 0) return false
  const before = text[at - 1]
  const after = text[at + word.length]
  const isLetter = (ch: string | undefined) => ch !== undefined && /[a-z0-9]/.test(ch)
  // Whole words only, but allow a plural "s" ("plastics", "droplets").
  return !isLetter(before) && (!isLetter(after) || (after === 's' && !isLetter(text[at + word.length + 1])))
}

function rangeGap(value: number, [lo, hi]: [number, number]) {
  return value < lo ? lo - value : value > hi ? value - hi : 0
}

function pressureSteps(value: number, [lo, hi]: [number, number]) {
  if (value <= 0) return 0
  const edge = value < lo ? lo : value > hi ? hi : value
  return Math.abs(Math.log(value / edge)) / Math.log(1.25)
}

export interface CachedMatch {
  environmentId: string
  fuel: FuelClass
  /** What in the question picked the place: a place word, air values typed in the question, or nothing. */
  placeFrom: 'question' | 'air-values' | 'selection'
  fuelFrom: 'question' | 'selection'
}

/**
 * Picks the saved answer closest to a question. It only reads the question for a known place, a material,
 * or an oxygen/pressure value; anything it cannot find stays on the visitor's current selection.
 */
export function nearestCached(
  question: string,
  environments: Environment[],
  answers: Record<string, Answer>,
  current: { environmentId: string; fuel: FuelClass },
): CachedMatch {
  const text = question.toLowerCase()
  const available = environments.filter((env) => FUEL_CLASSES.some((fuel) => answers[`${env.id}|${fuel}`]))

  let environmentId = current.environmentId
  let placeFrom: CachedMatch['placeFrom'] = 'selection'
  const named = PLACE_WORDS.find(([id, words]) => available.some((env) => env.id === id) && words.some((word) => hasWord(text, word)))
  if (named) {
    environmentId = named[0]
    placeFrom = 'question'
  } else {
    const o2 = /(\d+(?:\.\d+)?)\s*(?:%|percent)/.exec(text)
    const kpa = /(\d+(?:\.\d+)?)\s*kpa/.exec(text)
    if (o2 || kpa) {
      // Same scale the map's "close" rule uses: 2 oxygen points count like a factor of 1.25 in pressure.
      const distance = (env: Environment) =>
        (o2 ? rangeGap(Number(o2[1]), env.o2_pct) / 2 : 0) + (kpa ? pressureSteps(Number(kpa[1]), env.pressure_kpa) : 0)
      const closest = [...available].sort((a, b) => distance(a) - distance(b))[0]
      if (closest) {
        environmentId = closest.id
        placeFrom = 'air-values'
      }
    }
  }

  let fuel = current.fuel
  let fuelFrom: CachedMatch['fuelFrom'] = 'selection'
  const namedFuel = FUEL_WORDS.find(([, words]) => words.some((word) => hasWord(text, word)))
  if (namedFuel) {
    fuel = namedFuel[0]
    fuelFrom = 'question'
  }

  if (!answers[`${environmentId}|${fuel}`]) {
    return { environmentId: current.environmentId, fuel: current.fuel, placeFrom: 'selection', fuelFrom: 'selection' }
  }
  return { environmentId, fuel, placeFrom, fuelFrom }
}
