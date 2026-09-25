import { audio } from '../audio/audio';
import { useGameStore } from '../store/gameStore';
import { BOSS_PHASE_LINE } from '../story/campaign';
import { clamp, dampAngle } from '../lib/math';
import { blast, damage, GRAV, kill } from './combat';
import { emit } from './fx';
import { nearest, navTarget, queryRadius, rebuildHash, resolveGround } from './physics';
import { makeUnit } from './world';
import type { Projectile, Unit, World } from './types';

const nav = { x: 0, z: 0 };
let dvx = 0;
let dvz = 0;
let faceYaw: number | null = null;

const d2 = (a: { x: number; z: number }, b: { x: number; z: number }) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

function moveTo(w: World, u: Unit, tx: number, ty: number, tz: number, speedMul = 1, stopAt = 0.8) {
  navTarget(w, u, tx, ty, tz, nav);
  const dx = nav.x - u.x;
  const dz = nav.z - u.z;
  const d = Math.hypot(dx, dz);
  if (d < stopAt && nav.x === tx && nav.z === tz) return false;
  const s = u.speed * speedMul * (u.buff > 0 ? 1.2 : 1);
  dvx = (dx / (d || 1)) * s;
  dvz = (dz / (d || 1)) * s;
  return true;
}

export function spawnProjectile(w: World, p: Omit<Projectile, 'stuck' | 'stuckT' | 'hits'>) {
  w.projectiles.push({ ...p, stuck: false, stuckT: 0, hits: p.pierce > 1 ? new Set() : null });
}

/** Low-arc ballistic launch toward a (leading) target, with human error. */
function shoot(w: World, u: Unit, t: Unit, kind: 'arrow' | 'javelin') {
  const speed = kind === 'arrow' ? 40 : 28;
  const g = kind === 'arrow' ? 13 : 16;
  const sx = u.x;
  const sy = u.y + 1.5 * u.scale;
  const sz = u.z;
  const flight = Math.hypot(t.x - sx, t.z - sz) / speed;
  const tx = t.x + t.vx * flight * 0.7;
  const tz = t.z + t.vz * flight * 0.7;
  const ty = t.y + (t.alt ? 0 : 1.0);
  const dx = tx - sx;
  const dz = tz - sz;
  const d = Math.hypot(dx, dz);
  const h = ty - sy;
  const v2 = speed * speed;
  const disc = v2 * v2 - g * (g * d * d + 2 * h * v2);
  let th = disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (g * d));
  th += (Math.random() - 0.5) * 0.05;
  const yaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.05;
  spawnProjectile(w, {
    kind, x: sx, y: sy, z: sz,
    vx: Math.sin(yaw) * Math.cos(th) * speed, vy: Math.sin(th) * speed, vz: Math.cos(yaw) * Math.cos(th) * speed,
    team: u.team, damage: u.type === 'archer' ? u.damage : u.damage * 1.3, life: 6, pierce: 1, owner: u,
  });
  audio.playAt(kind === 'arrow' ? 'bow' : 'spear', sx, sy, sz, 0.6);
}

function startAttack(u: Unit) {
  if (u.attackT >= 0 || u.cooldown > 0) return;
  u.attackT = 0;
  u.attackHit = false;
  u.cooldown = u.cooldownMax * (0.85 + Math.random() * 0.3);
}

function engage(w: World, u: Unit, t: Unit) {
  const dx = t.x - u.x;
  const dz = t.z - u.z;
  const d = Math.hypot(dx, dz);
  faceYaw = Math.atan2(dx, dz);
  const reach = u.range + t.radius;
  if (u.type === 'archer') {
    if (d < 7 && !t.alt) {
      dvx = (-dx / d) * u.speed;
      dvz = (-dz / d) * u.speed;
    } else if (d > reach) moveTo(w, u, t.x, t.y, t.z, 0.9);
    else startAttack(u);
    return;
  }
  if (u.type === 'spearman' && d > 7 && d < 24 && u.javelin <= 0 && u.attackT < 0 && !t.alt) {
    u.javelin = 6 + Math.random() * 3;
    u.attackT = 0;
    u.attackHit = false;
    u.goalX = -1; // marks a throw
    return;
  }
  if (u.type === 'rakshas' && d > 5 && d < 13 && u.special <= 0 && u.grounded && !t.alt) {
    // leap: solve a jump that lands on the target in T seconds
    const T = 0.75;
    u.vx = dx / T;
    u.vz = dz / T;
    u.vy = (t.y - u.y + 0.5 * GRAV * T * T) / T;
    u.grounded = false;
    u.special = 5 + Math.random() * 3;
    u.attackT = 0.1;
    u.attackHit = false;
    audio.playAt('jump', u.x, u.y, u.z, 0.8);
    return;
  }
  if (u.type === 'lord' && u.special <= 0 && d < 6) {
    let n = 0;
    queryRadius(u.x, u.z, 6, (o) => {
      if (o.team !== u.team && o.alive) n++;
    });
    if (n >= 2) {
      u.special = 7 + Math.random() * 3;
      blast(w, u.x, u.z, 7, 55, 13, 7, u.team, u);
      w.rings.push({ x: u.x, y: u.y + 0.2, z: u.z, t: 0, dur: 0.7, radius: 8, color: 'crimson' });
      emit('dust', u.x, u.y + 0.3, u.z, 30, { speed: 9, up: 1, size: 1.2, life: 1.2, spread: 3 });
      audio.playAt('slam', u.x, u.y, u.z, 0.8);
      return;
    }
  }
  if (d > reach) moveTo(w, u, t.x, t.y, t.z, 1, 0);
  else startAttack(u);
}

function acquire(w: World, u: Unit, cx: number, cz: number, leash: number, aggro: number) {
  const king = w.king;
  const foe: 0 | 1 = u.team === 0 ? 1 : 0;
  const cur = u.target;
  if (cur && cur.alive && cur.morale !== 'kneel' && cur.morale !== 'ash' && cur.morale !== 'flee' && cur.team === foe) {
    const lx = cur.x - cx;
    const lz = cur.z - cz;
    if (lx * lx + lz * lz < leash * leash && d2(cur, u) < aggro * aggro * 2.2) {
      if (!(cur === king.unit && king.capture !== 'free' && king.capture !== 'trapping')) return;
    }
  }
  u.target = nearest(u.x, u.z, aggro, foe, (o) => {
    if (o === king.unit && (king.capture !== 'free' && king.capture !== 'trapping' || king.riding)) return false;
    if (o.alt && u.type !== 'archer') return false;
    const lx = o.x - cx;
    const lz = o.z - cz;
    return lx * lx + lz * lz < leash * leash;
  });
}

function patrolCamp(w: World, u: Unit, dt: number) {
  const c = u.camp!;
  u.patrol -= dt;
  if (u.patrol <= 0) {
    u.patrol = 4 + Math.random() * 7;
    const outside = Math.random() < 0.35;
    const lx = outside ? (Math.random() - 0.5) * 60 : (Math.random() - 0.5) * 60;
    let lz = outside ? 50 + Math.random() * 25 : (Math.random() - 0.5) * 60;
    if (!outside && Math.abs(lx) < 10 && lz > -10) lz = -20;
    u.goalX = c.x + lx * c.cos + lz * c.sin;
    u.goalZ = c.z - lx * c.sin + lz * c.cos;
  }
  if (u.type === 'lord') return; // lords hold their keep until provoked
  moveTo(w, u, u.goalX, c.y, u.goalZ, 0.32, 1.2);
}

function armySlot(w: World, u: Unit, out: { x: number; z: number }) {
  const k = w.king.unit;
  const yaw = k.yaw;
  const s = u.slot % 64;
  if (w.order === 'guard') {
    const ring = u.type === 'archer' ? 9 : u.type === 'spearman' ? 6.5 : 4.2;
    const a = s * 2.399 + yaw;
    out.x = k.x + Math.sin(a) * ring;
    out.z = k.z + Math.cos(a) * ring;
    return;
  }
  const row = Math.floor(s / 8);
  const col = (s % 8) - 3.5;
  const lx = col * 2.3;
  const lz = -(5 + row * 2.6);
  out.x = k.x + lx * Math.cos(yaw) + lz * Math.sin(yaw);
  out.z = k.z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
}

const slot = { x: 0, z: 0 };

function think(w: World, u: Unit, dt: number) {
  dvx = 0;
  dvz = 0;
  faceYaw = null;
  const king = w.king;

  if (u.morale === 'kneel') {
    u.kneel = Math.min(1, u.kneel + dt * 2.5);
    u.moraleT -= dt;
    if (u.moraleT <= 0) {
      u.team = 0;
      u.sworn = true;
      u.morale = 'sworn';
      u.camp = w.royal;
      u.role = 'soldier';
      u.target = null;
      u.flash = 1;
      u.hp = u.maxHp;
      w.sworn++;
      emit('gold', u.x, u.y + 1.2, u.z, 8, { speed: 3, up: 2, life: 1 });
      audio.playAt('kneel', u.x, u.y, u.z, 0.7);
    }
    return;
  }
  u.kneel = Math.max(0, u.kneel - dt * 2);
  if (u.morale === 'flee') {
    u.moraleT += dt;
    const ax = u.x - king.unit.x;
    const az = u.z - king.unit.z;
    const l = Math.hypot(ax, az) || 1;
    dvx = (ax / l) * u.speed * 1.15;
    dvz = (az / l) * u.speed * 1.15;
    if (u.moraleT > 9) {
      u.alive = false;
      u.hidden = true;
      u.deadTime = 99;
    }
    return;
  }
  if (u.morale === 'ash') {
    u.moraleT -= dt;
    u.flash = 0.5 + Math.sin(w.time * 30) * 0.5;
    if (u.moraleT <= 0) {
      emit('ash', u.x, u.y + 1, u.z, 22, { speed: 2, up: 2.5, size: 0.35, life: 2.2, spread: 1.2 });
      emit('ember', u.x, u.y + 1, u.z, 10, { speed: 2, up: 3, life: 1.6, homing: true });
      audio.playAt('ash', u.x, u.y, u.z, 0.8);
      u.alive = false;
      u.hidden = true;
      u.deadTime = 99;
      w.ember += 3;
    }
    return;
  }
  if (u.role === 'carrier') return; // moved by the capture system

  const kingU = king.unit;
  const captured = king.capture === 'trapped' || king.capture === 'carried' || king.capture === 'jailed';

  if (u.team === 1) {
    const c = u.camp;
    const raider = u.role === 'raider';
    const aggro = u.type === 'archer' ? 46 : u.type === 'boss' ? 40 : u.type === 'lord' ? 26 : 32;
    const cx = raider || !c ? u.x : c.x;
    const cz = raider || !c ? u.z : c.z;
    const leash = raider ? 1e5 : u.type === 'boss' ? 95 : 118;
    if ((u.retarget -= dt) <= 0) {
      u.retarget = 0.3 + Math.random() * 0.3;
      if (king.capture === 'trapping' && d2(u, kingU) < 60 * 60) u.target = kingU;
      else acquire(w, u, cx, cz, leash, aggro);
    }
    const t = u.target;
    if (t && t === kingU && king.capture === 'trapping' && u.type !== 'archer') {
      // encircle the wounded king
      const a = (u.id % 10) * 0.628;
      const tx = kingU.x + Math.sin(a) * 3.6;
      const tz = kingU.z + Math.cos(a) * 3.6;
      if (!moveTo(w, u, tx, kingU.y, tz, 1.1, 0.8)) startAttack(u);
      faceYaw = Math.atan2(kingU.x - u.x, kingU.z - u.z);
      return;
    }
    if (t) return engage(w, u, t);
    if (raider) {
      const castle = w.chapter.config.raidTarget === 'castle';
      const gx = castle ? w.royal.x + (u.id % 7) * 3 - 9 : kingU.x;
      const gz = castle ? w.royal.z + 30 + (u.id % 5) * 2 : kingU.z;
      moveTo(w, u, gx, w.royal.y, gz, 0.9, 3);
      return;
    }
    if (c) {
      const home = d2(u, c);
      if (home > 95 * 95) moveTo(w, u, c.x + c.sin * 40, c.y, c.z + c.cos * 40, 0.8);
      else if (u.type === 'boss') moveTo(w, u, c.x + c.sin * 16, c.y, c.z + c.cos * 16, 0.5, 2);
      else patrolCamp(w, u, dt);
    }
    return;
  }

  // ── royal army
  let cx = kingU.x;
  let cz = kingU.z;
  let leash = 70;
  let aggro = 36;
  if (u.role === 'backup') {
    const tx = captured ? king.cage.x : kingU.x;
    const tz = captured ? king.cage.z : kingU.z;
    if (d2(u, { x: tx, z: tz }) < 26 * 26 && !captured) u.role = 'soldier';
    aggro = 12;
    cx = u.x;
    cz = u.z;
    if ((u.retarget -= dt) <= 0) {
      u.retarget = 0.4;
      acquire(w, u, cx, cz, 30, aggro);
    }
    if (u.target) return engage(w, u, u.target);
    moveTo(w, u, tx, king.cage.y, tz, 1.15, 2.5);
    return;
  }
  if (captured) {
    cx = king.cage.x;
    cz = king.cage.z;
    if (d2(u, king.cage) < 320 * 320) {
      if ((u.retarget -= dt) <= 0) {
        u.retarget = 0.4;
        acquire(w, u, u.x, u.z, 14, 10);
      }
      if (u.target) return engage(w, u, u.target);
      moveTo(w, u, king.cage.x, king.cage.y, king.cage.z, 1.1, 2);
      return;
    }
  }
  if (w.rally) {
    cx = w.rally.x;
    cz = w.rally.z;
    leash = 40;
    aggro = 26;
  } else if (w.order === 'hold') {
    cx = w.royal.x;
    cz = w.royal.z + 30;
    leash = 110;
    aggro = 40;
  } else if (w.order === 'guard') {
    leash = 22;
    aggro = 14;
  }
  if ((u.retarget -= dt) <= 0) {
    u.retarget = 0.3 + Math.random() * 0.3;
    acquire(w, u, cx, cz, leash, aggro);
  }
  if (u.target) return engage(w, u, u.target);
  if (w.rally) {
    const a = u.slot * 2.399;
    const r = 2 + Math.sqrt(u.slot % 80) * 1.5;
    moveTo(w, u, w.rally.x + Math.sin(a) * r, w.rally.y, w.rally.z + Math.cos(a) * r, 1, 1);
  } else if (w.order === 'hold') {
    if (!u.camp) u.camp = w.royal;
    patrolCamp(w, u, dt);
  } else {
    armySlot(w, u, slot);
    const far = d2(u, slot) > 30 * 30;
    const kSpeed = Math.hypot(kingU.vx, kingU.vz);
    moveTo(w, u, slot.x, kingU.y, slot.z, far ? 1.35 : Math.max(0.5, Math.min(1.35, kSpeed / u.speed + 0.2)), 1.2);
    if (!far && Math.hypot(dvx, dvz) < 0.1) faceYaw = kingU.yaw;
  }
}

function resolveAttack(w: World, u: Unit, dt: number) {
  if (u.attackT < 0) {
    u.attack = -1;
    return;
  }
  u.attackT += dt;
  u.attack = Math.min(1, u.attackT / u.attackDur);
  const t = u.target;
  if (!u.attackHit && u.attack >= 0.55) {
    u.attackHit = true;
    const throwing = u.goalX === -1;
    if (throwing) u.goalX = u.x;
    if (!t || !t.alive) return;
    if (u.type === 'archer' || throwing) {
      shoot(w, u, t, throwing ? 'javelin' : 'arrow');
    } else {
      const dx = t.x - u.x;
      const dz = t.z - u.z;
      const d = Math.hypot(dx, dz);
      if (d <= u.range + t.radius + 1 && Math.abs(t.y - u.y) < 2.5 + (t.alt ? 0 : 0)) {
        const heavy = u.type === 'lord' || u.type === 'boss' || u.type === 'rakshas';
        damage(w, t, u.damage, u, dx, dz, heavy ? 7 : 3, heavy ? 3 : 0.8);
        const hx = u.x + (dx / (d || 1)) * u.range * 0.8;
        const hz = u.z + (dz / (d || 1)) * u.range * 0.8;
        emit(t.type === 'rakshas' ? 'fire' : 'spark', hx, t.y + 1.2, hz, 6, { speed: 7, up: 2, size: 0.12, life: 0.35 });
        audio.playAt(t.type === 'rakshas' || u.type === 'rakshas' ? 'impact' : 'clash', hx, t.y, hz, 0.7);
        if (u.type === 'boss') {
          // cleave: everything in the arc
          queryRadius(u.x, u.z, u.range + 1.5, (o) => {
            if (o.team === u.team || !o.alive || o === t) return;
            const ox = o.x - u.x;
            const oz = o.z - u.z;
            const ol = Math.hypot(ox, oz) || 1;
            if ((ox * dx + oz * dz) / (ol * (d || 1)) > 0.3) damage(w, o, u.damage * 0.7, u, ox, oz, 9, 3);
          });
          w.shake = Math.max(w.shake, 0.25);
        }
      }
    }
  }
  if (u.attackT >= u.attackDur) {
    u.attackT = -1;
    u.attack = -1;
  }
}

function integrate(w: World, u: Unit, dt: number) {
  if (u.grounded) {
    const k = 1 - Math.exp(-9 * dt);
    u.vx += (dvx - u.vx) * k;
    u.vz += (dvz - u.vz) * k;
    u.vy = 0;
  } else {
    u.vy -= GRAV * dt;
    const drag = Math.exp(-0.3 * dt);
    u.vx *= drag;
    u.vz *= drag;
  }
  u.x += u.vx * dt;
  u.z += u.vz * dt;
  u.y += u.vy * dt;
  u.x = clamp(u.x, -1150, 1150);
  u.z = clamp(u.z, -1150, 1150);
  const g = resolveGround(w, u, u.radius);
  if (u.y <= g) {
    if (!u.grounded && u.vy < -9) {
      emit('dust', u.x, g + 0.2, u.z, 6, { speed: 3, up: 0.5, size: 0.8, life: 0.8 });
      if (u.alive && u.vy < -17) damage(w, u, (-u.vy - 17) * 20, null);
      if (u.type === 'rakshas' && u.alive && u.attackT >= 0) {
        // leap landing strike
        blast(w, u.x, u.z, 2.8, u.damage * 1.3, 8, 3, u.team, u);
        audio.playAt('impact', u.x, u.y, u.z, 0.9);
      }
    }
    u.y = g;
    u.vy = 0;
    u.grounded = true;
  } else if (u.y > g + 0.35) u.grounded = false;
  else if (u.grounded) u.y = g;

  const sp = Math.hypot(u.vx, u.vz);
  u.walk += sp * dt * 2.4;
  u.move += (Math.min(1, sp / 3.5) - u.move) * Math.min(1, dt * 8);
  const want = faceYaw ?? (sp > 0.6 ? Math.atan2(u.vx, u.vz) : null);
  if (want !== null) u.yaw = dampAngle(u.yaw, want, 9, dt);
}

function corpse(w: World, u: Unit, dt: number) {
  u.deadTime += dt;
  u.move = 0;
  u.attack = -1;
  u.flash = Math.max(0, u.flash - dt * 4);
  if (u.hidden && u.deadTime > 50) return;
  if (!u.grounded) {
    u.vy -= GRAV * dt;
    u.x += u.vx * dt;
    u.z += u.vz * dt;
    u.y += u.vy * dt;
    u.pitch += u.spinX * dt;
    u.roll += u.spinZ * dt;
    const g = w.terrain.heightAt(u.x, u.z);
    if (u.y <= g) {
      u.y = g;
      u.grounded = true;
      emit('dust', u.x, g + 0.2, u.z, 4, { speed: 2, size: 0.7, life: 0.7 });
    }
  } else {
    const f = Math.exp(-7 * dt);
    u.vx *= f;
    u.vz *= f;
    u.x += u.vx * dt;
    u.z += u.vz * dt;
    const target = u.pitch <= 0 ? -Math.PI / 2 : Math.PI / 2;
    u.pitch += (target - u.pitch) * Math.min(1, dt * 7);
    u.roll += (0 - u.roll) * Math.min(1, dt * 3);
    if (u.deadTime > 14) u.y -= dt * 0.35;
  }
}

function eagle(w: World, u: Unit, dt: number) {
  const king = w.king;
  const anchor = king.capture === 'jailed' || king.capture === 'carried' ? king.cage : king.unit;
  u.walk += dt * (u.dive > 0 ? 2 : 1) * 3;
  u.cooldown -= dt;
  let gx: number;
  let gz: number;
  let gy: number;
  const ground = w.terrain.heightAt(u.x, u.z);
  if (u.dive > 0 && u.target && u.target.alive) {
    u.dive += dt;
    const t = u.target;
    gx = t.x;
    gz = t.z;
    gy = t.y + 1.2;
    if (Math.hypot(t.x - u.x, t.z - u.z, t.y + 1 - u.y) < 3) {
      damage(w, t, u.damage, u, t.x - u.x, t.z - u.z, 9, 6);
      emit('spark', t.x, t.y + 1.3, t.z, 10, { speed: 7, up: 3 });
      audio.playAt('impact', t.x, t.y, t.z, 0.8);
      u.dive = 0;
      u.cooldown = 2.5 + Math.random() * 1.5;
    }
    if (u.dive > 4) u.dive = 0;
  } else {
    u.dive = 0;
    const a = w.time * 0.5 + u.slot * 1.3;
    const r = 14 + (u.slot % 4) * 4;
    gx = anchor.x + Math.sin(a) * r;
    gz = anchor.z + Math.cos(a) * r;
    gy = w.terrain.heightAt(gx, gz) + u.alt + Math.sin(w.time + u.slot) * 2;
    if (u.cooldown <= 0) {
      u.cooldown = 1;
      const t = nearest(anchor.x, anchor.z, 50, 1, (o) => !o.alt);
      if (t) {
        u.target = t;
        u.dive = 0.01;
      }
    }
  }
  const dx = gx - u.x;
  const dy = gy - u.y;
  const dz = gz - u.z;
  const l = Math.hypot(dx, dy, dz) || 1;
  const sp = u.dive > 0 ? 30 : 17;
  const k = 1 - Math.exp(-(u.dive > 0 ? 4 : 2) * dt);
  u.vx += ((dx / l) * sp - u.vx) * k;
  u.vy += ((dy / l) * sp - u.vy) * k;
  u.vz += ((dz / l) * sp - u.vz) * k;
  u.x += u.vx * dt;
  u.y = Math.max(ground + 1, u.y + u.vy * dt);
  u.z += u.vz * dt;
  u.yaw = Math.atan2(u.vx, u.vz);
  u.pitch = -Math.atan2(u.vy, Math.hypot(u.vx, u.vz)) * 0.6;
}

function bossTick(w: World, u: Unit, dt: number) {
  const hpK = u.hp / u.maxHp;
  if (w.bossPhase === 0 && hpK < 0.5) {
    w.bossPhase = 1;
    u.speed *= 1.3;
    u.damage *= 1.2;
    useGameStore.getState().pushBanner({ title: 'THE ECLIPSE DEEPENS', subtitle: 'Kaalrath draws on the dark', tone: 'crimson' });
    useGameStore.getState().speak('Kaalrath', BOSS_PHASE_LINE);
    audio.play('roar', 1);
    audio.play('thunder', 1);
    w.shake = 0.8;
  }
  if (!u.target) return;
  const tb = w.bossTimers;
  tb.wave -= dt;
  tb.rift -= dt;
  if (tb.wave <= 0 && d2(u, u.target) < 32 * 32) {
    tb.wave = w.bossPhase ? 6.5 : 9;
    w.waves.push({ x: u.x, z: u.z, t: 0, hit: new Set() });
    w.rings.push({ x: u.x, y: u.y + 0.3, z: u.z, t: 0, dur: 1.7, radius: 30, color: 'shadow' });
    u.attackT = 0.3;
    u.attackHit = true;
    audio.play('slam', 1);
    w.shake = Math.max(w.shake, 0.6);
  }
  if (tb.rift <= 0) {
    tb.rift = w.bossPhase ? 13 : 18;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = u.x + Math.sin(a) * 7;
      const z = u.z + Math.cos(a) * 7;
      const r = makeUnit(w, 'rakshas', 1, x, z, w.chapter.config.difficulty);
      r.camp = u.camp;
      r.flash = 1;
      emit('fire', x, r.y + 0.5, z, 20, { speed: 4, up: 5, size: 0.5, life: 1 });
      emit('ash', x, r.y + 0.5, z, 12, { speed: 3, up: 3, size: 0.4, life: 1.5 });
    }
    audio.play('thunder', 0.6);
    useGameStore.getState().pushBanner({ title: 'THE DEEP OPENS', subtitle: 'Rakshas claw up through the rifts', tone: 'crimson' });
  }
}

export function updateUnits(w: World, dt: number) {
  rebuildHash(w.units);
  const king = w.king.unit;
  let heat = 0;
  for (const u of w.units) {
    if (u === king || u.type === 'dragon') continue;
    if (!u.alive) {
      corpse(w, u, dt);
      continue;
    }
    if (u.flash > 0 && u.morale !== 'ash') u.flash = Math.max(0, u.flash - dt * 5);
    if (u.buff > 0) u.buff -= dt;
    u.cooldown -= dt;
    u.special -= dt;
    u.javelin -= dt;
    if (u.type === 'eagle') {
      eagle(w, u, dt);
      continue;
    }
    let udt = dt;
    const far = d2(u, king) > 340 * 340;
    if (far && u.role !== 'raider' && u.role !== 'backup' && u.role !== 'carrier' && !u.target && u.grounded) {
      u.sleep++;
      if (u.sleep % 6 !== 0) continue;
      udt = dt * 6;
    } else if (u.target && d2(u, king) < 60 * 60) heat++;
    think(w, u, udt);
    if (u.type === 'boss') bossTick(w, u, udt);
    resolveAttack(w, u, udt);
    integrate(w, u, udt);
    if (u.hp <= 0 && u.alive) kill(w, u, null);
  }
  w.combatHeat += (Math.min(1, heat / 25) - w.combatHeat) * Math.min(1, dt * 0.8);

  // crowd separation — soldiers press against each other instead of overlapping
  for (const u of w.units) {
    if (!u.alive || u.alt || u.sleep % 6 !== 0 && d2(u, king) > 340 * 340) continue;
    queryRadius(u.x, u.z, u.radius + 1.7, (o, dd) => {
      if (o === u || o.id < u.id || o.alt || !o.grounded || !u.grounded) return;
      const min = u.radius + o.radius;
      if (dd >= min * min || dd < 1e-6) return;
      const d = Math.sqrt(dd);
      const push = (min - d) / d;
      const wu = o.mass / (u.mass + o.mass);
      const wo = 1 - wu;
      const px = (u.x - o.x) * push;
      const pz = (u.z - o.z) * push;
      if (u !== king) {
        u.x += px * wu;
        u.z += pz * wu;
      }
      if (o !== king) {
        o.x -= px * wo;
        o.z -= pz * wo;
      }
    });
  }

  // cleanup: corpses fade out, cap corpse count
  let dead = 0;
  for (const u of w.units) if (!u.alive) dead++;
  if (dead > 0) {
    const overflow = dead - 350;
    let removed = 0;
    w.units = w.units.filter((u) => {
      if (u.alive) return true;
      if (u.deadTime > 18 || (u.hidden && u.deadTime > 0.5 && u.type !== 'king' && u.type !== 'boss')) return false;
      if (overflow > 0 && removed < overflow && u.deadTime > 3) {
        removed++;
        return false;
      }
      return true;
    });
  }
}
