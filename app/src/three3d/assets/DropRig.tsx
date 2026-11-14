// 2.2 Second Drop Tower combustion rig (NASA Glenn), the experiment frame that falls inside the drag shield.
// Built from NASA photos 1994-05812 (whole rig) and 1994-05829 (end view, chamber lifted out): two trapezoid
// aluminium end plates with a tall triangular cut-out, a base plate and a top plate; the cylindrical combustion
// chamber with its clamped lid, round and rectangular windows; black camera mounts on a black shelf; the
// connector box on the upper shelf; the gas panel (schematic lines, toggle valves) and brass bottles below.
// Size: NASA's payload envelope is 96 cm long × 84 cm high; the depth (~56 cm) is read off the end view.
// x runs along the rig (chamber end at -x), z is the front. Static: no burn.
import { useMemo } from 'react';
import * as THREE from 'three';
import { box, cyl, extrude, merge, rbox, rivetGeo, tube } from '../three/geo';
import { aluminium, blasted, brass, screwSteel } from '../three/mats';
import { Scatter, V, type AssetProps, type Placed } from './common';

export const RIG = {
  L: 0.96, // between the end plates' outer faces
  H: 0.84, // to the top plate
  B: 0.56, // end plate width at the floor
  T: 0.2, // end plate width at the top
  t: 0.0095, // 3/8" plate
};

/** gas panel face: brushed aluminium with the plumbing schematic painted on, as in 1994-05812 */
function panelTexture() {
  const W = 1024, H = 640;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d4d7da';
  g.fillRect(0, 0, W, H);
  let s = 7;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 1400; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '120,124,128'},${0.04 + r() * 0.06})`;
    g.fillRect(r() * W, r() * H, 30 + r() * 220, 1);
  }
  // schematic: supply lines, tees and valve symbols
  g.strokeStyle = '#2b2d30';
  g.lineWidth = 4;
  const line = (pts: number[]) => {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke();
  };
  line([80, 120, 420, 120, 420, 330, 720, 330]);
  line([80, 450, 300, 450, 300, 330]);
  line([560, 120, 560, 230, 880, 230, 880, 520, 620, 520]);
  line([180, 560, 520, 560, 520, 450]);
  g.lineWidth = 3;
  for (const [x, y] of [[420, 220], [300, 400], [720, 330], [880, 380], [520, 500]]) {
    g.beginPath();
    g.moveTo(x - 18, y - 12);
    g.lineTo(x + 18, y + 12);
    g.lineTo(x + 18, y - 12);
    g.lineTo(x - 18, y + 12);
    g.closePath();
    g.stroke();
  }
  g.fillStyle = '#2b2d30';
  g.font = 'bold 30px Helvetica, Arial, sans-serif';
  for (const [t, x, y] of [['FUEL', 92, 105], ['O2 / N2', 92, 435], ['VENT', 735, 320], ['CHAMBER', 600, 215], ['FILL', 195, 545]] as const)
    g.fillText(t, x, y);
  g.font = '22px Helvetica, Arial, sans-serif';
  g.fillText('2.2 SEC DROP TOWER  -  COMBUSTION RIG', 300, 610);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function DropRig({ burn: _burn, glow: _glow, ...props }: AssetProps) {
  const m = useMemo(() => {
    const { L, H, B, T, t } = RIG;
    const hw = (y: number) => B / 2 - ((B - T) / 2) * (y / H); // end plate half-width at height y
    const alu: THREE.BufferGeometry[] = [];
    const cast: THREE.BufferGeometry[] = [];
    const black: THREE.BufferGeometry[] = [];
    const grey: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    const brassG: THREE.BufferGeometry[] = [];
    const steel: THREE.BufferGeometry[] = [];
    const cable: THREE.BufferGeometry[] = [];
    const screws: Placed[] = [];

    // end plates: trapezoid with the tall triangular cut-out, screw holes along the edges
    const plate = new THREE.Shape();
    plate.moveTo(-B / 2, 0);
    plate.lineTo(B / 2, 0);
    plate.lineTo(T / 2, H - 0.012);
    plate.lineTo(-T / 2, H - 0.012);
    plate.closePath();
    const hb = 0.12, ht = H * 0.78, leg = 0.065;
    const hole = new THREE.Path();
    hole.moveTo(-(hw(hb) - leg), hb);
    hole.lineTo(hw(hb) - leg, hb);
    hole.lineTo(0, ht);
    hole.closePath();
    plate.holes.push(hole);
    for (const sx of [-1, 1]) {
      // the extrusion runs along +x after the turn, so the plate starts at its inner face (+x end) or outer face (-x end)
      alu.push(extrude(plate, t, 0.0012, { pos: [sx > 0 ? L / 2 - t : -L / 2, 0, 0], rot: [0, Math.PI / 2, 0] }, 4));
      // screw heads along both legs, the foot and the top, on the outer face
      const nx = V(sx, 0, 0);
      const xo = sx * (L / 2 + 0.0005);
      for (let k = 0; k < 7; k++) {
        const y = 0.04 + k * ((H - 0.08) / 6);
        for (const sz of [-1, 1]) screws.push({ p: V(xo, y, sz * (hw(y) - 0.022)), n: nx });
      }
      for (const z of [-0.12, 0, 0.12]) screws.push({ p: V(xo, 0.035, z), n: nx });
    }
    const inner = L - 2 * t;
    // base plate and top plate
    alu.push(box(inner, 0.012, B - 0.02, { pos: [0, 0.006, 0] }));
    alu.push(box(L, 0.012, T, { pos: [0, H - 0.006, 0] }));
    for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) for (const z of [-0.07, 0.07]) screws.push({ p: V(x, H, z), n: V(0, 1, 0) });
    // corner angles under the top plate
    for (const sz of [-1, 1]) alu.push(box(inner, 0.025, 0.004, { pos: [0, H - 0.025, sz * (T / 2 - 0.004)] }));

    // black shelf at the chamber end, upper shelf at the electronics end, tie rods
    const yS = 0.3, yU = 0.62;
    const pz = hw(0.15) - 0.03; // gas panel face
    black.push(box(0.52, 0.012, 2 * hw(yS) + 0.04, { pos: [-L / 2 + t + 0.26, yS, 0.02] }));
    alu.push(box(0.44, 0.008, 2 * hw(yU) - 0.01, { pos: [L / 2 - t - 0.22, yU, 0] }));
    for (const [x, z] of [[0.05, 0.16], [0.05, -0.16], [0.4, 0.16], [0.4, -0.16]]) steel.push(cyl(0.006, 0.006, yU - 0.012, { pos: [x, 0.012 + (yU - 0.012) / 2, z] }, 12));

    // combustion chamber: cast aluminium can, flanges, clamped lid with handle, windows
    const cx = -0.24, cz = 0.02, r = 0.135, y0 = yS + 0.006, y1 = 0.74;
    cast.push(cyl(r, r, y1 - y0, { pos: [cx, (y0 + y1) / 2, cz] }, 64));
    cast.push(cyl(r + 0.025, r + 0.025, 0.018, { pos: [cx, y0 + 0.009, cz] }, 64));
    alu.push(cyl(r + 0.035, r + 0.035, 0.022, { pos: [cx, y1 + 0.011, cz] }, 64));
    alu.push(cyl(r + 0.03, r + 0.032, 0.014, { pos: [cx, y1 + 0.029, cz] }, 64));
    steel.push(tube([V(cx - 0.05, y1 + 0.036, cz), V(cx - 0.045, y1 + 0.07, cz), V(cx + 0.045, y1 + 0.07, cz), V(cx + 0.05, y1 + 0.036, cz)], 0.006, 40, 10));
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      screws.push({ p: V(cx + Math.cos(a) * (r + 0.024), y1 + 0.036, cz + Math.sin(a) * (r + 0.024)), n: V(0, 1, 0) });
    }
    // lid clamps
    for (const a of [0.4, 0.4 + (2 * Math.PI) / 3, 0.4 + (4 * Math.PI) / 3]) {
      const c = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      steel.push(box(0.03, 0.05, 0.016, { pos: [cx + c.x * (r + 0.04), y1 + 0.012, cz + c.z * (r + 0.04)], rot: [0, -a, 0] }));
    }
    // round viewports: a short boss, a bolted ring and dark window
    const port = (a: number, y: number, pr: number) => {
      const n = V(Math.cos(a), 0, Math.sin(a));
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
      const at = (d: number, g: THREE.BufferGeometry) => {
        g.applyQuaternion(q);
        g.translate(cx + n.x * d, y, cz + n.z * d);
        return g;
      };
      cast.push(at(r + 0.012, new THREE.CylinderGeometry(pr + 0.012, pr + 0.016, 0.03, 40)));
      black.push(at(r + 0.03, new THREE.CylinderGeometry(pr + 0.008, pr + 0.008, 0.008, 40)));
      glass.push(at(r + 0.035, new THREE.CylinderGeometry(pr - 0.004, pr - 0.004, 0.004, 40)));
      for (let k = 0; k < 8; k++) {
        const b = (k / 8) * Math.PI * 2;
        const u = V(0, Math.cos(b), 0).add(new THREE.Vector3(-n.z, 0, n.x).multiplyScalar(Math.sin(b)));
        screws.push({ p: V(cx, y, cz).addScaledVector(n, r + 0.034).addScaledVector(u, pr + 0.002), n });
      }
    };
    port(0.25, 0.52, 0.048); // big window toward the electronics end, front
    port(Math.PI * 0.62, 0.66, 0.028); // small one high on the front
    port(-Math.PI * 0.55, 0.5, 0.048); // back
    // rectangular window frame facing front-left, under the camera
    const rw = Math.PI * 0.68;
    const rn = V(Math.cos(rw), 0, Math.sin(rw));
    const rq = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), rn);
    for (const [d, w, h, g] of [[0.012, 0.1, 0.15, cast], [0.03, 0.09, 0.14, black]] as const) {
      const f = rbox(w, h, 0.03, 0.004, {}, 2);
      f.applyQuaternion(rq);
      f.translate(cx + rn.x * (r + d), 0.53, cz + rn.z * (r + d));
      g.push(f);
    }
    const win = new THREE.PlaneGeometry(0.06, 0.11);
    win.applyQuaternion(rq);
    win.translate(cx + rn.x * (r + 0.0455), 0.53, cz + rn.z * (r + 0.0455));
    glass.push(win);

    // camera mounts: stacked black blocks on the black shelf, looking into the windows
    for (const [x, z] of [[-0.4, 0.2], [-0.2, 0.22]]) {
      black.push(box(0.07, 0.11, 0.06, { pos: [x, yS + 0.06, z] }));
      black.push(box(0.06, 0.05, 0.075, { pos: [x, yS + 0.14, z] }));
      black.push(box(0.05, 0.16, 0.012, { pos: [x, yS + 0.25, z + 0.03] }));
      black.push(box(0.05, 0.16, 0.012, { pos: [x, yS + 0.25, z - 0.03] }));
      black.push(cyl(0.018, 0.018, 0.06, { pos: [x, yS + 0.21, z - 0.04], rot: [Math.PI / 2, 0, 0] }, 24));
      glass.push(cyl(0.013, 0.013, 0.002, { pos: [x, yS + 0.21, z - 0.071], rot: [Math.PI / 2, 0, 0] }, 24));
      for (const y of [0.04, 0.09]) screws.push({ p: V(x, yS + y, z + 0.031), n: V(0, 0, 1) });
    }

    // connector box on the upper shelf: two rows of BNC jacks on its front
    const ex = 0.2;
    grey.push(rbox(0.3, 0.085, 0.16, 0.004, { pos: [ex, yU + 0.047, 0.05] }, 2));
    for (let row = 0; row < 2; row++)
      for (let k = 0; k < 10; k++) {
        const x = ex - 0.125 + k * 0.028, y = yU + 0.03 + row * 0.032;
        steel.push(cyl(0.006, 0.006, 0.018, { pos: [x, y, 0.139], rot: [Math.PI / 2, 0, 0] }, 12));
        black.push(cyl(0.0075, 0.0075, 0.004, { pos: [x, y, 0.131], rot: [Math.PI / 2, 0, 0] }, 12));
      }
    grey.push(rbox(0.2, 0.07, 0.12, 0.004, { pos: [0.3, yU + 0.04, -0.12] }, 2));

    // middle bay: drive disc and dark electronics
    cast.push(cyl(0.13, 0.13, 0.016, { pos: [0.06, 0.37, -0.1], rot: [0, 0, Math.PI / 2] }, 48));
    black.push(cyl(0.03, 0.03, 0.06, { pos: [0.08, 0.38, -0.08], rot: [0, 0, Math.PI / 2] }, 24));
    black.push(box(0.16, 0.2, 0.14, { pos: [0.3, 0.13, -0.1] }));
    grey.push(box(0.14, 0.12, 0.1, { pos: [0.3, 0.42, -0.08] }));
    black.push(box(0.1, 0.16, 0.08, { pos: [0.33, 0.1, 0.12] }));
    // lower electronics bay: two battery packs with handles, a relay board, the solenoid valve block
    for (const z of [-0.02, 0.08]) {
      grey.push(rbox(0.12, 0.13, 0.09, 0.006, { pos: [0.17, 0.077, z] }, 2));
      black.push(box(0.06, 0.012, 0.012, { pos: [0.17, 0.15, z] }));
    }
    black.push(box(0.004, 0.14, 0.2, { pos: [0.42, 0.24, -0.02] }));
    steel.push(box(0.002, 0.12, 0.18, { pos: [0.417, 0.24, -0.02] }));
    for (let k = 0; k < 6; k++) black.push(box(0.016, 0.022, 0.02, { pos: [0.41, 0.19 + (k % 3) * 0.04, -0.08 + Math.floor(k / 3) * 0.1] }));
    steel.push(box(0.14, 0.05, 0.05, { pos: [-0.08, 0.04, 0.05] }));
    for (const x of [-0.13, -0.08, -0.03]) {
      black.push(cyl(0.014, 0.014, 0.05, { pos: [x, 0.09, 0.05] }, 16));
      steel.push(cyl(0.004, 0.004, 0.02, { pos: [x, 0.125, 0.05] }, 10));
    }
    // stainless gas lines: panel to the valve block, and up through the black shelf into the chamber base
    for (const [x0, dz] of [[-0.13, 0], [-0.08, 0.01], [-0.03, -0.01]]) {
      steel.push(tube([V(x0, 0.06, 0.075), V(x0, 0.05, 0.13 + dz), V(x0 - 0.02, 0.12, pz - 0.01), V(x0 - 0.06, 0.2, pz - 0.015)], 0.0032, 60, 8));
    }
    steel.push(tube([V(-0.03, 0.065, 0.025), V(-0.05, 0.15, -0.02), V(-0.12, 0.26, -0.03), V(-0.18, yS - 0.01, -0.02), V(-0.2, yS + 0.02, -0.01)], 0.0032, 80, 8));
    steel.push(tube([V(-0.08, 0.065, 0.025), V(-0.1, 0.17, -0.06), V(-0.2, 0.27, -0.08), V(-0.26, yS - 0.01, -0.06), V(-0.27, yS + 0.02, -0.05)], 0.0032, 80, 8));

    // gas panel across the front of the lower bay, toggle valves and fittings on it
    const panel = box(0.46, 0.26, 0.006, { pos: [-0.21, 0.145, pz] });
    for (const [x, y] of [[-0.33, 0.21], [-0.2, 0.08], [-0.08, 0.17]]) {
      steel.push(cyl(0.011, 0.011, 0.02, { pos: [x, y, pz + 0.013], rot: [Math.PI / 2, 0, 0] }, 16));
      black.push(box(0.012, 0.045, 0.012, { pos: [x, y + 0.012, pz + 0.028], rot: [-0.35, 0, 0] }));
    }
    for (const [x, y] of [[-0.4, 0.07], [-0.26, 0.14], [-0.14, 0.24], [-0.03, 0.09]]) {
      steel.push(cyl(0.008, 0.008, 0.016, { pos: [x, y, pz + 0.011], rot: [Math.PI / 2, 0, 0] }, 6));
      steel.push(cyl(0.004, 0.004, 0.03, { pos: [x, y, pz + 0.02], rot: [Math.PI / 2, 0, 0] }, 10));
    }
    steel.push(tube([V(-0.43, 0.05, pz + 0.012), V(-0.3, 0.04, pz + 0.02), V(-0.12, 0.04, pz + 0.02), V(0.0, 0.05, pz + 0.04)], 0.003, 60, 8));
    // brass bottles beside the panel
    for (const [x, z, rr, h] of [[0.04, 0.17, 0.028, 0.25], [0.1, 0.19, 0.02, 0.26]]) {
      brassG.push(cyl(rr, rr, h, { pos: [x, 0.012 + h / 2, z] }, 32));
      brassG.push(cyl(rr * 0.4, rr * 0.75, 0.02, { pos: [x, 0.022 + h, z] }, 24));
      steel.push(cyl(0.006, 0.006, 0.03, { pos: [x, 0.045 + h, z] }, 12));
    }
    // cables: connector box to cameras and chamber, chamber to the lower bay
    // camera leads drop from the connector box behind the cameras, close to the chamber wall
    cable.push(tube([V(0.07, yU + 0.02, 0.06), V(0.0, yU - 0.04, 0.08), V(-0.12, 0.5, 0.13), V(-0.2, yS + 0.34, 0.19)], 0.0045, 80, 8));
    cable.push(tube([V(0.07, yU + 0.02, 0.03), V(-0.02, yU - 0.03, 0.0), V(-0.3, 0.6, -0.04), V(-0.4, yS + 0.34, 0.17)], 0.0045, 80, 8));
    cable.push(tube([V(-0.05, yU, -0.05), V(-0.08, 0.45, -0.15), V(-0.12, 0.3, -0.18), V(0.1, 0.14, -0.16), V(0.22, 0.1, -0.1)], 0.007, 80, 8));
    // harness from the batteries round the back to the connector box
    for (const [dz, rr] of [[0, 0.008], [0.02, 0.005], [-0.015, 0.006]])
      cable.push(tube([V(0.17, 0.15, 0.04 + dz), V(0.12, 0.25, -0.17 + dz), V(0.18, 0.45, -0.19 + dz), V(0.25, yU - 0.02, -0.15 + dz), V(0.25, yU + 0.04, -0.03 + dz)], rr, 80, 8));
    cable.push(tube([V(-0.1, y1 - 0.05, cz + 0.05), V(-0.02, 0.55, 0.05), V(0.05, 0.42, 0.1), V(0.1, 0.3, 0.12), V(0.28, 0.16, 0.12)], 0.004, 80, 8));

    const tex = panelTexture();
    return {
      parts: [
        [merge(alu), aluminium({ color: '#a9adb1', roughness: 0.36 }, [1, 4])],
        [merge(cast), blasted({ color: '#94989c', roughness: 0.55 })],
        [merge(black), new THREE.MeshPhysicalMaterial({ color: '#141516', metalness: 0.3, roughness: 0.42, clearcoat: 0.2 })],
        [merge(grey), new THREE.MeshPhysicalMaterial({ color: '#3a3d41', metalness: 0.4, roughness: 0.5 })],
        [merge(glass), new THREE.MeshPhysicalMaterial({ color: '#06080a', roughness: 0.04, clearcoat: 1 })],
        [merge(brassG), brass({ roughness: 0.3, color: '#9b7d3c' })],
        [merge(steel), screwSteel({ color: '#c4c7ca', roughness: 0.28 })],
        [merge(cable), new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.65 })],
        [panel, new THREE.MeshPhysicalMaterial({ map: tex, color: '#c4c6c8', metalness: 0.7, roughness: 0.42 })],
      ] as [THREE.BufferGeometry, THREE.Material][],
      screws,
      screwGeo: rivetGeo(0.0045),
      screwMat: screwSteel({ roughness: 0.35 }),
    };
  }, []);

  return (
    <group {...props}>
      {m.parts.map(([g, mat], i) => (
        <mesh key={i} geometry={g} material={mat} castShadow receiveShadow />
      ))}
      <Scatter geo={m.screwGeo} mat={m.screwMat} items={m.screws} />
    </group>
  );
}
