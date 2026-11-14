import type { CitedAnswerSummary, SummaryLine } from './answerSummary'
import type { Ranked } from './data'
import { whatIf } from './predict'
import type { Dataset, Environment, FuelClass, Run } from './types'

interface Reference {
  label: string
  url?: string
}

export interface Brief {
  title: string
  date: string
  fuelLabel: string
  sample: boolean
  atmosphere: SummaryLine[]
  answer: { title: string; lines: SummaryLine[] }[]
  studies: { title: SummaryLine; reasons: string[] }[]
  model: SummaryLine
  sources: Reference[]
}

export const BRIEF_LABEL = 'SI-generated'
const MISSING = 'not reported'
const ANSWER_SECTIONS = [
  { key: 'known', title: 'Known' },
  { key: 'nearest', title: 'Nearest' },
  { key: 'missing', title: 'Missing' },
  { key: 'earth', title: 'Earth' },
] as const

function reportedRange(range: [number, number] | null | undefined, unit: string): string {
  if (range?.[0] == null || range[1] == null) return MISSING
  const [low, high] = range
  return low === high ? `${low} ${unit}` : `${low}–${high} ${unit}`
}

function normalizeMissing(text: string): string {
  return text.replace(/\b(?:null|n\/a)\b/gi, MISSING)
}

export function buildBrief({
  data, env, fuel, fuelLabel, runs, ranked, summary, date,
}: {
  data: Dataset
  env: Environment
  fuel: FuelClass
  fuelLabel: string
  runs: Run[]
  ranked: Ranked[]
  summary: CitedAnswerSummary | null
  date: string
}): Brief {
  const sources: Reference[] = []
  function cite(label: string, url?: string): number {
    const href = url && /^https?:\/\//i.test(url) ? new URL(url).href : undefined
    const index = sources.findIndex((source) => source.label === label && source.url === href)
    if (index !== -1) return index + 1
    return sources.push({ label, url: href })
  }

  const placeCites = env.sources.map(({ label, url }) => cite(label, url))
  const atmosphere: SummaryLine[] = [
    { text: `Oxygen ${reportedRange(env.o2_pct, '%')}`, citeNumbers: [] },
    { text: `Pressure ${reportedRange(env.pressure_kpa, 'kPa')}`, citeNumbers: [] },
    { text: `Gravity ${env.gravity_g == null ? MISSING : `${env.gravity_g} g`}`, citeNumbers: placeCites },
  ]

  const answerRefs = summary?.sources.map((source) => {
    const run = data.runs.find(({ id }) => id === source.id)
    const place = data.environments.find(({ id }) => `env:${id}` === source.id)
    if (place?.sources.length) return place.sources.map(({ label, url }) => cite(label, url))
    const table = run?.source.file.match(/Experimental table_(.+)\.csv$/)?.[1]
    const study = data.investigations.find(({ id }) => id === source.id)
    const label = run
      ? `${source.shortName} · ${table ?? 'experimental table'}, row ${run.source.row}`
      : study ? `${source.shortName} · PSI record and data` : `${source.shortName} · ${source.description}`
    return [cite(label, source.url)]
  }) ?? []
  const answer = ANSWER_SECTIONS.map(({ key, title }) => ({
    title,
    lines: summary?.columns.find((column) => column.key === key)?.fullClaims.map(({ text, citeNumbers }) => ({
      text: normalizeMissing(text),
      citeNumbers: [...new Set(citeNumbers.flatMap((number) => answerRefs[number - 1]))],
    })) ?? [{ text: MISSING, citeNumbers: [] }],
  }))

  const studies = ranked.slice(0, 5).map(({ investigation, reasons }) => {
    const name = investigation.short || investigation.name
    const studyRuns = runs.filter(({ investigation: id }) => id === investigation.id)
    const citeNumbers = [cite(
      `${investigation.short && investigation.short !== investigation.id ? `${name} (${investigation.id})` : investigation.id} · PSI record and data`,
      investigation.url,
    )]
    const pressureNote = studyRuns.find((run) => run.pressure_assumed_kpa != null)?.pressure_note
    const pressureSource = pressureNote?.match(/\((https?:\/\/[^)]+)\)/)?.[1]
    if (pressureSource) citeNumbers.push(cite('NASA Researcher’s Guide to Combustion Science, p. 19', pressureSource))

    return {
      title: { text: `${investigation.id} · ${name}`, citeNumbers },
      reasons: reasons.map((reason) => reason.verdict === 'not_recorded'
        ? `${reason.factor === 'oxygen' ? 'Oxygen' : reason.factor === 'pressure' ? 'Pressure' : 'Test gravity'} ${MISSING}`
        : reason.text.charAt(0).toUpperCase() + reason.text.slice(1)),
    }
  })

  const classModel = data.model?.by_fuel_class[fuel]
  const oxygen = env.o2_pct
  const pressure = env.pressure_kpa
  const hasAir = oxygen?.[0] != null && oxygen[1] != null && pressure?.[0] != null && pressure[1] != null
  const result = classModel && hasAir ? whatIf(classModel, {
    o2_pct: (oxygen[0] + oxygen[1]) / 2,
    pressure_kpa: (pressure[0] + pressure[1]) / 2,
    diluent: fuel === 'droplet' ? 'N2' : undefined,
  }) : null

  const status = result?.p_sustain != null && env.gravity_g === 0
    ? `Class-balanced score for sustained burning ${result.p_sustain.toFixed(3)}. The score describes microgravity test conditions.`
    : 'No evidence here.'
  const support = result
    ? ` Air-only support ${Number(result.support.toPrecision(3))}. Evaluated at the preset midpoint${fuel === 'droplet' ? ' with nitrogen diluent' : ''}.`
    : ' Air-only support not reported.'
  const scope = env.gravity_g != null && env.gravity_g !== 0
    ? ' The model covers microgravity only.'
    : ''
  const caveat = data.boundary?.by_fuel_class[fuel]
  const limit = caveat?.pressure_note
    ? ` ${caveat.pressure_note.charAt(0).toUpperCase() + caveat.pressure_note.slice(1)} BASS-II outcomes are SI-extracted from the NASA report; a human check of 20 of 113 labels against the report agreed on all 20.`
    : caveat?.status.startsWith('experiment')
      ? ' The gas model underperformed the oxygen-threshold baseline on held-out days.'
      : ''
  const modelCites = classModel ? [cite(
    'EMBER microgravity model and support data',
    new URL(`${import.meta.env.BASE_URL}data/model.json`, window.location.href).href,
  )] : []
  if (limit && caveat) modelCites.push(cite(
    'EMBER model boundary and caveats',
    new URL(`${import.meta.env.BASE_URL}data/boundary.json`, window.location.href).href,
  ))

  return {
    title: env.name, fuelLabel, date, sample: data.meta.mock, atmosphere, answer, studies, sources,
    model: { text: status + support + scope + limit, citeNumbers: modelCites },
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]<>!]/g, '\\$&')
}

export function briefMarkdown(brief: Brief): string {
  const line = ({ text, citeNumbers }: SummaryLine) => [
    escapeMarkdown(text),
    ...citeNumbers.map((n) => brief.sources[n - 1]?.url ? `[${n}][ref-${n}]` : `\\[${n}\\]`),
  ].join(' ')
  const sourceItems = brief.sources.map(({ label, url }, index) => {
    const name = escapeMarkdown(label)
    const n = index + 1
    return `- \\[${n}\\] ${url ? `[${name}][ref-${n}]` : name}`
  })
  const definitions = brief.sources.flatMap(({ url }, index) => url
    ? [`[ref-${index + 1}]: <${url.replace(/</g, '%3C').replace(/>/g, '%3E')}>`]
    : [])

  return [
    '# EMBER evidence brief',
    `## ${escapeMarkdown(brief.title)}`,
    `${escapeMarkdown(brief.fuelLabel)} · ${brief.date} · **${BRIEF_LABEL}**`,
    ...(brief.sample ? ['Sample data for preview.'] : []),
    '### Atmosphere',
    brief.atmosphere.map(line).join(' · '),
    ...brief.answer.flatMap(({ title, lines }) => [`### ${title}`, ...lines.map(line)]),
    '### Top-ranked investigations',
    brief.studies.length
      ? brief.studies.map(({ title, reasons }) => `- **${line(title)}** — ${reasons.map(escapeMarkdown).join(' · ')}`).join('\n')
      : MISSING,
    '### Microgravity model',
    line(brief.model),
    '### Citations',
    sourceItems.join('\n'),
    definitions.join('\n'),
  ].join('\n\n') + '\n'
}
