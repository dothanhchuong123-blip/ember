import { Material, Mesh, SkinnedMesh, Texture, type Object3D } from 'three'
import { modelPath, type ModelId } from './models'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

export function createModelLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
}

export async function loadBinaryModel(id: ModelId, signal: AbortSignal) {
  const response = await fetch(modelPath(`models/${id}.glb`), { signal })
  if (!response.ok) throw new Error(`Model request failed (${response.status})`)
  const buffer = await response.arrayBuffer()
  signal.throwIfAborted()
  const result = await createModelLoader().parseAsync(buffer, modelPath('models/'))
  if (signal.aborted) {
    disposeObject(result.scene, true)
    signal.throwIfAborted()
  }
  return result
}

export function disposeObject(object: Object3D, bitmaps = false) {
  const resources = new Set<{ dispose: () => void }>()
  const images = new Set<ImageBitmap>()
  object.traverse(child => {
    if (child instanceof SkinnedMesh) resources.add(child.skeleton)
    if (!(child instanceof Mesh)) return
    resources.add(child.geometry)
    if ('instanceMatrix' in child && 'dispose' in child) {
      resources.add(child as Mesh & { dispose: () => void })
    }
    const materials = [child.material, child.customDepthMaterial].flat()
    for (const material of materials) {
      if (!(material instanceof Material)) continue
      resources.add(material)
      for (const value of Object.values(material)) {
        if (!(value instanceof Texture)) continue
        resources.add(value)
        if (bitmaps && typeof ImageBitmap !== 'undefined' && value.image instanceof ImageBitmap) {
          images.add(value.image)
        }
      }
    }
  })
  for (const resource of resources) resource.dispose()
  for (const bitmap of images) bitmap.close()
}
