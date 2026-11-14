// Copies the JSON published by the other tracks into app/public/data/.
// Files that do not exist yet are left as they are (sample data). meta.json says whether anything is still sample data.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = join(root, 'app', 'public', 'data')
const sources = {
  'runs.json': 'data/clean/runs.json',
  'investigations.json': 'data/clean/investigations.json',
  'environments.json': 'data/earth/environments.json',
  'spinoffs.json': 'data/earth/spinoffs.json',
  'evidence-cards.json': 'data/earth/evidence-cards.json',
  'local-story.json': 'data/earth/local-story.json',
  'boundary.json': 'ml/boundary.json',
  'model.json': 'ml/model.json',
  'answers.json': 'ai/answers.json',
  'passages.json': 'ai/passages.json',
}
const stillSample = []
for (const [name, rel] of Object.entries(sources)) {
  const src = join(root, rel)
  if (existsSync(src)) {
    copyFileSync(src, join(out, name))
    console.log('synced ', name)
  } else {
    stillSample.push(name)
    console.log('missing', rel)
  }
}
// The banner stays on until the run data itself is real.
const mock = stillSample.includes('runs.json') || stillSample.includes('environments.json')
writeFileSync(join(out, 'meta.json'), JSON.stringify({ mock, still_sample: stillSample, synced_at: new Date().toISOString() }, null, 2))
console.log(mock ? 'meta: SAMPLE banner stays on' : 'meta: real data')
