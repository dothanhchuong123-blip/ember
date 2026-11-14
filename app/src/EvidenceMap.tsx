import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { FLAME_RAMP, heatmapImage } from './boundaryHeatmap'
import { distanceToRange, effectivePressure } from './data'
import { boxAt, clamp, inset, overlaps, placeInspector, placeLabel as layoutLabel } from './evidenceMapLayout'
import type { Box, Point } from './evidenceMapLayout'
import './evidence-map-guide.css'
import { fadeTransition, runEntryDelay, scenarioFade, useMotionPreference } from './motion'
import { whatIf } from './predict'
import type { ModelFile } from './predict'
import { tokens } from './tokens'
import { ScenarioNumber } from './components/ScenarioNumber'
import type { Boundary, BoundaryGrid, Environment, FuelClass, Investigation, Run } from './types'

const NORMOXIC_KPA = 21.3
const OUTCOME_LABEL: Record<Run['outcome'], string> = {
  sustained: 'Kept burning',
  extinguished: 'Went out',
  no_ignition: 'Did not ignite',
  unknown: 'Outcome unknown',
}
const DILUENTS = [
  { value: 'N2', label: 'Nitrogen (N₂)' },
  { value: 'CO2', label: 'Carbon dioxide (CO₂)' },
  { value: 'He', label: 'Helium (He)' },
] as const
type Diluent = typeof DILUENTS[number]['value']
type PlottedRun = Run & { o2_pct: number; pressure: number }
type PlotScale = ReturnType<typeof scaleLinear<number, number>>
type Glyph = { run: PlottedRun; cx: number; cy: number; radius: number }

function formatRangeShort([a, b]: [number, number], unit: string) {
  const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : `${+n.toFixed(2)}`)
  return a === b ? `${fmt(a)}${unit}` : `${fmt(a)}–${fmt(b)}${unit}`
}

/** Raw difference for labels: one decimal, two when the gap is under 0.1, never rounded to a false 0. */
function formatGap(value: number) {
  return `${+value.toFixed(value < 0.1 ? 2 : 1)}`
}

export interface EvidenceMapPlace {
  id: string
  label: string
  o2_pct: [number, number]
  pressure_kpa: [number, number]
}

function supportLookup(grid: BoundaryGrid | undefined, p: number, o2: number): number {
  if (!grid) return 0
  const pAxis = grid.pressure_axis_kpa
  const oAxis = grid.o2_axis
  if (p < pAxis[0] || p > pAxis[pAxis.length - 1] || o2 < oAxis[0] || o2 > oAxis[oAxis.length - 1]) return 0
  let i = 0
  while (i + 1 < pAxis.length && pAxis[i + 1] < p) i++
  let j = 0
  while (j + 1 < oAxis.length && oAxis[j + 1] < o2) j++
  return grid.support[j]?.[i] ?? 0
}

const heatmapURLs = new WeakMap<BoundaryGrid, string>()

function BoundaryRaster({ url, placement, width, height, reduced }: {
  url: string; placement: string; width: number; height: number; reduced: boolean
}) {
  return (
    <motion.g {...scenarioFade(reduced)} exit={{ opacity: 0 }} aria-hidden="true">
      <image className="boundary-raster plot-glide" width={width} height={height} href={url} preserveAspectRatio="none"
        style={{ transform: placement }} />
    </motion.g>
  )
}

function Heatmap({ grid, boundary, x, y, reduced }: {
  grid?: BoundaryGrid; boundary: Boundary | null; x: PlotScale; y: PlotScale; reduced: boolean
}) {
  const [, refresh] = useState(0)
  useEffect(() => {
    if (!grid || heatmapURLs.has(grid)) return
    const task = window.setTimeout(() => {
      const url = heatmapImage(grid)
      if (url) {
        heatmapURLs.set(grid, url)
        refresh((revision) => revision + 1)
      }
    }, 0)
    return () => window.clearTimeout(task)
  }, [grid])
  useEffect(() => {
    if (!boundary || !window.requestIdleCallback) return
    const grids = Object.values(boundary.by_fuel_class).flatMap((value) => [value, ...Object.values(value.variants ?? {})])
    let task: number
    const warmNext = () => {
      const next = grids.shift()
      if (!next) return
      if (!heatmapURLs.has(next)) {
        const url = heatmapImage(next)
        if (url) heatmapURLs.set(next, url)
      }
      task = window.requestIdleCallback(warmNext)
    }
    task = window.requestIdleCallback(warmNext)
    return () => window.cancelIdleCallback(task)
  }, [boundary])

  if (!grid) return null
  const url = heatmapURLs.get(grid)
  return (
    <AnimatePresence initial={false}>
      {url && (
        <BoundaryRaster key={url} url={url} reduced={reduced}
          width={grid.pressure_axis_kpa.at(-1)! - grid.pressure_axis_kpa[0]}
          height={grid.o2_axis.at(-1)! - grid.o2_axis[0]}
          placement={`translate(${x(grid.pressure_axis_kpa[0])}px, ${y(grid.o2_axis.at(-1)!)}px) scale(${x(1) - x(0)}, ${y(0) - y(1)})`} />
      )}
    </AnimatePresence>
  )
}

function Axes({ x, y, plot, compact, reduced }: {
  x: PlotScale; y: PlotScale; plot: { left: number; right: number; bottom: number; top: number }; compact: boolean; reduced: boolean
}) {
  const fade = { initial: reduced ? false as const : { opacity: 0 }, animate: { opacity: 1 },
    exit: { opacity: 0 }, transition: reduced ? { duration: 0 } : fadeTransition }
  return (
    <AnimatePresence initial={false}>
      {x.ticks(compact ? 4 : 8).map((value) => (
        <motion.g key={`p${value}`} {...fade}>
          <g className="plot-glide" style={{ transform: `translateX(${x(value)}px)` }}>
            <line className="grid" y1={plot.top} y2={plot.bottom} />
            <text className="tick" y={plot.bottom + 20} textAnchor="middle">{value}</text>
          </g>
        </motion.g>
      ))}
      {y.ticks(compact ? 5 : 6).map((value) => (
        <motion.g key={`o${value}`} {...fade}>
          <g className="plot-glide" style={{ transform: `translateY(${y(value)}px)` }}>
            <line className="grid" x1={plot.left} x2={plot.right} />
            <text className="tick" x={plot.left - 10} y={4} textAnchor="end">{value}</text>
          </g>
        </motion.g>
      ))}
    </AnimatePresence>
  )
}

type InspectorMode = 'hover' | 'focus' | 'pinned'

interface RunLayerProps {
  plotted: PlottedRun[]
  x: PlotScale
  y: PlotScale
  reduced: boolean
  highlightStudyIds: readonly string[]
  highlightRunIds: readonly string[]
  onInspect: (run: PlottedRun, mode: InspectorMode) => void
  onLeave: (run: PlottedRun) => void
}

const RunLayer = memo(function RunLayer({
  plotted, x, y, reduced, highlightStudyIds, highlightRunIds, onInspect, onLeave,
}: RunLayerProps) {
  const refs = useRef<(HTMLAnchorElement | null)[]>([])
  const [tabRunId, setTabRunId] = useState<string>()
  const activeIndex = Math.max(0, plotted.findIndex((run) => run.id === tabRunId))
  const glyphs = useMemo(() => {
    const cells = new Map<string, number>()
    const positions = plotted.map((run) => {
      const cx = x(run.pressure)
      const cy = y(run.o2_pct)
      const bx = Math.round(cx / 10)
      const by = Math.round(cy / 10)
      const key = `${bx}|${by}`
      cells.set(key, (cells.get(key) ?? 0) + 1)
      return { cx, cy, bx, by }
    })
    return positions.map(({ cx, cy, bx, by }, index) => {
      let count = 0
      for (let i = bx - 1; i <= bx + 1; i++) {
        for (let j = by - 1; j <= by + 1; j++) count += cells.get(`${i}|${j}`) ?? 0
      }
      return { run: plotted[index], cx, cy, radius: Math.min(5.2, 3.1 + 0.52 * Math.log2(count)) }
    })
  }, [plotted, x, y])
  // Keep departing marks in the same keyed list so a quick reversal can reuse their DOM nodes.
  const [frame, setFrame] = useState<{ glyphs: Glyph[]; leaving: Glyph[]; entering: Set<string> }>(
    () => ({ glyphs, leaving: [], entering: new Set() }),
  )
  if (frame.glyphs !== glyphs || (reduced && frame.leaving.length)) {
    const visible = new Set(glyphs.map(({ run }) => run.id))
    const previous = new Set([...frame.leaving, ...frame.glyphs].map(({ run }) => run.id))
    setFrame({
      glyphs,
      leaving: reduced ? [] : [...frame.leaving, ...frame.glyphs].filter(({ run }) => !visible.has(run.id)),
      entering: reduced ? new Set() : new Set([...visible].filter((id) => !previous.has(id) || frame.entering.has(id))),
    })
  }
  useEffect(() => {
    if (!frame.leaving.length) return
    const timer = window.setTimeout(() => setFrame({ ...frame, leaving: [] }), tokens.motion.fast * 1000)
    return () => window.clearTimeout(timer)
  }, [frame])

  function onKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next++
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next--
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = plotted.length - 1
    else if (event.key === ' ') {
      event.preventDefault()
      onInspect(plotted[index], 'pinned')
      return
    } else return
    event.preventDefault()
    refs.current[Math.max(0, Math.min(plotted.length - 1, next))]?.focus()
  }

  return (
    <g
      className={`map-run-layer${reduced ? '' : ' run-motion'}`}
      role="group"
      aria-label={`${plotted.length} experimental runs`}
    >
      {[...(reduced ? [] : frame.leaving), ...glyphs].map(({ run, cx, cy, radius }, position) => {
        const index = position - (reduced ? 0 : frame.leaving.length)
        const leaving = index < 0
        const phase = leaving ? ' run-leaving' : frame.entering.has(run.id) ? ' run-entering' : ''
        const assumed = run.pressure_kpa === null && run.pressure_assumed_kpa != null
        const highlighted = highlightRunIds.includes(run.id) || highlightStudyIds.includes(run.investigation)
        const dimmed = (highlightStudyIds.length > 0 || highlightRunIds.length > 0) && !highlighted
        const cls = `dot ${run.outcome}${assumed ? ' assumed' : ''}${highlighted ? ' highlighted' : ''}${dimmed ? ' dimmed' : ''}`
        return (
          <g key={run.id} className={`run-mark${phase}`}
            style={{
              transform: `translate(${cx}px, ${cy}px) scale(${leaving ? .45 : 1})`,
              '--run-delay': phase === ' run-entering' ? `${runEntryDelay(index)}s` : undefined,
            } as CSSProperties}
            aria-hidden={leaving || undefined}>
            <a
              ref={leaving ? undefined : (el) => { refs.current[index] = el }}
              className="dot-target"
              href={leaving ? undefined : run.source.url || undefined}
              target="_blank"
              rel="noreferrer"
              tabIndex={leaving ? undefined : index === activeIndex ? 0 : -1}
              aria-label={`${run.id}, ${run.fuel}, ${run.o2_pct}% oxygen, ${run.pressure} kPa${assumed ? ' assumed' : ''}, ${run.gravity}, ${OUTCOME_LABEL[run.outcome]}`}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse' || event.pointerType === 'pen') onInspect(run, 'hover')
              }}
              onPointerLeave={() => onLeave(run)}
              onFocus={(event) => {
                setTabRunId(run.id)
                if (event.currentTarget.matches(':focus-visible')) onInspect(run, 'focus')
              }}
              onClick={(event) => {
                // Modified clicks still open the original NASA source directly.
                if (run.source.url && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return
                event.preventDefault()
                onInspect(run, 'pinned')
              }}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              <circle className="dot-hit" r={Math.max(7, radius)} />
              {run.gravity === '1g'
                ? <rect className={cls} x={-radius} y={-radius} width={radius * 2} height={radius * 2} rx={1.5} />
                : <circle className={cls} r={radius} />}
            </a>
          </g>
        )
      })}
    </g>
  )
})

function lineTransform(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  return `translate(${x1}px, ${y1}px) rotate(${Math.atan2(dy, dx)}rad) scaleX(${Math.hypot(dx, dy)})`
}

function PlaceLeader({ anchor, box, selected = false }: { anchor: Point; box: Box; selected?: boolean }) {
  const x2 = clamp(anchor.x, box.x0, box.x1)
  const y2 = clamp(anchor.y, box.y0, box.y1)
  if (selected) return (
    <line className="target-leader plot-glide" x2={1} vectorEffect="non-scaling-stroke"
      style={{ transform: lineTransform(anchor.x, anchor.y, x2, y2) }} />
  )
  return (
    <line
      className="landmark-leader"
      x1={anchor.x} y1={anchor.y}
      x2={x2} y2={y2}
    />
  )
}

interface Props {
  runs: Run[]
  env: Environment
  placeLabel: string
  fuel: FuelClass
  boundary: Boundary | null
  model: ModelFile | null
  studies: Investigation[]
  highlightStudyIds: readonly string[]
  highlightRunIds: readonly string[]
  highlightPlace: boolean
  onSelectRun: (run: Run) => void
  citedRun: (run: Run) => boolean
  hasAnswer: boolean
  answerPanel: ReactNode
  onSelectInvestigation?: (investigationId: string) => void
  /** Other verified places drawn as faint landmarks. Places outside the axes are skipped, never clamped. */
  otherPlaces?: EvidenceMapPlace[]
  controls?: ReactNode
}

export function EvidenceMap({
  runs, env, placeLabel, fuel, boundary, model, studies,
  highlightStudyIds, highlightRunIds, highlightPlace, onSelectRun, citedRun, hasAnswer, answerPanel,
  onSelectInvestigation, otherPlaces, controls,
}: Props) {
  const id = useId()
  const reduced = useMotionPreference()
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  const inspector = useRef<HTMLDivElement>(null)
  const [activeDot, setActiveDot] = useState<{ id: string; mode: InspectorMode; anchor?: Point } | null>(null)
  const [inspectorContext, setInspectorContext] = useState({ envId: env.id, fuel })
  const [labelOffsets, setLabelOffsets] = useState<Record<string, Point>>({})
  const drag = useRef<{ id: string; start: Point; offset: Point } | null>(null)
  const [diluent, setDiluent] = useState<Diluent>('N2')
  const [override, setOverride] = useState<{ env: string; fuel: FuelClass; oxygen?: number; pressure?: number }>()
  // Other places stay as small unlabeled markers until asked for, so the selected place and the tests stay readable.
  const [showOtherLabels, setShowOtherLabels] = useState(false)
  const compact = width < 580
  const height = compact ? 370 : width >= 1000 ? 560 : 500

  useEffect(() => {
    if (!wrap.current) return
    const size = new ResizeObserver(([entry]) => {
      // A hidden or unmounted grid can briefly report zero width.
      if (entry.contentRect.width > 100) setWidth(Math.round(entry.contentRect.width))
    })
    size.observe(wrap.current)
    return () => size.disconnect()
  }, [])

  const plotted = useMemo(() => runs.flatMap<PlottedRun>((run) => {
    const pressure = effectivePressure(run)
    return pressure === null || run.o2_pct === null ? [] : [{ ...run, pressure, o2_pct: run.o2_pct }]
  }).sort((a, b) => a.pressure - b.pressure || a.o2_pct - b.o2_pct), [runs])
  const byId = useMemo(() => new Map(plotted.map((run) => [run.id, run])), [plotted])
  const byStudy = useMemo(() => new Map(studies.map((study) => [study.id, study])), [studies])
  const bass = useMemo(() => plotted.filter((run) => run.investigation === 'PSI-25' &&
    run.pressure_kpa === null && run.pressure_assumed_kpa === 101.3), [plotted])
  const classifiedBass = bass.filter((run) => run.outcome !== 'unknown').length

  const active = activeDot && byId.get(activeDot.id)
  const highlighted = highlightRunIds.length === 1 ? byId.get(highlightRunIds[0]) : undefined
  const coincident = useMemo(() => active ? plotted.filter((run) =>
    Math.abs(run.pressure - active.pressure) < 0.6 && Math.abs(run.o2_pct - active.o2_pct) < 0.4,
  ) : [], [active, plotted])
  const coincidentIndex = coincident.findIndex((run) => run.id === active?.id)
  const inspectRun = useCallback((run: PlottedRun, mode: InspectorMode) => {
    if (mode === 'pinned') onSelectRun(run)
    setActiveDot((current) => {
      if (current?.id === run.id && current.mode === mode) return current
      if (mode === 'hover' && (current?.mode === 'focus' || current?.mode === 'pinned')) return current
      return { id: run.id, mode }
    })
  }, [onSelectRun])
  const leaveRun = useCallback((run: PlottedRun) => {
    setActiveDot((current) => current?.mode === 'hover' && current.id === run.id ? null : current)
  }, [])

  const dismissInspector = useCallback((restoreFocus = false) => {
    if (restoreFocus && inspector.current?.contains(document.activeElement)) {
      wrap.current?.querySelector<SVGAElement>('.dot-target[tabindex="0"]')?.focus({ preventScroll: true })
    }
    setActiveDot(null)
  }, [])

  if (inspectorContext.envId !== env.id || inspectorContext.fuel !== fuel) {
    setInspectorContext({ envId: env.id, fuel })
    setActiveDot(null)
  }

  const hasActiveDot = activeDot !== null
  useEffect(() => {
    if (!hasActiveDot) return
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') dismissInspector(true)
    }
    const onOutsideClick = (event: Event) => {
      if (!(event.target instanceof Element) || !wrap.current?.contains(event.target) ||
        !event.target.closest('.dot-target, .map-tooltip')) dismissInspector()
    }
    const onScroll = (event: Event) => {
      if (!inspector.current?.contains(event.target as Node)) dismissInspector()
    }
    window.addEventListener('keydown', onEscape)
    window.addEventListener('pointerdown', onOutsideClick, true)
    window.addEventListener('click', onOutsideClick, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onEscape)
      window.removeEventListener('pointerdown', onOutsideClick, true)
      window.removeEventListener('click', onOutsideClick, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [hasActiveDot, dismissInspector])

  const klass = boundary?.by_fuel_class[fuel]
  const grid = fuel === 'droplet' && diluent !== 'N2' ? klass?.variants?.[diluent] : klass
  const classModel = model?.by_fuel_class[fuel]
  const current = override?.env === env.id && override.fuel === fuel ? override : undefined
  const oxygen = current?.oxygen ?? (env.o2_pct[0] + env.o2_pct[1]) / 2
  const expandedOxygen = oxygen > 50 ? 100 : 50
  const pressure = current?.pressure ?? (env.pressure_kpa[0] + env.pressure_kpa[1]) / 2
  const result = useMemo(() => classModel && whatIf(classModel, {
    o2_pct: oxygen,
    pressure_kpa: pressure,
    diluent: fuel === 'droplet' ? diluent : undefined,
  }), [classModel, oxygen, pressure, fuel, diluent])

  const plot = useMemo(() => ({
    left: compact ? 42 : 58,
    right: width - (compact ? 12 : 24),
    top: 34,
    bottom: height - 52,
  }), [width, height, compact])

  const pLimit = useMemo(() => Math.max(320,
    Math.ceil(Math.max(...env.pressure_kpa, ...plotted.map((run) => run.pressure)) / 20) * 20,
  ), [plotted, env.pressure_kpa])
  const oLimit = useMemo(() => Math.min(100, Math.max(expandedOxygen,
    Math.ceil(Math.max(...env.o2_pct, ...plotted.map((run) => run.o2_pct)) / 5) * 5,
  )), [plotted, env.o2_pct, expandedOxygen])
  const x = useMemo(() => scaleLinear().domain([0, pLimit]).range([plot.left, plot.right]), [pLimit, plot])
  const y = useMemo(() => scaleLinear().domain([0, oLimit]).range([plot.bottom, plot.top]), [oLimit, plot])

  const breathing = useMemo(() => {
    const first = 100 * NORMOXIC_KPA / oLimit
    const points: [number, number][] = []
    for (let p = first; p < pLimit; p += 1) points.push([p, -100 * NORMOXIC_KPA / p])
    points.push([pLimit, -100 * NORMOXIC_KPA / pLimit])
    return line()(points) ?? ''
  }, [oLimit, pLimit])

  const stripPressure = bass[0]?.pressure
  const crosshair = active ?? highlighted
  const crosshairX = crosshair ? x(crosshair.pressure) : 0
  const crosshairY = crosshair ? y(crosshair.o2_pct) : 0
  const cursorClass = result?.inSupport ? 'within' : 'outside'
  const flame = { '--score-ramp': `linear-gradient(90deg, ${FLAME_RAMP.join(', ')})` } as CSSProperties
  const plotBox = useMemo(() => ({ x0: plot.left, x1: plot.right, y0: plot.top, y1: plot.bottom }), [plot])
  const marker = useMemo(() => ({
    x: (x(env.pressure_kpa[0]) + x(env.pressure_kpa[1])) / 2,
    y: (y(env.o2_pct[0]) + y(env.o2_pct[1])) / 2,
  }), [env, x, y])
  const ringX = marker.x
  const ringY = marker.y
  const rangeWidth = Math.max(12, x(env.pressure_kpa[1]) - x(env.pressure_kpa[0]))
  const rangeHeight = Math.max(12, y(env.o2_pct[0]) - y(env.o2_pct[1]))
  const positionMarker = `translate(${ringX}px, ${ringY}px)`
  const ringBox = useMemo(() => boxAt(ringX - 23, ringY - 23, 46, 46), [ringX, ringY])
  const whatIfLabelBox = useMemo(() => {
    if (!classModel || !current) return null
    const px = x(pressure)
    const py = y(oxygen)
    return boxAt(px > plot.right - 72 ? px - 60 : px + 7, py > plot.bottom - 20 ? py - 26 : py + 2, 58, 20)
  }, [classModel, current, x, y, pressure, oxygen, plot])
  const targetLabel = useMemo(() => {
    const bounds = inset(plotBox, 6)
    const size = { x: Math.min(bounds.x1 - bounds.x0, Math.max(164, placeLabel.length * 6.5 + 36)), y: 48 }
    const dots = plotted.map((run) => ({ x: x(run.pressure), y: y(run.o2_pct) }))
    // The selected label always gets first choice of the available space.
    return layoutLabel(bounds, whatIfLabelBox ? [ringBox, whatIfLabelBox] : [ringBox], dots, marker, size, labelOffsets[env.id])
      ?? layoutLabel(bounds, [ringBox], dots, marker, size, labelOffsets[env.id])!
  }, [plotBox, placeLabel, plotted, x, y, whatIfLabelBox, ringBox, marker, labelOffsets, env.id])

  // Place the unsupported-region annotation away from the selected label and marker.
  const gapPos = (() => {
    if (!grid) return null
    const candidates: [number, number][] = oLimit > 60
      ? [[245, 74], [245, 56], [190, 74], [380, 65], [240, 29], [240, 22]]
      : [[250, 41], [235, 29], [250, 24], [195, 42], [260, 12], [380, 36]]
    for (const [p, o2] of candidates) {
      if (p > pLimit - 30 || o2 > oLimit - 4 || supportLookup(grid, p, o2) >= 0.25) continue
      const gx = clamp(x(p), plot.left + 76, plot.right - 76)
      const gy = clamp(y(o2), plot.top + 32, plot.bottom - 32)
      const box = boxAt(gx - (compact ? 54 : 80), gy - 15, compact ? 108 : 160, compact ? 20 : 37)
      if ([targetLabel, ringBox, whatIfLabelBox].some((obstacle) => obstacle && overlaps(inset(box, -6), obstacle))) continue
      return { x: gx, y: gy }
    }
    return null
  })()

  // Nearest plotted test to the place, by distance on the chart (each axis gap over that axis's visible span).
  const nearest = useMemo(() => {
    let best: PlottedRun | null = null
    let bestD = Infinity
    let inside = 0
    let insideMicro = 0
    for (const run of plotted) {
      const dO = distanceToRange(run.o2_pct, env.o2_pct)
      const dP = distanceToRange(run.pressure, env.pressure_kpa)
      if (dO === 0 && dP === 0) {
        inside++
        if (run.gravity === '0g') insideMicro++
        continue
      }
      const d = Math.hypot(dO / oLimit, dP / pLimit)
      const tie = Math.abs(d - bestD) <= 1e-12
      if ((!tie && d < bestD) || (tie && best && best.pressure_kpa === null && run.pressure_kpa !== null)) {
        best = run
        bestD = d
      }
    }
    if (inside > 0) return { kind: 'inside' as const, inside, insideMicro }
    if (!best) return null
    const dO = distanceToRange(best.o2_pct, env.o2_pct)
    const dP = distanceToRange(best.pressure, env.pressure_kpa)
    const lessO = best.o2_pct < env.o2_pct[0]
    const lessP = best.pressure < env.pressure_kpa[0]
    const assumed = best.pressure_kpa === null
    const long = [
      dO > 0 ? `${formatGap(dO)} points ${lessO ? 'less' : 'more'} oxygen` : 'oxygen inside this place’s range',
      dP > 0 ? `${formatGap(dP)} kPa ${lessP ? 'less' : 'more'} pressure` : 'pressure inside this place’s range',
    ].join(', ') + (assumed ? ' (assumed pressure)' : '')
    return { kind: 'nearest' as const, run: best, long }
  }, [plotted, env, oLimit, pLimit])

  const connector = useMemo(() => {
    if (nearest?.kind !== 'nearest') return null
    const tx = x(nearest.run.pressure)
    const ty = y(nearest.run.o2_pct)
    const length = Math.hypot(tx - ringX, ty - ringY)
    if (length < 24) return { tx, ty, line: null }
    const ux = (tx - ringX) / length
    const uy = (ty - ringY) / length
    const line = { x1: ringX + ux * 10, y1: ringY + uy * 10, x2: tx - ux * 7, y2: ty - uy * 7 }
    return { tx, ty, line }
  }, [nearest, x, y, ringX, ringY])

  const landmarks = useMemo(() => {
    return (otherPlaces ?? []).flatMap((place) => {
      if (place.id === env.id) return []
      const values = [...place.o2_pct, ...place.pressure_kpa]
      if (!values.every((v) => typeof v === 'number' && Number.isFinite(v))) return []
      if (Math.min(...place.pressure_kpa) < 0 || Math.max(...place.pressure_kpa) > pLimit) return []
      if (Math.min(...place.o2_pct) < 0 || Math.max(...place.o2_pct) > oLimit) return []
      return [{
        place,
        mx: (x(place.pressure_kpa[0]) + x(place.pressure_kpa[1])) / 2,
        my: (y(place.o2_pct[0]) + y(place.o2_pct[1])) / 2,
      }]
    })
  }, [otherPlaces, env.id, x, y, pLimit, oLimit])

  const gapX = gapPos?.x
  const gapY = gapPos?.y
  const landmarkLabels = useMemo(() => {
    const bounds = inset(plotBox, 6)
    const dots = plotted.map((run) => ({ x: x(run.pressure), y: y(run.o2_pct) }))
    const gapBox = gapX === undefined || gapY === undefined
      ? null
      : boxAt(gapX - (compact ? 54 : 80), gapY - 15, compact ? 108 : 160, compact ? 20 : 37)
    const obstacles = [ringBox, targetLabel, gapBox, whatIfLabelBox].flatMap((box) => box ? [inset(box, -5)] : [])
    landmarks.forEach(({ mx, my }) => obstacles.push(boxAt(mx - 5, my - 5, 10, 10)))
    // Give a moved label priority over automatically placed landmarks.
    const ordered = [...landmarks].sort((a, b) => Number(!!labelOffsets[b.place.id]) - Number(!!labelOffsets[a.place.id]))
    if (!showOtherLabels) return []
    return ordered.flatMap(({ place, mx, my }) => {
      const size = { x: Math.min(compact && bounds.x1 - bounds.x0 < 270 ? 130 : 240, place.label.length * 7.3 + 32), y: 26 }
      const anchor = { x: mx, y: my }
      const box = layoutLabel(bounds, obstacles, dots, anchor, size, labelOffsets[place.id])
      if (!box) return []
      obstacles.push(inset(box, -4))
      return [{ id: place.id, name: place.label, anchor, box }]
    })
  }, [plotBox, plotted, x, y, ringBox, targetLabel, gapX, gapY, whatIfLabelBox, landmarks, compact, labelOffsets, showOtherLabels])

  function moveLabel(id: string, offset: Point) {
    setLabelOffsets((previous) => ({ ...previous, [id]: offset }))
  }

  function dragLabel(event: PointerEvent<HTMLButtonElement>, id: string, box: Box, anchor: Point) {
    if (event.button !== 0) return
    drag.current = {
      id, start: { x: event.clientX, y: event.clientY },
      offset: { x: box.x0 - anchor.x, y: box.y0 - anchor.y },
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function renderLabel(label: { id: string; name: string; anchor: Point; box: Box }, selected = false) {
    const { id, name, anchor, box } = label
    return (
      <button
        key={selected ? 'selected-place' : id}
        type="button"
        className={`plot-label ${selected ? 'plot-label-selected plot-glide' : 'plot-label-landmark'}`}
        style={{ left: 0, top: 0, transform: `translate(${box.x0}px, ${box.y0}px)`, width: box.x1 - box.x0, height: box.y1 - box.y0 }}
        title={`${name} · Drag or use arrow keys to move`}
        aria-label={`${selected ? 'You are here, ' : ''}${name}. Drag or use arrow keys to move this label.`}
        onPointerDown={(event) => dragLabel(event, id, box, anchor)}
        onPointerMove={(event) => {
          const currentDrag = drag.current
          if (currentDrag?.id !== id || !event.currentTarget.hasPointerCapture(event.pointerId)) return
          moveLabel(id, {
            x: currentDrag.offset.x + event.clientX - currentDrag.start.x,
            y: currentDrag.offset.y + event.clientY - currentDrag.start.y,
          })
        }}
        onLostPointerCapture={() => { drag.current = null }}
        onKeyDown={(event) => {
          const delta: Record<string, Point> = {
            ArrowLeft: { x: -12, y: 0 }, ArrowRight: { x: 12, y: 0 },
            ArrowUp: { x: 0, y: -12 }, ArrowDown: { x: 0, y: 12 },
          }
          const step = delta[event.key]
          if (!step) return
          event.preventDefault()
          moveLabel(id, {
            x: box.x0 - anchor.x + step.x,
            y: box.y0 - anchor.y + step.y,
          })
        }}
      >
        <span className="plot-label-grip" aria-hidden="true" />
        <span className="plot-label-text">
          {selected && <span className="plot-label-tag">You are here</span>}
          <strong>{name}</strong>
        </span>
      </button>
    )
  }

  const sourceStudy = active && byStudy.get(active.investigation)
  const clickable = activeDot?.mode !== 'hover'
  const inspectorRun = active && (activeDot?.anchor ?? { x: active.pressure, y: active.o2_pct })
  const inspectorPosition = inspectorRun && placeInspector(
    inset(plotBox, 6), [inset(ringBox, -6), inset(targetLabel, -6)],
    { x: x(inspectorRun.x), y: y(inspectorRun.y) },
  )

  const chart = (
    <figure className="map" id="evidence-map" tabIndex={-1} style={flame}>
      {controls}
      <div className="map-chart-status">
        <span className="map-record-count"><strong className="mono"><ScenarioNumber value={plotted.length} /></strong> plotted tests · Each dot is one NASA test</span>
        <span className="map-status-actions">
          {landmarks.length > 0 && (
            <button type="button" className="map-toggle" aria-pressed={showOtherLabels} onClick={() => setShowOtherLabels(!showOtherLabels)}>
              <i aria-hidden="true">+</i> {showOtherLabels ? 'Hide' : 'Name'} other places ({landmarks.length})
            </button>
          )}
          <a className="map-answer-link" href="#answer">Evidence answer <span aria-hidden="true">↓</span></a>
        </span>
      </div>
      <div
        className="map-svg-wrap"
        id="evidence-plot"
        tabIndex={-1}
        ref={wrap}
        onPointerLeave={(event) => {
          // Touch pointers leave at the end of each tap.
          if (event.pointerType !== 'touch') dismissInspector()
        }}
        onPointerMove={(event) => {
          if (event.pointerType === 'touch' || !activeDot || activeDot.mode === 'hover') return
          const bounds = event.currentTarget.getBoundingClientRect()
          const px = event.clientX - bounds.left
          const py = event.clientY - bounds.top
          if (px < plot.left || px > plot.right || py < plot.top || py > plot.bottom) dismissInspector()
        }}
        onPointerCancel={(event) => {
          if (event.pointerType === 'touch') dismissInspector()
        }}
        onBlur={(event) => {
          const inspectorTargets = '.dot-target, .map-tooltip'
          if (event.relatedTarget instanceof Element && event.currentTarget.contains(event.relatedTarget) &&
            event.relatedTarget.closest(inspectorTargets)) return
          if (event.target instanceof Element && event.target.closest(inspectorTargets)) dismissInspector()
        }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Evidence map of oxygen and pressure. Use arrow keys to move among tests and Enter or Space to select one.">
          <defs>
            <pattern id={`${id}-hatch`} width={8} height={8} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line y2={8} className="plot-hatch" />
            </pattern>
            <clipPath id={`${id}-clip`}>
              <rect x={plot.left} y={plot.top} width={Math.max(1, plot.right - plot.left)} height={Math.max(1, plot.bottom - plot.top)} />
            </clipPath>
          </defs>

          <rect x={plot.left} y={plot.top} width={Math.max(1, plot.right - plot.left)} height={Math.max(1, plot.bottom - plot.top)} className="plot-backdrop" />
          <g clipPath={`url(#${id}-clip)`}>
            <rect x={plot.left} y={plot.top} width={Math.max(1, plot.right - plot.left)} height={Math.max(1, plot.bottom - plot.top)} fill={`url(#${id}-hatch)`} />
            <Heatmap grid={grid} boundary={boundary} x={x} y={y} reduced={reduced} />
          </g>

          <Axes x={x} y={y} plot={plot} compact={compact} reduced={reduced} />

          <text className="axis" x={plot.left} y={20}>Oxygen (%)</text>
          <text className="axis" x={plot.right} y={height - 10} textAnchor="end">Air pressure (kPa)</text>

          <g clipPath={`url(#${id}-clip)`}>
            <path className="breathing plot-glide" d={breathing} vectorEffect="non-scaling-stroke"
              style={{ transform: `translate(${plot.left}px, ${plot.bottom}px) scale(${x(1) - x(0)}, ${y(0) - y(1)})` }} />
            {stripPressure != null && (
              <line className="assumed-line plot-glide" y1={plot.top} y2={plot.bottom}
                style={{ transform: `translateX(${x(stripPressure)}px)` }} />
            )}

            {gapPos && <g className="gap-region-label" aria-hidden="true">
              <text className="gap-heading" x={gapPos.x} y={gapPos.y} textAnchor="middle">Untested</text>
              {!compact && (
                <text className="gap-sub" x={gapPos.x} y={gapPos.y + 20} textAnchor="middle">
                  No model score · outside tested O₂ &amp; pressure
                </text>
              )}
            </g>}

            {landmarks.map(({ place, mx, my }) => (
              <g
                key={place.id}
                className="map-landmark plot-glide"
                style={{ transform: `translate(${mx}px, ${my}px)` }}
                role="img"
                aria-label={`${place.label}: ${formatRangeShort(place.o2_pct, '% oxygen')}, ${formatRangeShort(place.pressure_kpa, ' kPa')}`}
              >
                <title>{`${place.label}: ${formatRangeShort(place.o2_pct, '% O₂')} · ${formatRangeShort(place.pressure_kpa, ' kPa')}`}</title>
                <path d="M-6,0 H6 M0,-6 V6" />
                <circle r={3.2} />
              </g>
            ))}

            <RunLayer
              plotted={plotted}
              x={x}
              y={y}
              reduced={reduced}
              highlightRunIds={highlightRunIds}
              highlightStudyIds={highlightStudyIds}
              onInspect={inspectRun}
              onLeave={leaveRun}
            />

            {crosshair && (
              <g className="map-crosshair">
                <path d={`M${plot.left},${crosshairY} H${plot.right} M${crosshairX},${plot.top} V${plot.bottom}`} />
                <circle cx={crosshairX} cy={crosshairY} r={9} />
              </g>
            )}
          </g>

          <rect x={plot.left} y={plot.top} width={Math.max(1, plot.right - plot.left)} height={Math.max(1, plot.bottom - plot.top)} className="plot-border" />

          {connector && (
            <g className="map-nearest-link" aria-hidden="true">
              {connector.line && <line className="plot-glide" x2={1} vectorEffect="non-scaling-stroke"
                style={{ transform: lineTransform(connector.line.x1, connector.line.y1, connector.line.x2, connector.line.y2) }} />}
              <circle className="plot-glide" r={8} style={{ transform: `translate(${connector.tx}px, ${connector.ty}px)` }} />
            </g>
          )}

          {classModel && (
            <g className={`whatif-marker plot-glide ${cursorClass}`}
              style={{ transform: `translate(${x(pressure)}px, ${y(oxygen)}px)` }}>
              <path d="M0,-7 L7,0 L0,7 L-7,0 Z" />
              {current && (
                <text
                  x={x(pressure) > plot.right - 72 ? -11 : 11}
                  y={y(oxygen) > plot.bottom - 20 ? -10 : 16}
                  textAnchor={x(pressure) > plot.right - 72 ? 'end' : 'start'}
                >
                  What if
                </text>
              )}
            </g>
          )}
          <g className="map-label-leaders" aria-hidden="true">
            {landmarkLabels.map(({ id, anchor, box }) => <PlaceLeader key={id} anchor={anchor} box={box} />)}
          </g>
          <g aria-hidden="true" className="place-target">
            <PlaceLeader anchor={marker} box={targetLabel} selected />
            <g className="selected-place-marker plot-glide" style={{ transform: positionMarker }}>
              {highlightPlace && <circle className="answer-place-ring" r={24} />}
              <rect className="env-range-box plot-glide" x={-6} y={-6} width={12} height={12}
                rx={1} vectorEffect="non-scaling-stroke"
                style={{ transform: `scale(${rangeWidth / 12}, ${rangeHeight / 12})`, opacity: rangeWidth > 18 || rangeHeight > 18 ? 1 : 0 }} />
              <circle className="target-pulse" r={15} />
              <circle className="target-halo" r={15} />
              <circle className="target-ring" r={7} />
              <circle className="target-dot" r={3} />
              <path className="target-ticks" d="M-21,0 H-11 M11,0 H21 M0,-21 V-11 M0,11 V21" />
            </g>
          </g>
        </svg>

        {active && inspectorPosition && (
          <div
            ref={inspector}
            className={`map-tooltip run-inspector-card${clickable ? '' : ' preview'}`}
            style={inspectorPosition}
            aria-label={`Test record ${active.id}`}
          >
            <div className="run-inspector-head">
              <span className={`outcome-pill ${active.outcome}`}>{OUTCOME_LABEL[active.outcome]}</span>
              <strong className="mono">{active.id}</strong>
            </div>
            <strong className="tooltip-study">{sourceStudy?.name ?? active.investigation}</strong>
            <div className="run-inspector-meta">
              <span>{active.fuel}</span>
              <span className="mono">{active.o2_pct}% O₂</span>
              <span className="mono">{active.pressure} kPa{active.pressure_kpa === null ? ' assumed' : ''}</span>
              <span className="mono">{active.gravity}</span>
              {active.diluent && <span>{active.diluent} diluent</span>}
              {active.flow_cm_s != null && (
                <span>
                  {active.flags.includes('flow_is_instrument_setting')
                    ? `Flow setting ${active.flow_cm_s}`
                    : `Flow ${active.flow_cm_s} cm/s`}
                </span>
              )}
            </div>
            {active.flags.includes('outcome_si_labelled_pending_human_check') && (
              <small>SI-extracted outcome. Human spot-check: 20 of 20 agreed.</small>
            )}
            <div className="run-inspector-actions">
              {active.source.url && (
                <a className="source-link" href={active.source.url} target="_blank" rel="noreferrer" tabIndex={clickable ? undefined : -1} title={`${active.source.file} · row ${active.source.row}`}>
                  NASA record ↗
                </a>
              )}
              {onSelectInvestigation && (
                <button type="button" className="link-btn" tabIndex={clickable ? undefined : -1} onClick={() => {
                  dismissInspector(true)
                  onSelectInvestigation(active.investigation)
                }}>
                  View study
                </button>
              )}
              {activeDot?.mode === 'pinned' && hasAnswer && (
                citedRun(active)
                  ? <a className="source-link" href="#answer">View cited lines</a>
                  : <span className="inspector-uncited">No citation in this answer</span>
              )}
              {coincident.length > 1 && (
                <div className="cluster-pager">
                  <span className="mono">{coincidentIndex + 1}/{coincident.length} nearby</span>
                  {[-1, 1].map((step) => (
                    <button
                      key={step}
                      type="button"
                      className="pager-btn"
                      aria-label={step < 0 ? 'Previous overlapping run' : 'Next overlapping run'}
                      tabIndex={clickable ? undefined : -1}
                      onClick={() => {
                        const run = coincident[(coincidentIndex + coincident.length + step) % coincident.length]
                        onSelectRun(run)
                        setActiveDot({
                          id: run.id,
                          mode: 'pinned',
                          anchor: inspectorRun ?? undefined,
                        })
                      }}
                    >
                      {step < 0 ? '‹' : '›'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {landmarkLabels.map((label) => renderLabel(label))}
        {renderLabel({ id: env.id, name: placeLabel, anchor: marker, box: targetLabel }, true)}
      </div>

      <figcaption className="map-caption">
        <div className="map-readline">
          <div className="map-inline-legend" aria-label="Symbol key">
            <span><i className="key-dot sustained" aria-hidden="true" /> Kept burning</span>
            <span><i className="key-dot extinguished" aria-hidden="true" /> Out / no ignition</span>
            <span><i className="key-dot unknown" aria-hidden="true" /> Unknown</span>
            <span><i className="key-dot assumed" aria-hidden="true" /> Assumed pressure</span>
            {stripPressure != null && <span><i className="map-line-key assumed-line-key" aria-hidden="true" /> {stripPressure} kPa assumed for BASS-II</span>}
            <span><i className="map-line-key breathing-line-key" aria-hidden="true" /> Sea-level O₂ partial pressure</span>
            {grid && <span><i className="map-area-key shaded" aria-hidden="true" /> Shaded · model score</span>}
            <span><i className="map-area-key hatched" aria-hidden="true" /> {grid ? 'Hatched · too few nearby tests for a model score' : 'Model shading unavailable'}</span>
          </div>
          {fuel === 'gas' && klass?.status && <span className="model-status">{klass.status}</span>}
          {fuel === 'droplet' && grid && <span className="map-context">{DILUENTS.find(({ value }) => value === diluent)?.label} model</span>}
        </div>

        {nearest?.kind === 'nearest' && (
          <p className="map-nearest">
            <i className="nearest-swatch" aria-hidden="true" />
            <span>
              {nearest.run.gravity === '0g' ? 'Nearest microgravity test' : 'Nearest test (normal gravity)'}
              {' '}to {placeLabel}: <strong>{nearest.long}</strong>
            </span>
          </p>
        )}
        {nearest?.kind === 'inside' && (
          <p className="map-nearest inside">
            <span>
              <strong>
                {nearest.inside.toLocaleString()} {nearest.inside === 1 ? 'test sits' : 'tests sit'} inside this place’s oxygen and pressure range.
              </strong>
              {' '}
              {nearest.insideMicro === nearest.inside
                ? `${nearest.inside === 1 ? 'It was' : 'They were'} run in microgravity`
                : `${nearest.insideMicro.toLocaleString()} of them ${nearest.insideMicro === 1 ? 'was' : 'were'} run in microgravity`}
              ; this place has {env.gravity_g} g.
            </span>
          </p>
        )}

        <div className="map-place-readout">
          <span className="mono">{formatRangeShort(env.o2_pct, '% O₂')} · {formatRangeShort(env.pressure_kpa, ' kPa')} · {env.gravity_g} g</span>
          <span>Hover or tap a test · Drag a label to move it</span>
        </div>
        {grid && <div className="model-score-caption">
          <span className="score-scale mono" aria-hidden="true">0 <i /> 1</span>
          <div className="score-words">
            <p className="score-plain">
              Brighter glow: the model leans more towards “kept burning” for microgravity tests in that air. It is a model estimate, drawn only where enough tests are nearby.
            </p>
            <p>class-balanced model score (partial dependence), not a probability or safety score</p>
          </div>
        </div>}
        <details className="map-key">
          <summary>How to read this chart &amp; caveats</summary>
          <p>Shading appears only where microgravity test coverage meets the support cutoff of 0.5. Diagonal hatching marks air outside the model’s supported region.</p>
          <p>
            Larger marks indicate multiple tests nearby. Hollow rings represent tests assigned an assumed habitat/glovebox pressure.
            {runs.length > plotted.length ? ` ${runs.length - plotted.length} records in this view lack oxygen or pressure values.` : ''}
            {' '}Tests reporting only burner-stream oxygen are excluded from the cabin-air map.
          </p>
          {bass.length > 0 && (
            <p>
              The 101.3 kPa BASS-II column has {classifiedBass} runs with SI-extracted outcomes (a human spot-check of 20 agreed on all 20) and {bass.length - classifiedBass} runs with unknown outcomes.
            </p>
          )}
        </details>
        {landmarks.length > 0 && (
          <details className="map-key">
            <summary>Other places marked on the map ({landmarks.length})</summary>
            <ul className="map-landmark-list">
              {landmarks.map(({ place }) => (
                <li key={place.id}>
                  <strong>{place.label}</strong> · {formatRangeShort(place.o2_pct, '% O₂')} · {formatRangeShort(place.pressure_kpa, ' kPa')}
                </li>
              ))}
            </ul>
          </details>
        )}
      </figcaption>
    </figure>
  )

  return (
    <div className="evidence-workspace">
      {chart}
      {answerPanel}

      <section className="whatif" aria-label="What-if conditions">
        <div className="whatif-heading">
          <div>
            <h3>What if the air changes?</h3>
            <p>Explore oxygen and pressure against the model’s microgravity tests.</p>
          </div>
          <div className="whatif-readout" role="status" aria-atomic="true">
            {!result ? (
              <strong>Model unavailable</strong>
            ) : result.inSupport ? (
              <strong className="mono">{result.p_sustain?.toFixed(3)} <span>model score</span></strong>
            ) : (
              <strong>Outside tested conditions</strong>
            )}
            {result && <span className="mono">Support {result.support.toFixed(3)} / 1.000</span>}
          </div>
        </div>
        {classModel && (
          <div className="whatif-controls">
            <label>
              <span>Oxygen <output className="mono">{+oxygen.toFixed(2)}% O₂</output></span>
              <input
                type="range"
                min={0}
                max={100}
                step={0.01}
                value={oxygen}
                onChange={(event) => setOverride({ ...current, env: env.id, fuel, oxygen: +event.target.value })}
              />
            </label>
            <label>
              <span>Air pressure <output className="mono">{+pressure.toFixed(2)} kPa</output></span>
              <input
                type="range"
                min={1}
                max={pLimit}
                step={0.01}
                value={pressure}
                onChange={(event) => setOverride({ ...current, env: env.id, fuel, pressure: +event.target.value })}
              />
            </label>
            {fuel === 'droplet' ? (
              <label>
                <span>Diluent <output>{DILUENTS.find(({ value }) => value === diluent)?.label}</output></span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={DILUENTS.findIndex(({ value }) => value === diluent)}
                  aria-valuetext={DILUENTS.find(({ value }) => value === diluent)?.label}
                  onChange={(event) => setDiluent(DILUENTS[+event.target.value].value)}
                />
              </label>
            ) : (
              <p className="whatif-context">Diluent is a model input for liquid droplets.</p>
            )}
          </div>
        )}
        {classModel && (
          <p className="whatif-note">
            The live score uses default test inputs; the shaded field averages across recorded conditions. Both describe microgravity tests only.
          </p>
        )}
        {klass && boundary && (
          <details className="model-card">
            <summary>Model card &amp; held-out accuracy</summary>
            <p>{klass.model}. Balanced accuracy on held-out test days. Training target: {klass.target}.</p>
            <dl>
              <div><dt>Selected material</dt><dd>{klass.metrics.balanced_accuracy.toFixed(3)}</dd></div>
              <div><dt>O₂ threshold baseline</dt><dd>{klass.metrics.baseline_balanced_accuracy.toFixed(3)}</dd></div>
              <div><dt>Training runs</dt><dd>{klass.n_train}</dd></div>
              <div><dt>Pooled balanced accuracy</dt><dd>{boundary.metrics.balanced_accuracy?.toFixed(3)}</dd></div>
              <div><dt>Pooled baseline</dt><dd>{boundary.metrics.baseline_balanced_accuracy?.toFixed(3)}</dd></div>
              {boundary.metrics.balanced_accuracy_95ci && (
                <div><dt>Pooled 95% interval</dt><dd>{boundary.metrics.balanced_accuracy_95ci.join('–')}</dd></div>
              )}
            </dl>
            {klass.pressure_note && <p>{klass.pressure_note}</p>}
          </details>
        )}
      </section>
    </div>
  )
}
