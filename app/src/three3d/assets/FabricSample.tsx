// Woven fibreglass-cotton fabric sample, 60 × 130 mm, sandwiched between two U-shaped aluminium frames
// (70 × 140 mm, 9 mm bars, 3 mm plates, open at the top), four socket cap screws with nuts behind.
// Burns from the top down: the top half is consumed with a ragged black edge, then a grey ash band and
// brown scorch fading to clean off-white weave. The frame's inner arms pick up soot.
import { useMemo } from 'react';
import * as THREE from 'three';
import { addDispNormals, burnable, type BurnLook } from '../three/burn';
import { bake, capScrew, extrude, mm } from '../three/geo';
import { aluminium, screwSteel, socketDark } from '../three/mats';
import { weaveBump, weaveMap } from '../three/textures';
import { useBurn, type AssetProps } from './common';

export const FAB = { W: mm(70), H: mm(140), bar: mm(9), plate: mm(3), gap: mm(0.35), fw: mm(60), fh: mm(130), fy0: mm(4) };

function uShape() {
  const { W, H, bar } = FAB;
  const s = new THREE.Shape();
  const r = mm(1.2);
  s.moveTo(-W / 2 + r, 0);
  s.lineTo(W / 2 - r, 0);
  s.quadraticCurveTo(W / 2, 0, W / 2, r);
  s.lineTo(W / 2, H);
  s.lineTo(W / 2 - bar, H);
  s.lineTo(W / 2 - bar, bar + r);
  s.quadraticCurveTo(W / 2 - bar, bar, W / 2 - bar - r, bar);
  s.lineTo(-W / 2 + bar + r, bar);
  s.quadraticCurveTo(-W / 2 + bar, bar, -W / 2 + bar, bar + r);
  s.lineTo(-W / 2 + bar, H);
  s.lineTo(-W / 2, H);
  s.lineTo(-W / 2, r);
  s.quadraticCurveTo(-W / 2, 0, -W / 2 + r, 0);
  return s;
}

export function FabricSample({ burn = 0, glow = 0, ...props }: AssetProps) {
  const shared = useBurn(burn, glow);
  const m = useMemo(() => {
    const top = FAB.fy0 + FAB.fh;
    const look = (o: Partial<BurnLook>): BurnLook => ({
      mode: 'radial',
      origin: [0, top + mm(6), 0],
      scale: [1.6, 1, 1],
      length: mm(72),
      deepBand: [0, mm(7)],
      charBand: [mm(5), mm(6)],
      heatBand: [mm(12), mm(14)],
      jitter: mm(6),
      noise: 70,
      scorch: '#7a4a22',
      char: '#2e2a27',
      deep: '#0d0c0b',
      ...o,
    });

    const fabric = new THREE.PlaneGeometry(FAB.fw, FAB.fh, 120, 260);
    fabric.translate(0, FAB.fy0 + FAB.fh / 2, 0);
    addDispNormals(fabric);
    // weave: 16 yarn cells per tile, ~0.45 mm per yarn
    const rx = FAB.fw / mm(7.2), ry = FAB.fh / mm(7.2);
    const cloth = burnable(
      new THREE.MeshPhysicalMaterial({
        color: '#f3eddc',
        map: weaveMap(rx, ry),
        bumpMap: weaveBump(rx, ry),
        bumpScale: 1.2,
        roughness: 0.9,
        sheen: 0.6,
        sheenColor: '#fff6e2',
        sheenRoughness: 0.7,
        side: THREE.DoubleSide,
      }),
      look({
        cut: 0.86,
        charRough: 1,
        deepRough: 1,
        lump: mm(1.4),
        lumpFreq: 180,
        lumpDeep: 0.6,
        edgeWave: mm(2.2),
        edgeWidth: mm(10),
        fray: mm(0.45),
        frayLength: mm(4),
      }),
      shared,
    );
    const frameMat = burnable(
      aluminium({}, [1, 3]),
      look({
        scale: [0.8, 1, 1],
        length: mm(60),
        deepBand: [0, mm(10)],
        charBand: [mm(5), mm(20)],
        heatBand: [mm(15), mm(20)],
        // soot on the upper bars: dark and dull, browner where it thins out (stays < 0.99 so the frame never glows)
        scorch: '#6e6254',
        char: '#1e1c1a', // darkest where the flame front licked the bars
        deep: '#9a958e', // only a light smudge further up: the tops stay silver in the photo
        strength: 0.97,
        metalKill: 0.6,
        charRough: 0.88,
        deepRough: 0.92,
      }),
      shared,
    );
    const zf = FAB.gap; // front plate starts here
    const front = extrude(uShape(), FAB.plate, mm(0.35), { pos: [0, 0, zf] });
    const back = extrude(uShape(), FAB.plate, mm(0.35), { pos: [0, 0, -zf - FAB.plate] });

    const bolts: [number, number][] = [
      [-(FAB.W / 2 - FAB.bar / 2), FAB.H - mm(5)],
      [FAB.W / 2 - FAB.bar / 2, FAB.H - mm(5)],
      [-(FAB.W / 2 - FAB.bar / 2), mm(4.5)],
      [FAB.W / 2 - FAB.bar / 2, mm(4.5)],
    ];
    const heads: THREE.BufferGeometry[] = [];
    const socks: THREE.BufferGeometry[] = [];
    const nuts: THREE.BufferGeometry[] = [];
    const ends: THREE.BufferGeometry[] = [];
    for (const [x, y] of bolts) {
      const [h, s] = capScrew(mm(2.7), mm(2.6), { pos: [x, y, zf + FAB.plate], rot: [Math.PI / 2, 0, 0] });
      heads.push(h);
      socks.push(s);
      nuts.push(bake(new THREE.CylinderGeometry(mm(3), mm(3), mm(2.2), 6), { pos: [x, y, -zf - FAB.plate - mm(1.1)], rot: [Math.PI / 2, 0, Math.PI / 6] }));
      ends.push(bake(new THREE.CylinderGeometry(mm(1.45), mm(1.45), mm(1.6), 16), { pos: [x, y, -zf - FAB.plate - mm(2.2) - mm(0.8)], rot: [Math.PI / 2, 0, 0] }));
    }
    return { fabric, cloth, frameMat, front, back, heads, socks, nuts, ends, steel: screwSteel(), dark: socketDark() };
  }, [shared]);

  return (
    <group {...props}>
      <mesh geometry={m.fabric} material={m.cloth} castShadow receiveShadow />
      <mesh geometry={m.front} material={m.frameMat} castShadow receiveShadow />
      <mesh geometry={m.back} material={m.frameMat} castShadow receiveShadow />
      {m.heads.map((g, i) => (
        <mesh key={`h${i}`} geometry={g} material={m.steel} castShadow />
      ))}
      {m.socks.map((g, i) => (
        <mesh key={`s${i}`} geometry={g} material={m.dark} />
      ))}
      {[...m.nuts, ...m.ends].map((g, i) => (
        <mesh key={`n${i}`} geometry={g} material={m.steel} castShadow />
      ))}
    </group>
  );
}
