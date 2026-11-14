// CC0 texture maps from Poly Haven (public/tex), loaded once and shared. 1K normal + roughness only.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

function load(path: string, srgb = false, repeat = 1) {
  const key = `${path}@${repeat}`;
  let t = cache.get(key);
  if (!t) {
    t = loader.load(`${import.meta.env.BASE_URL}tex/${path}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    cache.set(key, t);
  }
  return t;
}

/** pitted rock (rock_05): pores for char foam */
export const porousNormal = (rep = 1) => load('rock_05/rock_05_nor_gl_1k.jpg', false, rep);
export const porousRough = (rep = 1) => load('rock_05/rock_05_rough_1k.jpg', false, rep);
/** cracked clay plaster: crazing for silica ash */
export const plasterNormal = (rep = 1) => load('clay_plaster/clay_plaster_nor_gl_1k.jpg', false, rep);
export const plasterRough = (rep = 1) => load('clay_plaster/clay_plaster_rough_1k.jpg', false, rep);
/** rough linen weave */
export const linenNormal = (rep = 1) => load('rough_linen/rough_linen_nor_gl_1k.jpg', false, rep);
export const linenRough = (rep = 1) => load('rough_linen/rough_linen_rough_1k.jpg', false, rep);
