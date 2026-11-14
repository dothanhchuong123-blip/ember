import { useCallback, useEffect, useRef, useState } from 'react'
import { dataFiles, loadDataFile, type DataKey, type LoadState } from './data'
import type { AppData } from './types'

const keys = Object.keys(dataFiles) as DataKey[]
const initialStates = Object.fromEntries(keys.map((key) => [key, 'loading'])) as Record<DataKey, LoadState>
const initialData: AppData = {
  meta: { mock: true },
  runs: [], investigations: [], environments: [], spinoffs: [],
  boundary: null, model: null, answers: {}, passages: [],
  evidenceCards: [], localStory: [],
}

export function useAppData() {
  const [data, setData] = useState(initialData)
  const [states, setStates] = useState(initialStates)
  const requests = useRef(new Map<DataKey, AbortController>())

  const request = useCallback(async (key: DataKey) => {
    const active = requests.current
    active.get(key)?.abort()
    const controller = new AbortController()
    active.set(key, controller)
    setStates((current) => current[key] === 'loading' ? current : { ...current, [key]: 'loading' })
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      const value = await loadDataFile(key, controller.signal)
      if (active.get(key) !== controller) return
      setData((current) => ({ ...current, [key]: value }))
      setStates((current) => ({ ...current, [key]: 'ready' }))
    } catch {
      if (active.get(key) === controller) setStates((current) => ({ ...current, [key]: 'failed' }))
    } finally {
      window.clearTimeout(timeout)
      if (active.get(key) === controller) active.delete(key)
    }
  }, [])

  useEffect(() => {
    const active = requests.current
    keys.forEach(request)
    return () => {
      active.forEach((controller) => controller.abort())
      active.clear()
    }
  }, [request])

  return { data, states, retry: request }
}
