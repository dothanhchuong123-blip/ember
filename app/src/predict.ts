// EMBER live predictor for ml/model.json (Track B, B4). Pure TypeScript, no dependencies.
// Track C: copy this file into app/src/ (or import it) and load /data/model.json.
// Verified against Python by `node ml/check_predict.ts` (ml/testpoints.json).
// Written with SI assistance during the event; see AI-USE.md.

export type FuelClassKey = 'droplet' | 'gas' | 'solid'

interface Encoder {
  numeric: string[]
  categorical: Record<string, string[]>
  medians: Record<string, number>
  feature_names: string[]
}
interface Logistic { type: 'logistic'; mean: number[]; scale: number[]; coef: number[]; intercept: number }
interface Tree { feature: number[]; threshold: number[]; left: number[]; right: number[]; value: number[] }
interface Gbm { type: 'gbm'; init: number; learning_rate: number; trees: Tree[] }
interface SupportSpec {
  s_o2: number; s_ln_p: number; k: number; cut: number
  points: (number | string)[][] // [o2, pressure, ...context values]
  context_keys: string[]
}
export interface ClassModel {
  model: string; status: string; target: string
  encoder: Encoder; params: Logistic | Gbm; support: SupportSpec
}
export interface ModelFile { trained_at: string; by_fuel_class: Partial<Record<FuelClassKey, ClassModel>> }

/** Inputs: o2_pct and pressure_kpa always; other numeric (size_mm, burner_xf, burner_fuel_mg_s) and
 *  categorical (diluent, fuel_key, fuel_base) fields are optional. Missing numeric -> training median. */
export type WhatIf = Record<string, number | string | null | undefined>

function features(enc: Encoder, q: WhatIf): number[] {
  const x: number[] = []
  const o2 = Number(q.o2_pct), p = Number(q.pressure_kpa)
  for (const c of enc.numeric) {
    if (c === 'ppo2_kpa') x.push((o2 / 100) * p)
    else {
      const v = q[c]
      x.push(v === null || v === undefined || v === '' ? enc.medians[c] : Number(v))
    }
  }
  for (const [c, values] of Object.entries(enc.categorical)) for (const v of values) x.push(q[c] === v ? 1 : 0)
  return x
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

export function predictSustain(m: ClassModel, q: WhatIf): number {
  const x = features(m.encoder, q)
  const prm = m.params
  if (prm.type === 'logistic') {
    let z = prm.intercept
    for (let i = 0; i < x.length; i++) z += (prm.coef[i] * (x[i] - prm.mean[i])) / prm.scale[i]
    return sigmoid(z)
  }
  let raw = prm.init
  for (const t of prm.trees) {
    let n = 0
    while (t.left[n] !== -1) n = x[t.feature[n]] <= t.threshold[n] ? t.left[n] : t.right[n]
    raw += prm.learning_rate * t.value[n]
  }
  return sigmoid(raw)
}

/** Evidence strength 0–1: mean of exp(-d²/2) over the k nearest real runs (same context, e.g. same diluent). */
export function supportAt(m: ClassModel, q: WhatIf): number {
  const s = m.support
  const qo = Number(q.o2_pct) / s.s_o2, qp = Math.log(Number(q.pressure_kpa)) / s.s_ln_p
  const d2: number[] = []
  for (const pt of s.points) {
    if (!s.context_keys.every((k, i) => pt[2 + i] === q[k])) continue
    const a = Number(pt[0]) / s.s_o2 - qo, b = Math.log(Number(pt[1])) / s.s_ln_p - qp
    d2.push(a * a + b * b)
  }
  if (!d2.length) return 0
  d2.sort((u, v) => u - v)
  const k = Math.min(s.k, d2.length)
  let sum = 0
  for (let i = 0; i < k; i++) sum += Math.exp(-d2[i] / 2)
  return sum / k
}

/** What the panel should show: a score only where the evidence reaches. */
export function whatIf(m: ClassModel, q: WhatIf): { support: number; p_sustain: number | null; inSupport: boolean } {
  const support = supportAt(m, q)
  const inSupport = support >= m.support.cut
  return { support, p_sustain: inSupport ? predictSustain(m, q) : null, inSupport }
}
