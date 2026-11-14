import { useId } from 'react'
import type { JSX } from 'react'
import './flame-compare.css'

/**
 * Side-by-side illustration: a candle flame on Earth and in microgravity.
 * It is a drawing, not a photo and not data. The caption sentences come from
 * NASA's "A Researcher's Guide to: Combustion Science" (NP-2015-10-034-JSC),
 * pp. 8-10, as recorded in research/01-nasa-sources.md and ai/passages.json
 * (id guide:p8-10-buoyancy).
 */

const SOURCE_URL =
  'https://www.nasa.gov/wp-content/uploads/2016/05/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf'

function Candle({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-wax`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f8672" />
          <stop offset="0.35" stopColor="#e9e0c8" />
          <stop offset="0.7" stopColor="#c9bfa6" />
          <stop offset="1" stopColor="#6f6858" />
        </linearGradient>
        <linearGradient id={`${id}-waxfade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <rect x="86" y="166" width="28" height="54" rx="3" fill={`url(#${id}-wax)`} />
      <rect x="86" y="166" width="28" height="54" rx="3" fill={`url(#${id}-waxfade)`} />
      <ellipse cx="100" cy="167" rx="14" ry="3" fill="#f3ead2" opacity="0.85" />
      <path d="M100 167 C100 160 99 154 100.5 146" fill="none" stroke="#1c1512" strokeWidth="2.2" strokeLinecap="round" />
    </>
  )
}

function EarthFlame({ id }: { id: string }) {
  return (
    <svg
      className="flame-compare__svg"
      viewBox="0 0 200 220"
      role="img"
      aria-label="Illustration of a candle flame on Earth: a tall, bright yellow and orange teardrop with a small blue base, pointing upward."
    >
      <defs>
        <radialGradient id={`${id}-halo`} cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor="#ffb24d" stopOpacity="0.42" />
          <stop offset="0.55" stopColor="#ff7a2e" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ff7a2e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7b2b" stopOpacity="0.55" />
          <stop offset="0.22" stopColor="#ff9a36" />
          <stop offset="0.55" stopColor="#ffc94f" />
          <stop offset="0.82" stopColor="#ffe9a3" stopOpacity="0.95" />
          <stop offset="1" stopColor="#7fb4ff" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${id}-core`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b8" stopOpacity="0" />
          <stop offset="0.4" stopColor="#fff6cf" stopOpacity="0.95" />
          <stop offset="0.85" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-blue`} cx="50%" cy="70%" r="60%">
          <stop offset="0" stopColor="#1b3f9c" stopOpacity="0" />
          <stop offset="0.55" stopColor="#2f6fe0" stopOpacity="0.75" />
          <stop offset="1" stopColor="#58a6ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-dark`} cx="50%" cy="60%" r="50%">
          <stop offset="0" stopColor="#3a1d0c" stopOpacity="0.7" />
          <stop offset="1" stopColor="#3a1d0c" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-40%" y="-20%" width="180%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={`${id}-softer`} x="-60%" y="-30%" width="220%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse className="flame-compare__halo" cx="100" cy="100" rx="96" ry="104" fill={`url(#${id}-halo)`} />
      <Candle id={id} />
      <g className="flame-compare__earth">
        <path
          d="M100 22 C112 58 130 90 130 120 C130 143 116 158 100 158 C84 158 70 143 70 120 C70 90 88 58 100 22 Z"
          fill="#ff8a2a"
          opacity="0.5"
          filter={`url(#${id}-softer)`}
        />
        <path
          d="M100 26 C111 60 127 91 127 120 C127 141 114 155 100 155 C86 155 73 141 73 120 C73 91 89 60 100 26 Z"
          fill={`url(#${id}-body)`}
          filter={`url(#${id}-soft)`}
        />
        <path
          d="M100 62 C107 84 116 102 116 122 C116 137 109 147 100 147 C91 147 84 137 84 122 C84 102 93 84 100 62 Z"
          fill={`url(#${id}-core)`}
          filter={`url(#${id}-soft)`}
        />
        <ellipse cx="100" cy="146" rx="26" ry="15" fill={`url(#${id}-blue)`} filter={`url(#${id}-soft)`} />
        <ellipse cx="100" cy="140" rx="9" ry="13" fill={`url(#${id}-dark)`} />
      </g>
    </svg>
  )
}

function MicrogravityFlame({ id }: { id: string }) {
  return (
    <svg
      className="flame-compare__svg"
      viewBox="0 0 200 220"
      role="img"
      aria-label="Illustration of a candle flame in microgravity: a small, dim, nearly round blue flame sitting around the wick."
    >
      <defs>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#4d8dff" stopOpacity="0.3" />
          <stop offset="0.6" stopColor="#2b5fd6" stopOpacity="0.08" />
          <stop offset="1" stopColor="#2b5fd6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-shell`} cx="50%" cy="56%" r="50%">
          <stop offset="0" stopColor="#0d1f4f" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#1f4fc0" stopOpacity="0.4" />
          <stop offset="0.78" stopColor="#4f97ff" stopOpacity="0.9" />
          <stop offset="0.9" stopColor="#9ccbff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#9ccbff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.72" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.15" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect x="50" y="100" width="100" height="74" fill={`url(#${id}-fade)`} />
        </mask>
        <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>

      <ellipse className="flame-compare__halo" cx="100" cy="140" rx="78" ry="74" fill={`url(#${id}-halo)`} />
      <Candle id={id} />
      <g className="flame-compare__micro" mask={`url(#${id}-mask)`}>
        <ellipse cx="100" cy="140" rx="33" ry="30" fill={`url(#${id}-shell)`} filter={`url(#${id}-soft)`} />
      </g>
    </svg>
  )
}

export function FlameCompare({ className }: { className?: string }): JSX.Element {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <figure className={['flame-compare', className].filter(Boolean).join(' ')}>
      <span className="flame-compare__tag">Illustration</span>
      <div className="flame-compare__grid">
        <div className="flame-compare__panel">
          <EarthFlame id={`fc-e-${uid}`} />
          <h3 className="flame-compare__title">On Earth</h3>
          <p className="flame-compare__why">
            The flame is far hotter than the air around it, so its gas is much lighter. That buoyancy drives an
            upward flow and the flicker.
          </p>
        </div>
        <div className="flame-compare__panel">
          <MicrogravityFlame id={`fc-m-${uid}`} />
          <h3 className="flame-compare__title">In microgravity</h3>
          <p className="flame-compare__why">
            Without gravity, buoyancy is suppressed: no upward flow, no flicker. Diffusion controls the burning
            instead. In Shuttle and Mir tests the candle flame was small, dim blue and hemispherical.
          </p>
        </div>
      </div>
      <figcaption className="flame-compare__source">
        Not a photo, not data. Sources:{' '}
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">
          NASA, A Researcher&rsquo;s Guide to: Combustion Science, pp. 8&ndash;10
        </a>
        {' · '}
        <a href="https://ntrs.nasa.gov/citations/20010074076" target="_blank" rel="noreferrer">
          Dietrich et al., Candle Flames in Microgravity (NASA, 2001), abstract
        </a>
      </figcaption>
    </figure>
  )
}

export default FlameCompare
