import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { makeShared, type BurnShared } from '../three/burn';

export type AssetProps = ThreeElements['group'] & {
  /** 0 = clean, 1 = burnt as in the BURNT reference photo */
  burn?: number;
  /** 0..1 glowing rim on the burn front (use while the flame is on) */
  glow?: number;
};

/** shared burn uniforms for one asset, kept in sync with its props */
export function useBurn(burn = 0, glow = 0): BurnShared {
  const shared = useMemo(makeShared, []);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    shared.uBurn.value = THREE.MathUtils.clamp(burn, 0, 1);
    shared.uGlow.value = THREE.MathUtils.clamp(glow, 0, 1);
    invalidate();
  }, [shared, burn, glow, invalidate]);
  useFrame((_, dt) => {
    if (shared.uGlow.value > 0) shared.uTime.value += dt;
  });
  return shared;
}

export interface Placed {
  p: THREE.Vector3;
  n: THREE.Vector3;
  s?: number;
}

/** many copies of one small part (rivets, bolts), each turned so its +y faces n */
export function Scatter({ geo, mat, items }: { geo: THREE.BufferGeometry; mat: THREE.Material; items: Placed[] }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const M = new THREE.Matrix4();
    items.forEach((it, i) => {
      q.setFromUnitVectors(up, it.n.clone().normalize());
      const s = it.s ?? 1;
      M.compose(it.p, q, new THREE.Vector3(s, s, s));
      m.setMatrixAt(i, M);
    });
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }, [geo, mat, items]);
  return <primitive object={mesh} />;
}

/** points along the edge of a w × h rectangle (in a plane given by axes u, v), inset and spaced */
export function rowAround(
  center: THREE.Vector3,
  u: THREE.Vector3,
  v: THREE.Vector3,
  w: number,
  h: number,
  spacing: number,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const nx = Math.max(1, Math.round(w / spacing));
  const ny = Math.max(1, Math.round(h / spacing));
  for (let i = 0; i <= nx; i++) {
    const a = -w / 2 + (w * i) / nx;
    out.push(center.clone().addScaledVector(u, a).addScaledVector(v, -h / 2));
    out.push(center.clone().addScaledVector(u, a).addScaledVector(v, h / 2));
  }
  for (let j = 1; j < ny; j++) {
    const b = -h / 2 + (h * j) / ny;
    out.push(center.clone().addScaledVector(u, -w / 2).addScaledVector(v, b));
    out.push(center.clone().addScaledVector(u, w / 2).addScaledVector(v, b));
  }
  return out;
}

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** runs fn once the component really unmounts (not on React StrictMode's dev-only unmount/remount check) */
export function useOnUnmount(fn: () => void) {
  const f = useRef(fn);
  f.current = fn;
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      setTimeout(() => !alive.current && f.current(), 0);
    };
  }, []);
}
