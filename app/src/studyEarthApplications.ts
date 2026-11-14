// SI-assisted summaries of Track E's notes and research/02-earth-applications.md.
// An absent PSI ID means those sources do not document a study-specific Earth link.
export interface StudyEarthApplication {
  text: string
  sources: { label: string; url: string }[]
}

const guide = 'https://www.nasa.gov/wp-content/uploads/2016/05/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf'
const acme = 'https://www.nasa.gov/wp-content/uploads/2025/07/advanced-combustion-via-microgravity-experiments-acme.pdf'
const station = { label: 'NASA station research', url: 'https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/' }
const detector = {
  text: 'A related Shuttle-era detector distinguished smoke particles from dust for uses such as fire monitoring in mines.',
  sources: [{ label: 'NASA Spinoff', url: 'https://spinoff.nasa.gov/node/9407' }],
}

export const studyEarthApplications: Readonly<Partial<Record<string, StudyEarthApplication>>> = {
  // § A5, burner design and combustion models.
  'PSI-10': {
    text: 'NASA studied how soot forms to help designers develop cleaner, more efficient burners on Earth.',
    sources: [{ label: 'NASA combustion guide, p. 17', url: guide + '#page=17' }],
  },
  'PSI-21': {
    text: 'The study aimed to improve models of when gas flames stay lit or form soot, questions that matter for practical burners.',
    sources: [{ label: 'NASA combustion guide, p. 16', url: guide + '#page=16' }],
  },
  'PSI-22': {
    text: 'NASA tested electric control of gas flames as a possible way to cut emissions from burners on Earth.',
    sources: [{ label: 'NASA ACME overview, pp. 4–5', url: acme + '#page=4' }],
  },
  'PSI-23': {
    text: 'The study was designed to improve predictions of soot and flame extinction for combustion models used in burner design.',
    sources: [{ label: 'NASA ACME overview, pp. 1, 6', url: acme + '#page=6' }],
  },
  // § B and Track E's high-altitude and aircraft relevance notes.
  'PSI-25': {
    text: 'BASS-II gives a space comparison for material burning studies such as the Kangding fabric tests, where buoyancy still affects the flames.',
    sources: [
      station,
      { label: 'Kangding fabric study', url: 'https://www.sciopen.com/article/10.16511/j.cnki.qhdxxb.2023.26.040' },
    ],
  },
  'PSI-26': {
    text: 'NASA designed BASS to help improve ground-based fire tests for solid materials.',
    sources: [{ label: 'NASA combustion guide, p. 21', url: guide + '#page=21' }],
  },
  // § A4, cool-flame chemistry and liquid fuels.
  'PSI-39': {
    text: 'Studying how cool flames start and persist could help engineers develop engines that use less fuel and produce fewer emissions.',
    sources: [{ label: 'NASA combustion guide, p. 41', url: guide + '#page=41' }],
  },
  'PSI-68': {
    text: 'FLEX-2 studied how liquid fuel droplets burn and form soot, with the aim of helping engines on Earth use fuel more efficiently.',
    sources: [station],
  },
  'PSI-69': {
    text: 'FLEX revealed that fuel can keep reacting after the visible flame disappears, a finding that could help engineers design cleaner vehicle engines.',
    sources: [station],
  },
  // Track E links both SAME studies to the separate Shuttle-era spinoff.
  'PSI-101': detector,
  'PSI-102': detector,
  'PSI-106': {
    text: 'NASA studied flames that lift away from a burner to help engineers model cleaner, more fuel-efficient combustion devices.',
    sources: [{ label: 'NASA combustion guide, pp. 14–15', url: guide + '#page=14' }],
  },
  'PSI-107': {
    text: 'SPICE studied when gas flames begin to make soot, a question that matters for reducing emissions from burners and engines.',
    sources: [{ label: 'NASA combustion guide, pp. 13–14', url: guide + '#page=13' }],
  },
  'PSI-159': {
    text: 'The gas-flame runs offer an oxygen and pressure comparison for airliner cabins, where fire behavior also depends on Earth gravity, fuel and airflow.',
    sources: [
      { label: 'NASA ACME overview, p. 6', url: acme + '#page=6' },
      { label: 'FAA cabin pressure reference', url: 'https://www.govinfo.gov/content/pkg/CFR-2025-title14-vol1/pdf/CFR-2025-title14-vol1-sec25-841.pdf' },
    ],
  },
}
