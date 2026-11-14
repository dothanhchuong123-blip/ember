import type { BoundaryGrid } from './types'

export const SUPPORT_CUT = 0.5

/** Monotonic single-hue amber ramp for CSS legend bar (low warm slate -> high amber). */
export const FLAME_RAMP = ['rgba(222, 146, 72, 0.14)', 'rgba(235, 146, 58, 0.28)', 'rgba(247, 173, 82, 0.42)']

const PLOT_BASE = [13, 12, 10] // matches #0d0c0a plot background
const AMBER_LOW = [194, 136, 82] // warm subtle amber at score = 0
const AMBER_MID = [230, 140, 56] // warm ochre at score = 0.5
const AMBER_HIGH = [248, 178, 86] // luminous amber at score = 1.0

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function lerpRgb(score: number): [number, number, number] {
  if (score <= 0.5) {
    const t = score * 2
    return [
      AMBER_LOW[0] + (AMBER_MID[0] - AMBER_LOW[0]) * t,
      AMBER_LOW[1] + (AMBER_MID[1] - AMBER_LOW[1]) * t,
      AMBER_LOW[2] + (AMBER_MID[2] - AMBER_LOW[2]) * t,
    ]
  }
  const t = (score - 0.5) * 2
  return [
    AMBER_MID[0] + (AMBER_HIGH[0] - AMBER_MID[0]) * t,
    AMBER_MID[1] + (AMBER_HIGH[1] - AMBER_MID[1]) * t,
    AMBER_MID[2] + (AMBER_HIGH[2] - AMBER_MID[2]) * t,
  ]
}

/** Smooth discrete tree-step predictions across adjacent supported grid cells so
 * step boundaries become continuous gradients without horizontal striping or banding. */
function smoothSupportedField(values: number[][], support: number[][], passes: number): Float64Array {
  const rows = values.length
  const cols = values[0]?.length ?? 0
  let cur = new Float64Array(rows * cols)
  const tmp = new Float64Array(rows * cols)
  const next = new Float64Array(rows * cols)

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) cur[j * cols + i] = values[j][i]
  }

  for (let pass = 0; pass < passes; pass++) {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (support[j][i] < SUPPORT_CUT) {
          tmp[j * cols + i] = cur[j * cols + i]
          continue
        }
        let sum = cur[j * cols + i] * 2
        let weight = 2
        if (i > 0 && support[j][i - 1] >= SUPPORT_CUT) {
          sum += cur[j * cols + i - 1]
          weight += 1
        }
        if (i + 1 < cols && support[j][i + 1] >= SUPPORT_CUT) {
          sum += cur[j * cols + i + 1]
          weight += 1
        }
        tmp[j * cols + i] = sum / weight
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (support[j][i] < SUPPORT_CUT) {
          next[j * cols + i] = tmp[j * cols + i]
          continue
        }
        let sum = tmp[j * cols + i] * 2
        let weight = 2
        if (j > 0 && support[j - 1][i] >= SUPPORT_CUT) {
          sum += tmp[(j - 1) * cols + i]
          weight += 1
        }
        if (j + 1 < rows && support[j + 1][i] >= SUPPORT_CUT) {
          sum += tmp[(j + 1) * cols + i]
          weight += 1
        }
        next[j * cols + i] = sum / weight
      }
    }
    cur.set(next)
  }
  return cur
}

/** Render a smooth, stripe-free low-opacity field strictly where support >= 0.5.
 * Supported pixels pre-composite ~14-38% warm amber onto #0d0c0a and fade smoothly at
 * the support = 0.5 edge so unsupported areas keep their quiet hatch pattern underneath. */
export function heatmapImage(grid: BoundaryGrid) {
  const columns = grid.pressure_axis_kpa.length - 1
  const rows = grid.o2_axis.length - 1
  if (columns < 1 || rows < 1) return undefined

  const colsLen = columns + 1
  const smoothed = smoothSupportedField(grid.p_sustain, grid.support, 16)
  const scaleX = 10
  const scaleY = 8
  const width = columns * scaleX
  const height = rows * scaleY

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  const image = ctx.createImageData(width, height)

  for (let py = 0; py < height; py++) {
    const o = Math.max(0, Math.min(rows - 1e-4, rows * (1 - (py + 0.5) / height)))
    const j = Math.floor(o)
    const v = o - j
    for (let px = 0; px < width; px++) {
      const p = Math.max(0, Math.min(columns - 1e-4, columns * (px + 0.5) / width))
      const i = Math.floor(p)
      const u = p - i
      const weights = [(1 - v) * (1 - u), (1 - v) * u, v * (1 - u), v * u]
      const supCorners = [
        grid.support[j][i],
        grid.support[j][i + 1],
        grid.support[j + 1][i],
        grid.support[j + 1][i + 1],
      ]
      const sup = weights[0] * supCorners[0] + weights[1] * supCorners[1] + weights[2] * supCorners[2] + weights[3] * supCorners[3]
      if (sup < SUPPORT_CUT) continue

      const scoreCorners = [
        smoothed[j * colsLen + i],
        smoothed[j * colsLen + i + 1],
        smoothed[(j + 1) * colsLen + i],
        smoothed[(j + 1) * colsLen + i + 1],
      ]
      let scoreSum = 0
      let weightSum = 0
      for (let k = 0; k < 4; k++) {
        if (supCorners[k] < SUPPORT_CUT) continue
        scoreSum += weights[k] * scoreCorners[k]
        weightSum += weights[k]
      }
      if (!weightSum) continue

      const score = Math.max(0, Math.min(1, scoreSum / weightSum))
      const edgeFade = smoothstep(SUPPORT_CUT, SUPPORT_CUT + 0.20, sup)
      // 18% at score=0 up to 38% at score=1, composited over plot base so hatch stays outside support
      const tintOpacity = 0.18 + 0.20 * score
      const [tr, tg, tb] = lerpRgb(score)
      const offset = (py * width + px) * 4
      image.data[offset] = Math.round(PLOT_BASE[0] * (1 - tintOpacity) + tr * tintOpacity)
      image.data[offset + 1] = Math.round(PLOT_BASE[1] * (1 - tintOpacity) + tg * tintOpacity)
      image.data[offset + 2] = Math.round(PLOT_BASE[2] * (1 - tintOpacity) + tb * tintOpacity)
      image.data[offset + 3] = Math.round(255 * edgeFade)
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL()
}
