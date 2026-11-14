// Flammability test chamber: a riveted stainless box, 600 × 500 × 460 mm (+ feet), open at the front behind a
// bolted bezel frame. Inside: a bead-blasted liner with rounded corners, the circular air nozzle with its
// louvred throat on the back wall, a braided cable loom held by clips, the sample clamp on the right wall,
// and a gas line with brass fittings. Outside: corner posts, raised riveted side and back panels, feet,
// connectors and a toggle on the back. `burn` stains the liner with soot rising from the sample clamp.
import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { burnable } from '../three/burn';
import { bake, box, capScrew, cyl, extrude, merge, rbox, rivetGeo, roundRect, tube } from '../three/geo';
import { aluminium, blasted, brass, screwSteel, socketDark, stainless } from '../three/mats';
import { braidMap } from '../three/textures';
import { Scatter, V, rowAround, useBurn, type AssetProps, type Placed } from './common';

export const CH = {
  W: 0.6, H: 0.5, D: 0.46, y0: 0.03,
  hole: { w: 0.49, h: 0.39, r: 0.035 },
  liner: { w: 0.49, h: 0.39, back: -0.2 },
  /** the tip of the sample holder: where a sample sits */
  sampleAt: new THREE.Vector3(0.17, 0.29, -0.02),
};
const cy = CH.y0 + CH.H / 2;
const zF = CH.D / 2;

/** liner: inside of a rounded box with its front face removed */
function linerGeometry() {
  const d = zF - CH.liner.back;
  const g = new RoundedBoxGeometry(CH.liner.w, CH.liner.h, d, 6, CH.hole.r).toNonIndexed();
  g.translate(0, cy, CH.liner.back + d / 2);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const keep: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    let front = true;
    for (let k = 0; k < 3; k++) if (pos.getZ(t + k) < zF - 1e-4 || nor.getZ(t + k) < 0.99) front = false;
    if (!front) keep.push(t, t + 1, t + 2);
  }
  const out = new THREE.BufferGeometry();
  const pick = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, n: number) =>
    new THREE.BufferAttribute(Float32Array.from(keep.flatMap((i) => Array.from({ length: n }, (_, c) => a.getComponent(i, c)))), n);
  out.setAttribute('position', pick(pos, 3));
  out.setAttribute('normal', pick(nor, 3));
  out.setAttribute('uv', pick(uv, 2));
  return out;
}

function roundRectPoints(cx: number, cyy: number, w: number, h: number, r: number, z: number) {
  return roundRect(w, h, r)
    .getSpacedPoints(160)
    .slice(0, -1)
    .map((p) => new THREE.Vector3(cx + p.x, cyy + p.y, z));
}

export function Chamber({ burn = 0, glow = 0, ...props }: AssetProps) {
  const shared = useBurn(burn, glow);
  const m = useMemo(() => {
    const { W, H, D, y0 } = CH;
    const t = 0.012;
    const steel: THREE.BufferGeometry[] = [];
    const frame: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const brassG: THREE.BufferGeometry[] = [];
    const alu: THREE.BufferGeometry[] = [];
    const screwHeads: Placed[] = [];
    const rivets: Placed[] = [];

    // ── shell
    steel.push(box(W, t, D, { pos: [0, y0 + H - t / 2, 0] }));
    steel.push(box(W, t, D, { pos: [0, y0 + t / 2, 0] }));
    for (const s of [-1, 1]) steel.push(box(t, H, D, { pos: [s * (W / 2 - t / 2), cy, 0] }));
    steel.push(box(W, H, t, { pos: [0, cy, -D / 2 + t / 2] }));

    // corner posts and top rails
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) frame.push(rbox(0.024, H + 0.006, 0.024, 0.003, { pos: [sx * (W / 2 + 0.002), cy, sz * (D / 2 - 0.02)] }));
    for (const sz of [-1, 1]) frame.push(rbox(W + 0.004, 0.02, 0.02, 0.003, { pos: [0, y0 + H - 0.008, sz * (D / 2 - 0.02)] }));
    for (const sx of [-1, 1]) {
      frame.push(rbox(0.02, 0.02, D - 0.04, 0.003, { pos: [sx * (W / 2 + 0.002), y0 + H - 0.008, 0] }));
      frame.push(rbox(0.02, 0.02, D - 0.04, 0.003, { pos: [sx * (W / 2 + 0.002), y0 + 0.012, 0] }));
    }
    // feet and rear gussets
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        frame.push(rbox(0.07, y0 + 0.01, 0.06, 0.004, { pos: [sx * (W / 2 - 0.03), (y0 + 0.01) / 2, sz * (D / 2 - 0.035)] }));
      }
    for (const sx of [-1, 1]) {
      const g = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.11, 0), new THREE.Vector2(0.11, 0.15)]);
      frame.push(extrude(g, 0.006, 0.001, { pos: [sx * (W / 2 + 0.014) - 0.003, y0 + 0.02, -D / 2 + 0.11], rot: [0, Math.PI / 2, 0] }));
    }

    // raised riveted panels on both sides and on the back
    const panels: { c: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3; n: THREE.Vector3; w: number; h: number }[] = [];
    for (const sx of [-1, 1]) {
      const n = V(sx, 0, 0), u = V(0, 0, -sx), v = V(0, 1, 0);
      panels.push({ c: V(sx * (W / 2), y0 + H * 0.7, -0.01), u, v, n, w: 0.3, h: 0.19 });
      panels.push({ c: V(sx * (W / 2), y0 + H * 0.38, -0.01), u, v, n, w: 0.3, h: 0.14 });
    }
    panels.push({ c: V(0, y0 + H * 0.7, -D / 2), u: V(-1, 0, 0), v: V(0, 1, 0), n: V(0, 0, -1), w: 0.42, h: 0.19 });
    panels.push({ c: V(0, y0 + H * 0.4, -D / 2), u: V(-1, 0, 0), v: V(0, 1, 0), n: V(0, 0, -1), w: 0.42, h: 0.15 });
    for (const p of panels) {
      const g = extrude(roundRect(p.w, p.h, 0.014), 0.003, 0.0008);
      const basis = new THREE.Matrix4().makeBasis(p.u, p.v, p.n).setPosition(p.c);
      g.applyMatrix4(basis);
      steel.push(g);
      for (const q of rowAround(p.c.clone().addScaledVector(p.n, 0.003), p.u, p.v, p.w - 0.018, p.h - 0.018, 0.026)) rivets.push({ p: q, n: p.n });
    }
    // rivet rows round the side and back walls
    for (const sx of [-1, 1])
      for (const q of rowAround(V(sx * (W / 2), cy, -0.005), V(0, 0, 1), V(0, 1, 0), D - 0.09, H - 0.05, 0.034)) rivets.push({ p: q, n: V(sx, 0, 0) });
    for (const q of rowAround(V(0, cy, -D / 2), V(1, 0, 0), V(0, 1, 0), W - 0.07, H - 0.05, 0.036)) rivets.push({ p: q, n: V(0, 0, -1) });

    // top: raised lid frame, fittings along the back edge
    {
      const ring = roundRect(W - 0.06, D - 0.07, 0.01);
      ring.holes.push(roundRect(W - 0.08, D - 0.09, 0.006, new THREE.Path()));
      frame.push(extrude(ring, 0.004, 0.0008, { pos: [0, y0 + H, 0], rot: [-Math.PI / 2, 0, 0] }));
      brassG.push(cyl(0.006, 0.006, 0.014, { pos: [-0.12, y0 + H + 0.007, -D / 2 + 0.05] }, 6));
      brassG.push(cyl(0.004, 0.004, 0.024, { pos: [0.18, y0 + H + 0.012, -D / 2 + 0.05] }, 6));
      frame.push(rbox(0.06, 0.016, 0.03, 0.003, { pos: [0.03, y0 + H + 0.008, -D / 2 + 0.05] }));
      frame.push(rbox(0.05, 0.012, 0.02, 0.003, { pos: [-0.2, y0 + H + 0.006, D / 2 - 0.04] }));
    }

    // back: connectors, toggle, bracket, cover plate
    {
      const z = -D / 2 - 0.003;
      for (const [x, y] of [[0.24, 0.17], [0.24, 0.12]] as const) {
        dark.push(cyl(0.011, 0.011, 0.016, { pos: [x, y0 + y, z - 0.008], rot: [Math.PI / 2, 0, 0] }, 24));
        frame.push(cyl(0.013, 0.013, 0.004, { pos: [x, y0 + y, z - 0.002], rot: [Math.PI / 2, 0, 0] }, 24));
      }
      brassG.push(cyl(0.007, 0.007, 0.012, { pos: [0.24, y0 + 0.3, z - 0.006], rot: [Math.PI / 2, 0, 0] }, 6));
      frame.push(cyl(0.006, 0.006, 0.01, { pos: [0.24, y0 + 0.24, z - 0.005], rot: [Math.PI / 2, 0, 0] }, 16));
      frame.push(cyl(0.0018, 0.0012, 0.018, { pos: [0.24, y0 + 0.25, z - 0.015], rot: [Math.PI / 2 + 0.5, 0, 0] }, 10));
      frame.push(rbox(0.06, 0.05, 0.004, 0.002, { pos: [0.0, y0 + 0.37, z - 0.002] }));
      frame.push(rbox(0.05, 0.035, 0.004, 0.002, { pos: [-0.12, y0 + 0.4, z - 0.002] }));
      frame.push(rbox(0.04, 0.06, 0.004, 0.002, { pos: [0.08, y0 + 0.19, z - 0.002] }));
    }

    // left side, near the front: two connector plates and a line between them
    for (const y of [0.42, 0.1]) {
      frame.push(rbox(0.006, 0.045, 0.045, 0.002, { pos: [-W / 2 - 0.017, y0 + y, D / 2 - 0.05] }));
      dark.push(cyl(0.008, 0.008, 0.01, { pos: [-W / 2 - 0.024, y0 + y, D / 2 - 0.05], rot: [0, 0, Math.PI / 2] }, 20));
      for (const dy of [-0.016, 0.016]) for (const dz of [-0.016, 0.016]) screwHeads.push({ p: V(-W / 2 - 0.02, y0 + y + dy, D / 2 - 0.05 + dz), n: V(-1, 0, 0), s: 0.7 });
    }
    steel.push(tube([V(-W / 2 - 0.02, y0 + 0.13, D / 2 - 0.075), V(-W / 2 - 0.024, y0 + 0.26, D / 2 - 0.078), V(-W / 2 - 0.02, y0 + 0.39, D / 2 - 0.075)], 0.003, 60, 8));

    // ── bezel frame with bolts and a rubber gasket
    {
      const s = roundRect(W + 0.022, H + 0.02, 0.012);
      s.holes.push(roundRect(CH.hole.w + 0.012, CH.hole.h + 0.012, CH.hole.r + 0.006, new THREE.Path()));
      frame.push(extrude(s, 0.024, 0.003, { pos: [0, cy, zF] }, 16));
      const inner = roundRect(CH.hole.w + 0.03, CH.hole.h + 0.03, CH.hole.r + 0.01);
      inner.holes.push(roundRect(CH.hole.w, CH.hole.h, CH.hole.r, new THREE.Path()));
      frame.push(extrude(inner, 0.008, 0.001, { pos: [0, cy, zF + 0.022] }, 16));
      dark.push(tube(roundRectPoints(0, cy, CH.hole.w + 0.004, CH.hole.h + 0.004, CH.hole.r + 0.002, zF + 0.026), 0.0026, 320, 8, true));
      for (const q of rowAround(V(0, cy, zF + 0.024), V(1, 0, 0), V(0, 1, 0), W - 0.012 + 0.022 - 0.03, H + 0.02 - 0.03, 0.06)) screwHeads.push({ p: q, n: V(0, 0, 1) });
    }

    // ── interior
    const zb = CH.liner.back;
    // air nozzle on the back wall
    {
      const c = V(-0.115, cy + 0.005, zb);
      const face = (g: THREE.BufferGeometry, dz: number) => bake(g, { pos: [c.x, c.y, c.z + dz], rot: [Math.PI / 2, 0, 0] });
      frame.push(face(new THREE.CylinderGeometry(0.072, 0.072, 0.006, 64), 0.003));
      frame.push(face(new THREE.LatheGeometry([[0.052, 0], [0.054, 0.004], [0.054, 0.02], [0.05, 0.024], [0.044, 0.024], [0.042, 0.004], [0.042, 0]].map(([a, b]) => new THREE.Vector2(a, b)), 64), 0.006));
      dark.push(face(new THREE.CylinderGeometry(0.042, 0.042, 0.002, 48), 0.008));
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2;
        const fin = new THREE.BoxGeometry(0.028, 0.0014, 0.012);
        fin.rotateX(0.5);
        fin.translate(0.026, 0, 0);
        fin.rotateZ(a);
        frame.push(bake(fin, { pos: [c.x, c.y, c.z + 0.016] }));
      }
      frame.push(face(new THREE.SphereGeometry(0.012, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0.02));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        screwHeads.push({ p: V(c.x + Math.cos(a) * 0.063, c.y + Math.sin(a) * 0.063, c.z + 0.006), n: V(0, 0, 1), s: 0.8 });
      }
    }
    // braided cable loom with clips
    const loomPath = roundRectPoints(0.01, cy - 0.005, CH.liner.w - 0.07, CH.liner.h - 0.06, 0.055, zb + 0.008);
    const loom: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const off = (k - 2) * 0.0062;
      const pts = loomPath.map((p) => {
        const dx = p.x - 0.01, dy = p.y - (cy - 0.005);
        const len = Math.hypot(dx / (CH.liner.w - 0.07), dy / (CH.liner.h - 0.06)) || 1;
        return V(p.x + (dx / len) * off * 2.2, p.y + (dy / len) * off * 2.2, p.z + (k % 2) * 0.004);
      });
      loom.push(tube(pts, 0.0036, 400, 8, true));
    }
    for (let k = 0; k < 10; k++) {
      const i = Math.floor((k / 10) * loomPath.length + 6);
      const p = loomPath[i % loomPath.length], q = loomPath[(i + 1) % loomPath.length];
      const dir = q.clone().sub(p).normalize();
      const clip = new THREE.BoxGeometry(0.009, 0.036, 0.014);
      clip.rotateZ(Math.atan2(dir.y, dir.x));
      frame.push(bake(clip, { pos: [p.x, p.y, p.z + 0.003] }));
    }
    // sample clamp on the right wall
    {
      const xw = CH.liner.w / 2;
      const { y, z } = CH.sampleAt;
      alu.push(rbox(0.006, 0.07, 0.05, 0.0015, { pos: [xw - 0.004, y, z] }));
      alu.push(rbox(0.04, 0.018, 0.026, 0.002, { pos: [xw - 0.026, y, z] }));
      alu.push(rbox(0.016, 0.03, 0.03, 0.002, { pos: [xw - 0.052, y, z] }));
      alu.push(box(0.022, 0.002, 0.012, { pos: [CH.sampleAt.x + 0.011, y, z] }));
      for (const dy of [-0.026, 0.026]) for (const dz of [-0.017, 0.017]) screwHeads.push({ p: V(xw - 0.007, y + dy, z + dz), n: V(-1, 0, 0), s: 0.6 });
      screwHeads.push({ p: V(xw - 0.052, y + 0.015, z), n: V(0, 1, 0), s: 0.8 });
    }
    // gas line down the right wall with brass fittings and a sensor
    {
      const x = CH.liner.w / 2 - 0.008, z = zF - 0.05;
      steel.push(tube([V(x, cy + 0.18, zb + 0.05), V(x, cy + 0.17, z - 0.03), V(x, cy + 0.12, z), V(x, cy - 0.15, z), V(x - 0.01, cy - 0.17, z - 0.04)], 0.0028, 120, 8));
      for (const yy of [0.09, -0.02, -0.12]) brassG.push(cyl(0.0055, 0.0055, 0.012, { pos: [x, cy + yy, z] }, 6));
      frame.push(rbox(0.012, 0.045, 0.018, 0.002, { pos: [x - 0.002, cy + 0.03, z] }));
      brassG.push(cyl(0.004, 0.004, 0.012, { pos: [0.18, cy + CH.liner.h / 2 - 0.006, zF - 0.05] }, 6));
      brassG.push(cyl(0.004, 0.004, 0.012, { pos: [-0.2, cy + CH.liner.h / 2 - 0.006, zF - 0.05] }, 6));
    }

    const [headG] = capScrew(0.0045, 0.0032);
    const sootLook = {
      mode: 'radial' as const,
      origin: [CH.sampleAt.x, CH.sampleAt.y + 0.05, CH.sampleAt.z] as [number, number, number],
      scale: [1, 0.55, 1] as [number, number, number],
      length: 0.06,
      deepBand: [0, 0.04] as [number, number],
      charBand: [0.03, 0.07] as [number, number],
      heatBand: [0.08, 0.1] as [number, number],
      jitter: 0.025,
      noise: 14,
      scorch: '#8e8a85',
      char: '#56524e',
      deep: '#232120',
      charRough: 0.75,
      deepRough: 0.9,
      metalKill: 0.6,
      strength: 0.85,
    };
    return {
      liner: linerGeometry(),
      linerMat: burnable(blasted({ side: THREE.BackSide }), sootLook, shared),
      steel: merge(steel),
      frame: merge(frame),
      dark: merge(dark),
      brass: merge(brassG),
      alu: merge(alu),
      loom: merge(loom),
      steelMat: stainless(),
      frameMat: stainless({ roughness: 0.24 }, [6, 6]),
      darkMat: new THREE.MeshStandardMaterial({ color: '#2a2b2d', roughness: 0.55, metalness: 0.2 }),
      brassMat: brass(),
      aluMat: burnable(aluminium({}, [1, 1]), { ...sootLook, strength: 0.4 }, shared),
      loomMat: new THREE.MeshPhysicalMaterial({ color: '#c4c6c8', metalness: 1, roughness: 0.38, map: braidMap(160, 1) }),
      headG,
      screwMat: screwSteel(),
      rivetG: rivetGeo(0.0032),
      screwHeads,
      rivets,
      dull: socketDark(),
    };
  }, [shared]);

  return (
    <group {...props}>
      <mesh geometry={m.liner} material={m.linerMat} receiveShadow />
      <mesh geometry={m.steel} material={m.steelMat} castShadow receiveShadow />
      <mesh geometry={m.frame} material={m.frameMat} castShadow receiveShadow />
      <mesh geometry={m.dark} material={m.darkMat} castShadow receiveShadow />
      <mesh geometry={m.brass} material={m.brassMat} castShadow />
      <mesh geometry={m.alu} material={m.aluMat} castShadow receiveShadow />
      <mesh geometry={m.loom} material={m.loomMat} castShadow receiveShadow />
      <Scatter geo={m.headG} mat={m.screwMat} items={m.screwHeads} />
      <Scatter geo={m.rivetG} mat={m.steelMat} items={m.rivets} />
    </group>
  );
}
