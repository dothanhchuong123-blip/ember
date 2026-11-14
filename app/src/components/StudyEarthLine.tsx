import { studyEarthApplications } from '../studyEarthApplications'
import './study-earth-line.css'

export function StudyEarthLine({ studyId }: { studyId: string }) {
  const application = studyEarthApplications[studyId]
  return (
    <p className="study-earth-line" data-study-id={studyId}>
      {application ? (
        <>
          {application.text}{' '}
          {application.sources.map(({ label, url }) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">{label} ↗</a>
          ))}
        </>
      ) : 'No documented Earth application found'}
    </p>
  )
}
