import { lazy } from 'react'

export const proceduralModels = {
  cir_bench: lazy(() => import('./assets/CirBench').then(m => ({ default: m.CirBench }))),
  saffire: lazy(() => import('./assets/Saffire').then(m => ({ default: m.SaffireUnit }))),
  drop_vehicle: lazy(() => import('./assets/DropVehicle').then(m => ({ default: m.DropVehicle }))),
  drop_rig: lazy(() => import('./assets/DropRig').then(m => ({ default: m.DropRig }))),
  chamber: lazy(() => import('./assets/Chamber').then(m => ({ default: m.Chamber }))),
  pmma: lazy(() => import('./assets/PmmaRod').then(m => ({ default: m.PmmaRod }))),
  fabric: lazy(() => import('./assets/FabricSample').then(m => ({ default: m.FabricSample }))),
  wire: lazy(() => import('./assets/WireHarness').then(m => ({ default: m.WireHarness }))),
  silicone: lazy(() => import('./assets/SiliconeStrip').then(m => ({ default: m.SiliconeStrip }))),
  ultem: lazy(() => import('./assets/UltemBox').then(m => ({ default: m.UltemBox }))),
  moon_ground: lazy(() => import('./assets/MoonGround').then(m => ({ default: m.MoonGround }))),
}
