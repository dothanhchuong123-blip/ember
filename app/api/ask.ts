/**
 * EMBER Track D (D5) — Serverless Grounded SI Endpoint (`app/api/ask.ts`).
 *
 * Security & Grounding Guarantees:
 * - API keys come exclusively from server environment variables (`ANTHROPIC_API_KEY`,
 *   or optional `OPENAI_API_KEY` / `GEMINI_API_KEY` via `LLM_PROVIDER`). Never exposed to client.
 * - Per-IP sliding-window rate limiter (`RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS`).
 * - Input length cap (500 chars) and strict `max_tokens` caps (256 parse / 900 answer).
 * - Corpus-only grounding + deterministic fallback when no LLM key is set.
 * - Strict citation validator: every cited ID must exist in corpus; any sentence with a
 *   number must cite; failed sentences are dropped; empty `known` returns refusal statement.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type FuelClass = 'solid' | 'droplet' | 'gas'
export type Intent =
  | 'flammability'
  | 'gap'
  | 'comparison'
  | 'detection'
  | 'suppression'
  | 'earth_transfer'
  | 'unsupported'

export interface ParsedQuestion {
  environment_id: string | null
  custom: { o2: number | null; pressure: number | null } | null
  fuel_class: FuelClass | null
  fuel: string | null
  intent: Intent
}

export interface Claim {
  text: string
  cites: string[]
}

export interface AnswerPayload {
  known: Claim[]
  nearest: Claim[]
  missing: Claim[]
  earth: Claim[]
}

interface RunRecord {
  id: string
  investigation: string
  fuel_class: FuelClass
  fuel: string
  gravity: '0g' | '1g'
  o2_pct: number | null
  pressure_kpa: number | null
  pressure_assumed_kpa?: number | null
  outcome: string
  flags?: string[]
}

interface InvestigationRecord {
  id: string
  name: string
  short: string
  fuel_class: FuelClass
  pillar: string
  objective: string
  fuels: string
}

interface EnvironmentRecord {
  id: string
  domain: 'space' | 'earth'
  name: string
  o2_pct: [number, number] | null
  pressure_kpa: [number, number] | null
  gravity_g: number
  why_it_matters: string
  verified: boolean
}

interface SpinoffRecord {
  id: string
  title: string
  year: number
  nasa_origin: string
  earth_use: string
  benefit: string
}

interface PassageRecord {
  id: string
  source_title: string
  url: string
  page_or_section: string
  text: string
}

interface CorpusData {
  runs: RunRecord[]
  investigations: InvestigationRecord[]
  environments: EnvironmentRecord[]
  spinoffs: SpinoffRecord[]
  passages: PassageRecord[]
  answers: Record<string, AnswerPayload>
  validIds: Set<string>
}

export interface ValidationReport {
  droppedSentences: { section: string; sentence: string; reason: string }[]
  invalidCites: string[]
  uncitedNumericSentences: { section: string; sentence: string }[]
  knownFallbackTriggered: boolean
}

const REFUSAL_TEXT =
  'The NASA PSI combustion evidence does not reach this environment; no tested runs in this fuel class match both the target atmosphere and gravity regime.'

const MAX_QUESTION_CHARS = 500
const PARSE_MAX_TOKENS = 256
const ANSWER_MAX_TOKENS = 900
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20

const ipHits = new Map<string, number[]>()
let cachedCorpus: CorpusData | null = null

function readJsonIfExists<T>(paths: string[], fallback: T): T {
  for (const p of paths) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8')) as T
    }
  }
  return fallback
}

export function loadCorpus(forceReload = false): CorpusData {
  if (cachedCorpus && !forceReload) return cachedCorpus

  const here = dirname(fileURLToPath(import.meta.url))
  const appDir = resolve(here, '..')
  const repoRoot = resolve(appDir, '..')

  const runs = readJsonIfExists<RunRecord[]>(
    [join(repoRoot, 'data/clean/runs.json'), join(appDir, 'public/data/runs.json')],
    [],
  )
  const investigations = readJsonIfExists<InvestigationRecord[]>(
    [join(repoRoot, 'data/clean/investigations.json'), join(appDir, 'public/data/investigations.json')],
    [],
  )
  const environments = readJsonIfExists<EnvironmentRecord[]>(
    [join(repoRoot, 'data/earth/environments.json'), join(appDir, 'public/data/environments.json')],
    [],
  )
  const spinoffs = readJsonIfExists<SpinoffRecord[]>(
    [join(repoRoot, 'data/earth/spinoffs.json'), join(appDir, 'public/data/spinoffs.json')],
    [],
  )
  const passages = readJsonIfExists<PassageRecord[]>(
    [join(repoRoot, 'ai/passages.json'), join(appDir, 'public/data/passages.json')],
    [],
  )
  const answers = readJsonIfExists<Record<string, AnswerPayload>>(
    [join(repoRoot, 'ai/answers.json'), join(appDir, 'public/data/answers.json')],
    {},
  )

  const validIds = new Set<string>()
  for (const r of runs) validIds.add(r.id)
  for (const i of investigations) validIds.add(i.id)
  for (const p of passages) {
    validIds.add(p.id)
    validIds.add(`passage:${p.id}`)
  }
  for (const s of spinoffs) {
    validIds.add(s.id)
    validIds.add(`spinoff:${s.id}`)
  }
  for (const e of environments) {
    validIds.add(e.id)
    validIds.add(`env:${e.id}`)
  }

  cachedCorpus = { runs, investigations, environments, spinoffs, passages, answers, validIds }
  return cachedCorpus
}

const ENV_PATTERNS: Array<[string, RegExp[]]> = [
  ['lunar-rover', [/\blunar\s+rover\b/i, /\bmoon\s+rover\b/i, /\bpressurized\s+rover\b/i]],
  [
    'moon-habitat',
    [
      /\bmoon\s+(?:base|habitat|surface|lander)\b/i,
      /\blunar\s+(?:base|habitat|surface|gravity)\b/i,
      /\bexploration\s+atmosphere\b/i,
      /\b1\/6\s*g\b/i,
      /\b0\.165\s*g\b/i,
    ],
  ],
  ['iss-spacesuit', [/\bspacesuit\b/i, /\bspace\s+suit\b/i, /\bemu\b/i, /\b4\.3\s*psi/i]],
  ['shuttle-pre-eva', [/\bshuttle\b/i, /\bpre[-\s]?eva\b/i, /\bspacewalk\s+prep/i, /\b10\.2\s*psi/i]],
  ['skylab', [/\bskylab\b/i]],
  ['apollo-1', [/\bapollo\s*1\b/i, /\bas[-\s]?204\b/i]],
  ['iss', [/\biss\b/i, /\binternational\s+space\s+station\b/i, /\bmicrogravity\s+science\s+glovebox\b/i, /\bglovebox\b/i]],
  ['hospital-o2', [/\bhospital\b/i, /\boxygen\s+ward\b/i, /\bincubator\b/i, /\bnfpa\s*99\b/i, /\b23\.5\s*%/i]],
  ['hyperbaric', [/\bhyperbaric\b/i, /\bmonoplace\b/i, /\bmultiplace\b/i, /\b3\s*ata\b/i]],
  ['airliner', [/\bairliner\b/i, /\baircraft\b/i, /\bcargo\s+hold\b/i, /\b8,?000\s*(?:ft|feet)\b/i, /\bfaa\b/i]],
  ['high-altitude-o2', [/\bkangding\b/i, /\bhigh[-\s]altitude\b/i, /\btibet\b/i, /\b60\.5\s*kpa\b/i]],
  ['submarine', [/\bsubmarine\b/i]],
  ['hypoxic-data-centre', [/\bdata\s*cent(?:re|er)\b/i, /\bserver\s*room\b/i, /\bhypoxic\s+air\b/i]],
  ['deep-mine', [/\bdeep\s+mine\b/i, /\bcoal\s+mine\b/i, /\bmine\b/i]],
]

const FUEL_LEXICON: Array<[FuelClass, string, RegExp[]]> = [
  ['solid', 'cotton', [/\bcotton\b/i, /\bsibal\b/i, /\bclothing\b/i, /\bfabric\b/i, /\btextile\b/i]],
  ['solid', 'PMMA', [/\bpmma\b/i, /\bacrylic\b/i, /\bplexiglass\b/i]],
  ['solid', 'Nomex', [/\bnomex\b/i]],
  ['solid', 'Ultem', [/\bultem\b/i]],
  ['solid', 'Kapton', [/\bkapton\b/i]],
  ['solid', 'Teflon', [/\bteflon\b/i]],
  ['solid', 'Pyrell', [/\bpyrell\b/i, /\bpolyurethane\s+foam\b/i]],
  ['solid', 'silicone', [/\bsilicone\b/i]],
  ['solid', 'wax', [/\bwax\b/i, /\bcandle\b/i]],
  ['solid', 'cellulose', [/\bcellulose\b/i, /\bkimwipes?\b/i, /\bpaper\b/i]],
  ['solid', 'solid', [/\bsolids?\b/i, /\bpolymer\b/i, /\bwire\s+insulation\b/i, /\bplastic\b/i]],
  ['droplet', 'heptane', [/\bheptane\b/i, /\bn-heptane\b/i]],
  ['droplet', 'methanol', [/\bmethanol\b/i]],
  ['droplet', 'dodecane', [/\bdodecane\b/i, /\bn-dodecane\b/i, /\biso-dodecane\b/i]],
  ['droplet', 'farnesane', [/\bfarnesane\b/i]],
  ['droplet', 'decane', [/\bdecane\b/i, /\boctane\b/i]],
  ['droplet', 'droplet', [/\bdroplets?\b/i, /\bliquid\s+fuel\b/i, /\balkane\s+droplet\b/i]],
  ['gas', 'methane', [/\bmethane\b/i, /\bch4\b/i]],
  ['gas', 'ethylene', [/\bethylene\b/i, /\bc2h4\b/i]],
  ['gas', 'ethane', [/\bethane\b/i, /\bc2h6\b/i]],
  ['gas', 'propane', [/\bpropane\b/i, /\bc3h8\b/i]],
  ['gas', 'butane', [/\bbutane\b/i, /\bc4h10\b/i]],
  ['gas', 'pentane', [/\bpentane\b/i]],
  ['gas', 'hydrogen', [/\bhydrogen\b/i, /\bh2\b/i]],
  ['gas', 'DME', [/\bdme\b/i, /\bdimethyl\s+ether\b/i]],
  ['gas', 'gas', [/\bgas(?:es|eous)?\s+flames?\b/i, /\bspherical\s+(?:diffusion\s+)?flames?\b/i, /\bgas\s+jet\b/i, /\bburner\b/i, /\bcool\s+flames?\b/i]],
]

const UNSUPPORTED_PATTERNS: RegExp[] = [
  /\b(?:lithium[-\s]?ion|ev\s+battery|battery\s+cell)\b.*\b(?:thermal\s+runaway|propagation\s+speed|temperature|rate|predict)\b/i,
  /\b(?:thermal\s+runaway|propagation\s+speed)\b.*\b(?:lithium[-\s]?ion|ev\s+battery|battery)\b/i,
  /\b(?:mars|martian)\b.*\b(?:dust\s+storm|95%\s*co2|electrostatic|perchlorate)\b/i,
  /\bdeep[-\s]?fryer\b/i,
  /\bcooking\s+oil\b/i,
  /\breactor\s+compartment\b/i,
  /\bhalon\s*1301\b.*\bdecomposition\b/i,
  /\bexact\s+(?:flame[-\s]?spread\s+rate|spread\s+rate)\b.*\b(?:1\/6\s*g|lunar\s+gravity|moon)\b/i,
]

export function parseQuestionTS(question: string): ParsedQuestion {
  const q = question.trim().replace(/\s+/g, ' ')
  const ql = q.toLowerCase()
  const isUnsupported = UNSUPPORTED_PATTERNS.some((re) => re.test(q))

  let envId: string | null = null
  for (const [eid, pats] of ENV_PATTERNS) {
    if (pats.some((re) => re.test(q))) {
      envId = eid
      break
    }
  }

  let o2Val: number | null = null
  const mO2 = q.match(/(\d+(?:\.\d+)?)\s*%\s*(?:o2|oxygen|o₂)\b|\b(?:o2|oxygen)\s*(?:at|of|=|:)?\s*(\d+(?:\.\d+)?)\s*%/i)
  if (mO2) {
    const val = Number(mO2[1] ?? mO2[2])
    if (val >= 0 && val <= 100) o2Val = Math.round(val * 1000) / 1000
  }

  let pVal: number | null = null
  const mKpa = q.match(/(\d+(?:\.\d+)?)\s*kpa\b/i)
  const mPsi = q.match(/(\d+(?:\.\d+)?)\s*psi[a]?\b/i)
  const mAtm = q.match(/(\d+(?:\.\d+)?)\s*(?:atm|ata)\b/i)
  const mBar = q.match(/(\d+(?:\.\d+)?)\s*bar\b/i)
  if (mKpa) pVal = Math.round(Number(mKpa[1]) * 100) / 100
  else if (mPsi) pVal = Math.round(Number(mPsi[1]) * 6.89476 * 100) / 100
  else if (mAtm) pVal = Math.round(Number(mAtm[1]) * 101.325 * 100) / 100
  else if (mBar) pVal = Math.round(Number(mBar[1]) * 100 * 100) / 100

  let custom: { o2: number | null; pressure: number | null } | null =
    o2Val !== null || pVal !== null ? { o2: o2Val, pressure: pVal } : null

  if (envId && custom) {
    const presetMap: Record<string, [number, number]> = {
      'moon-habitat': [34, 56.54],
      'lunar-rover': [34, 56.54],
      iss: [21, 101.35],
      'shuttle-pre-eva': [26.5, 70.33],
      airliner: [21, 75.26],
      'hospital-o2': [23.5, 101.325],
      hyperbaric: [100, 303.975],
      'high-altitude-o2': [33, 60.5],
      'iss-spacesuit': [100, 29.65],
      'apollo-1': [100, 115.14],
    }
    const preset = presetMap[envId]
    if (preset) {
      const o2Same = custom.o2 === null || Math.abs(custom.o2 - preset[0]) <= 1.0
      const pSame = custom.pressure === null || Math.abs(custom.pressure - preset[1]) <= 2.5
      if (o2Same && pSame) custom = null
    }
  }

  let fuelClass: FuelClass | null = null
  let fuel: string | null = null
  for (const [fc, canon, pats] of FUEL_LEXICON) {
    if (pats.some((re) => re.test(q))) {
      fuelClass = fc
      fuel = canon === 'solid' || canon === 'droplet' || canon === 'gas' ? null : canon
      break
    }
  }

  if (/\bbre\b|\bburning\s+rate\s+emulator\b/i.test(q) && fuelClass === null) {
    fuelClass = 'gas'
  }

  if (isUnsupported) {
    if (ql.includes('lithium') || ql.includes('battery')) {
      fuel = 'lithium-ion battery'
      fuelClass = null
    } else if (ql.includes('cooking oil') || ql.includes('fryer')) {
      fuel = 'cooking oil'
      fuelClass = null
    } else if (ql.includes('halon') || ql.includes('reactor')) {
      fuel = 'Halon 1301'
      fuelClass = null
    } else if (ql.includes('mars') || ql.includes('martian') || ql.includes('dust storm')) {
      fuel = 'Martian regolith dust'
      fuelClass = null
    }
  }

  let intent: Intent = 'flammability'
  if (isUnsupported) {
    intent = 'unsupported'
  } else if (/\b(smoke|particle|detector|alarm|nuisance|same|daft|brunswick)\b/i.test(q)) {
    intent = 'detection'
  } else if (/\b(extinguish|water\s*mist|suppression|halon|co2\s+unit|nitrogen\s+jet)\b/i.test(q)) {
    intent = 'suppression'
  } else if (
    /\b(spinoff|earth|hospital|hyperbaric|aircraft|airliner|vietnam|home\s+oxygen|engine)\b/i.test(q) &&
    !/\b(compare|versus|vs)\b/i.test(q)
  ) {
    intent = 'earth_transfer'
  } else if (/\b(compare|versus|vs\.?|difference|1\s*g|test\s*1|normal\s+gravity)\b/i.test(q)) {
    intent = 'comparison'
  } else if (/\b(gap|missing|untested|unknown|nobody\s+know|what\s+is\s+missing)\b/i.test(q)) {
    intent = 'gap'
  }

  return { environment_id: envId, custom, fuel_class: fuelClass, fuel, intent }
}

function splitSentences(text: string): string[] {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (!clean) return []
  return clean.split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/).map((s) => s.trim()).filter(Boolean)
}

export function validateAnswerTS(
  raw: Partial<AnswerPayload>,
  validIds: Set<string>,
): { answer: AnswerPayload; report: ValidationReport } {
  const report: ValidationReport = {
    droppedSentences: [],
    invalidCites: [],
    uncitedNumericSentences: [],
    knownFallbackTriggered: false,
  }
  const cleaned: AnswerPayload = { known: [], nearest: [], missing: [], earth: [] }

  for (const section of ['known', 'nearest', 'missing', 'earth'] as const) {
    const claims = Array.isArray(raw[section]) ? raw[section] : []
    for (const claim of claims) {
      if (!claim || typeof claim.text !== 'string') continue
      const text = claim.text.trim()
      if (!text) continue

      const rawCites = Array.isArray(claim.cites) ? claim.cites : []
      const validCites: string[] = []
      const badCites: string[] = []
      for (const cid of rawCites) {
        const s = String(cid).trim()
        if (validIds.has(s)) {
          if (!validCites.includes(s)) validCites.push(s)
        } else {
          badCites.push(s)
        }
      }
      if (badCites.length > 0) report.invalidCites.push(...badCites)

      const kept: string[] = []
      for (const sent of splitSentences(text)) {
        const hasNum = /\d/.test(sent)
        if (badCites.length > 0 && validCites.length === 0) {
          report.droppedSentences.push({ section, sentence: sent, reason: 'invalid_cite' })
          continue
        }
        if (hasNum && validCites.length === 0) {
          report.uncitedNumericSentences.push({ section, sentence: sent })
          report.droppedSentences.push({ section, sentence: sent, reason: 'uncited_number' })
          continue
        }
        if (section !== 'missing' && validCites.length === 0 && !sent.toLowerCase().includes('does not reach')) {
          report.droppedSentences.push({ section, sentence: sent, reason: 'no_cites' })
          continue
        }
        kept.push(sent)
      }

      if (kept.length > 0) {
        cleaned[section].push({ text: kept.join(' '), cites: validCites })
      }
    }
  }

  if (cleaned.known.length === 0) {
    cleaned.known = [{ text: REFUSAL_TEXT, cites: [] }]
    report.knownFallbackTriggered = true
  }

  return { answer: cleaned, report }
}

function effectivePressure(r: RunRecord): number | null {
  return r.pressure_kpa ?? r.pressure_assumed_kpa ?? null
}

function isInverse(r: RunRecord): boolean {
  return Array.isArray(r.flags) && r.flags.includes('inverse_flame_o2_is_burner_stream')
}

function buildDeterministicAnswer(corpus: CorpusData, question: string, parsed: ParsedQuestion): AnswerPayload {
  const fc: FuelClass = parsed.fuel_class ?? 'solid'

  if (parsed.intent === 'unsupported') {
    const ql = question.toLowerCase()
    const nearest: Claim[] = []
    const missing: Claim[] = []
    if (ql.includes('lithium') || ql.includes('battery')) {
      nearest.push({
        text: 'While NASA developed a lithium-ion battery test protocol to qualify the ISS fine-water-mist portable extinguisher, that report is qualification methodology rather than PSI experimental burn runs.',
        cites: ['research02:portable-extinguisher-li-ion'],
      })
      missing.push({
        text: 'The EMBER PSI combustion dataset holds 0 battery-fire runs and cannot predict cell-to-cell thermal runaway propagation, vent-gas ignition, or suppression effectiveness.',
        cites: ['research02:portable-extinguisher-li-ion'],
      })
    } else if (ql.includes('1/6') || ql.includes('lunar') || ql.includes('moon')) {
      nearest.push({
        text: 'Nearest solid data in PSI are 0 g BASS-II tests up to 22.2% O2 at assumed 101.3 kPa (PSI-25:B1), while NASA upcoming FM2 hardware targets 1/6 g testing.',
        cites: ['PSI-25:B1', 'research01:fm2-lunar'],
      })
      missing.push({
        text: 'Cleaned PSI holds 0 lunar-gravity (1/6 g) runs and 0 solid runs above 22.2% O2 or at 56.54 kPa, so an exact 1/6 g solid spread rate cannot be derived from this corpus.',
        cites: ['PSI-25', 'research01:fm2-lunar'],
      })
    } else {
      missing.push({
        text: 'No PSI investigation, NASA research digest, or Earth dataset on disk covers this fuel, atmosphere, or equipment regime.',
        cites: ['research01:sec1-overview'],
      })
    }
    return {
      known: [],
      nearest,
      missing,
      earth: [
        {
          text: 'Earth safety transfers apply only to tested oxygen/pressure boundaries and hardware spinoffs (such as the 2020 ISS water-mist zero-leak valve and 1978 Brunswick detector), never untested hazards.',
          cites: ['earth:buoyancy-transfer-limits', 'spinoff:water-mist', 'spinoff:fire-detector'],
        },
      ],
    }
  }

  // If a cached preset matches cleanly and user did not ask for custom numbers or specialized intent
  if (
    parsed.environment_id &&
    !parsed.custom &&
    (parsed.intent === 'flammability' || parsed.intent === 'gap' || parsed.intent === 'earth_transfer')
  ) {
    const key = `${parsed.environment_id}|${fc}`
    const cached = corpus.answers[key]
    if (cached) {
      if (!parsed.fuel) return cached
      // Add fuel-specific run highlight if requested
      const fl = parsed.fuel.toLowerCase()
      const env = corpus.environments.find((e) => e.id === parsed.environment_id)
      const o2Target = env?.o2_pct ? (env.o2_pct[0] + env.o2_pct[1]) / 2 : 21
      const pTarget = env?.pressure_kpa ? (env.pressure_kpa[0] + env.pressure_kpa[1]) / 2 : 101.3
      const fuelRuns = corpus.runs
        .filter((r) => !isInverse(r) && r.fuel_class === fc && r.o2_pct !== null && effectivePressure(r) !== null)
        .filter((r) => r.fuel.toLowerCase().includes(fl) || (fl === 'cotton' && r.fuel.toLowerCase().includes('sibal')))
        .sort((a, b) => {
          const da = ((a.o2_pct! - o2Target) / 10) ** 2 + ((effectivePressure(a)! - pTarget) / 50) ** 2
          const db = ((b.o2_pct! - o2Target) / 10) ** 2 + ((effectivePressure(b)! - pTarget) / 50) ** 2
          return da - db
        })
      if (fuelRuns.length > 0) {
        const r0 = fuelRuns[0]
        const pDesc = r0.pressure_kpa !== null ? `${r0.pressure_kpa.toFixed(1)} kPa` : `${effectivePressure(r0)!.toFixed(1)} kPa assumed`
        return {
          ...cached,
          nearest: [
            {
              text: `Closest ${parsed.fuel}-matching run in PSI: ${r0.id} (${r0.fuel}, ${r0.o2_pct!.toFixed(1)}% O2, ${pDesc}, ${r0.outcome}) at 0 g.`,
              cites: [r0.id],
            },
            ...cached.nearest,
          ],
        }
      }
      return cached
    }
  }

  // Fallback synthesis from runs + passages for custom or cross-cutting queries
  const o2Target = parsed.custom?.o2 ?? 21.0
  const pTarget = parsed.custom?.pressure ?? 101.3
  const ambient = corpus.runs.filter(
    (r) => !isInverse(r) && (parsed.fuel_class === null || r.fuel_class === parsed.fuel_class) && r.o2_pct !== null && effectivePressure(r) !== null,
  )
  const inBox = ambient.filter(
    (r) => Math.abs(r.o2_pct! - o2Target) <= 1.5 && Math.abs(effectivePressure(r)! - pTarget) <= 5.0,
  )
  const sortedNearest = [...ambient].sort((a, b) => {
    const da = ((a.o2_pct! - o2Target) / 10) ** 2 + ((effectivePressure(a)! - pTarget) / 50) ** 2
    const db = ((b.o2_pct! - o2Target) / 10) ** 2 + ((effectivePressure(b)! - pTarget) / 50) ** 2
    return da - db
  })

  const tokens = question.toLowerCase().split(/\W+/).filter((t) => t.length >= 3)
  const topPassages = [...corpus.passages]
    .map((p) => ({
      p,
      hits: tokens.reduce((acc, t) => acc + (`${p.source_title} ${p.text}`.toLowerCase().includes(t) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map((x) => x.p)

  const known: Claim[] = []
  if (inBox.length > 0 && parsed.environment_id === null && parsed.custom !== null) {
    const r0 = inBox[0]
    const pDesc = r0.pressure_kpa !== null ? `${r0.pressure_kpa.toFixed(1)} kPa` : `${effectivePressure(r0)!.toFixed(1)} kPa assumed`
    known.push({
      text: `In 0 g microgravity, ${inBox.length} ambient ${parsed.fuel_class ?? 'PSI'} runs match near ${o2Target}% O2 and ${pTarget} kPa (e.g., ${r0.id}: ${r0.fuel}, ${r0.o2_pct}% O2, ${pDesc}, ${r0.outcome}).`,
      cites: inBox.slice(0, 3).map((r) => r.id),
    })
  } else if (topPassages.length > 0 && (parsed.intent === 'detection' || parsed.intent === 'suppression' || parsed.intent === 'comparison')) {
    known.push({
      text: topPassages[0].text,
      cites: [topPassages[0].id],
    })
  }

  const nearest: Claim[] = sortedNearest.slice(0, 2).map((r) => {
    const pDesc = r.pressure_kpa !== null ? `${r.pressure_kpa.toFixed(1)} kPa` : `${effectivePressure(r)!.toFixed(1)} kPa assumed`
    return {
      text: `Nearest ambient 0 g run: ${r.id} (${r.fuel}, ${r.o2_pct!.toFixed(1)}% O2, ${pDesc}, ${r.outcome}).`,
      cites: [r.id],
    }
  })

  return {
    known,
    nearest,
    missing: [
      {
        text: 'All cleaned PSI runs are 0 g only (zero 1/6 g lunar or 1 g Earth runs); partial-gravity and Earth buoyancy require separate evidence.',
        cites: ['research01:fm2-lunar', 'earth:buoyancy-transfer-limits'],
      },
    ],
    earth: [
      {
        text: 'Earth applications rely on verified oxygen/pressure limits and spinoffs (ISS water-mist valve, Shuttle dust-rejecting fire detector) because buoyancy remains present at 1 g.',
        cites: ['earth:buoyancy-transfer-limits', 'spinoff:water-mist', 'spinoff:fire-detector'],
      },
    ],
  }
}

async function callConfiguredLlm(
  systemPrompt: string,
  userContent: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase()
  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY?.trim()
    if (!key) throw new Error('ANTHROPIC_API_KEY not set')
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`)
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
    return (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
  }
  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY?.trim()
    if (!key) throw new Error('OPENAI_API_KEY not set')
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    })
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? ''
  }
  throw new Error(`Unsupported LLM_PROVIDER: ${provider}`)
}

function checkRateLimit(clientIp: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
  const arr = (ipHits.get(clientIp) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
  if (arr.length >= RATE_LIMIT_MAX) {
    const oldest = arr[0] ?? now
    ipHits.set(clientIp, arr)
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000)) }
  }
  arr.push(now)
  ipHits.set(clientIp, arr)
  return { allowed: true, retryAfterSec: 0 }
}

export async function handleAskRequest(input: {
  question: unknown
  clientIp?: string
  bypassRateLimit?: boolean
}): Promise<{
  status: number
  headers: Record<string, string>
  body: Record<string, unknown>
}> {
  const ip = input.clientIp ?? 'anonymous'
  if (!input.bypassRateLimit) {
    const rl = checkRateLimit(ip)
    if (!rl.allowed) {
      return {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) },
        body: { error: 'Rate limit exceeded. Try again shortly.' },
      }
    }
  }

  if (typeof input.question !== 'string' || !input.question.trim()) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Request must include a non-empty string field `question`.' },
    }
  }

  const question = input.question.trim().slice(0, MAX_QUESTION_CHARS)
  const corpus = loadCorpus()

  let parsed = parseQuestionTS(question)
  let mode = 'corpus-deterministic'
  const hasApiKey = Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(),
  )

  let rawAnswer: Partial<AnswerPayload> | null = null

  if (hasApiKey) {
    try {
      const parseModel = process.env.PARSE_MODEL ?? 'claude-haiku-5-5'
      const parseRaw = await callConfiguredLlm(
        'Extract JSON filters {environment_id, custom:{o2,pressure}|null, fuel_class, fuel, intent}. Return JSON only.',
        question,
        parseModel,
        PARSE_MAX_TOKENS,
      )
      const pm = parseRaw.match(/\{[\s\S]*\}/)
      if (pm) {
        const candidate = JSON.parse(pm[0]) as ParsedQuestion
        if ('intent' in candidate) parsed = candidate
      }

      const fc = parsed.fuel_class ?? 'solid'
      const candidateRuns = corpus.runs
        .filter((r) => !isInverse(r) && r.fuel_class === fc && r.o2_pct !== null && effectivePressure(r) !== null)
        .slice(0, 12)
      const tokens = question.toLowerCase().split(/\W+/).filter((t) => t.length >= 3)
      const candidatePassages = [...corpus.passages]
        .sort((a, b) => {
          const sa = tokens.reduce((acc, t) => acc + (`${a.id} ${a.text}`.toLowerCase().includes(t) ? 1 : 0), 0)
          const sb = tokens.reduce((acc, t) => acc + (`${b.id} ${b.text}`.toLowerCase().includes(t) ? 1 : 0), 0)
          return sb - sa
        })
        .slice(0, 8)

      const answerModel = process.env.ANSWER_MODEL ?? 'claude-sonnet-5-5'
      const answerRaw = await callConfiguredLlm(
        'Answer ONLY from the provided JSON corpus context. Output JSON {known, nearest, missing, earth} where every item has {text, cites[]}. Cite every numeric sentence.',
        JSON.stringify({ question, parsed, runs: candidateRuns, passages: candidatePassages, spinoffs: corpus.spinoffs }),
        answerModel,
        ANSWER_MAX_TOKENS,
      )
      const am = answerRaw.match(/\{[\s\S]*\}/)
      if (am) {
        rawAnswer = JSON.parse(am[0]) as Partial<AnswerPayload>
        mode = `live-${(process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase()}`
      }
    } catch {
      rawAnswer = null
      mode = 'corpus-fallback'
    }
  }

  if (!rawAnswer) {
    rawAnswer = buildDeterministicAnswer(corpus, question, parsed)
  }

  const { answer, report } = validateAnswerTS(rawAnswer, corpus.validIds)
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: {
      question,
      parsed,
      mode,
      answer,
      validation: report,
    },
  }
}

/** Web Standard Fetch API POST handler (Vercel Edge / Next / Vite SSR compatible). */
export async function POST(request: Request): Promise<Response> {
  try {
    const payload = (await request.json()) as { question?: unknown }
    const forwarded = request.headers.get('x-forwarded-for') ?? ''
    const clientIp = forwarded.split(',')[0]?.trim() || 'anonymous'
    const result = await handleAskRequest({ question: payload?.question, clientIp })
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: result.headers,
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/** Node / Vercel Serverless Function default handler `(req, res)`. */
export default async function handler(
  req: {
    method?: string
    body?: { question?: unknown } | string
    headers?: Record<string, string | string[] | undefined>
    socket?: { remoteAddress?: string }
  },
  res: {
    status: (code: number) => { json: (data: unknown) => void; setHeader?: (k: string, v: string) => void }
    setHeader: (name: string, value: string) => void
  },
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed; use POST.' })
    return
  }

  let parsedBody: { question?: unknown } = {}
  if (typeof req.body === 'string') {
    try {
      parsedBody = JSON.parse(req.body) as { question?: unknown }
    } catch {
      res.status(400).json({ error: 'Invalid JSON body.' })
      return
    }
  } else if (req.body && typeof req.body === 'object') {
    parsedBody = req.body
  }

  const fwd = req.headers?.['x-forwarded-for']
  const ipStr = Array.isArray(fwd) ? fwd[0] : fwd
  const clientIp = ipStr?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'anonymous'
  const result = await handleAskRequest({ question: parsedBody.question, clientIp })
  for (const [k, v] of Object.entries(result.headers)) {
    res.setHeader(k, v)
  }
  res.status(result.status).json(result.body)
}
