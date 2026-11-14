// Saffire spacecraft fire experiment flow unit (flown in Cygnus), with its white flight cover on: a true box,
// ~1.33 × 0.53 × 0.84 m, each face textured with that face cut out of a NASA photo and unwarped by
// scripts/rectify-saffire.mjs (GRC-2015-C-00430: the gold fan end; jsc2016e017570: the connector side, the
// grid end). The app renders the top as a plain cover. Static: no burn.
// The connector side faces +z, the fan end -x, the grid end +x.
import { useTexture } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useOnUnmount, type AssetProps } from './common';

export const SAFFIRE = { L: 1.33, H: 0.53, D: 0.84 };

const FACES = ['side', 'back', 'fan', 'grid'] as const;
const URLS = FACES.map((f) => `${import.meta.env.BASE_URL}textures/saffire_${f}.webp`);

export function SaffireUnit({ burn: _burn, glow: _glow, ...props }: AssetProps) {
  const tex = useTexture(URLS);
  useOnUnmount(() => useTexture.clear(URLS));
  const m = useMemo(() => {
    const { L, H, D } = SAFFIRE;
    const [side, back, fan, grid] = tex;
    for (const t of tex) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    }
    const cover = (map: THREE.Texture) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.78, sheen: 0.3, sheenRoughness: 0.8 });
    const metal = (map: THREE.Texture) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.5, metalness: 0.25 });
    // [width, height, position, rotation, material] per face
    const faces: [number, number, [number, number, number], [number, number, number], THREE.Material][] = [
      [L, H, [0, H / 2, D / 2], [0, 0, 0], cover(side)],
      [L, H, [0, H / 2, -D / 2], [0, Math.PI, 0], cover(back)],
      [D, H, [-L / 2, H / 2, 0], [0, -Math.PI / 2, 0], metal(fan)],
      [D, H, [L / 2, H / 2, 0], [0, Math.PI / 2, 0], metal(grid)],
      [L, D, [0, H, 0], [-Math.PI / 2, 0, 0], new THREE.MeshStandardMaterial({ color: '#e6e2d9', roughness: 0.78 })],
      [L, D, [0, 0.001, 0], [Math.PI / 2, 0, 0], new THREE.MeshStandardMaterial({ color: '#cfccc4', roughness: 0.85 })],
    ];
    return faces.map(([w, h, p, r, mat]) => ({ geo: new THREE.PlaneGeometry(w, h), p, r, mat }));
  }, [tex]);

  return (
    <group {...props}>
      {m.map((f, i) => (
        <mesh key={i} geometry={f.geo} material={f.mat} position={f.p} rotation={f.r} castShadow receiveShadow />
      ))}
    </group>
  );
}
