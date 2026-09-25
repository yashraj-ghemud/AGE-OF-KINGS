import * as THREE from 'three';
import { Terrain } from '../world/terrain';
import { rng } from '../lib/math';
import { makePuppet, type Puppet } from '../world/Puppets';

/** The world of the prologue: Suryagarh on its hill, the northern ridge, the valley road. */
export interface CineLayout {
  terrain: Terrain;
  hC: number;
  castle: THREE.Vector3;
  crown: THREE.Vector3;
  ridge: THREE.Vector3;
  hero: THREE.Vector3;
  cave: THREE.Vector3;
  impacts: THREE.Vector3[];
  impactTimes: number[];
  hordeDir: THREE.Vector3;
  hordeStart: THREE.Vector3;
  horde: Puppet[];
  hordeOffsets: { along: number; side: number }[];
}

let cached: CineLayout | null = null;

export const IMPACT_XZ: [number, number][] = [
  [-430, 360],
  [390, 330],
  [-180, 1010],
  [640, 160],
  [-720, 90],
  [300, 960],
  [860, 640],
];
export const COMET_LAUNCH = 41.0;
export const IMPACT_TIMES = [45.2, 45.9, 46.6, 47.4, 48.1, 48.9, 49.6];

export function cineLayout(): CineLayout {
  if (cached) return cached;
  const terrain = new Terrain({
    size: 3400,
    segments: 340,
    seed: 17,
    amplitude: 34,
    mountainRing: { r0: 1250, r1: 1650, height: 300 },
    bumps: [
      { x: 0, z: 0, r: 280, h: 42 },
      { x: 0, z: 760, r: 170, h: 60 },
      { x: -520, z: -380, r: 220, h: 50 },
      { x: 560, z: -300, r: 200, h: 35 },
    ],
    plateaus: [
      { x: 0, z: 0, r: 64, falloff: 45, tint: 'court' },
      { x: 0, z: 716, r: 16, falloff: 34, tint: 'dirt' },
    ],
    scorch: IMPACT_XZ.map(([x, z]) => ({ x, z, r: 90 })),
    roads: [
      { ax: 0, az: 62, bx: 30, bz: 300, w: 5 },
      { ax: 30, az: 300, bx: 42, bz: 460, w: 5 },
      { ax: 42, az: 460, bx: 16, bz: 640, w: 5 },
      { ax: 0, az: -60, bx: -260, bz: -420, w: 4 },
    ],
  });
  const hC = terrain.heightAt(0, 0);
  const g = (x: number, z: number) => terrain.heightAt(x, z);
  const castle = new THREE.Vector3(0, hC, 0);
  const crown = new THREE.Vector3(0, hC + 4.8, 20);
  const ridgeY = g(0, 716);
  const ridge = new THREE.Vector3(0, ridgeY, 716);
  const hero = new THREE.Vector3(0, g(0, 708), 708);
  const cave = new THREE.Vector3(0, -300, 0);
  const impacts = IMPACT_XZ.map(([x, z]) => new THREE.Vector3(x, g(x, z), z));

  // The horde marches down the valley road toward the capital.
  const hordeStart = new THREE.Vector3(38, 0, 505);
  const hordeDir = new THREE.Vector3(0.1, 0, -1).normalize();
  const r = rng(99);
  const horde: Puppet[] = [];
  const hordeOffsets: { along: number; side: number }[] = [];
  const rows = 34;
  const cols = 11;
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      const roll = r();
      const kind = roll < 0.38 ? 'rakshas' : roll < 0.62 ? 'spearman' : roll < 0.85 ? 'swordsman' : 'archer';
      const p = makePuppet({
        kind,
        team: 1,
        scale: kind === 'rakshas' ? 1.25 + r() * 0.15 : 0.95 + r() * 0.1,
        move: 1,
        torch: kind !== 'rakshas' && r() < 0.3,
      });
      horde.push(p);
      hordeOffsets.push({ along: row * 1.9 + (r() - 0.5) * 0.6, side: (c - (cols - 1) / 2) * 1.55 + (r() - 0.5) * 0.5 });
    }
  }
  // two traitor lords ride at the head
  for (let i = 0; i < 2; i++) {
    horde.push(makePuppet({ kind: 'lord', team: 1, scale: 1.3, move: 1 }));
    hordeOffsets.push({ along: -3.5, side: i ? 3 : -3 });
  }

  cached = { terrain, hC, castle, crown, ridge, hero, cave, impacts, impactTimes: IMPACT_TIMES, hordeDir, hordeStart, horde, hordeOffsets };
  return cached;
}
