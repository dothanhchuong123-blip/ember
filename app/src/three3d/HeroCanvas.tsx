import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  ACESFilmicToneMapping, Box3, Group, MathUtils, Vector3,
  type Object3D,
} from 'three'
import { disposeObject, loadBinaryModel } from './loadModel'

type SceneProps = {
  playing: boolean
  viewport: RefObject<HTMLDivElement | null>
  onReady: () => void
  onError: () => void
  ready: boolean
}

function Habitat({ onReady, onError }: Pick<SceneProps, 'onReady' | 'onError'>) {
  const [model, setModel] = useState<Object3D>()
  const { gl, scene, camera, invalidate } = useThree()

  useEffect(() => {
    const request = new AbortController()
    let owned: Group | undefined
    void loadBinaryModel('lunar_hab', request.signal).then(({ scene: habitat }) => {
      if (request.signal.aborted) {
        disposeObject(habitat, true)
        return
      }
      owned = habitat
      const bounds = new Box3().setFromObject(habitat)
      const size = bounds.getSize(new Vector3())
      const center = bounds.getCenter(new Vector3())
      const scale = 4.9 / size.x
      habitat.scale.multiplyScalar(scale)
      habitat.position.set(-center.x * scale, -bounds.min.y * scale - 1.02, -center.z * scale)
      habitat.rotation.y = -0.32
      setModel(habitat)
    }).catch(() => { if (!request.signal.aborted) onError() })
    return () => {
      request.abort()
      if (owned) disposeObject(owned, true)
    }
  }, [onError])

  useEffect(() => {
    if (!model) return
    let cancelled = false
    void gl.compileAsync(scene, camera).then(() => {
      if (cancelled) return
      invalidate()
      onReady()
    }).catch(() => { if (!cancelled) onError() })
    return () => { cancelled = true }
  }, [camera, gl, invalidate, model, onError, onReady, scene])

  return model ? <primitive object={model} /> : null
}

function LunarSurface() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -1.03, 0]}>
      <planeGeometry args={[14, 11]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        vertexShader={`
          varying vec2 surfaceUv;
          void main() {
            surfaceUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 surfaceUv;
          float grain(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise2(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(grain(i), grain(i + vec2(1, 0)), f.x),
              mix(grain(i + vec2(0, 1)), grain(i + 1.0), f.x), f.y);
          }
          void main() {
            vec2 p = (surfaceUv - 0.5) * vec2(2.0, 2.8);
            float dust = noise2(p * 86.0) * 0.30 + noise2(p * 24.0) * 0.38
              + noise2(p * 7.5) * 0.32;
            float contact = smoothstep(0.14, 0.58, length(p * vec2(0.95, 1.95)));
            float fade = 1.0 - smoothstep(0.22, 0.92, length(p));
            vec3 regolith = vec3(0.082, 0.108, 0.165);
            gl_FragColor = vec4(regolith * (0.68 + dust * 0.52) * (0.42 + 0.58 * contact), fade * 0.84);
          }
        `}
      />
    </mesh>
  )
}

function CinematicScene({ playing, viewport, onReady, onError, ready }: SceneProps) {
  const clock = useRef(0)
  const scroll = useRef(0)
  const eased = useRef(0)
  const lookAt = useMemo(() => new Vector3(), [])
  const canvas = useThree(state => state.gl.domElement)
  const invalidate = useThree(state => state.invalidate)

  useEffect(() => {
    const update = () => {
      const bounds = viewport.current?.getBoundingClientRect()
      if (bounds) scroll.current = MathUtils.clamp(-bounds.top / bounds.height, 0, 1)
    }
    if (playing) {
      update()
      window.addEventListener('scroll', update, { passive: true })
      window.addEventListener('resize', update)
    }
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [playing, viewport])

  useEffect(() => {
    canvas.addEventListener('webglcontextlost', onError)
    return () => canvas.removeEventListener('webglcontextlost', onError)
  }, [canvas, onError])

  useEffect(() => { if (ready) invalidate() }, [invalidate, ready])

  useFrame(({ camera, size }, delta) => {
    const step = playing ? Math.min(delta, .034) : 0
    clock.current += step
    eased.current = MathUtils.damp(eased.current, scroll.current, 4, step)
    const exit = eased.current
    const angle = .44 + .14 * Math.sin(clock.current * .16) + .32 * exit
    const radius = 7.95 + 1.35 * exit + Math.max(0, 1.4 - size.width / size.height) * 2.1
    camera.position.set(Math.sin(angle) * radius, 2.1 + exit * 1.15, Math.cos(angle) * radius)
    camera.lookAt(lookAt.set(0, .34 + exit * .22, 0))
  }, -1)
  useFrame(({ gl, scene, camera }) => {
    if (ready) gl.render(scene, camera)
  }, 1)

  return (
    <>
      <hemisphereLight args={['#e6dccb', '#0f0d0b', 0.92]} />
      <directionalLight position={[6, 8, 5]} intensity={2.15} color="#fff7ee" />
      <directionalLight position={[-6, 3.8, -5.5]} intensity={1.35} color="#9fb6d9" />
      <pointLight position={[0.45, 0.35, 2.2]} intensity={0.85} distance={4.5} color="#ffd09b" />
      <LunarSurface />
      <Habitat onReady={onReady} onError={onError} />
    </>
  )
}

export default function HeroCanvas(props: SceneProps) {
  return (
    <Canvas
      aria-hidden="true"
      camera={{ position: [3.1, 2.05, 6.8], fov: 31, near: .1, far: 45 }}
      dpr={1}
      frameloop={props.playing ? 'always' : 'demand'}
      gl={{ antialias: true, alpha: true, toneMapping: ACESFilmicToneMapping }}
    >
      <CinematicScene {...props} />
    </Canvas>
  )
}
