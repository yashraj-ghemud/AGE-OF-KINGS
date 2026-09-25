import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp } from '../lib/math';

/** Gameplay contract for every castle. All coordinates are castle-local; +z is the gate side. */
export const CASTLE = {
  HALF: 40,
  WALL_H: 9,
  WALL_T: 2.4,
  GATE_HALF: 9,
  KEEP_HALF: 7.5,
  KEEP_H: 15,
  STAIR_HALF: 2.2,
  STAIR_Z0: 7.5,
  STAIR_Z1: 27.5,
  /** Radius of the outer boundary where units can start interacting with the castle. */
  FOOTPRINT: 58,
};

export type CastleKind = 'royal' | 'traitor' | 'obsidian' | 'court';

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number;
}

const { HALF, WALL_H, WALL_T, GATE_HALF, KEEP_HALF, KEEP_H, STAIR_HALF, STAIR_Z0, STAIR_Z1 } = CASTLE;
const GT = GATE_HALF + 7; // gatehouse outer x

const aabb = (cx: number, cz: number, w: number, d: number, h: number): Collider => ({
  minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h,
});

export const HOUSES: [number, number, number, number][] = [
  // x, z, width(x), depth(z)
  [-27, -24, 9, 11],
  [27, -24, 9, 11],
  [-27, 2, 9, 11],
  [27, 2, 9, 11],
];

export const COLLIDERS: Collider[] = [
  aabb(0, -HALF, HALF * 2 + WALL_T, WALL_T, WALL_H), // back wall
  aabb(-HALF, 0, WALL_T, HALF * 2 + WALL_T, WALL_H), // left wall
  aabb(HALF, 0, WALL_T, HALF * 2 + WALL_T, WALL_H), // right wall
  aabb(-(HALF + GT) / 2, HALF, HALF - GT, WALL_T, WALL_H), // front-left
  aabb((HALF + GT) / 2, HALF, HALF - GT, WALL_T, WALL_H), // front-right
  aabb(-(GATE_HALF + 3.5), HALF, 7, 8, 15), // gate towers
  aabb(GATE_HALF + 3.5, HALF, 7, 8, 15),
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => aabb(sx * HALF, sz * HALF, 8.4, 8.4, 17)),
  aabb(-HALF, 0, 6.4, 6.4, 14),
  aabb(HALF, 0, 6.4, 6.4, 14),
  aabb(0, -HALF, 6.4, 6.4, 14),
  ...HOUSES.map(([x, z, w, d]) => aabb(x, z, w, d, 6)),
];

/** Floor height (above castle base) of the stairs at local z. */
export const stairHeight = (z: number) => KEEP_H * clamp((STAIR_Z1 - z) / (STAIR_Z1 - STAIR_Z0));

export interface Resolved {
  x: number;
  z: number;
  floor: number;
}

/**
 * Resolve an entity against castle geometry. Input is castle-local (x,z) and height above
 * the castle base. Returns the pushed-out position and the floor height to stand on.
 */
export function castleResolve(x: number, z: number, y: number, r: number, out: Resolved): Resolved {
  let floor = 0;
  if (Math.abs(x) > HALF + 12 || Math.abs(z) > HALF + 12) {
    out.x = x;
    out.z = z;
    out.floor = 0;
    return out;
  }
  for (const c of COLLIDERS) {
    if (y > c.h - 0.4) continue;
    const minX = c.minX - r;
    const maxX = c.maxX + r;
    const minZ = c.minZ - r;
    const maxZ = c.maxZ + r;
    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      const pl = x - minX;
      const pr = maxX - x;
      const pb = z - minZ;
      const pf = maxZ - z;
      const m = Math.min(pl, pr, pb, pf);
      if (m === pl) x = minX;
      else if (m === pr) x = maxX;
      else if (m === pb) z = minZ;
      else z = maxZ;
    }
  }

  // stairs: walkable ramp from the gate side up to the keep roof
  if (Math.abs(x) < STAIR_HALF + r * 0.5 && z > STAIR_Z0 - 0.2 && z < STAIR_Z1 + 0.5) {
    const sh = stairHeight(z);
    if (y > sh - 1.3) floor = Math.max(floor, sh);
    else x = x < 0 ? -(STAIR_HALF + r) : STAIR_HALF + r;
  }

  // keep: solid block with a walkable roof
  const onTop = y >= KEEP_H - 1.5;
  const inKeep = Math.abs(x) < KEEP_HALF + r && Math.abs(z) < KEEP_HALF + r;
  if (onTop) {
    const nearKeep = Math.abs(x) < KEEP_HALF + 2.5 && Math.abs(z) < KEEP_HALF + 2.5;
    const overStairs = Math.abs(x) < STAIR_HALF && z > 0;
    if (nearKeep && !overStairs) {
      x = clamp(x, -KEEP_HALF + 0.6, KEEP_HALF - 0.6);
      z = clamp(z, -KEEP_HALF + 0.6, KEEP_HALF - 0.6);
    }
    if (Math.abs(x) <= KEEP_HALF && Math.abs(z) <= KEEP_HALF) floor = Math.max(floor, KEEP_H);
  } else if (inKeep) {
    const pl = x + KEEP_HALF + r;
    const pr = KEEP_HALF + r - x;
    const pb = z + KEEP_HALF + r;
    const pf = KEEP_HALF + r - z;
    const m = Math.min(pl, pr, pb, pf);
    if (m === pl) x = -KEEP_HALF - r;
    else if (m === pr) x = KEEP_HALF + r;
    else if (m === pb) z = -KEEP_HALF - r;
    else z = KEEP_HALF + r;
  }

  out.x = x;
  out.z = z;
  out.floor = floor;
  return out;
}

const inside = (x: number, z: number) => Math.abs(x) < HALF && Math.abs(z) < HALF;
const OUT = HALF + 13;

function segHitsSquare(ax: number, az: number, bx: number, bz: number, h: number) {
  // Liang–Barsky against [-h,h]²
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const p = [-dx, dx, -dz, dz];
  const q = [ax + h, h - ax, az + h, h - az];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/**
 * Navigation waypoint (castle-local) for moving from `a` to `b` around/through a castle,
 * or null if the straight line is fine. Heights are above the castle base.
 */
export function castleWaypoint(
  ax: number, az: number, ay: number, bx: number, bz: number, by: number, out: THREE.Vector3,
): THREE.Vector3 | null {
  const aTop = ay >= KEEP_H - 1.5;
  const bTop = by >= KEEP_H - 1.5 && Math.abs(bx) < KEEP_HALF + 1 && Math.abs(bz) < KEEP_HALF + 1;
  const aOnStairs = Math.abs(ax) < STAIR_HALF + 0.5 && az > STAIR_Z0 - 0.5 && az < STAIR_Z1 + 1 && ay > 0.6;

  if (aTop && !bTop) {
    if (Math.abs(ax) < STAIR_HALF && az > KEEP_HALF - 1) return out.set(0, 0, STAIR_Z1 + 3);
    return out.set(0, KEEP_H, KEEP_HALF + 0.5);
  }
  if (aOnStairs && !bTop) return out.set(0, 0, STAIR_Z1 + 3);
  if (bTop && !aTop) {
    if (aOnStairs) return out.set(0, KEEP_H, 0);
    if (inside(ax, az)) {
      if (Math.abs(ax) < 6 && az > STAIR_Z1 - 1) return out.set(0, 0, STAIR_Z1 - 1);
      return out.set(0, 0, STAIR_Z1 + 2.5);
    }
  }

  const aIn = inside(ax, az);
  const bIn = inside(bx, bz) || bTop;
  if (aIn && !bIn) {
    if (az < HALF - 12 || Math.abs(ax) > GATE_HALF - 1.5) return out.set(clamp(ax, -4, 4), 0, HALF - 8);
    return out.set(ax * 0.5, 0, OUT);
  }
  if (!aIn && bIn) {
    if (az > HALF - 3 && Math.abs(ax) < GATE_HALF - 1.5) return out.set(ax * 0.4, 0, HALF - 10);
    if (az > HALF + 4) return out.set(0, 0, OUT);
    if (Math.abs(ax) > HALF + 3) return out.set(Math.sign(ax) * OUT, 0, OUT);
    return out.set(ax >= 0 ? OUT : -OUT, 0, -OUT);
  }
  if (!aIn && !bIn && segHitsSquare(ax, az, bx, bz, HALF + 4)) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const [cx, cz] of [[OUT, OUT], [-OUT, OUT], [OUT, -OUT], [-OUT, -OUT]]) {
      if (segHitsSquare(ax, az, cx, cz, HALF + 3)) continue;
      const d = Math.hypot(cx - ax, cz - az) + Math.hypot(bx - cx, bz - cz);
      if (d < bestD) {
        bestD = d;
        best = [cx, cz];
      }
    }
    if (best) return out.set(best[0], 0, best[1]);
  }
  return null;
}

// ───────────────────────────── geometry ─────────────────────────────

type G = THREE.BufferGeometry;

function place(g: G, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) =>
  place(new THREE.BoxGeometry(w, h, d), x, y, z, ry);
const cyl = (rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number) =>
  place(new THREE.CylinderGeometry(rt, rb, h, seg, 1), x, y, z);
const cone = (r: number, h: number, seg: number, x: number, y: number, z: number) =>
  place(new THREE.ConeGeometry(r, h, seg, 1), x, y, z);

/** World-aligned planar UVs so stone texture tiles continuously across merged pieces. */
function projectUV(g: G, tile: number) {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    const nz = Math.abs(nrm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ny >= nx && ny >= nz) uv.setXY(i, x / tile, z / tile);
    else if (nx >= nz) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  uv.needsUpdate = true;
  return g;
}

function merge(parts: G[], tile = 4) {
  const prepared = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    return projectUV(g, tile);
  });
  const m = mergeGeometries(prepared, false)!;
  m.computeBoundingSphere();
  return m;
}

function merlonsAlong(parts: G[], x0: number, z0: number, x1: number, z1: number, y: number, outward: [number, number]) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.floor(len / 2.6);
  const ry = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0.5 : i / n;
    const x = x0 + (x1 - x0) * t + outward[0] * (WALL_T * 0.3);
    const z = z0 + (z1 - z0) * t + outward[1] * (WALL_T * 0.3);
    parts.push(box(0.9, 1.4, 1.4, x, y + 0.7, z, ry));
  }
}

function roundTower(stone: G[], trim: G[], roofs: G[], x: number, z: number, r: number, h: number, roofH: number) {
  stone.push(cyl(r, r * 1.08, h, 14, x, h / 2, z));
  trim.push(cyl(r * 1.15, r * 1.15, 1.2, 14, x, h + 0.6, z));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    trim.push(box(1.1, 1.3, 0.8, x + Math.cos(a) * r * 1.08, h + 1.8, z + Math.sin(a) * r * 1.08, -a + Math.PI / 2));
  }
  if (roofH > 0) roofs.push(cone(r * 1.3, roofH, 14, x, h + 1.2 + roofH / 2, z));
}

export interface CastleGeometry {
  stone: G;
  trim: G;
  roof: G;
  wood: G;
  metal: G;
  gold: G;
  glow: G;
  banners: G;
  /** Local positions of burning braziers (for fire particles). */
  fires: THREE.Vector3[];
  /** Local positions of banner tips (for cloth sim / accents). */
}

export function buildCastleGeometry(kind: CastleKind): CastleGeometry {
  const stone: G[] = [];
  const trim: G[] = [];
  const roofs: G[] = [];
  const wood: G[] = [];
  const metal: G[] = [];
  const gold: G[] = [];
  const glow: G[] = [];
  const banners: G[] = [];
  const fires: THREE.Vector3[] = [];
  const court = kind === 'court';
  const dark = kind === 'traitor' || kind === 'obsidian';

  // ── curtain walls
  const wy = WALL_H / 2;
  stone.push(box(HALF * 2, WALL_H, WALL_T, 0, wy, -HALF));
  stone.push(box(WALL_T, WALL_H, HALF * 2, -HALF, wy, 0));
  stone.push(box(WALL_T, WALL_H, HALF * 2, HALF, wy, 0));
  stone.push(box(HALF - GT, WALL_H, WALL_T, -(HALF + GT) / 2, wy, HALF));
  stone.push(box(HALF - GT, WALL_H, WALL_T, (HALF + GT) / 2, wy, HALF));
  // wall-walk ledge
  trim.push(box(HALF * 2, 0.6, WALL_T + 0.8, 0, WALL_H, -HALF));
  trim.push(box(WALL_T + 0.8, 0.6, HALF * 2, -HALF, WALL_H, 0));
  trim.push(box(WALL_T + 0.8, 0.6, HALF * 2, HALF, WALL_H, 0));
  trim.push(box(HALF - GT, 0.6, WALL_T + 0.8, -(HALF + GT) / 2, WALL_H, HALF));
  trim.push(box(HALF - GT, 0.6, WALL_T + 0.8, (HALF + GT) / 2, WALL_H, HALF));
  merlonsAlong(trim, -HALF + 4, -HALF, HALF - 4, -HALF, WALL_H + 0.3, [0, -1]);
  merlonsAlong(trim, -HALF, -HALF + 4, -HALF, HALF - 4, WALL_H + 0.3, [-1, 0]);
  merlonsAlong(trim, HALF, -HALF + 4, HALF, HALF - 4, WALL_H + 0.3, [1, 0]);
  merlonsAlong(trim, -HALF + 4, HALF, -GT - 1, HALF, WALL_H + 0.3, [0, 1]);
  merlonsAlong(trim, GT + 1, HALF, HALF - 4, HALF, WALL_H + 0.3, [0, 1]);
  // buttresses
  for (const s of [-1, 1]) {
    for (const t of [-20, 20]) {
      stone.push(box(1.6, WALL_H * 0.7, 2.2, s * (HALF + 1.4), WALL_H * 0.35, t));
      stone.push(box(2.2, WALL_H * 0.7, 1.6, t, WALL_H * 0.35, -HALF - 1.4));
    }
  }

  // ── towers
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) roundTower(stone, trim, roofs, sx * HALF, sz * HALF, 4.2, 16, dark ? 7 : 9);
  roundTower(stone, trim, roofs, -HALF, 0, 3.2, 13, dark ? 5 : 7);
  roundTower(stone, trim, roofs, HALF, 0, 3.2, 13, dark ? 5 : 7);
  roundTower(stone, trim, roofs, 0, -HALF, 3.2, 13, dark ? 5 : 7);

  // ── gatehouse
  for (const s of [-1, 1]) {
    const gx = s * (GATE_HALF + 3.5);
    stone.push(box(7, 15, 8, gx, 7.5, HALF));
    trim.push(box(7.8, 0.8, 8.8, gx, 15.2, HALF));
    for (let i = 0; i < 3; i++) trim.push(box(1.2, 1.4, 1.2, gx - 2.6 + i * 2.6, 16.2, HALF + 4));
    roofs.push(place(new THREE.ConeGeometry(5.6, 6, 4, 1), gx, 18.8, HALF, Math.PI / 4));
    // arrow slits
    for (const yy of [5, 10]) metal.push(box(0.5, 1.8, 0.2, gx, yy, HALF + 4.05));
  }
  stone.push(box(GATE_HALF * 2, 5, 6, 0, 12.5, HALF)); // lintel over the gate
  trim.push(box(GATE_HALF * 2 + 1, 0.8, 6.8, 0, 15.2, HALF));
  // portcullis (raised)
  for (let i = -GATE_HALF + 1; i <= GATE_HALF - 1; i += 1.4) metal.push(box(0.18, 3.2, 0.18, i, 10.4, HALF + 1.2));
  metal.push(box(GATE_HALF * 2 - 1, 0.25, 0.25, 0, 9, HALF + 1.2));
  // open gate doors
  for (const s of [-1, 1]) wood.push(box(0.5, 9.6, GATE_HALF - 0.5, s * (GATE_HALF - 0.4), 4.8, HALF - GATE_HALF / 2 - 1.5));

  // ── keep
  stone.push(box(KEEP_HALF * 2, KEEP_H, KEEP_HALF * 2, 0, KEEP_H / 2, 0));
  trim.push(box(KEEP_HALF * 2 + 1, 0.8, KEEP_HALF * 2 + 1, 0, KEEP_H - 0.2, 0));
  // parapet merlons with a gap for the stairs
  for (let i = -3; i <= 3; i++) {
    const t = i * 2.1;
    if (Math.abs(t) > STAIR_HALF + 0.4) trim.push(box(1.1, 1.3, 0.9, t, KEEP_H + 0.85, KEEP_HALF + 0.1));
    trim.push(box(1.1, 1.3, 0.9, t, KEEP_H + 0.85, -KEEP_HALF - 0.1));
    trim.push(box(0.9, 1.3, 1.1, KEEP_HALF + 0.1, KEEP_H + 0.85, t));
    trim.push(box(0.9, 1.3, 1.1, -KEEP_HALF - 0.1, KEEP_H + 0.85, t));
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    roundTower(stone, trim, roofs, sx * (KEEP_HALF + 0.8), sz * (KEEP_HALF + 0.8), 2.3, 21, dark ? 5 : 7);
  }
  // keep windows (glowing)
  for (const s of [-1, 1]) {
    for (const yy of [6, 11]) {
      glow.push(box(0.9, 1.8, 0.1, s * 3.5, yy, KEEP_HALF + 0.06));
      glow.push(box(0.9, 1.8, 0.1, s * 3.5, yy, -KEEP_HALF - 0.06));
      glow.push(box(0.1, 1.8, 0.9, KEEP_HALF + 0.06, yy, s * 3.5));
      glow.push(box(0.1, 1.8, 0.9, -KEEP_HALF - 0.06, yy, s * 3.5));
    }
  }
  wood.push(box(3.4, 5, 0.3, 0, 2.5, KEEP_HALF + 0.1)); // keep door
  // flagpole on the rear-left turret
  wood.push(cyl(0.12, 0.12, 9, 6, -(KEEP_HALF + 0.8), 21 + 7 + 4.5, -(KEEP_HALF + 0.8)));

  // ── stairs up to the keep roof
  if (!court) {
    const steps = 30;
    const run = (STAIR_Z1 - STAIR_Z0) / steps;
    for (let k = 0; k < steps; k++) {
      const top = (k + 1) * (KEEP_H / steps);
      const zc = STAIR_Z1 - (k + 0.5) * run;
      stone.push(box(STAIR_HALF * 2, top, run + 0.02, 0, top / 2, zc));
    }
    trim.push(box(0.4, 1, STAIR_Z1 - STAIR_Z0, STAIR_HALF + 0.2, 0, (STAIR_Z0 + STAIR_Z1) / 2));
  }

  // ── houses
  for (const [x, z, w, d] of HOUSES) {
    stone.push(box(w, 6, d, x, 3, z));
    const rw = w * 0.74;
    roofs.push(place(new THREE.BoxGeometry(rw, rw, d + 0.8), x, 6, z, 0, 0, Math.PI / 4));
    wood.push(box(0.2, 3, 1.6, x + (x < 0 ? w / 2 + 0.1 : -w / 2 - 0.1), 1.5, z));
    glow.push(box(0.1, 1, 1, x + (x < 0 ? w / 2 + 0.06 : -w / 2 - 0.06), 3.6, z + 3));
  }

  // ── braziers
  const brazier = (x: number, z: number, y = 0) => {
    metal.push(cyl(0.9, 0.5, 0.7, 10, x, y + 1.6, z));
    metal.push(cyl(0.12, 0.2, 1.4, 6, x, y + 0.7, z));
    glow.push(cyl(0.75, 0.75, 0.15, 10, x, y + 1.95, z));
    fires.push(new THREE.Vector3(x, y + 2, z));
  };
  brazier(-(GATE_HALF + 1.5), HALF + 7);
  brazier(GATE_HALF + 1.5, HALF + 7);
  brazier(-5, 12);
  brazier(5, 12);

  // ── the Sun Court (intro variant): altar and a ring of pillars in front of the keep
  if (court) {
    stone.push(cyl(3.2, 3.6, 0.6, 24, 0, 0.3, 20));
    stone.push(cyl(2.3, 2.6, 0.6, 24, 0, 0.9, 20));
    stone.push(cyl(1.1, 1.4, 1.6, 16, 0, 2, 20));
    gold.push(cyl(1.25, 1.25, 0.2, 16, 0, 2.85, 20));
    gold.push(place(new THREE.TorusGeometry(2.45, 0.08, 6, 48), 0, 1.22, 20, 0, Math.PI / 2));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = Math.cos(a) * 10;
      const pz = 20 + Math.sin(a) * 10;
      stone.push(cyl(0.55, 0.65, 8, 12, px, 4, pz));
      trim.push(box(1.7, 0.5, 1.7, px, 8.2, pz));
      trim.push(box(1.6, 0.4, 1.6, px, 0.2, pz));
      if (i % 2 === 0) brazier(px * 0.72, 20 + (pz - 20) * 0.72);
    }
    // radial floor inlay
    gold.push(place(new THREE.RingGeometry(12.8, 13.2, 64), 0, 0.05, 20, 0, -Math.PI / 2));
    gold.push(place(new THREE.RingGeometry(5.8, 6, 48), 0, 0.05, 20, 0, -Math.PI / 2));
  }

  // ── stakes for traitor/obsidian strongholds
  if (dark) {
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (GATE_HALF + 8 + (i >> 1) * 1.6);
      const z = HALF + 6 + Math.sin(i * 2.3) * 1.5;
      const g = new THREE.ConeGeometry(0.22, 3.4, 5);
      wood.push(place(g, x, 1.2, z, 0, 0.5));
    }
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      const x = Math.cos(a) * 22;
      const z = -14 + Math.sin(a) * 10;
      wood.push(cyl(0.12, 0.12, 5, 5, x, 2.5, z));
      metal.push(box(1.2, 0.08, 0.08, x, 4.4, z));
    }
  }

  // ── banners
  const banner = (x: number, y: number, z: number, w: number, h: number, ry: number) => {
    const g = new THREE.PlaneGeometry(w, h, 6, 12);
    const wave = new Float32Array(g.getAttribute('position').count);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) wave[i] = (h / 2 - pos.getY(i)) / h; // 0 at the top
    g.setAttribute('aWave', new THREE.BufferAttribute(wave, 1));
    g.rotateY(ry);
    g.translate(x, y - h / 2, z);
    banners.push(g);
  };
  for (const s of [-1, 1]) {
    banner(s * (GATE_HALF + 3.5), 14.5, HALF + 4.1, 3.6, 9, 0);
    banner(s * (HALF + 4.35), 15, s * 0 + 18, 2.8, 8, s * Math.PI / 2);
    banner(s * (HALF + 4.35), 15, -18, 2.8, 8, s * Math.PI / 2);
    banner(s * 14, 13, -HALF - 1.3, 2.8, 8, Math.PI);
    banner(s * 3.6, 14.4, KEEP_HALF + 0.12, 2.2, 6.5, 0);
  }
  // flag on the pole
  {
    const g = new THREE.PlaneGeometry(4.5, 2.8, 10, 5);
    const pos = g.getAttribute('position');
    const wave = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) wave[i] = (pos.getX(i) + 2.25) / 4.5;
    g.setAttribute('aWave', new THREE.BufferAttribute(wave, 1));
    g.translate(2.25 - (KEEP_HALF + 0.8), 21 + 7 + 8, -(KEEP_HALF + 0.8));
    banners.push(g);
  }

  const bannerGeo = mergeGeometries(banners.map((b) => (b.index ? b.toNonIndexed() : b)), false)!;
  bannerGeo.computeBoundingSphere();

  return {
    stone: merge(stone),
    trim: merge(trim),
    roof: merge(roofs, 3),
    wood: merge(wood, 2),
    metal: merge(metal, 2),
    gold: gold.length ? merge(gold, 2) : new THREE.BufferGeometry(),
    glow: merge(glow, 2),
    banners: bannerGeo,
    fires,
  };
}
