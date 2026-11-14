import { useEffect, useRef, useState } from 'react'
import './gravity-flame.css'

/* Hero illustration: one candle flame whose shape follows a gravity slider.
   It is drawn from a few simple rules (hot gas rises in proportion to gravity; with no
   buoyancy it spreads evenly and burns cleaner, so bluer). It is an illustration, not a
   combustion simulation, and the caption says so. */

const STOPS = [
  { g: 1, label: 'Earth', value: '1 g' },
  { g: 0.165, label: 'Moon', value: '0.165 g' },
  { g: 0, label: 'Space', value: '0 g' },
] as const

export type Particle = { a: number; s: number; phase: number; age: number; rate: number; size: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t))

// Colour along a particle's life. Earth: blue root, white-yellow body, orange then sooty red tip.
function earthColor(t: number) {
  if (t < 0.12) return mix([90, 130, 255], [255, 236, 190], t / 0.12)
  if (t < 0.45) return mix([255, 236, 190], [255, 178, 77], (t - 0.12) / 0.33)
  return mix([255, 178, 77], [190, 60, 30], (t - 0.45) / 0.55)
}
// Microgravity: a dim blue shell with a faint warm core.
function spaceColor(t: number) {
  if (t < 0.2) return mix([200, 150, 120], [90, 130, 255], t / 0.2)
  return mix([90, 130, 255], [30, 60, 210], (t - 0.2) / 0.8)
}

/** Draws one frame. Exported so the shape can be checked without an animation loop. */
export function drawFlame(ctx: CanvasRenderingContext2D, w: number, h: number, particles: Particle[], gv: number, time: number) {
  const unit = Math.min(w, h) * 1.6
  const cx = w / 2
  const cy = h * 0.7
  const shape = Math.pow(gv, 0.45) // 0 → sphere, 1 → teardrop
  const blue = 1 - Math.pow(gv, 0.12)
  ctx.clearRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'
  for (const p of particles) {
    const t = p.age
    // Sphere: spreads out evenly from the wick, slowing as it goes.
    const r = 0.16 * p.s * Math.sqrt(t)
    const sx = Math.cos(p.a) * r
    const sy = Math.sin(p.a) * r - 0.02
    // Teardrop: narrow, rising, widest a quarter of the way up, with a sway near the tip.
    const width = 0.055 * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.05)) * Math.pow(1 - t, 0.35)
    const sway = Math.sin(time * 7 + p.phase * 2) * 0.012 * t * t + Math.sin(time * 2.3) * 0.006 * t
    const ex = Math.cos(p.a) * width * p.s + sway
    const ey = -0.36 * Math.pow(t, 1.15) * (0.75 + p.s * 0.35)
    const x = lerp(sx, ex, shape)
    const y = lerp(sy, ey, shape)
    const [cr, cg, cb] = mix(earthColor(t), spaceColor(t), blue)
    const alpha = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), lerp(1.8, 1, shape)) * (lerp(0.045, 0.1, gv) + 0.03 * (1 - shape))
    ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${alpha})`
    ctx.beginPath()
    ctx.arc(cx + x * unit, cy + y * unit, p.size * unit * lerp(0.6, 0.8 + t * 0.3, shape), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
}

export function GravityFlame() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [g, setG] = useState(0.165)
  const gRef = useRef(g)
  gRef.current = g

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let visible = true
    let last = performance.now()
    // Each particle follows a fixed path drawn between two shapes: a rising teardrop
    // (buoyant, 1 g) and an evenly spreading sphere (no buoyancy, 0 g).
    const particles: Particle[] = Array.from({ length: 280 }, () => ({
      a: Math.random() * Math.PI * 2,
      s: 0.55 + Math.random() * 0.45,
      phase: Math.random(),
      age: Math.random(),
      rate: 0.8 + Math.random() * 0.5,
      size: 0.022 + Math.random() * 0.03,
    }))

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      el.width = Math.round(el.clientWidth * dpr)
      el.height = Math.round(el.clientHeight * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(el)

    let time = 0
    const step = (dt: number) => {
      time += dt
      const gv = gRef.current
      // Buoyant flames turn over faster than diffusion-only flames.
      const speed = lerp(0.55, 1.25, Math.sqrt(gv))
      for (const p of particles) {
        p.age += dt * p.rate * speed
        if (p.age >= 1) { p.age -= 1; p.a = Math.random() * Math.PI * 2; p.s = 0.55 + Math.random() * 0.45 }
      }
    }

    const draw = () => drawFlame(ctx, el.width, el.height, particles, gRef.current, time)

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (visible) { step(dt); draw() }
      frame = requestAnimationFrame(loop)
    }

    if (reduced) {
      // One settled still frame, redrawn when the slider moves.
      draw()
      const id = window.setInterval(draw, 200)
      return () => { window.clearInterval(id); ro.disconnect(); io.disconnect() }
    }
    frame = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(frame); ro.disconnect(); io.disconnect() }
  }, [])

  const nearest = STOPS.reduce((best, s) => Math.abs(s.g - g) < Math.abs(best.g - g) ? s : best)

  return (
    <div className="gflame" data-g={nearest.label.toLowerCase()}>
      <div className="gflame-stage">
        <canvas ref={canvas} className="gflame-canvas" aria-hidden="true" />
        <svg className="gflame-candle" viewBox="0 0 100 100" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
          <defs>
            <linearGradient id="gflame-wax" x1="0" x2="1">
              <stop offset="0" stopColor="#3a332b" />
              <stop offset=".45" stopColor="#8a7d6b" />
              <stop offset="1" stopColor="#2a241f" />
            </linearGradient>
            <linearGradient id="gflame-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffb14d" stopOpacity=".55" />
              <stop offset=".35" stopColor="#ffb14d" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M41 9 Q50 6 59 9 V96 H41 Z" fill="url(#gflame-wax)" className="gflame-wax" />
          <path d="M41 9 Q45 13 44 22" className="gflame-drip" />
          <path d="M50 1 Q49 4 50 8" className="gflame-wick" />
        </svg>
        <p className="gflame-readout" aria-live="polite">
          <span className="gflame-g">{g.toFixed(g === 0 || g === 1 ? 0 : 3)}<small> g</small></span>
          <span className="gflame-place">{Math.abs(nearest.g - g) < 0.01 ? nearest.label : 'Between'}</span>
        </p>
      </div>
      <div className="gflame-controls">
        <label className="gflame-slider">
          <span className="visually-hidden">Gravity, from 0 g to 1 g</span>
          <input type="range" min={0} max={1} step={0.005} value={g} onChange={(e) => setG(Number(e.target.value))} />
        </label>
        <div className="gflame-stops" role="group" aria-label="Gravity presets">
          {STOPS.map((s) => (
            <button key={s.label} type="button" aria-pressed={Math.abs(s.g - g) < 0.01} onClick={() => setG(s.g)}>
              <strong>{s.label}</strong> <span className="mono">{s.value}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="gflame-note">
        Illustration, not a simulation. On Earth hot gas rises, so a flame is tall and flickers. With less gravity
        there is less lift, and the flame grows rounder and bluer. That is why fire in space has to be tested in space.
      </p>
    </div>
  )
}
