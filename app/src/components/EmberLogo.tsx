import { useRef } from 'react'
import { useBrandPulse } from '../motion'

export function EmberReticle({ coreClassName, pulse = false }: { coreClassName: string; pulse?: boolean }) {
  const core = useRef<SVGCircleElement>(null)
  useBrandPulse(core, pulse)

  return (
    <>
      <path d="M12 5.2a11.5 11.5 0 0 0 0 21.6m8 0a11.5 11.5 0 0 0 0-21.6M16 2v5m0 18v5"
        fill="none" stroke="currentColor" strokeWidth="2.3" />
      <circle ref={core} className={coreClassName} cx="16" cy="16" r="5.6" />
    </>
  )
}

export function EmberWordmark({ coreClassName }: { coreClassName?: string }) {
  return (
    <>
      <path d="M18 5H3v22h15M3 16h12M26 27V5h1l8.5 13L44 5h1v22
        M90 5H75v22h15M75 16h12M98 27V5h10a5.5 5.5 0 0 1 0 11H98m8 0 9 11"
        fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <g transform="translate(48 0)"><EmberLetterB coreClassName={coreClassName} /></g>
    </>
  )
}

export function EmberLetterB({ coreClassName }: { coreClassName?: string }) {
  return (
    <>
      <path d="M5 16h11a5.5 5.5 0 0 0 0-11H5v22h12.5a5.5 5.5 0 0 0 0-11H16"
        fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      {coreClassName && <circle className={coreClassName} cx="14.4" cy="21.5" r="2.3" />}
    </>
  )
}
