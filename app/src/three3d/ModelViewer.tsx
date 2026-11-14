import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { modelPath, models, type ModelId } from './models'
import { useDeferredActivation, useStageActivity } from './stageActivity'
import './viewer.css'

const ModelCanvas = lazy(() => import('./ModelCanvas'))
let closeActiveViewer: (() => void) | undefined

export class ViewerBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function ViewerStage({ id, preview }: { id: ModelId; preview: boolean }) {
  const stage = useRef<HTMLDivElement>(null)
  const { active, nearby, reduced } = useStageActivity(stage, preview ? '90px' : '0px')
  const started = useDeferredActivation(preview && nearby)
  const [manual, setManual] = useState<boolean | null>(null)
  const [mode, setMode] = useState<'still' | 'live' | 'failed'>('still')
  const [playing, setPlaying] = useState(preview || id.endsWith('_anim'))
  const [burn, setBurn] = useState(0)
  const ready = useCallback(() => setMode('live'), [])
  const fail = useCallback(() => setMode('failed'), [])
  const model = models[id]
  const requested = manual ?? (preview && started)
  const open = requested && mode !== 'failed' && (!preview || !reduced) && !!window.WebGL2RenderingContext
  const live = open && mode === 'live'
  const animated = id.endsWith('_anim')
  const close = useCallback(function closeViewer() {
    if (closeActiveViewer === closeViewer) closeActiveViewer = undefined
    setManual(false)
    setMode('still')
  }, [])

  useEffect(() => () => {
    if (closeActiveViewer === close) closeActiveViewer = undefined
  }, [close])

  useEffect(() => {
    if (preview && reduced) setMode('still')
  }, [preview, reduced])

  // A preview that starts by itself also takes over from any viewer already open, so one model is loaded at a time.
  useEffect(() => {
    if (!preview || !started || reduced || closeActiveViewer === close) return
    closeActiveViewer?.()
    closeActiveViewer = close
  }, [preview, started, reduced, close])

  function openViewer() {
    if (!window.WebGL2RenderingContext) {
      fail()
      return
    }
    closeActiveViewer?.()
    closeActiveViewer = close
    setManual(true)
    setPlaying(preview || animated)
    setBurn(0)
    setMode('still')
  }

  return (
    <figure className={preview ? 'ember-model ember-model-preview' : 'ember-model'}>
      <div ref={stage} className="ember-model-stage" aria-busy={open && !live}>
        <img src={modelPath(`models/stills/${id}.webp`)} alt={model.name} loading="lazy" decoding="async" />
        {open && (
          <div className="ember-model-canvas" data-ready={live}>
            <ViewerBoundary onError={fail}>
              <Suspense fallback={null}>
                <ModelCanvas id={id} burn={burn} preview={preview} playing={live && playing && active} onReady={ready} onError={fail} />
              </Suspense>
            </ViewerBoundary>
          </div>
        )}
        {model.generated && <span className="ember-model-badge">SI-generated model</span>}
      </div>
      <figcaption className="ember-model-caption">
        <strong>{model.name}</strong>
        <span>Simplified, not to engineering accuracy</span>
        {'caption' in model && <span>{model.caption}</span>}
        <div className="ember-model-controls">
          {open ? (
            <>
              <button type="button" onClick={close}>Close 3D</button>
              {mode === 'live' && (
                <button type="button" onClick={() => setPlaying(value => !value)}>
                  {playing ? 'Pause' : 'Play'} {animated ? 'animation' : 'rotation'}
                </button>
              )}
            </>
          ) : !(preview && reduced) && (
            <button type="button" onClick={openViewer}>
              {mode === 'failed' ? 'Retry 3D' : 'Open 3D'}
            </button>
          )}
          {open && !live && <span role="status">Loading 3D…</span>}
          {mode === 'failed' && <span role="status">3D unavailable. Showing a still image.</span>}
          {live && <span>Drag to rotate · Scroll to zoom</span>}
        </div>
        {live && model.burn && (
          <label className="ember-model-burn">
            Burn progress
            <input type="range" min="0" max="1" step="0.01" value={burn} onChange={event => setBurn(Number(event.target.value))} />
            <span>Illustration — not experiment data</span>
          </label>
        )}
      </figcaption>
    </figure>
  )
}

export function ModelCollection({ ids, label, preview = false }: { ids: readonly ModelId[]; label: string; preview?: boolean }) {
  const [selected, setSelected] = useState<ModelId>()
  const id = selected && ids.includes(selected) ? selected : ids[0]
  if (!id) return null
  return (
    <div className="ember-model-collection">
      {ids.length > 1 && (
        <label className="ember-model-picker">
          {label}
          <select value={id} onChange={event => setSelected(event.target.value as ModelId)}>
            {ids.map(option => <option key={option} value={option}>{models[option].name}</option>)}
          </select>
        </label>
      )}
      <ViewerStage key={id} id={id} preview={preview} />
    </div>
  )
}

export function SuppressionModelComparison() {
  return (
    <div className="ember-model-comparison">
      <ModelCollection ids={['pfe_real']} label="CO₂ extinguisher" />
      <ModelCollection ids={['mist_ext']} label="Water-mist extinguisher" />
    </div>
  )
}
