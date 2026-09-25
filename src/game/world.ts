import * as THREE from 'three';
import { Terrain } from '../world/terrain';
import { CASTLE } from '../world/fortress';
import { BOSS_NAME, LORD_NAMES, type Chapter } from '../story/campaign';
import { rng, randRange } from '../lib/math';
import type { Camp, KingState, Unit, UnitKind, World } from './types';
import type { PuppetKind } from '../world/Puppets';

/** Soldiers per camp are multiplied by this for bigger battles. */
export const ARMY_SCALE = 1.45;

interface Stats {
  hp: number;
  speed: number;
  damage: number;
  range: number;
  cd: number;
  radius: number;
  mass: number;
  scale: number;
}

export const STATS: Record<UnitKind, Stats> = {
  swordsman: { hp: 230, speed: 5.2, damage: 34, range: 2.1, cd: 1.0, radius: 0.45, mass: 1, scale: 1 },
  spearman: { hp: 190, speed: 4.8, damage: 30, range: 2.9, cd: 1.2, radius: 0.45, mass: 1, scale: 1 },
  archer: { hp: 140, speed: 5.4, damage: 22, range: 44, cd: 2.3, radius: 0.42, mass: 0.9, scale: 0.97 },
  rakshas: { hp: 420, speed: 6.6, damage: 44, range: 2.5, cd: 0.85, radius: 0.6, mass: 1.6, scale: 1.3 },
  lord: { hp: 3200, speed: 5.4, damage: 90, range: 3.3, cd: 1.5, radius: 0.8, mass: 4, scale: 1.45 },
  minister: { hp: 1500, speed: 6, damage: 60, range: 2.6, cd: 1.1, radius: 0.55, mass: 2, scale: 1.1 },
  eagle: { hp: 650, speed: 22, damage: 70, range: 3, cd: 3, radius: 1.2, mass: 1, scale: 1 },
  dragon: { hp: 8000, speed: 30, damage: 260, range: 30, cd: 0.1, radius: 3, mass: 20, scale: 1 },
  boss: { hp: 17000, speed: 5.8, damage: 140, range: 6.2, cd: 1.7, radius: 1.6, mass: 12, scale: 2.7 },
  king: { hp: 3000, speed: 17, damage: 110, range: 4.2, cd: 0.42, radius: 1.1, mass: 6, scale: 1 },
};

export function makeUnit(w: World, type: UnitKind, team: 0 | 1, x: number, z: number, difficulty = 1): Unit {
  const s = STATS[type];
  const kind: PuppetKind = type === 'eagle' || type === 'dragon' || type === 'boss' || type === 'king' ? 'lord' : type;
  const hpMul = team === 1 ? difficulty : 1;
  const u: Unit = {
    id: w.nextId++, kind, type, team, x, y: w.terrain.heightAt(x, z), z, yaw: Math.random() * Math.PI * 2,
    scale: s.scale * (type === 'rakshas' ? 0.95 + Math.random() * 0.15 : 1), walk: Math.random() * 6, move: 0, attack: -1,
    pitch: 0, roll: 0, kneel: 0, flash: 0, alive: true, hp: s.hp * hpMul, maxHp: s.hp * hpMul, vx: 0, vy: 0, vz: 0,
    grounded: true, radius: s.radius, mass: s.mass, speed: s.speed * (0.92 + Math.random() * 0.16),
    damage: s.damage * (team === 1 ? 0.75 + 0.25 * difficulty : 1), range: s.range, cooldownMax: s.cd, camp: null,
    role: type === 'lord' ? 'lord' : type === 'boss' ? 'boss' : type === 'eagle' || type === 'dragon' ? 'flyer' : type === 'king' ? 'king' : 'soldier',
    target: null, retarget: Math.random() * 0.5, cooldown: Math.random() * s.cd, attackT: -1, attackDur: type === 'archer' ? 0.9 : type === 'boss' ? 1.1 : 0.62,
    attackHit: false, special: 2 + Math.random() * 4, javelin: Math.random() * 3, goalX: x, goalZ: z, patrol: Math.random() * 4,
    deadTime: 0, spinX: 0, spinZ: 0, morale: 'normal', moraleT: 0, slot: w.units.length, buff: 0, sleep: 0, lastHit: -10,
    alt: type === 'eagle' ? 14 : type === 'dragon' ? 30 : 0, dive: 0, burn: 0,
    hidden: type === 'eagle' || type === 'dragon' || type === 'boss' || type === 'king',
  };
  if (u.alt) u.y += u.alt;
  w.units.push(u);
  return u;
}

function makeCamp(id: number, x: number, z: number, y: number, kind: Camp['kind'], royal: boolean, rot?: number): Camp {
  const r = rot ?? Math.atan2(-x, -z);
  return { id, x, z, y, rot: r, cos: Math.cos(r), sin: Math.sin(r), kind, lord: null, lordName: '', fallen: false, royal };
}

export function createWorld(chapter: Chapter, dawnBase: number): World {
  const cfg = chapter.config;
  const r = rng(cfg.seed);

  // ── pick stronghold sites
  const sites: { x: number; z: number; kind: Camp['kind'] }[] = [];
  const minR = chapter.mode === 'siege' ? 380 : 250;
  const firstAngle = r() * Math.PI * 2;
  for (let i = 0; i < cfg.camps; i++) {
    for (let tries = 0; tries < 200; tries++) {
      const a = firstAngle + (i / cfg.camps) * Math.PI * 2 + randRange(r, -0.45, 0.45);
      const d = randRange(r, minR + i * 40, 820);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (sites.every((s) => Math.hypot(s.x - x, s.z - z) > 270)) {
        sites.push({ x, z, kind: 'traitor' });
        break;
      }
    }
  }
  if (cfg.boss) {
    const a = firstAngle + Math.PI + 0.3;
    sites.push({ x: Math.cos(a) * 760, z: Math.sin(a) * 760, kind: 'obsidian' });
  }

  const plateaus = [
    { x: 0, z: 0, r: 64, falloff: 45, tint: 'court' as const },
    ...sites.map((s) => ({ x: s.x, z: s.z, r: 64, falloff: 45, tint: s.kind === 'obsidian' ? ('obsidian' as const) : ('dirt' as const) })),
  ];
  const roads = sites.map((s) => {
    const d = Math.hypot(s.x, s.z);
    return { ax: (s.x / d) * 60, az: (s.z / d) * 60, bx: s.x - (s.x / d) * 60, bz: s.z - (s.z / d) * 60, w: 4.5 };
  });
  const terrain = new Terrain({
    size: 2800,
    segments: 320,
    seed: cfg.seed,
    amplitude: 24,
    mountainRing: { r0: 1030, r1: 1320, height: 230 },
    plateaus,
    roads,
    scorch: sites.map((s) => ({ x: s.x, z: s.z, r: s.kind === 'obsidian' ? 200 : 120 })),
    ash: cfg.boss ? 0.55 : chapter.mode === 'invasion' ? 0.3 : 0.1,
  });

  const royal = makeCamp(0, 0, 0, terrain.heightAt(0, 0), 'royal', true, 0);
  const camps: Camp[] = [royal];
  sites.forEach((s, i) => camps.push(makeCamp(i + 1, s.x, s.z, terrain.heightAt(s.x, s.z), s.kind, false)));

  const w: World = {
    chapter, terrain, camps, royal, units: [], projectiles: [], shards: [], rings: [], rituals: [], waves: [],
    king: null as unknown as KingState, boss: null, bossPhase: 0, bossTimers: { wave: 8, rift: 14 },
    order: chapter.mode === 'siege' ? 'hold' : 'attack', rally: null, ember: cfg.startEmber, emberEarned: 0, time: 0, timeScale: 1,
    killcam: null, hitStop: 0, shake: 0, raidTimer: cfg.raidInterval * 0.8, raidMarker: null, lordsTotal: 0, lordsSlain: 0,
    sworn: 0, dragonsSummoned: 0, dawnBase, dawn: dawnBase, ended: false, endTimer: 0, victory: null, defeatReason: '', nextId: 1,
    combatHeat: 0, intro: 0,
  };

  // ── the king
  const kingUnit = makeUnit(w, 'king', 0, 0, CASTLE.HALF + 18);
  kingUnit.yaw = 0;
  const firstCamp = camps[1];
  const faceYaw = firstCamp ? Math.atan2(firstCamp.x, firstCamp.z - (CASTLE.HALF + 18)) : 0;
  w.king = {
    unit: kingUnit, camYaw: faceYaw, camPitch: 0.18, camDist: 8.5, stamina: 1, weapon: 'sword', swingT: -1, combo: 0, swingCd: 0,
    draw: 0, drawing: false, throwCd: 0, cd: { cry: 0, charge: 0, slam: 0, horn: 0 }, charging: 0, slamT: -1, rear: 0, leap: 0,
    gait: 0, capture: 'free', cage: new THREE.Vector3(), cageVel: new THREE.Vector3(), jailCamp: null, jailTime: 0, carriers: [],
    invuln: 3, lastDamage: -10, riding: null, firstPerson: false, aiming: false, trample: 0, footstep: 0, kills: 0, comboCount: 0,
    comboT: 0, hurtFlash: 0,
  };
  kingUnit.yaw = faceYaw;

  // ── the royal host, drawn up before the gate
  const kinds: UnitKind[] = ['swordsman', 'spearman', 'archer'];
  for (let i = 0; i < cfg.startArmy; i++) {
    const row = Math.floor(i / 10);
    const col = i % 10;
    const u = makeUnit(w, kinds[(i + row) % 3], 0, (col - 4.5) * 2.4, CASTLE.HALF + 26 + row * 2.6);
    u.yaw = faceYaw;
    u.camp = royal;
  }
  for (let i = 0; i < cfg.eagles; i++) {
    const e = makeUnit(w, 'eagle', 0, randRange(r, -20, 20), CASTLE.HALF + 20 + randRange(r, -10, 10));
    e.alt = 12 + r() * 8;
  }
  for (let i = 0; i < cfg.dragons; i++) {
    makeUnit(w, 'dragon', 0, 20 + i * 10, CASTLE.HALF + 10);
    w.dragonsSummoned++;
  }

  // ── traitor garrisons
  const names = [...LORD_NAMES].sort(() => r() - 0.5);
  let nameIdx = 0;
  for (const c of camps) {
    if (c.royal) continue;
    const boss = c.kind === 'obsidian';
    const lordName = boss ? BOSS_NAME : names[nameIdx++ % names.length];
    c.lordName = lordName;
    if (boss) {
      const k = makeUnit(w, 'boss', 1, c.x + c.sin * 16, c.z + c.cos * 16, 1);
      k.camp = c;
      k.lordName = lordName;
      c.lord = k;
      w.boss = k;
    } else {
      const lord = makeUnit(w, 'lord', 1, c.x, c.z, cfg.difficulty);
      lord.y = c.y + CASTLE.KEEP_H;
      lord.camp = c;
      lord.lordName = lordName;
      c.lord = lord;
      w.lordsTotal++;
    }
    const n = Math.round(randRange(r, cfg.soldiersPerCamp[0], cfg.soldiersPerCamp[1]) * ARMY_SCALE * (boss ? 1.3 : 1));
    for (let i = 0; i < n; i++) {
      const roll = r();
      const type: UnitKind = roll < cfg.rakshasRatio ? 'rakshas' : roll < cfg.rakshasRatio + 0.28 ? 'archer' : roll < cfg.rakshasRatio + 0.58 ? 'spearman' : 'swordsman';
      // inside the walls or loitering outside the gate
      let lx: number;
      let lz: number;
      if (r() < 0.65) {
        lx = randRange(r, -33, 33);
        lz = randRange(r, -33, 33);
        if (Math.abs(lx) < 11 && Math.abs(lz) < 30) lx = lx < 0 ? -14 : 14;
      } else {
        lx = randRange(r, -30, 30);
        lz = randRange(r, 48, 70);
      }
      const x = c.x + lx * c.cos + lz * c.sin;
      const z = c.z - lx * c.sin + lz * c.cos;
      const u = makeUnit(w, type, 1, x, z, cfg.difficulty);
      u.camp = c;
    }
  }
  return w;
}
