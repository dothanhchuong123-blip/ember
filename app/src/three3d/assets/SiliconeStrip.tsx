// Silicone elastomer strip, 120 × 25 × 5 mm, held at both ends between two-piece aluminium jaws.
// Burns from the centre outwards: the rubber turns to matte charcoal and a raised crust of off-white silica ash
// flakes (instanced plates) forms on it, lifting and curling at their edges, fading to clean grey rubber near
// the clamps.
import { useMemo } from 'react';
import * as THREE from 'three';
import { addDispNormals, burnable, growMesh, type BurnLook } from '../three/burn';
import { capScrew, denseRoundRect, flakeGeo, mm, placeOn, rbox, seeded } from '../three/geo';
import { plasterNormal, plasterRough } from '../three/maps';
import { aluminium, screwSteel, socketDark } from '../three/mats';
import { mottleRough } from '../three/textures';
import { useBurn, type AssetProps } from './common';

const S = { L: mm(124), W: mm(25), T: mm(5), y0: mm(10), jawX: mm(56), jawW: mm(20), jawD: mm(36), jawH: mm(10) };

export function SiliconeStrip({ burn = 0, glow = 0, ...props }: AssetProps) {
  const shared = useBurn(burn, glow);
  const m = useMemo(() => {
    const cy = S.y0 + S.T / 2;
    // the strip: cross-section in (z, y), extruded along x
    const strip = new THREE.ExtrudeGeometry(denseRoundRect(S.W, S.T, mm(1.9), mm(0.8)), {
      depth: S.L,
      steps: 180,
      bevelEnabled: false,
    });
    strip.translate(0, 0, -S.L / 2);
    strip.rotateY(Math.PI / 2);
    strip.translate(0, cy, 0);
    addDispNormals(strip);

    const look: BurnLook = {
      mode: 'both',
      origin: [0, cy, 0],
      dir: [1, 0, 0],
      length: mm(33),
      deepBand: [0, mm(6)],
      charBand: [mm(5), mm(5)],
      heatBand: [mm(9), mm(10)],
      jitter: mm(8),
      noise: 55,
      scorch: '#8d9093',
      // under the ash the rubber is burnt to matte charcoal; the white crust is the flakes
      char: '#1a1a1a',
      deep: '#121212',
      charRough: 0.95,
      deepRough: 0.95,
      swell: mm(0.3),
      lump: mm(0.5),
      lumpFreq: 260,
      lumpDeep: 1,
    };
    const rubber = burnable(
      new THREE.MeshPhysicalMaterial({
        color: '#7f858c',
        roughness: 0.62,
        roughnessMap: mottleRough(6),
        sheen: 0.25,
        sheenColor: '#a3a9ae',
        sheenRoughness: 0.6,
      }),
      look,
      shared,
    );

    // silica ash crust: ~150 thin plates packed on a jittered grid over the top and spilling onto the edges.
    // They appear as the consumed zone reaches them, then lift 1–3 mm and cup up at their rims, tilting 15–35°.
    const r = seeded(23);
    const top = S.y0 + S.T;
    const lists: THREE.Matrix4[][] = [[], [], [], []];
    const cell = mm(4.3);
    for (let x = -mm(39); x <= mm(39); x += cell)
      for (let z = -S.W / 2 + cell * 0.45; z <= S.W / 2 - cell * 0.2; z += cell * 0.86) {
        if (Math.abs(x + mm(3)) < mm(5) && r() < 0.7) continue; // the hottest stripe is bare black char, as in the photo
        const px = x + (r() - 0.5) * cell * 0.35 + ((Math.round(z / cell) & 1) * cell) / 2, pz = z + (r() - 0.5) * cell * 0.3;
        const rad = cell * (0.74 + r() * 0.1);
        lists[Math.floor(r() * 4)].push(placeOn(new THREE.Vector3(px, top + mm(0.15), pz), new THREE.Vector3(0, 1, 0), r() * 6.28, rad, rad, rad));
      }
    for (const sz of [-1, 1])
      for (let x = -mm(34); x <= mm(34); x += cell * 1.1) {
        if (r() < 0.25) continue;
        const rad = mm(1.6 + r() * 0.8);
        const p = new THREE.Vector3(x + (r() - 0.5) * cell, cy + (r() - 0.3) * mm(1.2), sz * (S.W / 2 + mm(0.1)));
        lists[Math.floor(r() * 4)].push(placeOn(p, new THREE.Vector3(0, 0.25, sz).normalize(), r() * 6.28, rad, rad, rad));
      }
    const ash = new THREE.MeshStandardMaterial({
      color: '#dedcd8',
      roughness: 0.95,
      roughnessMap: plasterRough(1),
      normalMap: plasterNormal(1),
      normalScale: new THREE.Vector2(0.9, 0.9),
      side: THREE.DoubleSide,
    });
    const flakes = lists.map((l, k) =>
      growMesh(flakeGeo(31 + k * 7, 0.27, 5 + (k % 3)), ash, look, shared, { band: 'deep', spread: 0.5, lift: 0.35, curl: 0.35, tilt: 0.35, glow: false }, l, [0.62, 1]),
    );

    const jawMat = burnable(
      aluminium({}, [1, 1]),
      {
        mode: 'both',
        origin: [0, cy, 0],
        dir: [1, 0, 0],
        length: mm(36),
        deepBand: [0, mm(10)],
        charBand: [mm(8), mm(15)],
        heatBand: [mm(15), mm(20)],
        scorch: '#9d9b98',
        char: '#77746f',
        deep: '#55524e',
        strength: 0.4,
        metalKill: 0.3,
        charRough: 0.65,
      },
      shared,
    );
    const jaws: THREE.BufferGeometry[] = [];
    const heads: THREE.BufferGeometry[] = [];
    const socks: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      const x = sx * S.jawX;
      jaws.push(rbox(S.jawW, S.jawH, S.jawD, mm(0.7), { pos: [x, S.y0 - S.jawH / 2 - mm(0.2), 0] }));
      jaws.push(rbox(S.jawW, S.jawH, S.jawD, mm(0.7), { pos: [x, S.y0 + S.T + S.jawH / 2 - mm(0.6), 0] }));
      for (const z of [-mm(10.5), mm(10.5)]) {
        const [h, s] = capScrew(mm(3.6), mm(3), { pos: [x, S.y0 + S.T + S.jawH - mm(0.6) - mm(2.6), z] });
        heads.push(h);
        socks.push(s);
      }
    }
    return { strip, rubber, jaws, jawMat, heads, socks, steel: screwSteel(), dark: socketDark(), flakes, count: lists.flat().length };
  }, [shared]);

  return (
    <group {...props}>
      <mesh geometry={m.strip} material={m.rubber} castShadow receiveShadow />
      {m.flakes.map((f, i) => (
        <primitive key={`f${i}`} object={f} />
      ))}
      {m.jaws.map((g, i) => (
        <mesh key={i} geometry={g} material={m.jawMat} castShadow receiveShadow />
      ))}
      {m.heads.map((g, i) => (
        <mesh key={`h${i}`} geometry={g} material={m.steel} castShadow />
      ))}
      {m.socks.map((g, i) => (
        <mesh key={`s${i}`} geometry={g} material={m.dark} />
      ))}
    </group>
  );
}
