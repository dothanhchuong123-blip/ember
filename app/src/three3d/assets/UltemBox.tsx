// Avionics enclosure in translucent amber Ultem (PEI), 100 × 72 × 42 mm, 2 mm walls, empty inside.
// Two columns of five cooling slots on the front, four corner screw bosses (seen through the walls),
// a lid/base split line, and two flange tabs on each side.
// Burns from the front-top-right corner: a swollen, bubbly black intumescent char foam that cracks to show
// scorched dark amber, and darkened amber everywhere near it.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { modelPath } from '../models';
import { addDispNormals, burnable, growMesh, type BurnLook } from '../three/burn';
import { bake, denseRoundRect, lumpyBlob, mm, placeOn, seeded } from '../three/geo';
import { mottleRough } from '../three/textures';
import { useBurn, useOnUnmount, type AssetProps } from './common';

const U = { W: mm(100), D: mm(72), H: mm(42), wall: mm(2), r: mm(6) };

/** vertical extrusion of a horizontal outline from y0 to y1 */
function upright(shape: THREE.Shape, y0: number, y1: number, steps = 1, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: y1 - y0 - bevel * 2,
    steps,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 3,
    curveSegments: 16,
  });
  g.translate(0, 0, bevel);
  g.rotateX(-Math.PI / 2); // +z → +y (shape y → −z)
  g.translate(0, y0, 0);
  return g;
}

// The approved shell was exported with the original constructive-solid-geometry cuts.
const shellPath = modelPath('models/ultem-shell.glb');

function tabGeometry(side: 1 | -1, z: number) {
  const s = new THREE.Shape();
  const w = mm(5.5);
  s.moveTo(mm(-3), -w);
  s.lineTo(mm(6), -w);
  s.absarc(mm(6), 0, w, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(mm(-3), w);
  s.closePath();
  const h = new THREE.Path();
  h.absarc(mm(6), 0, mm(1.7), 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = upright(s, 0, mm(3), 1, mm(0.4));
  if (side < 0) g.rotateY(Math.PI);
  g.translate((side * U.W) / 2, 0, z);
  return addDispNormals(g, 1e-4);
}

const LOOK: BurnLook = {
  mode: 'radial',
  origin: [U.W / 2 - mm(6), U.H, U.D / 2],
  scale: [0.75, 0.9, 1.4],
  length: mm(52),
  deepBand: [0, mm(8)],
  charBand: [mm(6), mm(8)],
  heatBand: [mm(18), mm(40)],
  jitter: mm(9),
  noise: 45,
  // under the foam the plastic is scorched dark amber: it shows in the cracks between the char lumps
  scorch: '#4a2108',
  char: '#1c120c',
  charRough: 0.6,
  deep: '#140e0a',
  deepRough: 0.7,
  cracks: 0.22,
  crackFreq: 60,
  crackColor: '#a8560c',
  swellFrom: [0, U.H * 0.4, 0],
  swell: mm(1.8),
  lump: mm(2.2),
  lumpFreq: 150,
  lumpDeep: 0.6,
};

/** where the char foam can sit: random points on the outer skin of the body (area-weighted, so rounded corners and
 *  slot edges get their share) inside the final burn, each with its surface normal */
function foamSites(body: THREE.BufferGeometry, density: number) {
  const { H } = U;
  const o = new THREE.Vector3(...LOOK.origin);
  const sc = new THREE.Vector3(...LOOK.scale!);
  const reach = LOOK.length + mm(16);
  const centre = new THREE.Vector3(0, H * 0.45, 0);
  const pos = body.attributes.position;
  const idx = body.index;
  const tri = (k: number) => (idx ? idx.getX(k) : k);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const r = seeded(17);
  // smooth low-frequency field: where it is high the foam has split open and the scorched amber shows through
  const gap = (p: THREE.Vector3) =>
    Math.sin(p.x * 170 + 1.3) * Math.sin(p.z * 200 + 0.4) + 0.5 * Math.sin(p.x * 390 + p.z * 310 + p.y * 120);
  const out: { p: THREE.Vector3; n: THREE.Vector3; k: number; pocket?: boolean }[] = [];
  const count = (idx ? idx.count : pos.count) / 3;
  for (let t = 0; t < count; t++) {
    a.fromBufferAttribute(pos, tri(t * 3));
    b.fromBufferAttribute(pos, tri(t * 3 + 1));
    c.fromBufferAttribute(pos, tri(t * 3 + 2));
    n.subVectors(c, b).cross(b.clone().sub(a).negate());
    const area = n.length() / 2;
    if (area <= 0) continue;
    n.normalize();
    const mid = a.clone().add(b).add(c).divideScalar(3);
    if (n.dot(mid.clone().sub(centre)) <= 0) continue; // inner walls face the middle of the box
    let k = area * density;
    while (k > 0) {
      if (k < 1 && r() > k) break;
      k -= 1;
      let u = r(), v = r();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const p = a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
      if (p.y < mm(8.5)) continue; // the base below the split line stays clean in the photo
      // over the slot grille the foam bridges some slots and leaves others open
      if (n.z > 0.7 && Math.abs(Math.abs(p.x) - mm(18)) < mm(16) && p.y > mm(9) && p.y < mm(35) && r() < 0.45) continue;
      const d = p.clone().sub(o).multiply(sc).length();
      if (d > reach) continue;
      if (gap(p) > (n.y > 0.6 ? 0.6 : 0.95) && d > mm(12)) {
        if (r() < 0.5) out.push({ p, n: n.clone(), k: 0, pocket: true });
        continue;
      }
      out.push({ p, n: n.clone(), k: 1 - THREE.MathUtils.smoothstep(d, LOOK.length * 0.5, reach) });
    }
  }
  return out;
}

export function UltemBox({ burn = 0, glow = 0, ...props }: AssetProps) {
  const shared = useBurn(burn, glow);
  const shell = useLoader(GLTFLoader, shellPath, loader => loader.setMeshoptDecoder(MeshoptDecoder));
  useOnUnmount(() => {
    const mesh = shell.scene.children[0] as THREE.Mesh;
    mesh.geometry.dispose();
    if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    useLoader.clear(GLTFLoader, shellPath);
  });
  const m = useMemo(() => {
    const mat = burnable(
      new THREE.MeshPhysicalMaterial({
        // dull honey / khaki amber; thick parts (edges, corners, bosses) go brown through the short, dark attenuation
        color: '#f0d6a0',
        roughness: 0.26,
        roughnessMap: mottleRough(4),
        transmission: 1,
        thickness: mm(3),
        ior: 1.66,
        attenuationColor: '#b8863a',
        attenuationDistance: mm(14),
        specularIntensity: 0.9,
        side: THREE.FrontSide, // the far walls are the opaque stand-ins below; double-sided transmission cost ~2× for little gain
      }),
      LOOK,
      shared,
    );
    const tabs = [
      tabGeometry(1, mm(-21)),
      tabGeometry(1, mm(21)),
      tabGeometry(-1, mm(-21)),
      tabGeometry(-1, mm(21)),
    ];
    // what you see through the walls: the far walls from inside, and the solid screw bosses. Transmission in
    // three.js only shows opaque things behind a surface, so these stand in for the box seen through itself.
    const { W, D, H, wall } = U;
    const inner = upright(denseRoundRect(W - 2 * wall - mm(0.4), D - 2 * wall - mm(0.4), U.r - wall, mm(4)), wall + mm(0.2), H - wall - mm(0.2));
    const cores = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        bake(new THREE.CylinderGeometry(mm(4.3), mm(4.3), H - wall * 2 - mm(1), 20), { pos: [sx * (W / 2 - mm(6.5)), H / 2 - mm(0.5), sz * (D / 2 - mm(6.5))] }),
      ),
    );
    const seen = new THREE.MeshStandardMaterial({ color: '#c99a52', roughness: 0.4, side: THREE.BackSide });
    const coreMat = new THREE.MeshStandardMaterial({ color: '#a8702c', roughness: 0.35 });

    // swollen intumescent char: a few hundred lumpy blobs of mixed size, overlapping into one mass that bridges
    // and partly fills the cooling slots. Each one grows from nothing as the char front reaches it.
    const r = seeded(5);
    const mesh = shell.scene.children[0] as THREE.Mesh;
    const body = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    addDispNormals(body, 1e-4);
    const sites = foamSites(body, 1 / (mm(3.3) * mm(3.3)));
    const blobGeo = [lumpyBlob(2, 1.3, 0.32, 1.8), lumpyBlob(2, 4.1, 0.36, 2.4), lumpyBlob(1, 2.7, 0.3, 2)];
    const lists: THREE.Matrix4[][] = [[], [], []];
    const gloss: THREE.Matrix4[] = [];
    const pockets: THREE.Matrix4[] = [];
    for (const { p, n, k, pocket } of sites) {
      if (pocket) {
        // scorched amber showing where the foam split: flat glossy pools just above the plastic
        const rad = mm(1.6 + r() * 1.4);
        pockets.push(placeOn(p.clone().addScaledVector(n, mm(0.9)), n, r() * 6.28, rad * 1.3, rad * 0.25, rad));
        continue;
      }
      // big swollen lumps near the corner where it burnt longest, smaller beads towards the edge of the char
      const big = r() < 0.15 + 0.35 * k;
      const rad = (big ? mm(2.4 + r() * 1.6) : mm(1.1 + r() * 1.0)) * (0.55 + 0.45 * k);
      // the swell is thickest (≈ 4–5 mm) at the corner and thins out to a crust at the edge of the char
      const lift = mm(0.4) + mm(2.6) * k * k + rad * (0.05 + r() * 0.2);
      const c = p.clone().addScaledVector(n, lift);
      const M = placeOn(c, n, r() * 6.28, rad * (1.1 + r() * 0.5), rad * (0.32 + r() * 0.2), rad * (1.1 + r() * 0.5));
      if (r() < 0.06) gloss.push(M);
      else lists[big ? (r() < 0.5 ? 0 : 1) : 2].push(M);
    }
    // a few plugs sunk into the slots
    const foamMat = () =>
      new THREE.MeshPhysicalMaterial({
        color: '#1b1a19',
        roughness: 0.78,
      });
    const grow = { band: 'char' as const, spread: 0.75, glow: true, pores: 1400 };
    const foam = lists.map((l, k) => growMesh(blobGeo[k], foamMat(), LOOK, shared, grow, l));
    const glossMat = new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    foam.push(growMesh(blobGeo[1], glossMat, LOOK, shared, { ...grow, pores: 0 }, gloss));
    const amberMat = new THREE.MeshPhysicalMaterial({ color: '#b8650e', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, emissive: '#3a1400' });
    foam.push(growMesh(blobGeo[2], amberMat, LOOK, shared, { ...grow, band: 'deep', pores: 0 }, pockets));
    return { body, tabs, mat, inner, cores, seen, coreMat, foam, count: sites.length };
  }, [shared, shell]);

  return (
    <group {...props}>
      <mesh geometry={m.inner} material={m.seen} />
      {m.cores.map((g, i) => (
        <mesh key={`c${i}`} geometry={g} material={m.coreMat} />
      ))}
      <mesh geometry={m.body} material={m.mat} castShadow receiveShadow />
      {m.tabs.map((g, i) => (
        <mesh key={i} geometry={g} material={m.mat} castShadow receiveShadow />
      ))}
      {m.foam.map((f, i) => (
        <primitive key={`f${i}`} object={f} />
      ))}
    </group>
  );
}
