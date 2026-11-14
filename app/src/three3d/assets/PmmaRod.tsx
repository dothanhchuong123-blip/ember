// Cast PMMA rod, Ø20 × 150 mm, its left 15 mm held in a 25 × 30 × 30 mm aluminium clamp.
// Burns from the free (right) tip: the tip slumps into a lumpy, bulbous, wet-black blob, then a translucent
// amber-brown band with blisters trapped just under its glossy skin, fading into clean milky acrylic.
import { useMemo } from 'react';
import * as THREE from 'three';
import { addDispNormals, burnable, growMesh, type BurnLook } from '../three/burn';
import { bake, capScrew, lumpyBlob, mm, placeOn, rbox, seeded } from '../three/geo';
import { aluminium, screwSteel, socketDark } from '../three/mats';
import { useBurn, type AssetProps } from './common';

export const PMMA = {
  R: mm(10),
  L: mm(150),
  x0: mm(-70), // inserted end (inside the clamp)
  cy: mm(15), // rod axis height
  clamp: { x: mm(-67.5), w: mm(25), h: mm(30), d: mm(30) },
};

const rodLook = (tipX: number): BurnLook => ({
  mode: 'linear',
  origin: [tipX, PMMA.cy, 0],
  dir: [-1, 0, 0],
  length: mm(24),
  deepBand: [0, mm(5)],
  charBand: [mm(17), mm(7)],
  heatBand: [mm(26), mm(8)],
  jitter: mm(7),
  noise: 110,
  scorch: '#e2c08a',
  char: '#a85a1e',
  charRough: 0.06,
  deep: '#121010',
  deepRough: 0.75,
  deepSwell: mm(0),
  melt: 0.1,
  meltLength: mm(24),
  sag: mm(2.4),
  round: mm(4),
  roundRadius: mm(10),
  pull: mm(2),
  inflate: mm(3.4),
  inflateFreq: 58,
  lump: mm(0.7),
  lumpFreq: 300,
  lumpDeep: 0.6,
  bubbles: 0.4,
  bubbleFreq: 500,
  bubbleColor: '#9a5a1c',
  wet: 0.25,
  wetZone: 'deep',
  wetFreq: 700,
  clearChar: true,
});

function rodGeometry() {
  const { R, L, x0, cy } = PMMA;
  const f = mm(1);
  const prof: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(R, 0)];
  for (let y = mm(1.5); y < L - f; y += mm(1.5)) prof.push(new THREE.Vector2(R, y));
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * (Math.PI / 2);
    prof.push(new THREE.Vector2(R - f + f * Math.cos(a), L - f + f * Math.sin(a)));
  }
  for (let r = R - f - mm(1); r > mm(0.5); r -= mm(1)) prof.push(new THREE.Vector2(r, L));
  prof.push(new THREE.Vector2(0, L));
  const g = new THREE.LatheGeometry(prof, 72);
  g.rotateZ(-Math.PI / 2);
  g.translate(x0, cy, 0);
  return addDispNormals(g);
}

export function PmmaRod({ burn = 0, glow = 0, ...props }: AssetProps) {
  const shared = useBurn(burn, glow);
  const m = useMemo(() => {
    const tipX = PMMA.x0 + PMMA.L;
    const rodMat = burnable(
      new THREE.MeshPhysicalMaterial({
        color: '#f4f3ef',
        roughness: 0.2,
        transmission: 0.5,
        thickness: mm(20),
        ior: 1.49,
        attenuationColor: '#ece6da',
        attenuationDistance: mm(25),
        clearcoat: 1,
        clearcoatRoughness: 0.06,
      }),
      rodLook(tipX),
      shared,
    );

    // blisters in the amber band: flattened dark-amber bubbles just breaking the glossy skin. (three.js
    // transmission tints what it shows by the surface colour, so ones fully inside the rod were lost.)
    const r = seeded(41);
    const blist: THREE.Matrix4[] = [];
    for (let k = 0; k < 36; k++) {
      const x = tipX - mm(22) - r() * mm(18);
      const a = r() * Math.PI * 2;
      const n = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      const rad = mm(0.9 + r() * 1.4);
      const c = new THREE.Vector3(x, PMMA.cy, 0).addScaledVector(n, PMMA.R + mm(0.5) - rad * 0.42); // clears the band's own 0.3 mm lumps
      blist.push(placeOn(c, n, r() * 6.28, rad, rad * 0.42, rad * (0.8 + r() * 0.4)));
    }
    const blisters = growMesh(
      lumpyBlob(2, 7.7, 0.12, 1.5),
      new THREE.MeshPhysicalMaterial({ color: '#5c2200', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.82 }),
      rodLook(tipX),
      shared,
      { band: 'char', spread: 0.6, glow: false },
      blist,
    );
    const clampMat = burnable(
      aluminium({}, [1, 1]),
      {
        mode: 'linear',
        origin: [tipX, PMMA.cy, 0],
        dir: [-1, 0, 0],
        length: mm(120),
        deepBand: [0, mm(20)],
        charBand: [mm(10), mm(30)],
        heatBand: [mm(20), mm(40)],
        scorch: '#8f8d8a',
        char: '#6b6865',
        deep: '#4a4846',
        charRough: 0.6,
        strength: 0.35,
        metalKill: 0.3,
      },
      shared,
    );
    const c = PMMA.clamp;
    const clamp = rbox(c.w, c.h, c.d, mm(0.8), { pos: [c.x, c.h / 2, 0] });
    const [head, sock] = capScrew(mm(4.2), mm(3.2), { pos: [c.x, c.h - mm(2.2), 0] });
    const counterbore = bake(new THREE.RingGeometry(mm(4.2), mm(5), 40), { pos: [c.x, c.h + mm(0.02), 0], rot: [-Math.PI / 2, 0, 0] });
    const entry = bake(new THREE.TorusGeometry(PMMA.R + mm(0.15), mm(0.18), 8, 64), { pos: [c.x + c.w / 2, PMMA.cy, 0], rot: [0, Math.PI / 2, 0] });
    return { blisters, rod: rodGeometry(), rodMat, clamp, clampMat, head, sock, counterbore, entry, steel: screwSteel(), dark: socketDark() };
  }, [shared]);

  return (
    <group {...props}>
      <mesh geometry={m.rod} material={m.rodMat} castShadow receiveShadow />
      <primitive object={m.blisters} />
      <mesh geometry={m.clamp} material={m.clampMat} castShadow receiveShadow />
      <mesh geometry={m.head} material={m.steel} castShadow />
      <mesh geometry={m.sock} material={m.dark} />
      <mesh geometry={m.counterbore} material={m.dark} />
      <mesh geometry={m.entry} material={m.dark} />
    </group>
  );
}
