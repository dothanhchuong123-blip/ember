import { effectivePressure } from './data'
import type { Answer, Claim, Environment, FuelClass, Investigation, Run } from './types'

export interface CitedSource {
  number: number
  id: string
  shortName: string
  description: string
  url?: string
  canPlot: boolean
}

export interface SummaryLine {
  text: string
  citeNumbers: number[]
  /** Parent claim citations for highlighting excerpts, including clauses with no printed markers. */
  sourceNumbers?: number[]
}

export interface ColumnSummary {
  key: 'known' | 'nearest' | 'missing' | 'earth'
  title: string
  /** True when the Known section is the "no evidence here" refusal. Shown as a refusal, never softened. */
  refusal: boolean
  headline: SummaryLine
  bullets: SummaryLine[]
  fullClaims: { text: string; citeNumbers: number[] }[]
}

export interface CitedAnswerSummary {
  columns: ColumnSummary[]
  sources: CitedSource[]
}

interface SummaryContext {
  answer: Answer
  fuel: FuelClass
  fuelRuns: Run[]
  isCabinTest: (run: Run) => boolean
  placeNames: Record<string, string>
  runById: Map<string, Run>
  investigationById: Map<string, Investigation>
  passageById: Map<string, { id: string; source_title: string; page_or_section?: string; url: string }>
  envByCitation: Map<string, Environment>
}

const SECTION_DEFS: { key: 'known' | 'nearest' | 'missing' | 'earth'; title: string }[] = [
  { key: 'known', title: 'Known' },
  { key: 'nearest', title: 'Nearest' },
  { key: 'missing', title: 'Missing' },
  { key: 'earth', title: 'Why it matters on Earth' },
]

function capitalizeFirst(text: string): string {
  if (!text) return text
  const first = text[0]
  return first >= 'a' && first <= 'z' ? first.toUpperCase() + text.slice(1) : text
}

function ensurePeriod(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * Removes inline run-ID/example parentheticals whose referenced runs move into the numbered source list,
 * while preserving scientific qualifiers (e.g. tolerances, pressure assumptions, theoretical-only notes).
 */
function trimExampleParens(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '(') {
      let depth = 1
      let j = i + 1
      while (j < text.length && depth > 0) {
        if (text[j] === '(') depth += 1
        else if (text[j] === ')') depth -= 1
        j += 1
      }
      const inner = text.slice(i + 1, j - 1)
      const lower = inner.toLowerCase()
      const isExampleDump =
        lower.startsWith('e.g.') ||
        lower.startsWith('highest ') ||
        lower.startsWith('including ') ||
        lower.startsWith('minimum ') ||
        lower.startsWith('100 micron') ||
        lower.startsWith('200 micron') ||
        lower.startsWith('see ') ||
        lower.startsWith('[.') ||
        (lower.includes('psi-') && inner.length > 22 && !lower.includes('assumed') && !lower.includes('theoretical'))
      if (isExampleDump) {
        if (out.endsWith(' ')) out = out.slice(0, -1)
        i = j
        continue
      }
      out += text.slice(i, j)
      i = j
    } else {
      out += text[i]
      i += 1
    }
  }
  return out.replace(/\s+([,.;:])/g, '$1').trim()
}

function splitOutsideParens(text: string, seps: string[]): { seg: string; sep: string }[] {
  const parts: { seg: string; sep: string }[] = []
  let buf = ''
  let depth = 0
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '(') depth += 1
    else if (ch === ')' && depth > 0) depth -= 1
    let matched = ''
    if (depth === 0) {
      for (const sep of seps) {
        if (text.startsWith(sep, i)) {
          matched = sep
          break
        }
      }
    }
    if (matched) {
      const clean = buf.trim()
      if (clean) parts.push({ seg: clean, sep: matched })
      buf = ''
      i += matched.length
      continue
    }
    buf += ch
    i += 1
  }
  const tail = buf.trim()
  if (tail) parts.push({ seg: tail, sep: '' })
  return parts
}

function splitClaimClauses(claimText: string, allowColonSplit: boolean): string[] {
  const clean = trimExampleParens(claimText)
  const seps = allowColonSplit ? ['. ', '; ', ': '] : ['. ', '; ']
  const rawParts = splitOutsideParens(clean, seps)
  const merged: string[] = []
  for (let i = 0; i < rawParts.length; i++) {
    let { seg, sep } = rawParts[i]
    while (
      sep === ': ' &&
      i + 1 < rawParts.length &&
      (seg.length < 32 || /\b(?:are|is|include|near|with)$/.test(seg))
    ) {
      i += 1
      seg = `${seg}: ${rawParts[i].seg}`
      sep = rawParts[i].sep
    }
    while (sep === '; ' && i + 1 < rawParts.length && /^PSI-\d+/i.test(rawParts[i + 1].seg)) {
      i += 1
      seg = `${seg}; ${rawParts[i].seg}`
      sep = rawParts[i].sep
    }
    const formatted = ensurePeriod(capitalizeFirst(seg))
    if (formatted && !merged.includes(formatted)) merged.push(formatted)
  }
  return merged
}

function formatPassageSection(raw?: string): string {
  if (!raw) return 'Referenced passage'
  return raw
    .replace(/\bresearch\/01-nasa-sources\.md/g, 'NASA research summary')
    .replace(/\bresearch\/02-earth-applications\.md/g, 'Earth safety notes')
    .replace(/\bdata\/clean\/investigations\.json\s*·\s*/g, 'NASA PSI archive · ')
    .replace(/\bdata\/earth\/[a-z-]+\.json\s*·\s*/g, 'Environment notes · ')
    .replace(/\s*&\s*PLAYBOOK[^·]*/g, '')
    .replace(/\s*&?\s*local-story\.json/g, '')
    .trim()
}

function resolveCitation(id: string, number: number, ctx: SummaryContext): CitedSource {
  const run = ctx.runById.get(id)
  if (run) {
    const study = ctx.investigationById.get(run.investigation)
    const runCode = id.startsWith(`${run.investigation}:`) ? id.slice(run.investigation.length + 1) : id
    const o2 = run.o2_pct !== null ? `${run.o2_pct}% O₂` : 'O₂ n/a'
    const pressure = effectivePressure(run)
    const pText = pressure !== null ? `${pressure} kPa${run.pressure_assumed_kpa ? ' assumed' : ''}` : 'pressure n/a'
    const outcome = run.outcome.replace('_', ' ')
    return {
      number,
      id,
      shortName: `${study?.short || run.investigation} run ${runCode}`,
      description: `${run.fuel} · ${o2} · ${pText} · ${outcome}`,
      url: run.source.url || study?.url,
      canPlot:
        run.fuel_class === ctx.fuel &&
        ctx.isCabinTest(run) &&
        run.o2_pct !== null &&
        effectivePressure(run) !== null,
    }
  }

  const study = ctx.investigationById.get(id)
  if (study) {
    const shortName = study.short && study.short !== study.id ? `${study.short} (${study.id})` : study.id
    const runCountLabel = study.n_runs > 0 ? `${study.n_runs} runs` : 'burner summaries'
    return {
      number,
      id,
      shortName,
      description: `${study.name} · ${study.fuel_class} study (${runCountLabel})`,
      url: study.url,
      canPlot: ctx.fuelRuns.some((item) => item.investigation === id && item.o2_pct !== null && effectivePressure(item) !== null),
    }
  }

  const passage = ctx.passageById.get(id)
  if (passage) {
    return {
      number,
      id,
      shortName: passage.source_title,
      description: formatPassageSection(passage.page_or_section),
      url: passage.url,
      canPlot: false,
    }
  }

  const place = ctx.envByCitation.get(id)
  if (place) {
    return {
      number,
      id,
      shortName: ctx.placeNames[place.id] ?? place.name,
      description: `${place.name} environment reference`,
      url: place.sources[0]?.url,
      canPlot: false,
    }
  }

  return {
    number,
    id,
    shortName: id,
    description: 'Cited reference',
    canPlot: false,
  }
}

function summarizeColumnClaims(
  claims: Claim[],
  citeToNumber: (id: string) => number
): { headline: SummaryLine; bullets: SummaryLine[]; fullClaims: { text: string; citeNumbers: number[] }[] } {
  const lines: SummaryLine[] = []
  const fullClaims = claims.map((claim) => ({
    text: claim.text,
    citeNumbers: Array.from(new Set(claim.cites.map(citeToNumber))),
  }))

  claims.forEach((claim, claimIndex) => {
    const clauses = splitClaimClauses(claim.text, claimIndex === 0)
    const citeNums = Array.from(new Set(claim.cites.map(citeToNumber)))
    clauses.forEach((clause, clauseIndex) => {
      lines.push({
        text: clause,
        // The claim's markers go on its opening line and on every later line that states a number,
        // so no number is ever shown without its citation.
        citeNumbers: clauseIndex === 0 || /\d/.test(clause) ? citeNums : [],
        sourceNumbers: citeNums,
      })
    })
  })

  return {
    headline: lines[0] ?? { text: '', citeNumbers: [] },
    bullets: lines.slice(1, 3),
    fullClaims,
  }
}

export function buildCitedAnswerSummary(ctx: SummaryContext): CitedAnswerSummary {
  const numberById = new Map<string, number>()
  const sources: CitedSource[] = []

  const citeToNumber = (id: string): number => {
    const existing = numberById.get(id)
    if (existing !== undefined) return existing
    const next = sources.length + 1
    numberById.set(id, next)
    sources.push(resolveCitation(id, next, ctx))
    return next
  }

  const columns: ColumnSummary[] = []
  for (const { key, title } of SECTION_DEFS) {
    // A sentence that states a number without a citation is never shown (the server validator drops these
    // too; this covers any answer that reaches the page another way).
    const claims = (ctx.answer[key] ?? []).filter((claim) => claim.cites.length > 0 || !/\d/.test(claim.text))
    if (!claims.length) continue
    const summary = summarizeColumnClaims(claims, citeToNumber)
    columns.push({
      key,
      title,
      refusal: key === 'known' && claims.every((claim) => claim.cites.length === 0),
      ...summary,
    })
  }

  return { columns, sources }
}
