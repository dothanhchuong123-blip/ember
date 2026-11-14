import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { modelPath } from './models'
import { useDeferredActivation, useStageActivity } from './stageActivity'
import { ViewerBoundary } from './ModelViewer'
import './hero.css'

const HeroCanvas = lazy(() => import('./HeroCanvas'))

export function HabitatHero({ children, obscured }: { children: React.ReactNode; obscured: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const { active, nearby, reduced } = useStageActivity(viewport)
  const started = useDeferredActivation(nearby && !obscured)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [paused, setPaused] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  const onError = useCallback(() => setFailed(true), [])

  useEffect(() => { if (reduced) setReady(false) }, [reduced])

  const enabled = started && !reduced && !failed && !!window.WebGL2RenderingContext
  return (
    <>
      <div ref={viewport} className="habitat-viewport">
        <img src={modelPath('models/stills/lunar_hab.webp')} alt="Moon habitat module on the lunar surface" width="766" height="432" fetchPriority="high" decoding="async" />
        {enabled && (
          <div className="habitat-canvas" data-ready={ready}>
            <ViewerBoundary onError={onError}>
              <Suspense fallback={null}>
                <HeroCanvas ready={ready} viewport={viewport} playing={ready && active && !paused && !obscured} onReady={onReady} onError={onError} />
              </Suspense>
            </ViewerBoundary>
          </div>
        )}
        {enabled && ready && (
          <button className="habitat-motion" type="button" onClick={() => setPaused(value => !value)}>
            {paused ? 'Play motion' : 'Pause motion'}
          </button>
        )}
      </div>
      <figcaption>
        <span className="habitat-caption-copy">
          Moon habitat concept
          <span className="habitat-credit">SI-generated model</span>
        </span>
        {children}
      </figcaption>
    </>
  )
}
