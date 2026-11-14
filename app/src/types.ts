import type { ModelFile } from './predict'

// Data contracts shared by every track. Source of truth: PLAYBOOK.md § 6.
// Code in this app was written with SI assistance (Claude Code) during the event; see AI-USE.md.

export type FuelClass = 'solid' | 'droplet' | 'gas'
export type Outcome = 'sustained' | 'extinguished' | 'no_ignition' | 'unknown'
export type Pillar = 'prevention' | 'detection' | 'suppression' | 'fundamentals'

export interface Run {
  id: string
  investigation: string
  fuel_class: FuelClass
  fuel: string
  gravity: '0g' | '1g'
  o2_pct: number | null
  pressure_kpa: number | null
  /** Set only when the source table has no pressure column and a cited document gives the cabin/chamber pressure. Drawn hollow. */
  pressure_assumed_kpa?: number | null
  pressure_note?: string
  diluent: string | null
  flow_cm_s: number | null
  outcome: Outcome
  outcome_detail: string
  outcome_origin: 'table' | 'report-extracted' | 'none'
  metrics: Record<string, number | null>
  raw: Record<string, string>
  source: { file: string; row: number; url: string; doi: string }
  flags: string[]
}

export interface Investigation {
  id: string
  name: string
  short: string
  fuel_class: FuelClass
  pillar: Pillar
  hardware: string
  years: string
  objective: string
  fuels: string
  conditions: string
  variables: string
  sensors: string
  findings: { text: string; cite: string }[]
  profile_origin: string
  n_runs: number
  o2_range: [number, number] | null
  pressure_range_kpa: [number, number] | null
  url: string
  doi: string
  licence: string
  earth_links: string[]
  has_video: boolean
}

export interface Environment {
  id: string
  domain: 'space' | 'earth'
  name: string
  o2_pct: [number, number]
  pressure_kpa: [number, number]
  gravity_g: number
  why_it_matters: string
  sources: { label: string; url: string }[]
  verified: boolean
}

export interface Spinoff {
  id: string
  title: string
  year: number
  nasa_origin: string
  earth_use: string
  benefit: string
  linked_investigations: string[]
  source_url: string
}

export interface BoundaryGrid {
  o2_axis: number[]
  pressure_axis_kpa: number[]
  p_sustain: number[][] // [o2 index][pressure index]
  support: number[][] // 0–1; draw p_sustain only where support >= 0.5
}

export interface BoundaryClass extends BoundaryGrid {
  status: string
  model: string
  target: string
  pressure_note: string
  n_train: number
  variants: Partial<Record<'CO2' | 'He', BoundaryGrid>>
  metrics: {
    balanced_accuracy: number
    baseline_balanced_accuracy: number
    stress_balanced_accuracy: number
    cv: string
  }
}

export interface Boundary {
  trained_at: string | null
  model: string
  metrics: {
    balanced_accuracy: number | null
    balanced_accuracy_95ci?: [number, number]
    baseline_balanced_accuracy: number | null
    n_train: number
    n_groups: number
    cv: string
  }
  by_fuel_class: Partial<Record<FuelClass, BoundaryClass>>
}

export interface Claim {
  text: string
  cites: string[]
}

export interface Answer {
  known: Claim[]
  nearest: Claim[]
  missing: Claim[]
  earth: Claim[]
}

export interface Meta {
  mock: boolean
  note?: string
}

export interface Dataset {
  meta: Meta
  runs: Run[]
  investigations: Investigation[]
  environments: Environment[]
  spinoffs: Spinoff[]
  boundary: Boundary | null
  model: ModelFile | null
  answers: Record<string, Answer>
  passages: { id: string; source_title: string; page_or_section?: string; url: string; text?: string }[]
}


export interface SourceLink {
  label: string
  url: string
}

export interface EvidenceCard {
  id: string
  title: string
  mode: 'compare' | 'evidence' | 'gap'
  verified: boolean
  environment_ids: string[]
  related_investigations: string[]
  model_ids?: string[]
  evidence: { text: string; sources: SourceLink[]; verified?: boolean }[]
  gaps: string[]
  si_generated?: boolean
}

export interface LocalFact {
  id: string
  geography: string
  text: string
  sources: SourceLink[]
  verified?: boolean
  si_generated?: boolean
}

export interface AppData extends Dataset {
  evidenceCards: EvidenceCard[]
  localStory: LocalFact[]
}
