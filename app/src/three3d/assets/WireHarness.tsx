// Aerospace wire bundle sample: four Ø3 mm wires (two white, two yellow insulation) loosely twisted into one
// 150 mm bundle, two black nylon cable ties, stripped stranded copper ends crimped into gold pin contacts.
// Burns from the middle: insulation melts into wet, glossy black lumps and droplets (some hanging under the
// bundle) and is eaten away to show the fine twisted copper strands, oxidised purple-brown; scorched tan
// insulation towards the ties.
import { useMemo } from 'react';
import * as THREE from 'three';
import { addDispNormals, burnable, growMesh, type BurnLook } from '../three/burn';
import { bake, lumpyBlob, merge, mm, placeOn, rbox, seeded, tube } from '../three/geo';
import { copper, gold, insulation, nylonBlack } from '../three/mats';
import { strandBump, strandMap } from '../three/textures';
import { useBurn, type AssetProps } from './common';

const WR = mm(1.5); // insulation radius (Ø3 mm wires, as in the photo)
const CR = mm(0.85); // conductor radius
const BUNDLE = mm(2.15); // wire centre to bundle axis: four wires touching in a square
const INS_END = mm(58); // insulation ends at ±58 mm
const CU_END = mm(63);
const TIE_X = mm(40);
const Y = BUNDLE + WR; // bundle axis height (resting on the floor)

/** centre-line of wire i: twisted between the ties, fanned out flat beyond them */
function wirePath(i: number, xs: number[]): THREE.Vector3[] {
  const twist = (Math.PI * 2) / mm(115); // one loose turn over ~115 mm
  // fan slot by the wire's sideways order where the fan starts, so wires never cross
  const slot = (side: number) => {
    const zs = [0, 1, 2, 3].map((k) => Math.sin(k * (Math.PI / 2) + twist * side * TIE_X));
    const order = [...zs.keys()].sort((a, b) => zs[a] - zs[b]);
    return order.indexOf(i);
  };
  const slotL = slot(-1), slotR = slot(1);
  return xs.map((x) => {
    const a = i * (Math.PI / 2) + twist * x;
    const y0 = Y + BUNDLE * Math.cos(a), z0 = BUNDLE * Math.sin(a);
    const t = THREE.MathUtils.smoothstep(Math.abs(x), TIE_X + mm(3), INS_END - mm(4));
    const s = x < 0 ? slotL : slotR;
    const fz = (s - 1.5) * mm(5.2);
    const fy = WR + (s - 1.5) * mm(0.7) * (x < 0 ? -1 : 1) + mm(1.2);
    return new THREE.Vector3(x, THREE.MathUtils.lerp(y0, fy, t), THREE.MathUtils.lerp(z0, fz, t));
  });
}

const range = (a: number, b: number, step: number) => {
  const out: number[] = [];
  for (let x = a; x <= b + 1e-9; x += step) out.push(x);
  return out;
};

export function WireHarness({ burn = 0, glow = 0, ...props }: AssetProps) {
  const shared = useBurn(burn, glow);
  const m = useMemo(() => {
    const base: Omit<BurnLook, 'scorch' | 'char' | 'deep'> = {
      mode: 'both',
      origin: [0, Y, 0],
      dir: [1, 0, 0],
      length: mm(20),
      deepBand: [0, mm(8)],
      charBand: [mm(9), mm(6)],
      heatBand: [mm(17), mm(14)],
      jitter: mm(5),
      noise: 80,
    };
    const insLook: BurnLook = {
      ...base,
      scorch: '#b8884c',
      char: '#0f0d0c',
      charRough: 0.14,
      deep: '#0a0909',
      deepRough: 0.16,
      swell: mm(0.9),
      lump: mm(2.6),
      lumpFreq: 170,
      lumpDeep: 0.7,
      bubbles: 1,
      bubbleFreq: 300,
      bubbleColor: '#050505',
      wet: 1,
      wetZone: 'char',
      cut: 1.02, // ragged windows where the noise is low: the melt mostly stays on as a black mass
      cutCore: mm(16.5), // and the hottest middle is eaten right through to the strands
    };
    const cuLook: BurnLook = {
      ...base,
      scorch: '#8a4a34',
      char: '#4a2533',
      deep: '#3d1e28',
      charRough: 0.35,
      deepRough: 0.35,
      metalKill: 0.15,
    };
    const ins = [insulation('#f3f2ee'), insulation('#e9c21c'), insulation('#f3f2ee'), insulation('#e9c21c')].map((mat) =>
      burnable(mat, insLook, shared),
    );
    const cu = burnable(copper({ map: strandMap(1, 60), bumpMap: strandBump(1, 60), bumpScale: 0.6 }), cuLook, shared);
    const tieMat = burnable(nylonBlack(), { ...base, scorch: '#2a2420', char: '#0c0b0a', deep: '#0c0b0a', strength: 0.6 }, shared);

    const xs = range(-INS_END, INS_END, mm(1));
    const wires = [0, 1, 2, 3].map((i) => {
      const pts = wirePath(i, xs);
      const g = tube(pts, WR, 260, 14);
      addDispNormals(g);
      const L = pts[0], R = pts[pts.length - 1];
      // conductor: same path, carried on straight past the insulation
      const core = tube([L.clone().setX(-CU_END), ...pts, R.clone().setX(CU_END)], CR, 280, 10);
      const caps = [L, R].map((p, k) =>
        bake(new THREE.RingGeometry(CR, WR, 24), { pos: [p.x, p.y, p.z], rot: [0, k ? Math.PI / 2 : -Math.PI / 2, 0] }),
      );
      // gold crimp contact: barrel, collar, pin, rounded tip
      const pins = [L, R].map((p, k) => {
        const s = k ? 1 : -1;
        const prof = [
          [0, 0], [mm(0.95), 0], [mm(0.95), mm(4.2)], [mm(1.15), mm(4.4)], [mm(1.15), mm(5.4)], [mm(0.75), mm(5.6)],
          [mm(0.55), mm(5.8)], [mm(0.55), mm(12.4)], [mm(0.35), mm(13)], [0, mm(13.2)],
        ].map(([r, y]) => new THREE.Vector2(r * 1.2, y));
        return bake(new THREE.LatheGeometry(prof, 24), { pos: [s * (CU_END - mm(1)), p.y, p.z], rot: [0, 0, -s * Math.PI / 2] });
      });
      return { g, core, caps, pins };
    });

    // the conductors' fine strands, only where the insulation can melt away: 12 strands of Ø0.32 mm twisted round
    // each core, opening up a little at the hottest middle
    const MELT = mm(34);
    const strands = merge(
      [0, 1, 2, 3].flatMap((i) => {
        const pts = wirePath(i, range(-MELT, MELT, mm(1)));
        return [...Array(12).keys()].map((k) => {
          const path = pts.map((p) => {
            const open = 1 + 0.5 * Math.exp(-((p.x / mm(10)) ** 2));
            const a = (k / 12) * Math.PI * 2 + p.x / mm(1.1);
            const rr = CR * 0.72 * open;
            return new THREE.Vector3(p.x, p.y + Math.cos(a) * rr, p.z + Math.sin(a) * rr);
          });
          return tube(path, mm(0.16), 220, 5);
        });
      }),
    );
    addDispNormals(strands);
    const strandMat = burnable(
      new THREE.MeshPhysicalMaterial({ color: '#8a5040', metalness: 0.85, roughness: 0.32 }),
      { ...cuLook, scorch: '#9a5a3a', char: '#64383a', deep: '#523034', charRough: 0.3, deepRough: 0.32 },
      shared,
    );

    // melt droplets and blobs: glossy black, clinging round the melt, some hanging under the bundle and sagging
    const r = seeded(9);
    const drops: THREE.Matrix4[] = [];
    const big: THREE.Matrix4[] = [];
    for (let k = 0; k < 96; k++) {
      // round the edges of the melt, not over the open window at the middle
      const x = (r() < 0.5 ? -1 : 1) * (mm(7) + r() ** 1.5 * mm(24));
      const under = r() < 0.3;
      const a = under ? Math.PI + (r() - 0.5) * 1.2 : r() * Math.PI * 2; // angle round the bundle, π = underneath
      const n = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      const rad = mm(0.5 + r() * (under ? 1.4 : 1.1)) * (r() < 0.1 ? 1.7 : 1);
      const c = new THREE.Vector3(x, Y, 0).addScaledVector(n, BUNDLE + WR * 0.9 + rad * 0.3);
      const M = placeOn(c, n, r() * 6.28, rad * (1 + r() * 0.4), rad * (under ? 1.3 + r() * 0.6 : 0.6 + r() * 0.3), rad * (1 + r() * 0.4));
      (rad > mm(1.6) ? big : drops).push(M);
    }
    const wetBlack = () => new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.08 });
    const dropOpts = { band: 'char' as const, spread: 0.7, sag: mm(1.4), glow: true };
    const melt = [
      growMesh(lumpyBlob(3, 3.3, 0.25, 2.2), wetBlack(), insLook, shared, dropOpts, drops),
      growMesh(lumpyBlob(3, 5.1, 0.3, 2.6), wetBlack(), insLook, shared, dropOpts, big),
    ];

    // cable ties: a flat band round the bundle with its locking head on top
    const ties = [-TIE_X, TIE_X].flatMap((x) => {
      const r0 = BUNDLE + WR + mm(0.05), t = mm(0.8), w = mm(3.2);
      const band = bake(
        new THREE.LatheGeometry(
          [[r0, -w / 2], [r0 + t, -w / 2], [r0 + t, w / 2], [r0, w / 2], [r0, -w / 2]].map(([a, b]) => new THREE.Vector2(a, b)),
          40,
        ),
        { pos: [x, Y, 0], rot: [0, 0, Math.PI / 2] },
      );
      const head = rbox(mm(4), mm(3.6), mm(5.2), mm(0.6), { pos: [x, Y + r0 + t + mm(1.5), 0] });
      return [band, head];
    });
    return { wires, ins, cu, ties, tieMat, gold: gold(), strands, strandMat, melt };
  }, [shared]);

  return (
    <group {...props}>
      {m.wires.map((w, i) => (
        <group key={i}>
          <mesh geometry={w.g} material={m.ins[i]} castShadow receiveShadow />
          <mesh geometry={w.core} material={m.cu} castShadow />
          {w.caps.map((c, k) => (
            <mesh key={`c${k}`} geometry={c} material={m.ins[i]} />
          ))}
          {w.pins.map((p, k) => (
            <mesh key={`p${k}`} geometry={p} material={m.gold} castShadow />
          ))}
        </group>
      ))}
      <mesh geometry={m.strands} material={m.strandMat} castShadow />
      {m.melt.map((o, i) => (
        <primitive key={`m${i}`} object={o} />
      ))}
      {m.ties.map((g, i) => (
        <mesh key={`t${i}`} geometry={g} material={m.tieMat} castShadow receiveShadow />
      ))}
    </group>
  );
}
