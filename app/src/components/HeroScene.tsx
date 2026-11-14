import { Bounds, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type HeroModelId = 'lunar_hab' | 'orion'

const HERO_MODELS: Record<HeroModelId, { label: string; subtitle: string; file: string; cam: [number, number, number] }> = {
  lunar_hab: {
    label: 'Moon habitat',
    subtitle: 'Lunar surface habitat concept · Meshy text-to-3D look-alike',
    file: 'models/lunar_hab.glb',
    cam: [7.2, 4.8, 12.6],
  },
  orion: {
    label: 'Orion',
    subtitle: 'Orion crew & service module · Meshy text-to-3D look-alike',
    file: 'models/orion.glb',
    cam: [14.5, 9.8, 24.5],
  },
}

function disposeObjectResources(root: THREE.Object3D) {
  const seen = new Set<{ dispose: () => void }>()
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) seen.add(mesh.geometry)
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const mat of mats) {
      seen.add(mat)
      for (const val of Object.values(mat)) {
        if (val instanceof THREE.Texture) seen.add(val)
      }
    }
  })
  seen.forEach((item) => item.dispose())
}

function TurntableModel({ url, rotating }: { url: string; rotating: boolean }) {
  // useDraco=false, useMeshopt=true uses three-stdlib's bundled MeshoptDecoder offline (no CDN requests).
  const { scene } = useGLTF(url, false, true)
  const groupRef = useRef<THREE.Group>(null)

  const cloned = useMemo(() => {
    const obj = scene.clone(true)
    obj.traverse((child) => {
      const m = child as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    return obj
  }, [scene])

  useLayoutEffect(() => {
    const target = groupRef.current
    return () => {
      if (target) disposeObjectResources(target)
      useGLTF.clear(url)
    }
  }, [url])

  useFrame((_, delta) => {
    if (rotating && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.22
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  )
}

export default function HeroScene() {
  const [modelId, setModelId] = useState<HeroModelId>('lunar_hab')
  const [inView, setInView] = useState(true)
  const stageRef = useRef<HTMLDivElement>(null)
  const [rotating, setRotating] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(prefers-reduced-motion: reduce)').matches : true,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setRotating(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.05 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const active = HERO_MODELS[modelId]
  const url = `${import.meta.env.BASE_URL}${active.file}`

  return (
    <div ref={stageRef} className="hero-stage" aria-label="3D context model viewer">
      <div className="hero-stage-top">
        <span className="si-badge">SI-generated model</span>
        <div className="hero-stage-controls">
          <div className="model-switch" role="group" aria-label="Choose 3D context model">
            {(Object.keys(HERO_MODELS) as HeroModelId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={id === modelId ? 'stage-pill on' : 'stage-pill'}
                aria-pressed={id === modelId}
                onClick={() => setModelId(id)}
              >
                {HERO_MODELS[id].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="stage-pill"
            onClick={() => setRotating((r) => !r)}
          >
            {rotating ? 'Pause rotation' : 'Play rotation'}
          </button>
        </div>
      </div>

      <div className="hero-canvas-wrap">
        <Canvas
          key={modelId}
          frameloop={inView && rotating ? 'always' : 'demand'}
          dpr={[1, 2]}
          camera={{ position: active.cam, fov: 32, near: 0.1, far: 160 }}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12, preserveDrawingBuffer: true }}
        >
          {/* Local procedural studio Lightformers — zero CDN HDRI fetches */}
          <Environment resolution={256} frames={1}>
            <Lightformer form="rect" intensity={2.6} color="#fff7ed" position={[4, 6, 5]} rotation-x={Math.PI / 4} scale={[8, 4, 1]} />
            <Lightformer form="rect" intensity={1.5} color="#bae6fd" position={[-6, 3, -3]} rotation-y={Math.PI / 2} scale={[8, 5, 1]} />
            <Lightformer form="rect" intensity={1.1} color="#ff8a3d" position={[0, -3, 4]} rotation-x={-Math.PI / 3} scale={[9, 3, 1]} />
          </Environment>
          <ambientLight intensity={0.45} color="#cbdcf7" />
          <directionalLight position={[8, 12, 10]} intensity={1.6} color="#fff5eb" />
          <directionalLight position={[-9, 4, -8]} intensity={0.9} color="#38bdf8" />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.22}>
              <TurntableModel url={url} rotating={rotating} />
            </Bounds>
          </Suspense>
          <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI / 2.05} />
        </Canvas>
      </div>

      <p className="hero-stage-caption">
        {active.subtitle} · Simplified, not to engineering accuracy · Drag to inspect
      </p>
    </div>
  )
}
