// Lunar regolith patch, 4 × 4 m, from a top-down regolith image (Nano Banana, 1024 px ≈ 4 mm per pixel):
// the image is the colour, and its blurred brightness lifts the surface (rocks and crater rims up to ≈ 3 cm)
// on top of a gentle ±3 cm roll. A 6 cm skirt shows it as a cut slab of soil. Static: no burn.
import { useTexture } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useOnUnmount, type AssetProps } from './common';

const BASE = `${import.meta.env.BASE_URL}tex/moon_regolith/`;
const URLS = [`${BASE}moon_regolith_col.webp`, `${BASE}moon_regolith_h.jpg`];
const S = 4; // m
const N = 384; // grid segments per side (≈ 1 cm)
const RELIEF = 0.03; // m, white in the height map
const ROLL = 0.03; // m
const SKIRT = 0.06; // m below the lowest point

/** brightness 0..1 of an image, sampled bilinearly at (u, v) */
function sampler(img: HTMLImageElement) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const w = c.width, h = c.height;
  const px = (x: number, y: number) => d[(Math.min(h - 1, y) * w + Math.min(w - 1, x)) * 4] / 255;
  return (u: number, v: number) => {
    const x = u * (w - 1), y = (1 - v) * (h - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    return (px(x0, y0) * (1 - fx) + px(x0 + 1, y0) * fx) * (1 - fy) + (px(x0, y0 + 1) * (1 - fx) + px(x0 + 1, y0 + 1) * fx) * fy;
  };
}

export function MoonGround({ burn: _burn, glow: _glow, ...props }: AssetProps) {
  const [col, hgt] = useTexture(URLS);
  useOnUnmount(() => useTexture.clear(URLS));
  const m = useMemo(() => {
    col.colorSpace = THREE.SRGBColorSpace;
    col.anisotropy = 8;
    const H = sampler(hgt.image as HTMLImageElement);
    const roll = (x: number, z: number) =>
      ROLL * (0.55 * Math.sin(x * 1.3 + 0.4) * Math.cos(z * 1.1 - 0.7) + 0.3 * Math.sin(x * 2.9 - z * 2.3 + 1.1) + 0.15 * Math.cos(x * 5.1 + z * 4.4));

    const top = new THREE.PlaneGeometry(S, S, N, N);
    top.rotateX(-Math.PI / 2);
    const pos = top.attributes.position as THREE.BufferAttribute;
    const uv = top.attributes.uv as THREE.BufferAttribute;
    const y = new Float32Array(pos.count);
    let lo = Infinity;
    for (let i = 0; i < pos.count; i++) {
      y[i] = H(uv.getX(i), uv.getY(i)) * RELIEF + roll(pos.getX(i), pos.getZ(i));
      lo = Math.min(lo, y[i]);
    }
    for (let i = 0; i < pos.count; i++) pos.setY(i, y[i] - lo + SKIRT);
    top.computeVertexNormals();

    // skirt: the four cut faces, from y = 0 up to the edge of the surface
    const sv: number[] = [];
    const edge = (i: number) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const side = (ids: number[]) => {
      for (let k = 0; k < ids.length - 1; k++) {
        const [ax, ay, az] = edge(ids[k]), [bx, by, bz] = edge(ids[k + 1]);
        sv.push(ax, 0, az, bx, 0, bz, bx, by, bz, ax, 0, az, bx, by, bz, ax, ay, az);
      }
    };
    const row = (r: number) => Array.from({ length: N + 1 }, (_, c) => r * (N + 1) + c);
    const colIdx = (c: number) => Array.from({ length: N + 1 }, (_, r) => r * (N + 1) + c);
    side(row(N));
    side(row(0).reverse());
    side(colIdx(N).reverse());
    side(colIdx(0));
    const skirt = new THREE.BufferGeometry();
    skirt.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    skirt.computeVertexNormals();

    const soil = new THREE.MeshStandardMaterial({ map: col, bumpMap: hgt, bumpScale: 2, roughness: 0.97, metalness: 0 });
    const cut = new THREE.MeshStandardMaterial({ color: '#4d4b48', roughness: 1, side: THREE.DoubleSide });
    return { top, skirt, soil, cut };
  }, [col, hgt]);

  return (
    <group {...props}>
      <mesh geometry={m.top} material={m.soil} castShadow receiveShadow />
      <mesh geometry={m.skirt} material={m.cut} receiveShadow />
    </group>
  );
}
