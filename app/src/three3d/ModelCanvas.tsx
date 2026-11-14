import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ACESFilmicToneMapping, AnimationMixer, Group, Texture,
  Box3, DataTexture, HalfFloatType, LinearFilter, LinearSRGBColorSpace, PMREMGenerator,
  PerspectiveCamera, Sphere, Vector3,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { disposeObject, loadBinaryModel } from './loadModel'
import { modelPath, models, type ModelId } from './models'
import { proceduralModels } from './procedural'

function BinaryModel({ id, playing, onReady, onError }: {
  id: ModelId
  playing: boolean
  onReady: () => void
  onError: () => void
}) {
  const [model, setModel] = useState<GLTF>()
  const mixer = useRef<AnimationMixer | null>(null)
  useFrame((_, delta) => {
    if (playing) mixer.current?.update(Math.min(delta, 0.05))
  })

  useEffect(() => {
    const request = new AbortController()
    let owned: GLTF | undefined
    async function load() {
      const result = await loadBinaryModel(id, request.signal)
      if (request.signal.aborted) {
        disposeObject(result.scene, true)
        return
      }
      owned = result
      setModel(result)
    }
    void load().catch(() => {
      if (!request.signal.aborted) onError()
    })
    return () => {
      request.abort()
      if (owned) disposeObject(owned.scene, true)
    }
  }, [id, onError])

  useEffect(() => {
    const clip = model?.animations.find(candidate => candidate.name === 'Swim_Idle') ?? model?.animations[0]
    if (!model || !clip) return
    const animation = new AnimationMixer(model.scene)
    animation.clipAction(clip).play()
    animation.update(0)
    mixer.current = animation
    return () => {
      animation.stopAllAction()
      animation.uncacheRoot(model.scene)
      mixer.current = null
    }
  }, [model])

  if (!model) return null
  return <FittedModel onReady={onReady}><primitive object={model.scene} /></FittedModel>
}

function FittedModel({ children, onReady, dispose = false }: {
  children: React.ReactNode
  onReady: () => void
  dispose?: boolean
}) {
  const group = useRef<Group>(null)
  const camera = useThree(state => state.camera) as PerspectiveCamera
  const controls = useThree(state => state.controls)
  const invalidate = useThree(state => state.invalidate)
  const renderer = useThree(state => state.gl)
  const scene = useThree(state => state.scene)

  useLayoutEffect(() => {
    const object = group.current
    if (!object || !controls || !('target' in controls) || !(controls.target instanceof Vector3)) return
    object.updateWorldMatrix(true, true)
    const bounds = new Box3().setFromObject(object).getBoundingSphere(new Sphere())
    const vertical = camera.fov * Math.PI / 360
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
    const distance = Math.max(
      bounds.radius * 0.98,
      bounds.radius * (0.64 + 0.36 / Math.min(1, camera.aspect)) / Math.sin(Math.min(vertical, horizontal)),
    )
    const direction = camera.position.clone().sub(controls.target).normalize()
    camera.position.copy(bounds.center).addScaledVector(direction, distance)
    camera.near = distance / 100
    camera.far = distance * 100
    camera.updateProjectionMatrix()
    controls.target.copy(bounds.center)
    camera.lookAt(bounds.center)
    let cancelled = false
    void renderer.compileAsync(object, camera, scene).then(() => {
      if (cancelled) return
      invalidate()
      onReady()
    }, () => {
      if (cancelled) return
      invalidate()
      onReady()
    })
    return () => { cancelled = true }
  }, [camera, controls, invalidate, onReady, renderer, scene])

  useLayoutEffect(() => {
    const object = group.current
    return () => {
      if (object && dispose) disposeObject(object)
    }
  }, [dispose])

  return <group ref={group}>{children}</group>
}

const studioPath = modelPath('env/studio_small_09_1k.hdr')

function Studio({ procedural }: { procedural: boolean }) {
  return (
    <>
      <color attach="background" args={['#191612']} />
      <hemisphereLight args={['#f4f8ff', '#a68269', 2]} />
      <directionalLight position={[3, 5, 4]} intensity={2.8} />
      <directionalLight position={[-3, 1, -4]} color="#a2cfff" intensity={1.6} />
      {procedural && <StudioEnvironment />}
    </>
  )
}

function StudioEnvironment() {
  // The procedural assets rely on an HDR studio for metallic and transmissive surfaces.
  const renderer = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    const controller = new AbortController()
    let target: { texture: Texture; dispose: () => void } | undefined
    void (async () => {
      const response = await fetch(studioPath, { signal: controller.signal })
      if (!response.ok) return
      const buffer = await response.arrayBuffer()
      if (controller.signal.aborted) return
      const data = new HDRLoader().parse(buffer)
      const texture = new DataTexture(data.data, data.width, data.height)
      texture.type = data.type ?? HalfFloatType
      texture.colorSpace = LinearSRGBColorSpace
      texture.minFilter = texture.magFilter = LinearFilter
      texture.flipY = true
      texture.needsUpdate = true
      const generator = new PMREMGenerator(renderer)
      try {
        target = generator.fromEquirectangular(texture)
      } finally {
        generator.dispose()
        texture.dispose()
      }
      scene.environment = target.texture
      invalidate()
    })().catch(() => {})
    return () => {
      controller.abort()
      scene.environment = null
      target?.dispose()
    }
  }, [invalidate, renderer, scene])
  return null
}

function ContextObserver({ onError }: { onError: () => void }) {
  const canvas = useThree(state => state.gl.domElement)
  useEffect(() => {
    canvas.addEventListener('webglcontextlost', onError)
    return () => canvas.removeEventListener('webglcontextlost', onError)
  }, [canvas, onError])
  return null
}

export default function ModelCanvas({ id, burn, playing, onReady, onError, preview }: {
  id: ModelId
  preview: boolean
  burn: number
  playing: boolean
  onReady: () => void
  onError: () => void
}) {
  const procedural = models[id].format === 'procedural'
  const Asset = proceduralModels[id as keyof typeof proceduralModels]
  const animated = id.endsWith('_anim')
  const view = id === 'bass_ii_insert' ? [3.1, 1.65, 6] as const : [4, 2.6, 6] as const
  return (
    <Canvas
      aria-label={models[id].name}
      camera={{ position: [...view], fov: 38 }}
      dpr={preview ? 1 : [1, 1.5]}
      frameloop={playing ? 'always' : 'demand'}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
    >
      <ContextObserver onError={onError} />
      <Studio procedural={procedural && !preview} />
      <Suspense fallback={null}>
        {procedural ? (
          <FittedModel onReady={onReady} dispose>
            <Asset burn={burn} />
          </FittedModel>
        ) : (
          <BinaryModel id={id} playing={playing} onError={onError} onReady={onReady} />
        )}
      </Suspense>
      <OrbitControls makeDefault enablePan={false} autoRotate={playing && !animated} autoRotateSpeed={0.8} />
    </Canvas>
  )
}
