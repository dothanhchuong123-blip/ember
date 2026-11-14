import { dataFiles, type DataKey, type LoadState } from '../data'

export function DataStatus({ file, state, retry }: {
  file: DataKey
  state: LoadState
  retry: (file: DataKey) => void
}) {
  const label = dataFiles[file].label
  if (state === 'ready') return null
  if (state === 'loading') return <p className="data-status" role="status" data-file={dataFiles[file].name}>Loading {label.toLowerCase()}…</p>
  return (
    <div className="data-status is-failed" data-file={dataFiles[file].name}>
      <p role="alert">{label} could not be loaded.</p>
      <button type="button" className="button quiet" onClick={() => retry(file)}>Retry {label.toLowerCase()}</button>
    </div>
  )
}
