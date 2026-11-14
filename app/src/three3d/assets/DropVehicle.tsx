// Zero Gravity Research Facility drop vehicle (NASA Glenn): the 1.0 m × ~3.3 m experiment vehicle that free-falls
// 132 m for 5.18 s of microgravity. Built from NASA photo GRC-2004-C-00575 (the vehicle parked on its stand):
// a red/white checkered painted shell (8 × 4 squares, for tracking in the drop films), a spun-aluminium nose
// cone with its release spindle on top, a long aluminium spike underneath that enters the deceleration pit's
// polystyrene beads first, riveted seams and bands, and the blue ground stand. Static: no burn.
import { useMemo } from 'react';
import * as THREE from 'three';
import { cyl, merge, rbox, rivetGeo } from '../three/geo';
import { aluminium, screwSteel, socketDark } from '../three/mats';
import { Scatter, V, type AssetProps, type Placed } from './common';

export const DV = {
  R: 0.5, // shell radius
  shell: 1.6, // checkered cylinder length
  nose: 0.55, // nose cone height
  noseTop: 0.17, // nose cone top radius
  spike: 0.72, // spike cone length under the shell
  y0: 0.08, // spike tip height on the stand
};

/** checkered paint, 8 squares around × 4 high, with light handling wear and grime toward the bottom */
function checkerTexture() {
  const W = 2048, H = 1024, cols = 8, rows = 4;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  let s = 11;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      g.fillStyle = (i + j) % 2 ? '#c3161d' : '#eeebe3';
      g.fillRect((i * W) / cols, (j * H) / rows, W / cols + 1, H / rows + 1);
    }
  // scuffs and chips
  for (let k = 0; k < 900; k++) {
    const x = r() * W, y = r() * H, l = 2 + r() * 14;
    g.strokeStyle = `rgba(${r() < 0.5 ? '90,90,90' : '255,255,255'},${0.05 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + l * (r() - 0.5), y + l * (r() - 0.5));
    g.stroke();
  }
  // grime from the bead pit, heavier at the bottom (canvas bottom = shell bottom)
  const grad = g.createLinearGradient(0, H * 0.55, 0, H);
  grad.addColorStop(0, 'rgba(70,60,50,0)');
  grad.addColorStop(1, 'rgba(70,60,50,0.16)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function DropVehicle({ burn: _burn, glow: _glow, ...props }: AssetProps) {
  const m = useMemo(() => {
    const { R, shell, nose, noseTop, spike, y0 } = DV;
    const yB = y0 + spike; // shell bottom
    const yT = yB + shell; // shell top
    const alu: THREE.BufferGeometry[] = [];
    const blue: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const rivets: Placed[] = [];

    // checkered shell (open cylinder, painted)
    const shellGeo = new THREE.CylinderGeometry(R, R, shell, 96, 1, true);
    shellGeo.translate(0, yB + shell / 2, 0);

    // bands at both ends of the shell
    alu.push(cyl(R + 0.006, R + 0.006, 0.035, { pos: [0, yB + 0.0175, 0] }, 96));
    alu.push(cyl(R + 0.006, R + 0.006, 0.03, { pos: [0, yT - 0.015, 0] }, 96));

    // nose cone (spun aluminium) with its cap, collar and the release spindle
    alu.push(cyl(noseTop, R, nose, { pos: [0, yT + nose / 2, 0] }, 96));
    alu.push(cyl(noseTop + 0.01, noseTop + 0.01, 0.035, { pos: [0, yT + nose + 0.0175, 0] }, 64));
    alu.push(cyl(0.05, 0.06, 0.06, { pos: [0, yT + nose + 0.065, 0] }, 32));
    alu.push(cyl(0.018, 0.018, 0.42, { pos: [0, yT + nose + 0.3, 0] }, 20));
    alu.push(cyl(0.03, 0.03, 0.03, { pos: [0, yT + nose + 0.52, 0] }, 20));

    // spike: aluminium cone under the shell, with a blunt tip
    alu.push(cyl(R * 0.6, 0.022, spike - 0.02, { pos: [0, y0 + 0.02 + (spike - 0.02) / 2, 0] }, 96));
    alu.push(cyl(0.025, 0.006, 0.02, { pos: [0, y0 + 0.01, 0] }, 24));
    alu.push(cyl(R * 0.66, R * 0.66, 0.02, { pos: [0, yB - 0.01, 0] }, 96));

    // access slot in a white square of the top row (u = 0 is +z, as in CylinderGeometry), two small tabs on the nose
    const slotAng = Math.PI / 8;
    const sp = (a: number, rr: number, y: number) => V(Math.sin(a) * rr, y, Math.cos(a) * rr);
    const slot = rbox(0.045, 0.15, 0.02, 0.008, {}, 2);
    const sq = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), slotAng);
    slot.applyQuaternion(sq);
    const sc = sp(slotAng, R - 0.004, yT - shell / 8);
    slot.translate(sc.x, sc.y, sc.z);
    dark.push(slot);
    const tabs: THREE.BufferGeometry[] = [];
    for (const a of [-0.25, 0.55]) {
      const t = 0.3, rr = R - (R - noseTop) * t + 0.004;
      const tab = rbox(0.03, 0.045, 0.01, 0.003, {}, 2);
      tab.rotateX(-Math.atan((R - noseTop) / nose));
      tab.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a));
      const c = sp(a, rr, yT + nose * t);
      tab.translate(c.x, c.y, c.z);
      tabs.push(tab);
    }

    // stand: floor ring, four raked legs and the cradle ring the shell rests on
    const legR0 = 0.56, legR1 = R * 0.7;
    blue.push(cyl(legR0 + 0.03, legR0 + 0.03, 0.03, { pos: [0, 0.015, 0] }, 64));
    blue.push(cyl(legR1 + 0.03, legR1 + 0.03, 0.04, { pos: [0, yB - 0.04, 0] }, 64));
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const p0 = V(Math.sin(a) * legR0, 0.03, Math.cos(a) * legR0);
      const p1 = V(Math.sin(a) * legR1, yB - 0.06, Math.cos(a) * legR1);
      const len = p0.distanceTo(p1);
      const leg = new THREE.BoxGeometry(0.05, len, 0.05);
      leg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), p1.clone().sub(p0).normalize()));
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      leg.translate(mid.x, mid.y, mid.z);
      blue.push(leg);
      blue.push(cyl(0.05, 0.05, 0.012, { pos: [p0.x, 0.036, p0.z] }, 16));
    }

    // rivets: two vertical shell seams, around both bands, and up the nose-cone seam
    for (const a of [-0.6, Math.PI - 0.6])
      for (let y = yB + 0.06; y < yT - 0.04; y += 0.05) rivets.push({ p: sp(a, R, y), n: sp(a, 1, 0) });
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      rivets.push({ p: sp(a, R + 0.006, yB + 0.0175), n: sp(a, 1, 0) });
      rivets.push({ p: sp(a, R + 0.006, yT - 0.015), n: sp(a, 1, 0) });
    }
    const slope = (R - noseTop) / nose;
    const nn = V(0, slope, 0);
    for (let t = 0.06; t < 0.95; t += 0.07) {
      const a = -0.6;
      const rr = R - (R - noseTop) * t;
      const n = sp(a, 1, 0).add(nn).normalize();
      rivets.push({ p: sp(a, rr, yT + nose * t), n });
    }

    const paint = new THREE.MeshPhysicalMaterial({
      map: checkerTexture(),
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide,
    });
    return {
      shell: shellGeo,
      alu: merge(alu),
      blue: merge(blue),
      dark: merge(dark),
      tabY: tabs[0],
      tabG: tabs[1],
      rivets,
      mats: {
        paint,
        alu: aluminium({ roughness: 0.46, color: '#aeb3b8' }, [1, 6]),
        blue: new THREE.MeshPhysicalMaterial({ color: '#5d8fc6', roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
        dark: socketDark(),
        tabY: new THREE.MeshPhysicalMaterial({ color: '#e2c22a', roughness: 0.5 }),
        tabG: new THREE.MeshPhysicalMaterial({ color: '#3f9a52', roughness: 0.5 }),
        rivet: screwSteel({ roughness: 0.4 }),
      },
      rivetGeo: rivetGeo(0.0045),
    };
  }, []);

  return (
    <group {...props}>
      <mesh geometry={m.shell} material={m.mats.paint} castShadow receiveShadow />
      <mesh geometry={m.alu} material={m.mats.alu} castShadow receiveShadow />
      <mesh geometry={m.blue} material={m.mats.blue} castShadow receiveShadow />
      <mesh geometry={m.dark} material={m.mats.dark} />
      <mesh geometry={m.tabY} material={m.mats.tabY} />
      <mesh geometry={m.tabG} material={m.mats.tabG} />
      <Scatter geo={m.rivetGeo} mat={m.mats.rivet} items={m.rivets} />
    </group>
  );
}
