import type { ReactNode } from 'react'

export function SectionDetails({ headingId, title, compact, children }: {
  headingId: string
  title: string
  compact: boolean
  children: ReactNode
}) {
  return (
    <details className="section-details" open={!compact}>
      <summary><h2 id={headingId}>{title}</h2></summary>
      <div className="section-details-body">{children}</div>
    </details>
  )
}
