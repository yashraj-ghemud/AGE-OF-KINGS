import * as THREE from 'three';
import { audio } from '../audio/audio';
import { useGameStore } from '../store/gameStore';
import { clamp, dampAngle } from '../lib/math';
import { CHAPTERS } from '../story/campaign';
import { blast, damage } from './combat';
import { emit, stepFx } from './fx';
import { campNear, nearest, queryRadius, resolveGround } from './physics';
import { freeKing } from './player';
import { makeUnit } from './world';
import type { Unit, World } from './types';

const say = (title: string, subtitle: string | undefined, tone: 'gold' | 'crimson' | 'ember' | 'blue') =>
  useGameStore.getState().pushBanner({ title, subtitle, tone });

/** Per-dragon fire-breath state, read by the renderer. */
export const breathOf = new Map<number, { origin: THREE.Vector3; dir: THREE.Vector3; active: number }>();

function breath(u: Unit) {
  let b = breathOf.get(u.id);
  if (!b) {
    b = { origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), active: 0 };
    breathOf.set(u.id, b);
  }
  return b;
}

// ───────────────────────── projectiles ─────────────────────────

const probe = { x: 0, y: 0, z: 0 };

function projectiles(w: World, dt: number) {
  const list = w.projectiles;
  let stuck = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (p.stuck) {
      p.stuckT += dt;
      stuck++;
      if (p.stuckT > 12) list.splice(i, 1);
      continue;
    }
    const g = p.kind === 'arrow' ? 13 : p.kind === 'javelin' ? 16 : p.kind === 'royalSpear' ? 9 : 10;
    p.vy -= g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.life -= dt;
    let remove = p.life <= 0;
    const foe = p.team === 0 ? 1 : 0;
    queryRadius(p.x, p.z, 2.2, (u) => {
      if (remove || u.team !== foe || !u.alive || u.morale === 'kneel' || u.morale === 'ash') return;
      if (p.hits?.has(u.id)) return;
      const top = u.alt ? u.y + 1.5 : u.y + 2 * u.scale + (u.type === 'king' ? 1.4 : 0);
      const bottom = u.alt ? u.y - 1.5 : u.y;
      if (p.y < bottom || p.y > top) return;
      const r = u.radius + 0.35;
      if ((u.x - p.x) ** 2 + (u.z - p.z) ** 2 > r * r) return;
      const heavy = p.kind === 'royalSpear' || p.kind === 'javelin';
      damage(w, u, p.damage, p.owner, p.vx, p.vz, heavy ? 8 : 2.5, heavy ? 3 : 0.5);
      emit(u.type === 'rakshas' ? 'fire' : 'hit', p.x, p.y, p.z, 5, { speed: 4, up: 1, size: 0.12, life: 0.35 });
      audio.playAt('impact', p.x, p.y, p.z, 0.6);
      if (p.hits && p.pierce > 1) {
        p.hits.add(u.id);
        p.pierce--;
      } else remove = true;
      return true;
    });
    if (!remove) {
      const ground = w.terrain.heightAt(p.x, p.z);
      let hitWall = false;
      if (campNear(w, p.x, p.z, 0)) {
        probe.x = p.x;
        probe.y = p.y;
        probe.z = p.z;
        const floor = resolveGround(w, probe, 0.05);
        hitWall = probe.x !== p.x || probe.z !== p.z || p.y < floor;
      }
      if (p.y <= ground || hitWall) {
        if (stuck < 300) {
          p.stuck = true;
          p.y = Math.max(p.y, ground);
          emit('dust', p.x, p.y + 0.1, p.z, 2, { speed: 1.5, size: 0.4, life: 0.5 });
        } else remove = true;
      }
    }
    if (remove) list.splice(i, 1);
  }
}

// ───────────────────────── dragons ─────────────────────────

function breathDamage(w: World, d: Unit, b: { origin: THREE.Vector3; dir: THREE.Vector3; active: number }, dt: number) {
  if (b.active < 0.5) return;
  const len = 30;
  const cx = b.origin.x + b.dir.x * len * 0.5;
  const cz = b.origin.z + b.dir.z * len * 0.5;
  queryRadius(cx, cz, len * 0.6, (u) => {
    if (u.team !== 1 || !u.alive) return;
    const vx = u.x - b.origin.x;
    const vy = u.y + 1 - b.origin.y;
    const vz = u.z - b.origin.z;
    const along = vx * b.dir.x + vy * b.dir.y + vz * b.dir.z;
    if (along < 0 || along > len) return;
    const px = vx - b.dir.x * along;
    const py = vy - b.dir.y * along;
    const pz = vz - b.dir.z * along;
    const rad = 2 + along * 0.35;
    if (px * px + py * py + pz * pz > rad * rad) return;
    damage(w, u, 320 * dt, d, b.dir.x, b.dir.z, 6 * dt, 0);
    u.burn = 1;
    if (Math.random() < dt * 6) emit('fire', u.x, u.y + 1, u.z, 2, { speed: 2, up: 3, size: 0.6, life: 0.6 });
  });
  if (Math.random() < dt * 2.2) audio.playAt('fire', b.origin.x, b.origin.y, b.origin.z, 0.8);
}

function dragons(w: World, dt: number) {
  const k = w.king;
  for (const d of w.units) {
    if (d.type !== 'dragon' || !d.alive) continue;
    d.flash = Math.max(0, d.flash - dt * 4);
    const b = breath(d);
    const ridden = k.riding === d;
    const ground = w.terrain.heightAt(d.x, d.z);
    let gx = d.x;
    let gy = d.y;
    let gz = d.z;
    let sp = 22;
    let breathing = false;
    if (ridden) {
      breathing = d.attack > 0;
    } else if (d.dive === -1) {
      // pickup: swoop down beside the king, then he mounts
      gx = k.unit.x;
      gz = k.unit.z;
      gy = k.unit.y + 3;
      sp = 34;
      if (Math.hypot(d.x - gx, d.z - gz, d.y - gy) < 6) {
        d.dive = 0;
        k.riding = d;
        k.camPitch = 0.1;
        say('SKYBORNE', 'W fly · mouse steer · Space climb · Ctrl dive · LMB fire · P dismount', 'ember');
        audio.play('roar', 0.8);
      }
    } else if (d.dive === -2) {
      // rescue the caged king
      gx = k.cage.x;
      gz = k.cage.z;
      gy = k.cage.y + 4;
      sp = 40;
      if (Math.hypot(d.x - gx, d.z - gz, d.y - gy) < 7) {
        d.dive = 0;
        if (k.capture !== 'free' && k.capture !== 'trapping') freeKing(w, 'Dragonfire melts the cage');
        blast(w, d.x, d.z, 12, 200, 16, 8, 0, d);
        emit('fire', d.x, d.y - 2, d.z, 60, { speed: 12, up: 2, size: 0.8, life: 1 });
      }
    } else {
      // escort: circle the king, strafe enemies near him
      const anchor = k.unit;
      if ((d.retarget -= dt) <= 0) {
        d.retarget = 1.2;
        d.target = nearest(anchor.x, anchor.z, 70, 1);
      }
      const t = d.target && d.target.alive ? d.target : null;
      if (t) {
        const dx = t.x - d.x;
        const dz = t.z - d.z;
        const dist = Math.hypot(dx, dz);
        gx = t.x - (dx / (dist || 1)) * 8;
        gz = t.z - (dz / (dist || 1)) * 8;
        gy = w.terrain.heightAt(gx, gz) + 11;
        sp = 26;
        breathing = dist < 32;
      } else {
        const a = w.time * 0.35 + d.id;
        gx = anchor.x + Math.sin(a) * 26;
        gz = anchor.z + Math.cos(a) * 26;
        gy = w.terrain.heightAt(gx, gz) + d.alt;
      }
    }
    if (!ridden) {
      const dx = gx - d.x;
      const dy = gy - d.y;
      const dz = gz - d.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      const kf = 1 - Math.exp(-2 * dt);
      d.vx += ((dx / l) * sp - d.vx) * kf;
      d.vy += ((dy / l) * sp * 0.8 - d.vy) * kf;
      d.vz += ((dz / l) * sp - d.vz) * kf;
      d.x += d.vx * dt;
      d.y = Math.max(ground + 4, d.y + d.vy * dt);
      d.z += d.vz * dt;
      const prev = d.yaw;
      d.yaw = dampAngle(d.yaw, Math.atan2(d.vx, d.vz), 3, dt);
      d.roll = clamp((prev - d.yaw) / Math.max(dt, 1e-3) * 0.3, -0.6, 0.6);
      d.pitch = -Math.atan2(d.vy, Math.hypot(d.vx, d.vz)) * 0.5;
      d.walk += dt * 1.1;
    }
    // breath comes from the mouth, aimed forward-down (or where the rider looks)
    const fx0 = Math.sin(d.yaw);
    const fz0 = Math.cos(d.yaw);
    b.origin.set(d.x + fx0 * 7.2, d.y + 0.6, d.z + fz0 * 7.2);
    if (ridden) {
      b.dir.set(Math.sin(k.camYaw) * Math.cos(-k.camPitch * 0.8 - 0.25), Math.sin(-k.camPitch * 0.8 - 0.25), Math.cos(k.camYaw) * Math.cos(-k.camPitch * 0.8 - 0.25)).normalize();
    } else {
      const t = d.target;
      if (t) b.dir.set(t.x - b.origin.x, t.y + 1 - b.origin.y, t.z - b.origin.z).normalize();
      else b.dir.set(fx0, -0.4, fz0).normalize();
    }
    b.active += ((breathing ? 1 : 0) - b.active) * Math.min(1, dt * 6);
    breathDamage(w, d, b, dt);
  }
}

// ───────────────────────── rituals, shards, waves, raids ─────────────────────────

function rituals(w: World, dt: number) {
  for (const r of w.rituals) {
    if (r.done) continue;
    const prev = r.t;
    r.t += dt;
    if (prev < 0.4 && r.t >= 0.4) audio.play('thunder', 0.9);
    if (prev < 1.6 && r.t >= 1.6) audio.play('thunder', 0.7);
    if (r.t > 1.5 && r.t < 3.6 && Math.random() < dt * 20) emit('ember', r.x, r.y + 1 + Math.random() * 2, r.z, 2, { speed: 3, up: 2, life: 1 });
    if (prev < 3.6 && r.t >= 3.6) {
      const d = makeUnit(w, 'dragon', 0, r.x, r.z);
      d.y = r.y + 4;
      d.vy = 14;
      d.yaw = w.king.camYaw;
      d.flash = 1;
      if (w.king.capture === 'trapped' || w.king.capture === 'carried' || w.king.capture === 'jailed') d.dive = -2;
      w.dragonsSummoned++;
      blast(w, r.x, r.z, 16, 150, 20, 10, 0, d);
      w.rings.push({ x: r.x, y: r.y + 0.3, z: r.z, t: 0, dur: 1.2, radius: 24, color: 'ember' });
      emit('fire', r.x, r.y + 2, r.z, 120, { speed: 16, up: 4, size: 0.7, life: 1.2, spread: 2 });
      emit('spark', r.x, r.y + 2, r.z, 60, { speed: 20, up: 6, size: 0.2, life: 1 });
      audio.play('roar', 1.2);
      audio.play('slam', 0.8);
      w.shake = Math.max(w.shake, 1);
      say('AN EMBER-KIN WAKES', 'Press P to ride · it fights at your side', 'ember');
    }
    if (r.t > 4.5) r.done = true;
  }
  w.rituals = w.rituals.filter((r) => !r.done || r.t < 5);
}

function shards(w: World, dt: number) {
  const k = w.king.unit;
  for (const s of w.shards) {
    if (s.collected) continue;
    s.t += dt;
    if (s.t < 1.4) s.y += dt * 1.6;
    else {
      const dx = k.x - s.x;
      const dy = k.y + 2.5 - s.y;
      const dz = k.z - s.z;
      const d = Math.hypot(dx, dy, dz);
      const sp = Math.min(60, 4 + (s.t - 1.4) * 40);
      if (d < 1.5) {
        s.collected = true;
        w.ember += 60;
        audio.play('shard');
        emit('gold', k.x, k.y + 2.5, k.z, 60, { speed: 9, up: 2, life: 1.4, spread: 1 });
        w.rings.push({ x: k.x, y: k.y + 0.3, z: k.z, t: 0, dur: 1, radius: 20, color: 'gold' });
        say('CROWN SHARD RECLAIMED', `${w.lordsSlain} of ${w.lordsTotal} · the eclipse wavers`, 'gold');
      } else {
        s.x += (dx / d) * sp * dt;
        s.y += (dy / d) * sp * dt;
        s.z += (dz / d) * sp * dt;
      }
    }
  }
}

function waves(w: World, dt: number) {
  for (const wv of w.waves) {
    wv.t += dt;
    const r = wv.t * 18;
    queryRadius(wv.x, wv.z, r + 2, (u, d2) => {
      if (u.team !== 0 || !u.alive || wv.hit.has(u.id) || u.alt) return;
      const d = Math.sqrt(d2);
      if (d < r - 2.5) return;
      wv.hit.add(u.id);
      damage(w, u, 95, w.boss, u.x - wv.x, u.z - wv.z, 15, 7);
      emit('ash', u.x, u.y + 1, u.z, 6, { speed: 4, up: 2, life: 0.8 });
    });
  }
  w.waves = w.waves.filter((wv) => wv.t < 1.7);
}

function raids(w: World, dt: number) {
  const cfg = w.chapter.config;
  if (!cfg.raidInterval) return;
  if (w.raidMarker) {
    w.raidMarker.t -= dt;
    if (w.raidMarker.t <= 0) w.raidMarker = null;
  }
  w.raidTimer -= dt;
  if (w.raidTimer > 0) return;
  w.raidTimer = cfg.raidInterval * (0.8 + Math.random() * 0.4);
  const live = w.camps.filter((c) => !c.royal && !c.fallen);
  if (!live.length) return;
  const c = live[Math.floor(Math.random() * live.length)];
  const n = Math.round(cfg.raidSize[0] + Math.random() * (cfg.raidSize[1] - cfg.raidSize[0]));
  const gx = c.x + c.sin * 58;
  const gz = c.z + c.cos * 58;
  for (let i = 0; i < n; i++) {
    const roll = Math.random();
    const type = roll < cfg.rakshasRatio + 0.1 ? 'rakshas' : roll < 0.55 ? 'swordsman' : roll < 0.8 ? 'spearman' : 'archer';
    const u = makeUnit(w, type, 1, gx + (Math.random() - 0.5) * 12, gz + (Math.random() - 0.5) * 12, cfg.difficulty);
    u.role = 'raider';
    u.camp = c;
  }
  w.raidMarker = { x: gx, z: gz, t: 25, name: c.lordName };
  audio.play('horn', 0.9);
  say('THE WAR-HORN SOUNDS', `${c.lordName} sends ${n} raiders ${cfg.raidTarget === 'castle' ? 'against Suryagarh' : 'after you'}`, 'crimson');
}

// ───────────────────────── frame driver ─────────────────────────

export function stepSystems(w: World, dt: number, realDt: number) {
  projectiles(w, dt);
  dragons(w, dt);
  rituals(w, dt);
  shards(w, dt);
  waves(w, dt);
  raids(w, dt);
  stepFx(dt);
  for (const r of w.rings) r.t += dt;
  w.rings = w.rings.filter((r) => r.t < r.dur);
  for (const u of w.units) if (u.burn > 0) u.burn = Math.max(0, u.burn - dt);

  // kill-cam & hit-stop time control (real time)
  if (w.killcam) {
    w.killcam.t += realDt;
    if (w.killcam.t >= w.killcam.dur) {
      if (!w.killcam.boss) w.timeScale = 1;
      w.killcam = null;
    }
  }
  if (w.hitStop > 0) w.hitStop -= realDt;

  const total = w.lordsTotal + (w.boss ? 1 : 0);
  const slain = w.lordsSlain + (w.boss && !w.boss.alive ? 1 : 0);
  w.dawn = w.dawnBase + (total ? slain / total : 0) * 0.13;
  w.shake = Math.max(0, w.shake - realDt * 1.6);

  if (!w.ended) {
    const k = w.king;
    const bossDone = !w.boss || !w.boss.alive;
    if (w.lordsSlain >= w.lordsTotal && bossDone) {
      w.ended = true;
      w.victory = true;
      w.endTimer = w.boss ? 4.5 : 4;
      if (!w.boss) say('VICTORY', CHAPTERS[w.chapter.id].victory, 'gold');
      audio.play('warcry');
    } else if (k.capture === 'jailed' && k.jailTime <= 0) {
      w.ended = true;
      w.victory = false;
      w.defeatReason = 'The Blood-Moon rite is complete. The king is lost to the eclipse.';
      w.endTimer = 3;
      audio.play('thunder', 1);
    }
  } else {
    w.endTimer -= realDt;
  }
}
