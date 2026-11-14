import type { ModelId } from './models'

const solids = ['bass_ii_insert', 'msg'] as const
const droplets = ['flex_mdca', 'cir'] as const
const gases = ['cir_bench', 'cir'] as const
const saffire = ['saffire'] as const
const moon = ['lunar_hab', 'gateway', 'orion'] as const

export const profileModels: Readonly<Partial<Record<string, readonly ModelId[]>>> = {
  'PSI-25': solids, 'PSI-26': solids, 'PSI-106': solids, 'PSI-107': solids,
  'PSI-39': droplets, 'PSI-68': droplets, 'PSI-69': droplets,
  'PSI-10': gases, 'PSI-20': gases, 'PSI-21': gases, 'PSI-22': gases, 'PSI-23': gases, 'PSI-159': gases,
  'PSI-98': saffire, 'PSI-99': saffire, 'PSI-100': saffire,
  'PSI-47': ['msg'], 'PSI-60': solids, 'PSI-62': solids,
  'PSI-101': ['msg'], 'PSI-102': ['msg'], 'PSI-115': ['msg'],
  'PSI-117': droplets, 'PSI-142': droplets,
}

const bassNote = 'The cutaway illustrates BASS-II equipment.'
const flexNote = 'The model illustrates related ISS FLEX droplet experiments.'
const smokeNote = 'The glovebox illustrates related ISS aerosol research.'

export const profileModelNotes: Readonly<Partial<Record<string, string>>> = {
  'PSI-26': bassNote, 'PSI-60': bassNote, 'PSI-62': bassNote, 'PSI-106': bassNote, 'PSI-107': bassNote,
  'PSI-47': smokeNote, 'PSI-101': smokeNote, 'PSI-115': smokeNote,
  'PSI-117': flexNote, 'PSI-142': flexNote,
}

export const environmentModels: Readonly<Partial<Record<string, readonly ModelId[]>>> = {
  iss: ['msg', 'cir', 'flex_mdca'],
  'moon-habitat': moon,
  'lunar-rover': ['lunar_suit'],
  'iss-spacesuit': ['astro_emu_anim'],
  hyperbaric: ['chamber'],
}

export const modelGroups = {
  hero: ['lunar_hab', 'orion', 'gateway'],
  mars: ['mars_hab', 'mars_ground'],
  microgravity: ['drop_vehicle', 'drop_rig'],
  groundTest: ['chamber'],
  prevention: ['pmma', 'fabric', 'wire', 'silicone', 'ultem', 'cargo_bag', 'sleep_bag'],
  suppression: ['pfe_real', 'mist_ext'],
  breathingApparatus: ['pba_real', 'crew_pba_anim'],
  oxygenRichMedicine: ['pfe_real', 'mist_ext', 'pba_real'],
} as const satisfies Record<string, readonly ModelId[]>
