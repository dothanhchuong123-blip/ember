// One burn shader for every asset. It patches a MeshStandardMaterial / MeshPhysicalMaterial so a single
// clean mesh can show the whole burn: scorch tint → char → fully consumed, driven by one value (uBurn, 0..1).
//
// The burn front moves through the asset's own space (every burnable part has its transform baked into its
// geometry, so all parts of one asset share that space). Three ways to move:
//   linear  from `origin` along `dir`          (rod tip → clamp, fabric top → bottom)
//   both    from `origin` both ways along `dir` (centre of the silicone strip and of the wire bundle)
//   radial  out from `origin`, stretched by `scale` (Ultem: front-top-right corner)
// Shape changes (swelling char foam, the melted rod tip, drips) are vertex displacement along a smoothed
// normal (`bNormal`, see addDispNormals) so hard edges never tear; the fragment shader uses the same height
// for its normal, so lighting matches the displaced shape. The consumed part can be cut away (fabric, wire
// insulation). A glowing rim follows the front while uGlow > 0.
import * as THREE from 'three';
import { NOISE_GLSL } from './noise';

export type V3 = [number, number, number];

export interface BurnLook {
  mode: 'linear' | 'both' | 'radial';
  origin: V3;
  dir?: V3;
  scale?: V3;
  /** metres from the origin that are fully consumed at uBurn = 1 */
  length: number;
  /** each zone runs to [offset beyond the consumed front, fade width], metres */
  deepBand?: [number, number];
  charBand?: [number, number];
  heatBand?: [number, number];
  /** width of the glowing rim at the leading edge of the char, metres */
  glowWidth?: number;
  /** how ragged the front is, metres (0.003) */
  jitter?: number;
  /** noise frequency per metre for the ragged front (120) */
  noise?: number;
  scorch: THREE.ColorRepresentation;
  char: THREE.ColorRepresentation;
  deep: THREE.ColorRepresentation;
  charRough?: number;
  deepRough?: number;
  /** 1 = char removes metalness (soot on aluminium) */
  metalKill?: number;
  /** metres along the normal in the char band */
  swell?: number;
  /** metres along the normal in the consumed zone (negative melts it away) */
  deepSwell?: number;
  /** metres along `dir` in the consumed zone (the rod tip gets shorter) */
  pull?: number;
  /** fraction of the radius (around the dir axis) lost at the origin, growing over meltLength: a melted, tapered tip */
  melt?: number;
  meltLength?: number;
  /** metres the rim of a melted tip slumps back, so the end turns into a rounded blob (radius roundRadius) */
  round?: number;
  roundRadius?: number;
  /** metres the most melted part sags downwards (gravity) */
  sag?: number;
  /** metres of low-frequency lumpy inflation in the consumed zone (a bulbous, uneven melted blob); follows the
   *  smooth front, so it never tears */
  inflate?: number;
  /** noise frequency per metre for the inflation (60) */
  inflateFreq?: number;
  /** metres the cloth waves out of its plane (along its normal) within `edgeWidth` of the burnt-away edge */
  edgeWave?: number;
  edgeWidth?: number;
  /** yarn pitch in metres: the cut edge follows single threads of a plain weave lying in the x-y plane, so
   *  threads stick out of the ragged edge by up to `frayLength` */
  fray?: number;
  frayLength?: number;
  /** keep the char band see-through (only the consumed zone turns opaque), so things under the surface show */
  clearChar?: boolean;
  /** push swelling out from this point instead of along the normal: a direction that is continuous in
   *  space, so meshes with grooves and hard edges (CSG) never open up */
  swellFrom?: V3;
  /** metres of noisy lumps: foam, bubbles, drips */
  lump?: number;
  lumpFreq?: number;
  /** 0 = lumps sit in the char band, 1 = in the consumed zone */
  lumpDeep?: number;
  /** round bubbles in the char band (melting plastic), lighter colour and raised */
  bubbles?: number;
  bubbleFreq?: number;
  bubbleColor?: THREE.ColorRepresentation;
  /** crack network in the consumed zone (silicone ash) */
  cracks?: number;
  crackFreq?: number;
  crackColor?: THREE.ColorRepresentation;
  /** cut away the consumed zone above this value (0 = never; above 1 = only holes where the noise is low) */
  cut?: number;
  /** metres behind the consumed front where everything is cut, an open window at the hottest core
   *  (default: just behind the front when cut < 1, never when cut ≥ 1) */
  cutCore?: number;
  /** wet, glossy black melt (PMMA, wire insulation, Ultem pockets): 0..1, in the char band or only the consumed zone */
  wet?: number;
  wetZone?: 'char' | 'deep';
  /** cells per metre of the wet sparkle bumps (900) */
  wetFreq?: number;
  /** scales the fade widths of the three zones: < 1 gives crisper, more ragged edges (deep/char 0.3, heat 0.5) */
  fade?: number;
  heatFade?: number;
  /** a tileable greyscale texture (e.g. a Poly Haven roughness map) used as fine relief and roughness in the char,
   *  projected in object space (triplanar), so parts without shared UVs still line up */
  detail?: THREE.Texture;
  /** texture repeats per metre */
  detailScale?: number;
  /** relief height, metres */
  detailAmp?: number;
  /** 1 for the sample itself, ~0.3–0.5 for soot on its holder */
  strength?: number;
  glow?: THREE.ColorRepresentation;
}

export interface BurnShared {
  uBurn: { value: number };
  uGlow: { value: number };
  uTime: { value: number };
}

export const makeShared = (): BurnShared => ({ uBurn: { value: 0 }, uGlow: { value: 0 }, uTime: { value: 0 } });

const MODES = { linear: 0, both: 1, radial: 2 } as const;

const COMMON = /* glsl */ `
uniform float uBurn; uniform float uGlow; uniform float uTime;
uniform int uBMode; uniform vec3 uBOrigin; uniform vec3 uBDir; uniform vec3 uBScale;
uniform float uBLen; uniform float uBJitter; uniform float uBNoise;
uniform vec2 uBDeepB; uniform vec2 uBCharB; uniform vec2 uBHeatB; uniform float uBGlowW;
uniform float uBSwell; uniform float uBDeepSwell; uniform float uBPull;
uniform float uBLump; uniform float uBLumpFreq; uniform float uBLumpDeep;
uniform vec3 uBFrom; uniform float uBUseFrom;
uniform float uBMelt; uniform float uBMeltLen; uniform float uBSag; uniform float uBRound; uniform float uBRoundR;
uniform float uBInflate; uniform float uBInflateFreq; uniform float uBClearChar;
uniform float uBEdgeWave; uniform float uBEdgeW; uniform float uBFray; uniform float uBFrayLen;
${NOISE_GLSL}
struct BB { float heat; float ch; float deep; float glow; float n; float x; };
BB burnBands(vec3 p, float jit) {
  BB b;
  vec3 q = p - uBOrigin;
  float d;
  if (uBMode == 0) d = dot(q, uBDir);
  else if (uBMode == 1) d = abs(dot(q, uBDir));
  else d = length(q * uBScale);
  // two layers: the broad wander of the front plus a finer, higher-frequency rag on its edge
  float n = b_fbm(p * uBNoise);
  b.n = n;
  if (jit > 0.0) n += 0.42 * b_fbm2(p * uBNoise * 3.7 + 31.0);
  float reach = uBHeatB.x + uBHeatB.y + uBJitter;
  float front = uBurn * (uBLen + reach) - reach;
  float x = max(d, 0.0) - front + n * jit; // distance beyond the consumed front
  b.x = x;
  b.deep = 1.0 - smoothstep(uBDeepB.x, uBDeepB.x + uBDeepB.y, x);
  b.ch = 1.0 - smoothstep(uBCharB.x, uBCharB.x + uBCharB.y, x);
  b.heat = 1.0 - smoothstep(uBHeatB.x, uBHeatB.x + uBHeatB.y, x);
  b.glow = smoothstep(uBCharB.x - uBGlowW, uBCharB.x, x) * (1.0 - smoothstep(uBCharB.x, uBCharB.x + uBCharB.y, x));
  return b;
}
float burnHeight(BB b, vec3 p) {
  float ln = b_fbm(p * uBLumpFreq) * 0.5 + 0.5;
  float lw = mix(max(b.ch - b.deep, 0.0), b.deep, uBLumpDeep);
  return uBSwell * b.ch + uBDeepSwell * b.deep + uBLump * lw * ln;
}
`;

const FRAG_HEAD = /* glsl */ `
uniform float uBStrength; uniform vec3 uBScorch; uniform vec3 uBChar; uniform vec3 uBDeep;
uniform float uBCharRough; uniform float uBDeepRough; uniform float uBMetalKill;
uniform float uBCracks; uniform float uBCrackFreq; uniform vec3 uBCrackColor; uniform float uBCut; uniform float uBCutCore;
uniform vec3 uBGlowColor;
uniform float uBWet; uniform float uBWetDeep; uniform float uBWetFreq;
uniform sampler2D uBDetail; uniform float uBDetailScale; uniform float uBDetailAmp;
uniform float uBBubbles; uniform float uBBubbleFreq; uniform vec3 uBBubbleColor;
varying vec3 vBP;
vec3 bPerturb(vec3 pos, vec3 n, float h, bool front) {
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * (front ? 1.0 : -1.0);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad);
}
`;

/** the uniforms one look needs; shared by the surface patch (burnable) and the instanced growth (growable) */
function burnUniforms(look: BurnLook, shared: BurnShared) {
  const dir = new THREE.Vector3(...(look.dir ?? [1, 0, 0])).normalize();
  const f = look.fade ?? 0.3;
  const fh = look.heatFade ?? 0.5;
  const band = (b: [number, number] | undefined, def: [number, number], k: number) => {
    const [o, w] = b ?? def;
    return new THREE.Vector2(o, w * k);
  };
  return {
    ...shared,
    uBMode: { value: MODES[look.mode] },
    uBOrigin: { value: new THREE.Vector3(...look.origin) },
    uBDir: { value: dir },
    uBScale: { value: new THREE.Vector3(...(look.scale ?? [1, 1, 1])) },
    uBLen: { value: look.length },
    uBJitter: { value: look.jitter ?? 0.003 },
    uBDeepB: { value: band(look.deepBand, [0, 0.004], f) },
    uBCharB: { value: band(look.charBand, [0.01, 0.006], f) },
    uBHeatB: { value: band(look.heatBand, [0.02, 0.01], fh) },
    uBGlowW: { value: (look.glowWidth ?? 0.004) * Math.max(f, 0.5) },
    uBNoise: { value: look.noise ?? 120 },
    uBSwell: { value: look.swell ?? 0 },
    uBDeepSwell: { value: look.deepSwell ?? 0 },
    uBPull: { value: look.pull ?? 0 },
    uBLump: { value: look.lump ?? 0 },
    uBLumpFreq: { value: look.lumpFreq ?? 400 },
    uBLumpDeep: { value: look.lumpDeep ?? 0 },
    uBFrom: { value: new THREE.Vector3(...(look.swellFrom ?? [0, 0, 0])) },
    uBUseFrom: { value: look.swellFrom ? 1 : 0 },
    uBMelt: { value: look.melt ?? 0 },
    uBMeltLen: { value: look.meltLength ?? 0 },
    uBSag: { value: look.sag ?? 0 },
    uBRound: { value: look.round ?? 0 },
    uBRoundR: { value: look.roundRadius ?? 0.01 },
    uBInflate: { value: look.inflate ?? 0 },
    uBInflateFreq: { value: look.inflateFreq ?? 60 },
    uBClearChar: { value: look.clearChar ? 1 : 0 },
    uBEdgeWave: { value: look.edgeWave ?? 0 },
    uBEdgeW: { value: look.edgeWidth ?? 0.01 },
    uBFray: { value: look.fray ?? 0 },
    uBFrayLen: { value: look.frayLength ?? 0.002 },
    uBStrength: { value: look.strength ?? 1 },
    uBScorch: { value: new THREE.Color(look.scorch) },
    uBChar: { value: new THREE.Color(look.char) },
    uBDeep: { value: new THREE.Color(look.deep) },
    uBCharRough: { value: look.charRough ?? 0.85 },
    uBDeepRough: { value: look.deepRough ?? 0.95 },
    uBMetalKill: { value: look.metalKill ?? 1 },
    uBCracks: { value: look.cracks ?? 0 },
    uBCrackFreq: { value: look.crackFreq ?? 250 },
    uBCrackColor: { value: new THREE.Color(look.crackColor ?? '#141210') },
    uBCut: { value: look.cut ?? 0 },
    uBCutCore: { value: look.cutCore ?? ((look.cut ?? 0) < 1 ? band(look.deepBand, [0, 0.004], f).y * 1.5 : 1e3) },
    uBBubbles: { value: look.bubbles ?? 0 },
    uBBubbleFreq: { value: look.bubbleFreq ?? 500 },
    uBBubbleColor: { value: new THREE.Color(look.bubbleColor ?? '#c88a3a') },
    uBGlowColor: { value: new THREE.Color(look.glow ?? '#ff6200').multiplyScalar(3) },
    uBWet: { value: look.wet ?? 0 },
    uBWetDeep: { value: look.wetZone === 'deep' ? 1 : 0 },
    uBWetFreq: { value: look.wetFreq ?? 900 },
    uBDetail: { value: look.detail ?? null },
    uBDetailScale: { value: look.detailScale ?? 60 },
    uBDetailAmp: { value: look.detailAmp ?? 0.0002 },
  };
}

let cacheId = 0;

export function burnable<M extends THREE.MeshStandardMaterial>(mat: M, look: BurnLook, shared: BurnShared): M {
  const u = burnUniforms(look, shared);
  const physical = (mat as unknown as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial;
  // clearcoat code only compiles when clearcoat > 0, and the wet melt needs it
  if (look.wet && physical) {
    const pm = mat as unknown as THREE.MeshPhysicalMaterial;
    if (pm.clearcoat === 0) pm.clearcoat = 0.001;
  }
  const defs = (look.detail ? '#define B_DETAIL\n' : '') + (look.wet ? '#define B_WET\n' : '');

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}\nattribute vec3 bNormal;\nvarying vec3 vBP;\nvarying vec3 vBN;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBP = position;
        vBN = objectNormal;
        {
          BB bb = burnBands(position, uBJitter);
          BB bs = burnBands(position, 0.0); // smooth field for big shape changes, so the surface never folds
          vec3 dn = uBUseFrom > 0.5 ? normalize(position - uBFrom) : (dot(bNormal, bNormal) > 0.25 ? bNormal : objectNormal);
          transformed += dn * burnHeight(bb, position) + uBDir * uBPull * bs.deep * bs.deep;
          if (uBEdgeWave > 0.0) {
            // the cloth curls and waves near the burnt edge: strongest at the edge, gone uBEdgeW behind it
            float ew = 1.0 - smoothstep(0.0, uBEdgeW, bb.x);
            float wv = b_snoise(position * 260.0) * 0.6 + b_snoise(position * 90.0 + 4.0) * 0.6 + 0.35;
            transformed += dn * uBEdgeWave * ew * ew * wv;
          }
          if (uBInflate > 0.0) {
            // lumpy, uneven swelling of the melted blob: low-frequency noise on the smooth front only
            float inf = b_fbm(position * uBInflateFreq + 3.7) * 0.75 + 0.45;
            transformed += dn * uBInflate * max(inf, 0.0) * smoothstep(0.0, 0.006, -bs.x);
          }
          if (uBMeltLen > 0.0) {
            float mf = smoothstep(0.0, uBMeltLen, -bs.x);
            vec3 q = transformed - uBOrigin;
            vec3 radial = q - uBDir * dot(q, uBDir);
            float rr = length(radial) / max(uBRoundR, 1e-5);
            transformed -= radial * uBMelt * mf;
            transformed += uBDir * uBRound * rr * rr * pow(mf, 3.0);
            transformed.y -= uBSag * mf * mf;
          }
        }`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `${defs}#include <common>\n${COMMON}\n${FRAG_HEAD}`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        BB bb = burnBands(vBP, uBJitter);
        float bS = uBStrength;
        float bCrack = 0.0;
        float bBub = 0.0;
        if (uBBubbles > 0.0) {
          vec2 bc = b_cells(vBP * uBBubbleFreq);
          bBub = smoothstep(0.22, 0.6, bc.x) * max(bb.ch - bb.deep, 0.0) * uBBubbles * step(0.35, bc.y);
        }
        float bCn = b_fbm(vBP * uBNoise * 3.0) * 0.5 + 0.5;
        float bWet = 0.0;
        float bWetH = 0.0;
        #ifdef B_WET
          bWet = uBWet * mix(bb.ch, bb.deep, uBWetDeep) * step(0.5, bS);
          if (bWet > 0.0) {
            vec2 wc = b_cells(vBP * uBWetFreq);
            bWetH = smoothstep(0.0, 0.45, wc.x) * (0.6 + 0.4 * wc.y); // little domes: each one catches a highlight
          }
        #endif
        float bDet = 0.5;
        #ifdef B_DETAIL
          {
            vec3 w = pow(abs(normalize(vBN)), vec3(4.0));
            w /= (w.x + w.y + w.z);
            vec3 tp = vBP * uBDetailScale;
            bDet = texture2D(uBDetail, tp.yz).r * w.x + texture2D(uBDetail, tp.xz).r * w.y + texture2D(uBDetail, tp.xy).r * w.z;
          }
        #endif`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 c = diffuseColor.rgb;
          c = mix(c, mix(c, uBScorch, 0.8), bb.heat * (1.0 - bb.ch));
          c = mix(c, uBChar * (0.7 + 0.6 * bCn), bb.ch);
          c = mix(c, uBDeep * (0.8 + 0.4 * bCn), bb.deep);
          c = mix(c, uBBubbleColor, bBub);
          if (uBCracks > 0.0) {
            vec2 cc = b_cells(vBP * uBCrackFreq + b_snoise(vBP * uBCrackFreq * 0.35) * 0.35);
            bCrack = (1.0 - smoothstep(0.015, 0.05, cc.x)) * bb.deep * uBCracks;
            c *= mix(1.0, 0.55 + 0.45 * smoothstep(-0.03, 0.0, bb.x + uBLen * 0.35), bb.deep); // darker char showing at the hottest centre
            c = mix(c, uBCrackColor, bCrack);
          }
          c = mix(c, vec3(0.0015), bWet); // #050505
          diffuseColor.rgb = mix(diffuseColor.rgb, c, bS);
          if (uBCut > 0.0) {
            float cx = bb.x;
            float cn = bCn;
            if (uBFray > 0.0) {
              // plain weave: in alternate cells the warp (vertical) or the weft (horizontal) thread is on top.
              // Each thread reads the front at its own centre line plus its own random length, so it either
              // burns off whole or sticks out of the edge.
              vec2 cell = floor(vBP.xy / uBFray);
              bool warp = mod(cell.x + cell.y, 2.0) < 0.5;
              vec3 q = vBP;
              if (warp) q.x = (cell.x + 0.5) * uBFray; else q.y = (cell.y + 0.5) * uBFray;
              float th = b_hash3(vec3(warp ? cell.x : cell.y + 911.0, warp ? 3.0 : 7.0, 1.0)).x;
              cx = burnBands(q, uBJitter).x + (th - 0.5) * uBFrayLen;
              cn = 0.5;
            }
            float cdeep = 1.0 - smoothstep(uBDeepB.x, uBDeepB.x + uBDeepB.y, cx);
            if (cdeep > uBCut + (cn - 0.5) * 0.4 || cx < -uBCutCore) discard;
          }
        }`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uBCharRough * (0.75 + 0.5 * bDet), bb.ch * bS);
        roughnessFactor = mix(roughnessFactor, uBDeepRough, bb.deep * bS);
        roughnessFactor = mix(roughnessFactor, 0.06, bWet);
        metalnessFactor = mix(metalnessFactor, 0.0, bb.ch * bS * uBMetalKill);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float h = burnHeight(bb, vBP) + bBub * 0.0004 - bCrack * 0.0005 + b_snoise(vBP * uBNoise * 4.0) * 0.00002 * bb.ch
            + bWet * bWetH * 0.00012 + (bDet - 0.5) * uBDetailAmp * bb.ch * (1.0 - bWet);
          if (bS > 0.5) normal = bPerturb(-vViewPosition, normal, h, faceDirection > 0.0);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uBGlowColor * bb.glow * uGlow * step(0.99, bS)
          * (0.5 + 0.9 * (b_snoise(vBP * uBNoise * 2.0 + vec3(0.0, uTime * 0.9, 0.0)) * 0.5 + 0.5));`,
      )
      .replace(
        'material.transmission = transmission;',
        'material.transmission = transmission * (1.0 - max(max(mix(bb.ch, bb.deep, uBClearChar), bb.heat * 0.45 * (1.0 - uBClearChar)) * bS, bWet));',
      )
      .replace(
        'material.clearcoat = clearcoat;',
        'material.clearcoat = mix(clearcoat * (1.0 - bb.deep * 0.75 * bS), 1.0, bWet);',
      )
      .replace('material.clearcoatRoughness = clearcoatRoughness;', 'material.clearcoatRoughness = mix(clearcoatRoughness, 0.08, bWet);');
    shader.fragmentShader = shader.fragmentShader.replace('varying vec3 vBP;', 'varying vec3 vBP;\nvarying vec3 vBN;');
  };
  const key = `burn-v2${defs.replace(/\W/g, '')}`;
  mat.customProgramCacheKey = () => key;
  return mat;
}

export interface GrowOpts {
  /** which zone makes the pieces appear: heat (scorch), char or deep (consumed) */
  band?: 'heat' | 'char' | 'deep';
  /** 0..1: how much each piece's own start is staggered within that zone */
  spread?: number;
  /** how far each piece rises along its own +y as it grows (flakes lifting off), in the piece's own units: with a
   *  uniform instance scale of s metres, 0.5 means s/2. Use a uniform scale when lift, curl or tilt are on. */
  lift?: number;
  /** edge curl in the piece's own units: the rim (r = 1) rises by `curl` (flakes cupping) */
  curl?: number;
  /** radians of random tilt reached at full growth */
  tilt?: number;
  /** metres the piece drops straight down at full growth (drips) */
  sag?: number;
  /** add the glowing front to the pieces as well */
  glow?: boolean;
  /** pores per metre on the pieces' surface (char foam), 0 = smooth */
  pores?: number;
}

/** shader code for an instanced piece that grows with the burn: it reads the burn bands at its own centre (the
 *  instance origin, in the asset's space), so it shows up exactly where the surface shader puts that zone */
const GROW_VERT = /* glsl */ `
uniform float uGBand; uniform float uGSpread; uniform float uGLift; uniform float uGCurl; uniform float uGTilt; uniform float uGSag;
varying float vGGlow; varying vec3 vGP; varying vec3 vGW;
`;
const GROW_BEGIN = /* glsl */ `
#include <begin_vertex>
{
  vec3 ip = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 hs = b_hash3(ip * 1731.0);
  BB gb = burnBands(ip, uBJitter);
  float zone = uGBand < 0.5 ? gb.heat : (uGBand < 1.5 ? gb.ch : gb.deep);
  float s0 = hs.x * uGSpread;
  float g = smoothstep(s0, s0 + max(1.0 - uGSpread, 0.25), zone);
  vGGlow = gb.glow;
  vGP = ip;
  float r2 = dot(transformed.xz, transformed.xz);
  transformed.y += uGCurl * r2 * g;
  float a = uGTilt * g * (hs.y * 2.0 - 1.0);
  float ca = cos(a), sa = sin(a);
  vec2 ax = normalize(vec2(hs.z - 0.5, 0.37));
  // tilt about a random horizontal axis of the piece
  float along = dot(transformed.xz, ax);
  vec2 across = transformed.xz - ax * along;
  vec2 tp = vec2(along, transformed.y);
  tp = vec2(ca * tp.x - sa * tp.y, sa * tp.x + ca * tp.y);
  transformed = vec3(ax.x * tp.x + across.x, tp.y, ax.y * tp.x + across.y);
  transformed *= g;
  transformed.y += uGLift * g * (0.5 + hs.x);
  if (uGSag > 0.0) transformed += inverse(mat3(instanceMatrix)) * vec3(0.0, -1.0, 0.0) * uGSag * g * g * (0.4 + hs.y);
  vGW = (instanceMatrix * vec4(transformed, 1.0)).xyz;
}
`;

/** patch a material for an InstancedMesh whose pieces (char blobs, ash flakes, droplets) grow in with the burn */
export function growable<M extends THREE.Material>(mat: M, look: BurnLook, shared: BurnShared, o: GrowOpts = {}): M {
  const u = {
    ...burnUniforms(look, shared),
    uGBand: { value: o.band === 'heat' ? 0 : o.band === 'deep' ? 2 : 1 },
    uGSpread: { value: o.spread ?? 0.6 },
    uGLift: { value: o.lift ?? 0 },
    uGCurl: { value: o.curl ?? 0 },
    uGTilt: { value: o.tilt ?? 0 },
    uGSag: { value: o.sag ?? 0 },
    uGPores: { value: o.pores ?? 0 },
  };
  const isDepth = (mat as unknown as THREE.MeshDepthMaterial).isMeshDepthMaterial;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}\n${GROW_VERT}`)
      .replace('#include <begin_vertex>', GROW_BEGIN);
    if (!isDepth && o.glow !== false) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\n${COMMON}\n${FRAG_HEAD.replace('varying vec3 vBP;', '')}\nuniform float uGPores;\nvarying float vGGlow; varying vec3 vGP; varying vec3 vGW;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float gPore = 0.0;
          if (uGPores > 0.0) {
            // pits: one per lattice cell at a random spot, some cells skipped; two sizes
            for (int k = 0; k < 2; k++) {
              vec3 q = vGW * uGPores * (k == 0 ? 1.0 : 2.4) + float(k) * 7.31;
              vec3 hc = b_hash3(floor(q));
              float dd = length(fract(q) - (0.3 + hc * 0.4));
              gPore = max(gPore, step(0.45, hc.z) * smoothstep(0.08 + 0.14 * hc.y, 0.02, dd) * (k == 0 ? 1.0 : 0.7));
            }
            diffuseColor.rgb *= 1.0 - 0.6 * gPore;
            diffuseColor.rgb *= 0.85 + 0.5 * (b_snoise(vGW * uGPores * 0.25) * 0.5 + 0.5);
          }`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          if (uGPores > 0.0) normal = bPerturb(-vViewPosition, normal, -gPore * 0.00025 + b_snoise(vGW * uGPores * 0.6) * 0.00012, faceDirection > 0.0);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += uBGlowColor * 0.35 * vGGlow * uGlow * (0.5 + 0.9 * (b_snoise(vGP * uBNoise * 2.0 + vec3(0.0, uTime * 0.9, 0.0)) * 0.5 + 0.5));`,
        );
    }
  };
  const key = `grow-v1${isDepth ? 'd' : ''}${++cacheId}`;
  mat.customProgramCacheKey = () => key;
  return mat;
}

/** an InstancedMesh of pieces that grow with the burn (see growable); shadows use the same growth */
export function growMesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  look: BurnLook,
  shared: BurnShared,
  o: GrowOpts,
  matrices: THREE.Matrix4[],
  /** random brightness per piece, [min, max] multiplier on the material colour */
  tint?: [number, number],
) {
  const m = new THREE.InstancedMesh(geo, growable(mat, look, shared, o), matrices.length);
  matrices.forEach((M, i) => m.setMatrixAt(i, M));
  if (tint) {
    const c = new THREE.Color();
    let s = 12345;
    matrices.forEach((_, i) => {
      s = (s * 1664525 + 1013904223) >>> 0;
      const k = tint[0] + (tint[1] - tint[0]) * (s / 4294967296);
      m.setColorAt(i, c.setScalar(k));
    });
  }
  m.customDepthMaterial = growable(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), look, shared, o);
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false; // pieces start at zero size, so the bounding sphere would be wrong
  return m;
}

/** a normal per position, averaged over hard edges, so displacement never splits the mesh */
export function addDispNormals(geo: THREE.BufferGeometry, q = 1e-5): THREE.BufferGeometry {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const sums = new Map<string, THREE.Vector3>();
  const keys: string[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) / q)},${Math.round(pos.getY(i) / q)},${Math.round(pos.getZ(i) / q)}`;
    keys.push(k);
    v.fromBufferAttribute(nor, i);
    const s = sums.get(k);
    if (s) s.add(v);
    else sums.set(k, v.clone());
  }
  const out = new Float32Array(pos.count * 3);
  keys.forEach((k, i) => {
    const s = sums.get(k)!;
    const l = s.length() || 1;
    out[i * 3] = s.x / l;
    out[i * 3 + 1] = s.y / l;
    out[i * 3 + 2] = s.z / l;
  });
  geo.setAttribute('bNormal', new THREE.BufferAttribute(out, 3));
  return geo;
}

/** Soft glowing near-spherical microgravity flame shader with no hard ring or dark core. */
export function sphericalFlame(shared: BurnShared) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: shared.uTime, uGlow: shared.uGlow },
    vertexShader: /* glsl */ `
      varying vec2 flameUv;
      void main() {
        flameUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      varying vec2 flameUv;
      uniform float uTime;
      uniform float uGlow;
      void main() {
        vec2 p = flameUv * 1.45;
        float r = length(p);
        if (r > 1.44) discard;
        float shimmer = b_snoise(vec3(p * 2.4, uTime * 0.35));
        float rr = max(0.0, r + shimmer * 0.045);
        float innerCore = exp(-rr * rr * 5.2) * 0.72;
        float midWarm = exp(-pow(rr - 0.32, 2.0) * 6.5) * 0.34;
        float blueShell = exp(-pow(rr - 0.68, 2.0) * 14.0) * 0.42;
        float blueHalo = exp(-rr * rr * 2.1) * 0.14;
        float fade = 1.0 - smoothstep(0.95, 1.42, r);
        vec3 light = vec3(0.20, 0.56, 1.0) * (blueShell + blueHalo)
          + vec3(1.0, 0.52, 0.14) * midWarm
          + vec3(1.0, 0.80, 0.42) * innerCore;
        float alpha = clamp((innerCore + midWarm + blueShell + blueHalo) * fade * uGlow, 0.0, 1.0);
        gl_FragColor = vec4(light, alpha);
        #include <colorspace_fragment>
      }
    `,
  })
}
