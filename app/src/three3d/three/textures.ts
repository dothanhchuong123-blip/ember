// Small textures drawn on a canvas at start-up: nothing to download, all tileable.
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(n: number) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return [c, c.getContext('2d')!] as const;
}

function tex(key: string, c: HTMLCanvasElement, srgb: boolean, repeat: [number, number] = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

function once(key: string, make: () => THREE.Texture) {
  return cache.get(key) ?? make();
}

/** brushed metal grain: fine streaks along u. Use as roughnessMap (and lightly as map). */
const brushedCanvas = (() => {
  let c: HTMLCanvasElement | null = null;
  return () => {
    if (c) return c;
    const [cv, g] = canvas(512);
    const r = rng(7);
    g.fillStyle = '#c8c8c8';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const y = r() * 512;
      const x = r() * 512;
      const len = 40 + r() * 400;
      const v = Math.floor(150 + r() * 105);
      g.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.35})`;
      g.lineWidth = 0.6 + r() * 1.1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y + (r() - 0.5) * 1.5);
      g.stroke();
      if (x + len > 512) {
        g.beginPath();
        g.moveTo(x - 512, y);
        g.lineTo(x + len - 512, y);
        g.stroke();
      }
    }
    c = cv;
    return c;
  };
})();

export const brushedRough = (rx = 1, ry = 1) =>
  once(`brR${rx},${ry}`, () => tex(`brR${rx},${ry}`, brushedCanvas(), false, [rx, ry]));
export const brushedMap = (rx = 1, ry = 1) =>
  once(`brM${rx},${ry}`, () => tex(`brM${rx},${ry}`, brushedCanvas(), true, [rx, ry]));

/** soft mottling (cast or bead-blasted stainless, rubber) */
const mottleCanvas = (() => {
  let c: HTMLCanvasElement | null = null;
  return () => {
    if (c) return c;
    const [cv, g] = canvas(256);
    const r = rng(3);
    g.fillStyle = '#d0d0d0';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = r() * 256, y = r() * 256, rad = 4 + r() * 26;
      const v = Math.floor(170 + r() * 85);
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${v},${v},${v},0.18)`);
      grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = grd;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) g.fillRect(x - rad + ox, y - rad + oy, rad * 2, rad * 2);
    }
    c = cv;
    return c;
  };
})();
export const mottleMap = (rep = 1) => once(`mo${rep}`, () => tex(`mo${rep}`, mottleCanvas(), true, [rep, rep]));
export const mottleRough = (rep = 1) => once(`moR${rep}`, () => tex(`moR${rep}`, mottleCanvas(), false, [rep, rep]));

/** plain weave of fibreglass-cotton yarn: colour map + bump */
const weaveCanvas = (() => {
  let c: HTMLCanvasElement | null = null;
  return () => {
    if (c) return c;
    const N = 512, cells = 16, s = N / cells;
    const [cv, g] = canvas(N);
    const r = rng(11);
    g.fillStyle = '#9a9384';
    g.fillRect(0, 0, N, N);
    for (let j = 0; j < cells; j++)
      for (let i = 0; i < cells; i++) {
        const over = (i + j) % 2 === 0; // warp over weft
        const x = i * s, y = j * s;
        const v = 0.88 + r() * 0.12;
        // a yarn segment: a rounded lozenge, bright in the middle, dark at its ends
        const grd = over ? g.createLinearGradient(x, y, x + s, y) : g.createLinearGradient(x, y, x, y + s);
        const mid = Math.floor(255 * v), end = Math.floor(196 * v);
        grd.addColorStop(0, `rgb(${end},${end},${end})`);
        grd.addColorStop(0.5, `rgb(${mid},${mid},${mid})`);
        grd.addColorStop(1, `rgb(${end},${end},${end})`);
        g.fillStyle = grd;
        g.beginPath();
        if (over) g.roundRect(x + 0.5, y + s * 0.1, s - 1, s * 0.8, s * 0.35);
        else g.roundRect(x + s * 0.1, y + 0.5, s * 0.8, s - 1, s * 0.35);
        g.fill();
        // fibre lines
        g.strokeStyle = 'rgba(255,255,255,0.12)';
        g.lineWidth = 0.6;
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          if (over) { const yy = y + s * (0.25 + k * 0.17); g.moveTo(x + 2, yy); g.lineTo(x + s - 2, yy + (r() - 0.5)); }
          else { const xx = x + s * (0.25 + k * 0.17); g.moveTo(xx, y + 2); g.lineTo(xx + (r() - 0.5), y + s - 2); }
          g.stroke();
        }
      }
    c = cv;
    return c;
  };
})();
export const weaveMap = (rx: number, ry: number) => once(`wv${rx},${ry}`, () => tex(`wv${rx},${ry}`, weaveCanvas(), true, [rx, ry]));
export const weaveBump = (rx: number, ry: number) => once(`wvB${rx},${ry}`, () => tex(`wvB${rx},${ry}`, weaveCanvas(), false, [rx, ry]));

/** stranded copper conductor: fine helical strands (u along the wire) */
const strandCanvas = (() => {
  let c: HTMLCanvasElement | null = null;
  return () => {
    if (c) return c;
    const [cv, g] = canvas(256);
    g.fillStyle = '#b0b0b0';
    g.fillRect(0, 0, 256, 256);
    for (let k = -16; k < 32; k++) {
      const grd = g.createLinearGradient(k * 16, 0, k * 16 + 16, 0);
      grd.addColorStop(0, '#9a9a9a');
      grd.addColorStop(0.5, '#ffffff');
      grd.addColorStop(1, '#9a9a9a');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(k * 16, 0);
      g.lineTo(k * 16 + 16, 0);
      g.lineTo(k * 16 + 16 + 128, 256);
      g.lineTo(k * 16 + 128, 256);
      g.closePath();
      g.fill();
    }
    c = cv;
    return c;
  };
})();
export const strandMap = (rx: number, ry: number) => once(`st${rx},${ry}`, () => tex(`st${rx},${ry}`, strandCanvas(), true, [rx, ry]));
export const strandBump = (rx: number, ry: number) => once(`stB${rx},${ry}`, () => tex(`stB${rx},${ry}`, strandCanvas(), false, [rx, ry]));

/** braided steel cable sleeve */
export const braidMap = (rx: number, ry: number) =>
  once(`br${rx},${ry}`, () => {
    const [cv, g] = canvas(128);
    g.fillStyle = '#6a6a6a';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        const x = i * 16, y = j * 16;
        const grd = g.createLinearGradient(x, y, x + 16, y + 16);
        grd.addColorStop(0, '#9a9a9a');
        grd.addColorStop(0.5, '#ececec');
        grd.addColorStop(1, '#8a8a8a');
        g.fillStyle = grd;
        g.beginPath();
        if ((i + j) % 2) g.ellipse(x + 8, y + 8, 7.5, 3.2, Math.PI / 4, 0, Math.PI * 2);
        else g.ellipse(x + 8, y + 8, 7.5, 3.2, -Math.PI / 4, 0, Math.PI * 2);
        g.fill();
      }
    return tex(`br${rx},${ry}`, cv, true, [rx, ry]);
  });
