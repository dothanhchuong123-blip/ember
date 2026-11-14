// Combustion Integrated Rack (CIR) optics bench with its 100-litre combustion chamber, as pulled out of the rack.
// Built from NASA photos 0003854 (front, operational), 0003852 (door open), 0003857 (extracted, angled) and
// 0003858 (bench folded down, rear packages). Sizes from NASA/TM-1998-206972 and NTRS 20030032248: the bench is an
// aluminium plate 86.5 cm wide × 124.5 cm long × 10 cm deep with a 25 mm hole grid on both faces; the chamber
// (40 cm inside diameter, ~90 cm long) passes through it, its hinged breech-lock lid and resource ring on the
// front, the rest behind with 8 windows (12 cm clear view) in 4 opposed pairs. The gas bottles (1.0, 2.25 and 3.8 L),
// the gas chromatograph and the blue cooling-water loop are on the front; the image processing packages, the PI
// package and the FOMA control unit on the back. Positions on the front are read off 0003854 at 1.84 mm/px;
// the back packages are placed from 0003858 and are approximate.
// The front faces +z, the bench stands upright as in the rack. Static: no burn.
import { useMemo } from 'react';
import * as THREE from 'three';
import { box, cyl, merge, rbox, rivetGeo, tube } from '../three/geo';
import { aluminium, screwSteel, stainless } from '../three/mats';
import { Scatter, V, type AssetProps, type Placed } from './common';

export const CIRBENCH = {
  W: 0.865, // bench width
  H: 1.245, // bench length (upright: height)
  D: 0.1, // bench depth
  y0: 0.06, // bench bottom; the gas chromatograph boxes hang below it to the floor
  rc: 0.2, // chamber inside radius (40 cm ID)
};

/** black anodized face with the 25 mm grid of tapped holes */
function gridTexture() {
  const { W, H } = CIRBENCH;
  const px = 1.04; // px per mm
  const c = document.createElement('canvas');
  c.width = Math.round(W * 1000 * px);
  c.height = Math.round(H * 1000 * px);
  const g = c.getContext('2d')!;
  g.fillStyle = '#1a1b1d';
  g.fillRect(0, 0, c.width, c.height);
  let s = 3;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 900; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.015 + r() * 0.025})`;
    g.fillRect(r() * c.width, r() * c.height, 2 + r() * 60, 1 + r() * 40);
  }
  const step = 25 * px;
  for (let y = step / 2 + 4; y < c.height; y += step)
    for (let x = step / 2 + 6; x < c.width; x += step) {
      g.fillStyle = '#2a2c2f';
      g.beginPath();
      g.arc(x, y, 4.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#050506';
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** every sticker on one canvas: white bottle labels and the white-on-black package names */
const A = 1024;
const LABELS: Record<string, { at: [number, number, number, number]; lines: string[]; dark?: boolean }> = {
  o2: { at: [0, 0, 400, 80], lines: ['OXYGEN 85%'] },
  fuel: { at: [420, 0, 400, 80], lines: ['GASEOUS FUELS'] },
  premix: { at: [0, 100, 840, 80], lines: ['DILUENT / PREMIX / OXYGEN 30%'] },
  dil: { at: [0, 200, 300, 80], lines: ['DILUENT'] },
  ads: { at: [320, 200, 560, 80], lines: ['ADSORBER CARTRIDGE'] },
  gcb: { at: [0, 300, 480, 160], lines: ['GAS CHROMATOGRAPH', 'BOTTLE ASSEMBLY'], dark: true },
  gcp: { at: [500, 300, 400, 220], lines: ['GAS', 'CHROMATOGRAPH', 'PACKAGE'], dark: true },
  ipp: { at: [0, 540, 420, 260], lines: ['IMAGE', 'PROCESSING', 'PACKAGE', 'I.P.P.'], dark: true },
  pip: { at: [440, 540, 520, 260], lines: ['PRINCIPLE', 'INVESTIGATOR', 'PACKAGE', 'P.I.P.'], dark: true },
  fcu: { at: [0, 820, 360, 200], lines: ['FOMA', 'CONTROL', 'UNIT', 'F.C.U.'], dark: true },
};

function labelTexture() {
  const c = document.createElement('canvas');
  c.width = A;
  c.height = A;
  const g = c.getContext('2d')!;
  g.textBaseline = 'middle';
  for (const { at: [x, y, w, h], lines, dark } of Object.values(LABELS)) {
    g.fillStyle = dark ? '#141516' : '#efeee8';
    g.fillRect(x, y, w, h);
    g.fillStyle = dark ? '#e8e8e4' : '#1c1c1c';
    const fs = dark ? Math.min(36, (h - 24) / lines.length) : 40;
    g.font = `bold ${fs}px Helvetica, Arial, sans-serif`;
    lines.forEach((t, i) => {
      if (dark) g.fillText(t, x + 16, y + 14 + fs * (i + 0.5));
      else g.fillText(t, x + (w - g.measureText(t).width) / 2, y + h / 2);
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** a flat sticker of width w (m) showing one atlas entry, height from its aspect */
function label(key: keyof typeof LABELS, w: number, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) {
  const [x, y, pw, ph] = LABELS[key].at;
  const g = new THREE.PlaneGeometry(w, (w * ph) / pw);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * pw) / A, 1 - (y + (1 - uv.getY(i)) * ph) / A);
  g.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]).translate(...pos);
  return g;
}

export function CirBench({ burn: _burn, glow: _glow, ...props }: AssetProps) {
  const m = useMemo(() => {
    const { W, H, D, y0, rc } = CIRBENCH;
    const zf = D / 2, zb = -D / 2; // front and back faces
    const P = (px: number, py: number): [number, number] => [(px - 340) * 0.00184, y0 + (797 - py) * 0.00184]; // 0003854 px → m
    const alu: THREE.BufferGeometry[] = [];
    const black: THREE.BufferGeometry[] = [];
    const steel: THREE.BufferGeometry[] = [];
    const ss: THREE.BufferGeometry[] = [];
    const grey: THREE.BufferGeometry[] = [];
    const tan: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    const hose: THREE.BufferGeometry[] = [];
    const brassG: THREE.BufferGeometry[] = [];
    const color: Record<string, THREE.BufferGeometry[]> = { '#e2b81c': [], '#2c8a3c': [], '#b3221d': [], '#3d9bd6': [] };
    const labels: THREE.BufferGeometry[] = [];
    const screws: Placed[] = [];

    // ---- bench: ribbed aluminium body, black faces with the hole grid, cut through for the chamber
    const [cx, cy] = [0, P(345, 565)[1]];
    const face = new THREE.Shape();
    face.moveTo(-W / 2, 0);
    face.lineTo(W / 2, 0);
    face.lineTo(W / 2, H);
    face.lineTo(-W / 2, H);
    face.closePath();
    const hole = new THREE.Path();
    hole.absarc(cx, cy - y0, rc + 0.02, 0, Math.PI * 2, false);
    face.holes.push(hole);
    const faces: THREE.BufferGeometry[] = [];
    for (const [z, ry] of [[zf + 0.0006, 0], [zb - 0.0006, Math.PI]] as const) {
      const f = new THREE.ShapeGeometry(face, 48);
      f.rotateY(ry).translate(0, y0, z); // the back face is turned round to look out
      faces.push(f);
    }
    // frame of the ribbed section, seen on the bench edges
    for (const sx of [-1, 1]) alu.push(box(0.012, H, D, { pos: [sx * (W / 2 - 0.006), y0 + H / 2, 0] }));
    for (const y of [y0 + 0.006, y0 + H - 0.006]) alu.push(box(W - 0.024, 0.012, D, { pos: [0, y, 0] }));
    black.push(box(W - 0.024, H - 0.024, D - 0.012, { pos: [0, y0 + H / 2, 0] }).toNonIndexed());
    // ribs show through the edge lightening holes
    for (const sx of [-1, 1])
      for (let k = 0; k < 9; k++) black.push(rbox(0.004, 0.08, 0.05, 0.002, { pos: [sx * (W / 2 + 0.0002), y0 + 0.1 + k * 0.13, 0] }, 2));
    // drawer slides on both edges: three nested channels running back into the rack
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + 0.016);
      for (const [k, h] of [[0, 0.07], [1, 0.058], [2, 0.046]] as const) {
        alu.push(box(0.006, h, 0.62 - k * 0.04, { pos: [x + sx * k * 0.007, y0 + 0.62, -0.26 + k * 0.03] }));
      }
      for (let k = 0; k < 6; k++) screws.push({ p: V(x + sx * 0.018, y0 + 0.62 + (k % 2 ? 0.018 : -0.018), -0.5 + Math.floor(k / 2) * 0.2), n: V(sx, 0, 0) });
      alu.push(box(0.03, 0.12, 0.08, { pos: [x - sx * 0.002, y0 + 0.62, -0.02] }));
    }
    for (let k = 0; k < 10; k++)
      for (const sx of [-1, 1]) screws.push({ p: V(sx * (W / 2 - 0.018), y0 + 0.03 + k * ((H - 0.06) / 9), zf + 0.001), n: V(0, 0, 1) });

    // ---- combustion chamber
    const rw = rc + 0.016; // outer wall
    const zr = -0.6; // where the rear dome starts
    black.push(cyl(rw, rw, zf + 0.06 - zr, { pos: [cx, cy, (zf + 0.06 + zr) / 2], rot: [Math.PI / 2, 0, 0] }, 72));
    // rear dome
    const dome = new THREE.SphereGeometry(rw, 72, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.45, 1).rotateX(-Math.PI / 2).translate(cx, cy, zr);
    black.push(dome);
    for (const z of [zb - 0.03, zr + 0.01]) black.push(cyl(rw + 0.018, rw + 0.018, 0.03, { pos: [cx, cy, z], rot: [Math.PI / 2, 0, 0] }, 72));
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      screws.push({ p: V(cx + Math.cos(a) * (rw + 0.01), cy + Math.sin(a) * (rw + 0.01), zr - 0.006), n: V(0, 0, -1) });
    }
    // 8 windows in 4 opposed pairs, 12 cm clear view
    const zwin = -0.32;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const n = V(Math.cos(a), Math.sin(a), 0);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
      const at = (d: number, g: THREE.BufferGeometry) => g.applyQuaternion(q).translate(cx + n.x * d, cy + n.y * d, zwin);
      black.push(at(rw + 0.02, new THREE.CylinderGeometry(0.082, 0.088, 0.05, 48)));
      alu.push(at(rw + 0.047, new THREE.CylinderGeometry(0.075, 0.075, 0.008, 48)));
      glass.push(at(rw + 0.052, new THREE.CylinderGeometry(0.06, 0.06, 0.004, 48)));
      const u = V(0, 0, 1), v = n.clone().cross(u);
      for (let j = 0; j < 8; j++) {
        const b = (j / 8) * Math.PI * 2;
        screws.push({ p: V(cx, cy, zwin).addScaledVector(n, rw + 0.051).addScaledVector(u, Math.cos(b) * 0.068).addScaledVector(v, Math.sin(b) * 0.068), n });
      }
    }
    // resource interface ring on the front: connectors and the two cooling-water ports
    const zi = zf + 0.03;
    black.push(cyl(rw + 0.02, rw + 0.02, 0.06, { pos: [cx, cy, zi], rot: [Math.PI / 2, 0, 0] }, 72));
    for (const a of [0.35, 0.75, 2.4, 2.75]) {
      steel.push(cyl(0.016, 0.016, 0.03, { pos: [cx + Math.cos(a) * (rw + 0.03), cy + Math.sin(a) * (rw + 0.03), zi], rot: [0, 0, a - Math.PI / 2] }, 20));
      black.push(cyl(0.012, 0.012, 0.012, { pos: [cx + Math.cos(a) * (rw + 0.05), cy + Math.sin(a) * (rw + 0.05), zi], rot: [0, 0, a - Math.PI / 2] }, 20));
    }
    // hinged breech-lock lid: flange ring, 8 tan lock tabs, shallow glossy dome, plain hub, handle bar
    const zl = zf + 0.06;
    black.push(cyl(rw + 0.03, rw + 0.03, 0.035, { pos: [cx, cy, zl + 0.0175], rot: [Math.PI / 2, 0, 0] }, 72));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      tan.push(box(0.05, 0.016, 0.03, { pos: [cx + Math.cos(a) * (rw + 0.03), cy + Math.sin(a) * (rw + 0.03), zl + 0.02], rot: [0, 0, a + Math.PI / 2] }));
    }
    const lidR = rw + 0.01, lidD = 0.075, zd = zl + 0.035;
    const lid = new THREE.SphereGeometry(lidR, 72, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    lid.scale(1, lidD / lidR, 1).rotateX(Math.PI / 2).translate(cx, cy, zd);
    const lidZ = (r: number) => zd + lidD * Math.sqrt(Math.max(0, 1 - (r / lidR) ** 2));
    const hubR = 0.068;
    black.push(cyl(hubR, hubR + 0.004, 0.02, { pos: [cx, cy, lidZ(0) + 0.006], rot: [Math.PI / 2, 0, 0] }, 48));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      screws.push({ p: V(cx + Math.cos(a) * (hubR - 0.008), cy + Math.sin(a) * (hubR - 0.008), lidZ(0) + 0.0165), n: V(0, 0, 1) });
    }
    // handle bar from the hub out over the rim to the latch on the left
    const bar: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 12; k++) {
      const x0 = hubR + k * 0.0215, x1 = x0 + 0.0215;
      const z0 = (x0 > lidR ? zl + 0.04 : lidZ(x0)) + 0.008, z1 = (x1 > lidR ? zl + 0.04 : lidZ(x1)) + 0.008;
      const len = Math.hypot(x1 - x0, z1 - z0);
      bar.push(box(len + 0.002, 0.044, 0.01, { pos: [cx - (x0 + x1) / 2, cy, (z0 + z1) / 2], rot: [0, -Math.atan2(z1 - z0, x1 - x0), 0] }));
    }
    black.push(...bar);
    // hinge on the left, latch block on the right
    for (const dy of [-0.15, 0.15]) {
      black.push(box(0.05, 0.05, 0.05, { pos: [cx - rw - 0.05, cy + dy, zl + 0.015] }));
      steel.push(cyl(0.008, 0.008, 0.07, { pos: [cx - rw - 0.06, cy + dy, zl + 0.03] }, 12));
    }
    color['#2c8a3c'].push(box(0.03, 0.09, 0.03, { pos: [cx - rw - 0.075, cy, zl + 0.03] }));

    // blue cooling-water loop round the lid, open on the left where it turns into the ring
    const ringR = 0.28, zh = zf + 0.05, a0 = Math.PI * 1.08, a1 = Math.PI * 2.9;
    const loop: THREE.Vector3[] = [];
    for (let k = 0; k <= 80; k++) {
      const a = a0 + ((a1 - a0) * k) / 80;
      loop.push(V(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, zh));
    }
    hose.push(tube([V(cx - rw - 0.02, cy - 0.06, zi), ...loop.slice(0, 1).map((p) => p.clone().setZ(zi + 0.01)), ...loop], 0.0125, 240, 14));
    hose.push(tube([V(cx - rw - 0.025, cy + 0.08, zi), V(cx + Math.cos(a1) * ringR, cy + Math.sin(a1) * ringR, zh)], 0.0125, 20, 14));
    for (let k = 0; k < 8; k++) {
      const a = a0 + 0.15 + ((a1 - a0 - 0.3) * k) / 7;
      grey.push(box(0.012, 0.034, 0.034, { pos: [cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, zh], rot: [0, 0, a] }));
    }

    // ---- gas bottles on the front (1.0, 2.25 and 3.8 L), neck valve + black knob + quick disconnect
    const bottle = (px: number, py: number, len: number, R: number, neck: 1 | -1, key: keyof typeof LABELS, flat = false) => {
      const [x, y] = P(px, py);
      const z = zf + 0.03 + R;
      const pts: THREE.Vector2[] = [];
      if (flat) {
        pts.push(new THREE.Vector2(0, -len / 2), new THREE.Vector2(R - 0.004, -len / 2), new THREE.Vector2(R, -len / 2 + 0.004));
        pts.push(new THREE.Vector2(R, len / 2 - 0.004), new THREE.Vector2(R - 0.004, len / 2), new THREE.Vector2(0, len / 2));
      } else {
        for (let k = 0; k <= 10; k++) {
          const a = -Math.PI / 2 + (k / 10) * (Math.PI / 2);
          pts.push(new THREE.Vector2(Math.max(1e-4, R * Math.cos(a)), -len / 2 + R + R * Math.sin(a)));
        }
        for (let k = 0; k <= 10; k++) {
          const a = (k / 10) * (Math.PI / 2);
          pts.push(new THREE.Vector2(Math.max(1e-4, R * Math.cos(a)), len / 2 - R + R * Math.sin(a)));
        }
      }
      const g = new THREE.LatheGeometry(pts, 48);
      g.rotateZ(neck > 0 ? -Math.PI / 2 : Math.PI / 2).translate(x, y, z);
      ss.push(g);
      // straps and saddle brackets down to the bench
      for (const f of [-0.3, 0.3]) {
        steel.push(cyl(R + 0.002, R + 0.002, 0.012, { pos: [x + f * len, y, z], rot: [0, 0, Math.PI / 2] }, 48));
        alu.push(box(0.03, R * 1.4, z - R * 0.4 - zf, { pos: [x + f * len, y, zf + (z - R * 0.4 - zf) / 2] }));
      }
      // neck, valve block, knob and quick disconnect
      const xe = x + (neck * len) / 2;
      ss.push(cyl(0.011, 0.011, 0.025, { pos: [xe + neck * 0.012, y, z], rot: [0, 0, Math.PI / 2] }, 20));
      alu.push(box(0.04, 0.045, 0.045, { pos: [xe + neck * 0.044, y, z] }));
      black.push(cyl(0.014, 0.014, 0.022, { pos: [xe + neck * 0.044, y, z + 0.033], rot: [Math.PI / 2, 0, 0] }, 20));
      steel.push(cyl(0.009, 0.009, 0.03, { pos: [xe + neck * 0.078, y, z], rot: [0, 0, Math.PI / 2] }, 16));
      steel.push(cyl(0.012, 0.012, 0.012, { pos: [xe + neck * 0.098, y, z], rot: [0, 0, Math.PI / 2] }, 6));
      alu.push(box(0.03, 0.06, z - zf, { pos: [xe + neck * 0.044, y, zf + (z - zf) / 2] }));
      labels.push(label(key, Math.min(0.5 * len, LABELS[key].at[2] * 0.00034), [x, y + R * 0.18, z + R * 0.985], [-0.18, 0, 0]));
      return { x, y, z, xe };
    };
    const o2 = bottle(207, 152, 0.25, 0.055, -1, 'o2');
    const fu = bottle(465, 152, 0.24, 0.055, 1, 'fuel');
    const pm = bottle(342, 232, 0.73, 0.066, -1, 'premix');
    const di = bottle(269, 305, 0.45, 0.056, -1, 'dil');
    const ad = bottle(332, 370, 0.5, 0.045, -1, 'ads', true);
    // left manifold rail the bottle valves plug into
    alu.push(box(0.05, 0.5, 0.05, { pos: [P(112, 0)[0], P(0, 260)[1], zf + 0.025] }));
    for (const b of [o2, pm, di, ad]) {
      steel.push(tube([V(b.xe - 0.098, b.y, b.z), V(P(112, 0)[0] + 0.03, b.y, b.z), V(P(112, 0)[0] + 0.02, b.y - 0.01, zf + 0.05)], 0.003, 20, 8));
    }
    // white flow-control manifold right of the diluent bottle, and stainless lines down to the chamber ring
    const [mx, my] = P(450, 282);
    grey.push(rbox(0.27, 0.08, 0.06, 0.006, { pos: [mx, my, zf + 0.035] }, 2));
    for (let k = 0; k < 5; k++) steel.push(cyl(0.007, 0.007, 0.02, { pos: [mx - 0.1 + k * 0.05, my - 0.045, zf + 0.04] }, 12));
    const lines: [number, number][][] = [
      [[fu.xe + 0.1, fu.y], [P(560, 230)[0], P(0, 230)[1]], [P(560, 350)[0], P(0, 350)[1]], [P(500, 440)[0], P(0, 440)[1]]],
      [[mx + 0.08, my - 0.05], [P(540, 380)[0], P(0, 380)[1]], [P(530, 470)[0], P(0, 470)[1]]],
      [[mx - 0.02, my - 0.05], [P(480, 360)[0], P(0, 360)[1]], [P(455, 420)[0], P(0, 420)[1]]],
      [[P(140, 400)[0], P(0, 400)[1]], [P(150, 480)[0], P(0, 480)[1]], [P(200, 500)[0], P(0, 500)[1]]],
    ];
    for (const l of lines) steel.push(tube(l.map(([x, y]) => V(x, y, zf + 0.012)), 0.003, 60, 8));
    // small parts read off the photo: valve box with knob, connectors, the yellow cap, brass fitting, red lamp
    {
      const [x, y] = P(135, 420);
      alu.push(box(0.055, 0.07, 0.05, { pos: [x, y, zf + 0.025] }));
      black.push(cyl(0.016, 0.016, 0.02, { pos: [x, y, zf + 0.06], rot: [Math.PI / 2, 0, 0] }, 20));
    }
    {
      const [x, y] = P(240, 410);
      color['#2c8a3c'].push(cyl(0.017, 0.017, 0.04, { pos: [x, y, zf + 0.02], rot: [Math.PI / 2, 0, 0] }, 20));
    }
    for (const [px, py] of [[455, 420], [480, 470]]) {
      const [x, y] = P(px, py);
      grey.push(rbox(0.04, 0.03, 0.05, 0.004, { pos: [x, y, zf + 0.025], rot: [0, 0, 0.6] }, 2));
    }
    {
      const [x, y] = P(515, 470);
      color['#e2b81c'].push(cyl(0.022, 0.022, 0.035, { pos: [x, y, zf + 0.03], rot: [Math.PI / 2, 0, 0.4] }, 24));
      const [bx, by] = P(515, 530);
      color['#3d9bd6'].push(cyl(0.012, 0.012, 0.03, { pos: [bx, by, zf + 0.015], rot: [Math.PI / 2, 0, 0] }, 16));
      const [fx, fy] = P(475, 690);
      brassG.push(box(0.04, 0.04, 0.035, { pos: [fx, fy, zf + 0.018] }));
      brassG.push(cyl(0.008, 0.008, 0.04, { pos: [fx + 0.035, fy, zf + 0.018], rot: [0, 0, Math.PI / 2] }, 12));
      const [rx, ry] = P(205, 730);
      color['#b3221d'].push(cyl(0.01, 0.01, 0.012, { pos: [rx, ry, zf + 0.006], rot: [Math.PI / 2, 0, 0] }, 16));
    }

    // gas chromatograph: bottle assembly (left) and package (right, stepped), hanging to the floor
    const gd = 0.22;
    {
      const [x0] = P(105, 0), [x1] = P(190, 0), yt = P(0, 580)[1];
      black.push(rbox(x1 - x0, yt, gd, 0.004, { pos: [(x0 + x1) / 2, yt / 2, zf + gd / 2] }, 2));
      labels.push(label('gcb', 0.13, [(x0 + x1) / 2, yt - 0.05, zf + gd + 0.0008]));
    }
    {
      const [x0] = P(505, 0), [xl] = P(450, 0), [x1] = P(580, 0), yt = P(0, 575)[1], yl = 0.13;
      black.push(rbox(x1 - x0, yt, gd, 0.004, { pos: [(x0 + x1) / 2, yt / 2, zf + gd / 2] }, 2));
      black.push(rbox(x1 - xl, yl, gd + 0.02, 0.004, { pos: [(xl + x1) / 2, yl / 2, zf + (gd + 0.02) / 2] }, 2));
      labels.push(label('gcp', 0.1, [xl + 0.06, yl / 2, zf + gd + 0.0208]));
    }

    // ---- back: image processing packages, PI package, FOMA control unit, diagnostics looking into the windows
    const back = (x: number, y: number, w: number, h: number, d: number, key?: keyof typeof LABELS, lw = 0.12) => {
      black.push(rbox(w, h, d, 0.005, { pos: [x, y, zb - d / 2] }, 2));
      if (key) labels.push(label(key, lw, [x - w / 2 + lw / 2 + 0.015, y + h / 2 - (lw * LABELS[key].at[3]) / LABELS[key].at[2] / 2 - 0.02, zb - d - 0.0008], [0, Math.PI, 0]));
    };
    back(-0.29, y0 + 1.0, 0.24, 0.42, 0.36, 'ipp');
    back(0.29, y0 + 1.0, 0.24, 0.42, 0.3, 'ipp');
    back(0.3, y0 + 0.27, 0.22, 0.42, 0.3, 'pip', 0.14);
    back(-0.3, y0 + 0.27, 0.2, 0.42, 0.28, 'fcu', 0.1);
    for (const [x, y] of [[-0.29, y0 + 1.0], [0.29, y0 + 1.0], [0.3, y0 + 0.27], [-0.3, y0 + 0.27]])
      for (const s of [-1, 1]) grey.push(box(0.03, 0.012, 0.03, { pos: [x + s * 0.08, y - 0.21 - 0.006, zb - 0.015] }));
    // diagnostics: camera bodies with lenses aimed at the top and side windows
    for (const k of [1, 2, 5]) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const n = V(Math.cos(a), Math.sin(a), 0);
      const c = V(cx, cy, zwin).addScaledVector(n, rw + 0.2);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n.clone().negate());
      const put = (g: THREE.BufferGeometry, d: number) => g.applyQuaternion(q).translate(c.x - n.x * d, c.y - n.y * d, c.z);
      black.push(put(new THREE.BoxGeometry(0.09, 0.12, 0.09), 0));
      black.push(put(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 32), 0.09));
      glass.push(put(new THREE.CylinderGeometry(0.024, 0.024, 0.002, 32), 0.126));
      alu.push(box(0.03, 0.03, zwin - zb + 0.02, { pos: [c.x, c.y, (zwin + zb) / 2] }));
    }
    // harness bundles from the packages across the back
    const cable: THREE.BufferGeometry[] = [];
    cable.push(tube([V(-0.29, y0 + 0.79, zb - 0.1), V(-0.2, y0 + 0.75, zb - 0.05), V(0.2, y0 + 0.76, zb - 0.04), V(0.29, y0 + 0.79, zb - 0.1)], 0.009, 60, 8));
    cable.push(tube([V(0.3, y0 + 0.48, zb - 0.12), V(0.33, y0 + 0.62, zb - 0.06), V(0.31, y0 + 0.79, zb - 0.12)], 0.007, 40, 8));
    cable.push(tube([V(-0.3, y0 + 0.48, zb - 0.12), V(-0.36, y0 + 0.62, zb - 0.05), V(-0.3, y0 + 0.79, zb - 0.14)], 0.007, 40, 8));

    const black2 = new THREE.MeshPhysicalMaterial({ color: '#151618', metalness: 0.25, roughness: 0.4, clearcoat: 0.25 });
    const parts: [THREE.BufferGeometry, THREE.Material][] = [
      [merge(faces), new THREE.MeshPhysicalMaterial({ map: gridTexture(), metalness: 0.3, roughness: 0.45, clearcoat: 0.15 })],
      [merge(alu), aluminium({ color: '#b5b9bd', roughness: 0.34 }, [1, 4])],
      [merge(black), black2],
      [merge(ss), stainless({ color: '#a7abaf', roughness: 0.3 }, [1, 6])],
      [merge(steel), screwSteel({ color: '#c4c7ca', roughness: 0.28 })],
      [merge(grey), new THREE.MeshPhysicalMaterial({ color: '#d9dad6', metalness: 0, roughness: 0.55 })],
      [merge(tan), new THREE.MeshPhysicalMaterial({ color: '#b39a5e', metalness: 0.7, roughness: 0.4 })],
      [merge(glass), new THREE.MeshPhysicalMaterial({ color: '#0a0d10', roughness: 0.03, clearcoat: 1, metalness: 0.2 })],
      [merge(hose), new THREE.MeshPhysicalMaterial({ color: '#2a86c8', roughness: 0.3, clearcoat: 0.6, sheen: 0.2 })],
      [merge(brassG), new THREE.MeshPhysicalMaterial({ color: '#b08d45', metalness: 1, roughness: 0.3 })],
      [merge(cable), new THREE.MeshStandardMaterial({ color: '#1e1f22', roughness: 0.65 })],
      [merge(labels), new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })],
    ];
    for (const [c, list] of Object.entries(color)) parts.push([merge(list), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, clearcoat: 0.3 })]);
    return { parts, screws, screwGeo: rivetGeo(0.005), screwMat: screwSteel({ roughness: 0.35 }) };
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
