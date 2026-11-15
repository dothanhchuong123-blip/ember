type ModelOptions = {
  generated?: boolean
  burn?: boolean
  caption?: string
}

const glb = (name: string, options: ModelOptions = { generated: true }) => ({
  name, format: 'glb' as const, ...options,
})

const procedural = (name: string, options: ModelOptions = {}) => ({
  name, format: 'procedural' as const, ...options,
})

export const models = {
  bass_ii_insert: glb('BASS-II B1 cutaway', {
    generated: true,
    caption: 'Cyan arrows show imposed airflow. Magenta sightlines show the overhead still camera and the front video view through a mirror.',
  }),
  msg: glb('Microgravity Science Glovebox'),
  flex_mdca: glb('FLEX droplet apparatus'),
  cir: glb('Combustion Integrated Rack'),
  cir_bench: procedural('CIR optics bench'),
  saffire: procedural('Saffire flow unit'),
  drop_vehicle: procedural('Drop vehicle'),
  drop_rig: procedural('Drop tower combustion rig'),
  chamber: procedural('Ground test chamber', { burn: true }),
  pmma: procedural('PMMA rod', { burn: true }),
  fabric: procedural('SIBAL fabric', { burn: true }),
  wire: procedural('Wire harness', { burn: true }),
  silicone: procedural('Silicone strip', { burn: true }),
  ultem: procedural('Ultem enclosure', { burn: true }),
  cargo_bag: glb('Cargo transfer bag'),
  sleep_bag: glb('Sleeping bag'),
  crew_iva_anim: glb('Cabin crew'),
  lunar_hab: glb('Moon habitat concept'),
  moon_ground: procedural('Lunar ground', { generated: true }),
  lunar_suit: glb('Lunar suit concept'),
  lunar_rover: glb('Pressurised lunar rover concept'),
  mars_hab: glb('Mars habitat concept'),
  mars_ground: glb('Mars ground'),
  astro_emu_anim: glb('EMU spacesuit'),
  orion: glb('Orion crew and service module'),
  gateway: glb('Lunar Gateway concept'),
  pfe_real: glb('ISS CO₂ extinguisher'),
  mist_ext: glb('Water-mist extinguisher'),
  pba_real: glb('ISS Portable Breathing Apparatus'),
  crew_pba_anim: glb('Crew wearing breathing apparatus'),
} satisfies Record<string, ModelOptions & { name: string; format: 'glb' | 'procedural' }>

export type ModelId = keyof typeof models

export function modelPath(path: string) {
  return `${import.meta.env.BASE_URL}${path}`
}
