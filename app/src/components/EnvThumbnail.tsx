import { useId } from 'react'

interface Props {
  id: string
  domain: 'space' | 'earth'
}

/**
 * Uniform 16:9 technical blueprint illustration matching model still lighting/framing
 * for environments that have no dedicated 3D CAD/scan asset.
 */
export function EnvThumbnail({ id, domain }: Props) {
  const key = id.toLowerCase()
  const gradient = useId()

  const backdrop = (
    <defs>
      <radialGradient id={gradient} cx="50%" cy="46%" r="58%">
        <stop offset="0%" className="thumb-bg-inner" />
        <stop offset="100%" className="thumb-bg-outer" />
      </radialGradient>
    </defs>
  )

  if (key.includes('rover')) {
    return (
      <svg className="env-thumb" viewBox="0 0 320 180" aria-hidden="true">
        {backdrop}
        <rect width="320" height="180" fill={`url(#${gradient})`} />
        <path d="M24 140 Q160 124 296 140" className="thumb-horizon" />
        {/* Pressurized lunar rover body */}
        <rect x="82" y="64" width="128" height="48" rx="14" className="thumb-structure" />
        <path d="M188 68 L224 84 L224 106 L188 106 Z" className="thumb-structure" />
        {/* Forward viewing viewport */}
        <polygon points="196,76 218,86 218,98 196,98" className="thumb-cool-glass" />
        {/* Mast & high-gain antenna */}
        <line x1="112" y1="64" x2="112" y2="40" className="thumb-stroke" />
        <path d="M98 38 Q112 46 126 38" className="thumb-accent-stroke" />
        <rect x="134" y="54" width="38" height="10" rx="2" className="thumb-accent-fill" />
        {/* Chassis bar and 3 visible wheels per side */}
        <line x1="94" y1="118" x2="210" y2="118" className="thumb-stroke" />
        {[104, 152, 200].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="126" r="14" className="thumb-wheel" />
            <circle cx={cx} cy="126" r="5" className="thumb-accent-fill" />
          </g>
        ))}
      </svg>
    )
  }

  if (key.includes('hospital') || key.includes('icu') || key.includes('clinic') || key.includes('med')) {
    return (
      <svg className="env-thumb" viewBox="0 0 320 180" aria-hidden="true">
        {backdrop}
        <rect width="320" height="180" fill={`url(#${gradient})`} />
        {/* Patient bay divider & oxygen wall manifold */}
        <line x1="36" y1="142" x2="284" y2="142" className="thumb-horizon" />
        <rect x="64" y="42" width="44" height="72" rx="4" className="thumb-structure" />
        {/* O2 flow column & medical gas dial */}
        <rect x="74" y="52" width="24" height="32" rx="2" className="thumb-cool-glass" />
        <circle cx="86" cy="98" r="7" className="thumb-accent-stroke" />
        <path d="M86 58 V78 M79 68 H93" className="thumb-cool-stroke" />
        {/* Bed frame & oxygen hood / supply line */}
        <path d="M108 68 C134 68 134 94 148 94" className="thumb-cool-stroke" />
        <rect x="132" y="96" width="114" height="24" rx="5" className="thumb-structure" />
        <rect x="142" y="84" width="26" height="12" rx="4" className="thumb-accent-fill" />
        <line x1="142" y1="120" x2="142" y2="142" className="thumb-stroke" />
        <line x1="234" y1="120" x2="234" y2="142" className="thumb-stroke" />
      </svg>
    )
  }

  if (key.includes('air') || key.includes('plane') || key.includes('flight') || key.includes('cabin') || key.includes('cargo')) {
    return (
      <svg className="env-thumb" viewBox="0 0 320 180" aria-hidden="true">
        {backdrop}
        <rect width="320" height="180" fill={`url(#${gradient})`} />
        {/* Altitude flight-level guides */}
        <line x1="34" y1="138" x2="286" y2="138" className="thumb-horizon" />
        {/* Tail fin & fuselage */}
        <path d="M62 84 L48 44 L76 44 L96 84 Z" className="thumb-structure" />
        <path d="M58 84 H216 C250 84 274 96 274 106 C274 114 252 118 220 118 H68 Z" className="thumb-structure" />
        {/* Flight deck & passenger cabin windows */}
        <path d="M232 90 L256 97 L256 104 L232 104 Z" className="thumb-cool-glass" />
        {[106, 126, 146, 166, 186, 206].map((wx) => (
          <rect key={wx} x={wx} y="93" width="9" height="11" rx="3" className="thumb-accent-fill" />
        ))}
        {/* Wing profile */}
        <path d="M138 112 L192 112 L162 134 L126 134 Z" className="thumb-structure" />
      </svg>
    )
  }

  if (key.includes('suit') || key.includes('emu') || key.includes('eva')) {
    return (
      <svg className="env-thumb" viewBox="0 0 320 180" aria-hidden="true">
        {backdrop}
        <rect width="320" height="180" fill={`url(#${gradient})`} />
        <circle cx="160" cy="68" r="24" className="thumb-structure" />
        <ellipse cx="160" cy="68" rx="16" ry="11" className="thumb-cool-glass" />
        <path d="M126 136 C126 108 140 98 160 98 C180 98 194 108 194 136 Z" className="thumb-structure" />
        <rect x="148" y="108" width="24" height="16" rx="3" className="thumb-accent-fill" />
      </svg>
    )
  }

  if (key.includes('iss') || key.includes('station') || key.includes('gateway') || key.includes('skylab') || key.includes('shuttle') || key.includes('apollo')) {
    return (
      <svg className="env-thumb" viewBox="0 0 320 180" aria-hidden="true">
        {backdrop}
        <rect width="320" height="180" fill={`url(#${gradient})`} />
        <line x1="60" y1="90" x2="260" y2="90" className="thumb-stroke" />
        <rect x="128" y="72" width="64" height="36" rx="6" className="thumb-structure" />
        <rect x="74" y="42" width="22" height="96" rx="3" className="thumb-cool-glass" />
        <rect x="224" y="42" width="22" height="96" rx="3" className="thumb-cool-glass" />
        <circle cx="160" cy="90" r="7" className="thumb-accent-fill" />
      </svg>
    )
  }

  return (
    <svg className="env-thumb" viewBox="0 0 320 180" aria-hidden="true">
      {backdrop}
      <rect width="320" height="180" fill={`url(#${gradient})`} />
      <line x1="40" y1="138" x2="280" y2="138" className="thumb-horizon" />
      <circle cx="160" cy="88" r="38" className="thumb-structure" />
      <circle cx="160" cy="88" r="26" className={domain === 'space' ? 'thumb-accent-stroke' : 'thumb-cool-stroke'} />
      <path d="M160 88 L176 74" className="thumb-accent-stroke" />
      <circle cx="160" cy="88" r="4" className="thumb-accent-fill" />
    </svg>
  )
}
