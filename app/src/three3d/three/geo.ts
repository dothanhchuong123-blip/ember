// Geometry helpers. Units are metres; every asset stands on y = 0, centred on x and z.
// Burnable parts get their transform baked into the geometry (see burn.ts), so helpers here bake.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const mm = (v: number) => v / 1000;

export interface Place {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

export function bake<G extends THREE.BufferGeometry>(geo: G, p: Place = {}): G {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
    new THREE.Vector3(...(p.scale ?? [1, 1, 1])),
  );
  geo.applyMatrix4(m);
  return geo;
}

export const box = (w: number, h: number, d: number, p?: Place) => bake(new THREE.BoxGeometry(w, h, d), p);
export const rbox = (w: number, h: number, d: number, r: number, p?: Place, seg = 4) =>
  bake(new RoundedBoxGeometry(w, h, d, seg, r), p);
export const cyl = (rt: number, rb: number, h: number, p?: Place, seg = 32) =>
  bake(new THREE.CylinderGeometry(rt, rb, h, seg), p);

/** merge geometries of any kind (indexed or not) into one */
export function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    if (!n.attributes.normal) n.computeVertexNormals();
    return n;
  });
  return mergeGeometries(clean, false)!;
}

/** rounded rectangle centred on the origin */
export function roundRect<T extends THREE.Path = THREE.Shape>(w: number, h: number, r: number, shape: T = new THREE.Shape() as unknown as T): T {
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** a rounded rectangle path offset to (cx, cy), for holes */
export function roundRectHole(cx: number, cy: number, w: number, h: number, r: number) {
  const p = roundRect(w, h, r, new THREE.Path());
  // shift every point: rebuild from points (Path has no translate)
  const pts = p.getPoints(8).map((v) => new THREE.Vector2(v.x + cx, v.y + cy));
  return new THREE.Path(pts.reverse());
}

/** extrude a shape along +z from z = 0 to depth, with a small bevel */
export function extrude(shape: THREE.Shape, depth: number, bevel = 0, p?: Place, curveSegments = 12) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments,
  });
  g.translate(0, 0, bevel);
  return bake(g, p);
}

/** hex socket cap screw head on +y: a chamfered cylinder; returns [head, socket] */
export function capScrew(r: number, h: number, p?: Place): [THREE.BufferGeometry, THREE.BufferGeometry] {
  const c = r * 0.12;
  const prof = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r, 0),
    new THREE.Vector2(r, h - c),
    new THREE.Vector2(r - c, h),
    new THREE.Vector2(r * 0.62, h),
    new THREE.Vector2(r * 0.55, h * 0.55),
    new THREE.Vector2(0, h * 0.55),
  ];
  const head = bake(new THREE.LatheGeometry(prof, 32), p);
  const sock = bake(new THREE.CylinderGeometry(r * 0.5, r * 0.5, h * 0.02, 6).translate(0, h * 0.57, 0), p);
  return [head, sock];
}

/** dome rivet head, centred at origin facing +y */
export const rivetGeo = (r: number) => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1);

/** smooth tube along points */
export function tube(points: THREE.Vector3[], r: number, segs = 200, radial = 12, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, segs, r, radial, closed);
}

/** dense rounded-rectangle outline (w × h, corner r), so the extrusion can bend smoothly */
export function denseRoundRect(w: number, h: number, r: number, step: number) {
  const pts: THREE.Vector2[] = [];
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n));
  };
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i < 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  };
  const x = w / 2 - r, y = h / 2 - r;
  seg(-x, -h / 2, x, -h / 2);
  arc(x, -y, -Math.PI / 2);
  seg(w / 2, -y, w / 2, y);
  arc(x, y, 0);
  seg(x, h / 2, -x, h / 2);
  arc(-x, y, Math.PI / 2);
  seg(-w / 2, y, -w / 2, -y);
  arc(-x, -y, Math.PI);
  return new THREE.Shape(pts);
}


/** a lumpy blob: an icosphere pushed in and out by smooth noise (value noise from sines; no textures) */
export function lumpyBlob(detail: number, seed: number, amount = 0.28, freq = 2.2) {
  // the icosphere comes unindexed (flat normals); weld it so the lumps shade smoothly
  const ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const g = mergeVertices(ico, 1e-6);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const s1 = seed * 1.7 + 0.3, s2 = seed * 2.9 + 1.1, s3 = seed * 0.7 + 2.3;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n =
      Math.sin(v.x * freq + s1) * Math.sin(v.y * freq * 1.3 + s2) * Math.sin(v.z * freq * 0.9 + s3) +
      0.5 * Math.sin(v.x * freq * 2.3 + s2) * Math.sin(v.y * freq * 2.1 + s3) * Math.sin(v.z * freq * 2.7 + s1);
    v.multiplyScalar(1 + amount * n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** seeded random numbers, so scattered pieces land in the same places every load */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** a matrix that puts a piece at p, its +y along n, spun by `spin` about n, scaled (sx, sy, sz) */
export function placeOn(p: THREE.Vector3, n: THREE.Vector3, spin: number, sx: number, sy: number, sz: number) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().normalize());
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
  return new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, sz));
}

/** a thin irregular polygon plate, radius ≈ 1 in x/z, `thick` metres in y (centred on y = 0), with inner rings so
 *  it can bend (curl) smoothly; planar uv from x/z */
export function flakeGeo(seed: number, thick: number, sides = 6, rings = 3) {
  const r = seeded(seed);
  const rim: [number, number][] = [];
  const a0 = r() * Math.PI * 2;
  for (let i = 0; i < sides; i++) {
    const a = a0 + ((i + (r() - 0.5) * 0.6) / sides) * Math.PI * 2;
    const rr = 0.72 + r() * 0.28;
    rim.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const vert = (x: number, y: number, z: number) => {
    pos.push(x, y, z);
    uv.push(x * 0.5 + 0.5, z * 0.5 + 0.5);
    return pos.length / 3 - 1;
  };
  for (const side of [1, -1]) {
    const y = (side * thick) / 2;
    const c = vert(0, y, 0);
    let prev: number[] = [];
    for (let k = 1; k <= rings; k++) {
      const t = k / rings;
      const ring = rim.map(([x, z]) => vert(x * t, y, z * t));
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        const tri = (a: number, b: number, d: number) => (side > 0 ? idx.push(a, d, b) : idx.push(a, b, d));
        if (k === 1) tri(c, ring[i], ring[j]);
        else {
          tri(prev[i], ring[i], ring[j]);
          tri(prev[i], ring[j], prev[j]);
        }
      }
      prev = ring;
    }
  }
  // side wall between the two outer rings
  const ringStart = (side: number) => (side > 0 ? 0 : pos.length / 6) + 1 + (rings - 1) * sides;
  const top = ringStart(1), bot = ringStart(-1);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    idx.push(top + i, top + j, bot + i, top + j, bot + j, bot + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
