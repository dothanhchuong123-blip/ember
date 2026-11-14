// Real-world materials (PBR values from measured references; colours in sRGB).
import * as THREE from 'three';
import { brushedRough, mottleRough } from './textures';

type Opt = Partial<THREE.MeshPhysicalMaterialParameters>;

/** machined / brushed 6061 aluminium (clamps, frames) */
export const aluminium = (o: Opt = {}, rep: [number, number] = [2, 2]) =>
  new THREE.MeshPhysicalMaterial({
    color: '#dfe2e5',
    metalness: 1,
    roughness: 0.44,
    roughnessMap: brushedRough(...rep),
    anisotropy: 0.4,
    ...o,
  });

/** 304 stainless sheet, brushed (chamber shell) */
export const stainless = (o: Opt = {}, rep: [number, number] = [8, 8]) =>
  new THREE.MeshPhysicalMaterial({
    color: '#c6c9cc',
    metalness: 1,
    roughness: 0.36,
    roughnessMap: brushedRough(...rep),
    anisotropy: 0.4,
    ...o,
  });

/** bead-blasted stainless (chamber interior) */
export const blasted = (o: Opt = {}) =>
  new THREE.MeshPhysicalMaterial({
    color: '#babdc0',
    metalness: 1,
    roughness: 0.34,
    roughnessMap: mottleRough(3),
    ...o,
  });

/** black-oxide alloy steel (socket cap screws) */
export const screwSteel = (o: Opt = {}) =>
  new THREE.MeshPhysicalMaterial({ color: '#9a9da1', metalness: 1, roughness: 0.3, ...o });

export const socketDark = () => new THREE.MeshStandardMaterial({ color: '#1b1c1e', metalness: 0.6, roughness: 0.6 });

export const gold = (o: Opt = {}) => new THREE.MeshPhysicalMaterial({ color: '#e7b851', metalness: 1, roughness: 0.22, ...o });
export const brass = (o: Opt = {}) => new THREE.MeshPhysicalMaterial({ color: '#c9a23f', metalness: 1, roughness: 0.32, ...o });
export const copper = (o: Opt = {}) => new THREE.MeshPhysicalMaterial({ color: '#d8875a', metalness: 1, roughness: 0.33, ...o });

/** PA66 nylon cable tie, black */
export const nylonBlack = (o: Opt = {}) =>
  new THREE.MeshPhysicalMaterial({ color: '#141414', roughness: 0.5, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.5, ...o });

/** wire insulation (PTFE / ETFE): glossy, smooth */
export const insulation = (color: string, o: Opt = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.25, ...o });

export const blackRubber = () => new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8, metalness: 0 });
