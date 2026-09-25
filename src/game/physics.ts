import * as THREE from 'three';
import { castleResolve, castleWaypoint, CASTLE, type Resolved } from '../world/fortress';
import type { Camp, Unit, World } from './types';

// ───────────────────────── spatial hash ─────────────────────────

const CELL = 8;
const HALF = 1400;
const DIM = Math.ceil((HALF * 2) / CELL);
const head = new Int32Array(DIM * DIM);
let next = new Int32Array(4096);
let list: Unit[] = [];

const cellOf = (v: number) => Math.max(0, Math.min(DIM - 1, Math.floor((v + HALF) / CELL)));

export function rebuildHash(units: Unit[]) {
  head.fill(-1);
  if (next.length < units.length) next = new Int32Array(units.length * 2);
  list = units;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive) continue;
    const k = cellOf(u.x) * DIM + cellOf(u.z);
    next[i] = head[k];
    head[k] = i;
  }
}

/** Calls fn for each living unit within radius r of (x,z). Return true from fn to stop. */
export function queryRadius(x: number, z: number, r: number, fn: (u: Unit, d2: number) => boolean | void) {
  const r2 = r * r;
  const x0 = cellOf(x - r);
  const x1 = cellOf(x + r);
  const z0 = cellOf(z - r);
  const z1 = cellOf(z + r);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      let i = head[cx * DIM + cz];
      while (i !== -1) {
        const u = list[i];
        const dx = u.x - x;
        const dz = u.z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 <= r2 && fn(u, d2)) return;
        i = next[i];
      }
    }
  }
}

/** Nearest living unit of `team` within r satisfying the filter. */
export function nearest(x: number, z: number, r: number, team: 0 | 1, filter?: (u: Unit) => boolean) {
  let best: Unit | null = null;
  let bd = Infinity;
  queryRadius(x, z, r, (u, d2) => {
    if (u.team !== team || u.morale === 'kneel' || u.morale === 'flee' || u.morale === 'ash') return;
    if (filter && !filter(u)) return;
    if (d2 < bd) {
      bd = d2;
      best = u;
    }
  });
  return best as Unit | null;
}

// ───────────────────────── castles ─────────────────────────

const res: Resolved = { x: 0, z: 0, floor: 0 };
const wp = new THREE.Vector3();

export function toLocal(c: Camp, x: number, z: number, out: { x: number; z: number }) {
  const dx = x - c.x;
  const dz = z - c.z;
  out.x = dx * c.cos - dz * c.sin;
  out.z = dx * c.sin + dz * c.cos;
  return out;
}
export function toWorld(c: Camp, lx: number, lz: number, out: { x: number; z: number }) {
  out.x = c.x + lx * c.cos + lz * c.sin;
  out.z = c.z - lx * c.sin + lz * c.cos;
  return out;
}

const loc = { x: 0, z: 0 };
const wld = { x: 0, z: 0 };

export function campNear(w: World, x: number, z: number, pad = 12): Camp | null {
  const R = CASTLE.HALF * 1.45 + pad;
  for (const c of w.camps) {
    const dx = x - c.x;
    const dz = z - c.z;
    if (dx * dx + dz * dz < R * R) return c;
  }
  return null;
}

/**
 * Resolve an entity at (x,y,z) against castles: pushes it out of walls and returns the
 * ground height it stands on (terrain or castle floors such as stairs and the keep roof).
 */
export function resolveGround(w: World, u: { x: number; y: number; z: number }, radius: number) {
  let ground = w.terrain.heightAt(u.x, u.z);
  const c = campNear(w, u.x, u.z);
  if (c) {
    toLocal(c, u.x, u.z, loc);
    castleResolve(loc.x, loc.z, u.y - c.y, radius, res);
    toWorld(c, res.x, res.z, wld);
    u.x = wld.x;
    u.z = wld.z;
    if (res.floor > 0) ground = Math.max(ground, c.y + res.floor);
  }
  return ground;
}

/** Steering target that routes through gates and up stairs when needed. */
export function navTarget(w: World, u: Unit, tx: number, ty: number, tz: number, out: { x: number; z: number }) {
  out.x = tx;
  out.z = tz;
  const c = campNear(w, u.x, u.z, 20) ?? campNear(w, tx, tz, 4);
  if (!c) return out;
  toLocal(c, u.x, u.z, loc);
  const ax = loc.x;
  const az = loc.z;
  toLocal(c, tx, tz, loc);
  const p = castleWaypoint(ax, az, u.y - c.y, loc.x, loc.z, ty - c.y, wp);
  if (p) toWorld(c, p.x, p.z, out);
  return out;
}
