import * as THREE from 'three';
import { createNoise2D, fbm, ridged } from './noise';
import { clamp, lerp, smoothstep } from '../lib/math';

export interface Plateau {
  x: number;
  z: number;
  r: number;
  falloff: number;
  /** Absolute plateau height; defaults to the natural terrain height at the centre. */
  height?: number;
  /** Ground colour inside the plateau. */
  tint?: 'court' | 'dirt' | 'obsidian';
}

export interface TerrainSpec {
  size: number;
  segments: number;
  seed: number;
  amplitude: number;
  mountainRing?: { r0: number; r1: number; height: number };
  bumps?: { x: number; z: number; r: number; h: number }[];
  plateaus?: Plateau[];
  scorch?: { x: number; z: number; r: number }[];
  roads?: { ax: number; az: number; bx: number; bz: number; w: number }[];
  /** 0 = lush, 1 = ashen/dead land. */
  ash?: number;
}

const C = (hex: string) => new THREE.Color(hex);
const PAL = {
  grassA: C('#4f6e2c'),
  grassB: C('#7b8444'),
  grassC: C('#35521f'),
  ashA: C('#3d3a31'),
  ashB: C('#4c4638'),
  dirt: C('#6b563b'),
  rock: C('#6a655e'),
  rockDark: C('#4a4541'),
  snow: C('#dfe4ea'),
  scorch: C('#1f1a17'),
  ember: C('#6a2210'),
  road: C('#7a6445'),
  court: C('#8d826f'),
  obsidian: C('#17151a'),
};

export class Terrain {
  readonly size: number;
  readonly half: number;
  readonly seg: number;
  readonly cell: number;
  readonly heights: Float32Array;
  readonly spec: TerrainSpec;
  private raw: (x: number, z: number) => number;

  constructor(spec: TerrainSpec) {
    this.spec = spec;
    this.size = spec.size;
    this.half = spec.size / 2;
    this.seg = spec.segments;
    this.cell = spec.size / spec.segments;

    const n1 = createNoise2D(spec.seed);
    const n2 = createNoise2D(spec.seed * 7 + 3);
    const n3 = createNoise2D(spec.seed * 13 + 11);
    const amp = spec.amplitude;
    const ring = spec.mountainRing;
    const bumps = spec.bumps ?? [];

    const base = (x: number, z: number) => {
      let h = fbm(n1, x / 520, z / 520, 5) * amp;
      h += (ridged(n2, x / 230, z / 230, 4) - 0.35) * amp * 0.45;
      h += fbm(n3, x / 48, z / 48, 3) * 1.4;
      for (const b of bumps) {
        const d = Math.hypot(x - b.x, z - b.z) / b.r;
        if (d < 1.6) h += b.h * Math.exp(-d * d * 2.2);
      }
      if (ring) {
        const d = Math.hypot(x, z);
        const m = smoothstep(ring.r0, ring.r1, d);
        if (m > 0) h += m * ring.height * (0.62 + 0.3 * fbm(n1, x / 420 + 17, z / 420 - 5, 4) + 0.22 * ridged(n2, x / 520, z / 520, 3));
      }
      return h;
    };

    const plateaus = (spec.plateaus ?? []).map((p) => ({ ...p, height: p.height ?? base(p.x, p.z) }));
    this.raw = (x, z) => {
      let h = base(x, z);
      for (const p of plateaus) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < p.r + p.falloff) {
          const w = 1 - smoothstep(p.r, p.r + p.falloff, d);
          h = lerp(h, p.height!, w);
        }
      }
      return h;
    };
    this.spec.plateaus = plateaus;

    const n = this.seg + 1;
    this.heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        this.heights[j * n + i] = this.raw(-this.half + i * this.cell, -this.half + j * this.cell);
      }
    }
  }

  /** Exact height of the rendered triangle mesh at (x, z). */
  heightAt(x: number, z: number) {
    const fx = (x + this.half) / this.cell;
    const fz = (z + this.half) / this.cell;
    const i = clamp(Math.floor(fx), 0, this.seg - 1);
    const j = clamp(Math.floor(fz), 0, this.seg - 1);
    const u = clamp(fx - i, 0, 1);
    const v = clamp(fz - j, 0, 1);
    const n = this.seg + 1;
    const ha = this.heights[j * n + i];
    const hb = this.heights[j * n + i + 1];
    const hc = this.heights[(j + 1) * n + i];
    const hd = this.heights[(j + 1) * n + i + 1];
    if (u + v <= 1) return ha + (hb - ha) * u + (hc - ha) * v;
    return hd + (hc - hd) * (1 - u) + (hb - hd) * (1 - v);
  }

  normalAt(x: number, z: number, out = new THREE.Vector3()) {
    const e = this.cell * 0.5;
    const hl = this.heightAt(x - e, z);
    const hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e);
    const hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  plateauAt(x: number, z: number) {
    for (const p of this.spec.plateaus ?? []) {
      if (Math.hypot(x - p.x, z - p.z) < p.r) return p;
    }
    return null;
  }

  buildGeometry() {
    const n = this.seg + 1;
    const pos = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    const noise = createNoise2D(this.spec.seed + 99);
    const nrm = new THREE.Vector3();
    const tmp = new THREE.Color();
    const ash = this.spec.ash ?? 0;
    const scorch = this.spec.scorch ?? [];
    const roads = this.spec.roads ?? [];
    const plateaus = this.spec.plateaus ?? [];
    const ringR = this.spec.mountainRing?.r0 ?? Infinity;

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = -this.half + i * this.cell;
        const z = -this.half + j * this.cell;
        const h = this.heights[k];
        pos[k * 3] = x;
        pos[k * 3 + 1] = h;
        pos[k * 3 + 2] = z;
        uv[k * 2] = x / 10;
        uv[k * 2 + 1] = z / 10;

        this.normalAt(x, z, nrm);
        const slope = 1 - nrm.y;
        const nA = fbm(noise, x / 90, z / 90, 3);
        const nB = noise(x / 14, z / 14);

        // grass blend
        tmp.copy(PAL.grassA).lerp(PAL.grassB, clamp(nA * 0.8 + 0.45));
        tmp.lerp(PAL.grassC, clamp(nB * 0.5 + 0.2) * 0.5);
        if (ash > 0) {
          const ashCol = PAL.ashA.clone().lerp(PAL.ashB, clamp(nA + 0.5));
          tmp.lerp(ashCol, ash);
        }
        // dirt patches
        tmp.lerp(PAL.dirt, smoothstep(0.35, 0.6, nB * 0.6 + nA * 0.5) * 0.55);
        // rock on slopes
        const rockW = smoothstep(0.18, 0.42, slope + nB * 0.05);
        tmp.lerp(nA > 0 ? PAL.rock : PAL.rockDark, rockW);
        // snow high up on the mountain ring
        const dC = Math.hypot(x, z);
        if (dC > ringR) tmp.lerp(PAL.snow, smoothstep(95, 140, h + nB * 10) * (1 - rockW * 0.6));
        // roads
        for (const r of roads) {
          const d = distToSegment(x, z, r.ax, r.az, r.bx, r.bz);
          if (d < r.w * 1.8) tmp.lerp(PAL.road, (1 - smoothstep(r.w * 0.6, r.w * 1.8, d + nB * 1.2)) * 0.85);
        }
        // plateau courts
        for (const p of plateaus) {
          const d = Math.hypot(x - p.x, z - p.z);
          if (d < p.r + 6) {
            const w = 1 - smoothstep(p.r * 0.8, p.r + 6, d + nB * 4);
            const c = p.tint === 'obsidian' ? PAL.obsidian : p.tint === 'dirt' ? PAL.dirt : PAL.court;
            tmp.lerp(c, w * 0.85);
          }
        }
        // scorched earth around enemy strongholds
        for (const s of scorch) {
          const d = Math.hypot(x - s.x, z - s.z);
          if (d < s.r * 1.3) {
            const w = 1 - smoothstep(s.r * 0.55, s.r * 1.3, d + nA * 25);
            tmp.lerp(PAL.scorch, w * 0.85);
            if (nB > 0.55) tmp.lerp(PAL.ember, w * 0.6);
          }
        }
        const shade = 0.9 + nB * 0.08;
        col[k * 3] = tmp.r * shade;
        col[k * 3 + 1] = tmp.g * shade;
        col[k * 3 + 2] = tmp.b * shade;
      }
    }

    const idx = new Uint32Array(this.seg * this.seg * 6);
    let p = 0;
    for (let j = 0; j < this.seg; j++) {
      for (let i = 0; i < this.seg; i++) {
        const a = j * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
}

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

let detailTex: THREE.CanvasTexture | null = null;
/** Tiling grayscale micro-detail texture that modulates the terrain vertex colours. */
export function terrainDetailTexture() {
  if (detailTex) return detailTex;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const img = g.createImageData(s, s);
  const n = createNoise2D(4242);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // tileable noise via torus mapping
      const a = (x / s) * Math.PI * 2;
      const b = (y / s) * Math.PI * 2;
      const v =
        n(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + Math.cos(b) * 3) * 0.5 +
        n(Math.cos(a) * 11, Math.sin(b) * 11 + Math.sin(a) * 5) * 0.3 +
        (Math.random() - 0.5) * 0.35;
      const val = Math.round(clamp(0.86 + v * 0.14) * 255);
      const o = (y * s + x) * 4;
      img.data[o] = val;
      img.data[o + 1] = val;
      img.data[o + 2] = val;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  detailTex = new THREE.CanvasTexture(c);
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
  // Linear data: a gentle multiplier around 0.86, not a colour.
  detailTex.colorSpace = THREE.NoColorSpace;
  detailTex.anisotropy = 8;
  return detailTex;
}

export function createTerrainMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.97,
    metalness: 0,
    map: terrainDetailTexture(),
  });
}
