import * as THREE from 'three';
import { audio } from '../audio/audio';
import { useGameStore, type ArmyOrder } from '../store/gameStore';
import { CAPTURE_LINE } from '../story/campaign';
import { clamp, dampAngle, angleDelta } from '../lib/math';
import { CASTLE } from '../world/fortress';
import { blast, damage, GRAV, spawnBackup } from './combat';
import { emit } from './fx';
import { input } from './input';
import { navTarget, queryRadius, resolveGround } from './physics';
import { spawnProjectile } from './ai';
import { makeUnit } from './world';
import type { Unit, World } from './types';

export const camState = {
  pos: new THREE.Vector3(),
  dir: new THREE.Vector3(0, 0, 1),
};

const say = (title: string, subtitle: string | undefined, tone: 'gold' | 'crimson' | 'ember' | 'blue') =>
  useGameStore.getState().pushBanner({ title, subtitle, tone });

export const COSTS = { recruit: 15, horn: 60, rite: 120 };
export const COOLDOWNS = { cry: 18, charge: 8, slam: 12, horn: 45 };

const tmp = new THREE.Vector3();
const nav = { x: 0, z: 0 };

function aimPoint(w: World, out: THREE.Vector3) {
  // march the camera ray until it meets the ground (for rally points)
  for (let t = 2; t < 220; t += 1.5) {
    out.copy(camState.pos).addScaledVector(camState.dir, t);
    if (out.y <= w.terrain.heightAt(out.x, out.z)) {
      out.y = w.terrain.heightAt(out.x, out.z);
      return true;
    }
  }
  return false;
}

function aimDirFrom(x: number, y: number, z: number, out: THREE.Vector3) {
  // shoot toward what the crosshair looks at (~70m ahead)
  tmp.copy(camState.pos).addScaledVector(camState.dir, 70);
  return out.set(tmp.x - x, tmp.y - y, tmp.z - z).normalize();
}

function setOrder(w: World, o: ArmyOrder) {
  w.order = o;
  w.rally = null;
  const text = { attack: ['ATTACK', 'The host follows you into battle'], guard: ['GUARD THE KING', 'The host forms rings around you'], hold: ['HOLD SURYAGARH', 'The host defends the capital'] }[o];
  say(text[0], text[1], 'blue');
  audio.play('uiConfirm');
}

export function freeKing(w: World, reason: string) {
  const k = w.king;
  k.capture = 'free';
  k.unit.hp = k.unit.maxHp * 0.5;
  k.invuln = 5;
  k.jailCamp = null;
  for (const c of k.carriers) if (c.alive) c.role = 'soldier';
  k.carriers = [];
  // step out of the cage
  k.unit.vy = 5;
  k.unit.grounded = false;
  say('THE KING IS FREE', reason, 'gold');
  audio.play('warcry');
  emit('gold', k.unit.x, k.unit.y + 1.5, k.unit.z, 40, { speed: 8, up: 3, life: 1.2 });
  w.rings.push({ x: k.unit.x, y: k.unit.y + 0.3, z: k.unit.z, t: 0, dur: 0.9, radius: 12, color: 'gold' });
}

function capture(w: World, dt: number) {
  const k = w.king;
  const u = k.unit;
  if (k.capture === 'free' && u.hp < u.maxHp * 0.15 && u.hp > 0) {
    k.capture = 'trapping';
    say('THE TRAITORS CLOSE IN', 'They want you alive — break away!', 'crimson');
  }
  if (k.capture === 'trapping' && u.hp > u.maxHp * 0.3) k.capture = 'free';
  if ((k.capture === 'free' || k.capture === 'trapping') && u.hp <= 0) {
    let best = Infinity;
    let camp = null;
    for (const c of w.camps) {
      if (c.royal || c.fallen) continue;
      const d = Math.hypot(c.x - u.x, c.z - u.z);
      if (d < best) {
        best = d;
        camp = c;
      }
    }
    const cands = w.units
      .filter((o) => o.alive && o.team === 1 && o.morale === 'normal' && (o.type === 'swordsman' || o.type === 'spearman' || o.type === 'rakshas') && Math.hypot(o.x - u.x, o.z - u.z) < 90)
      .sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z))
      .slice(0, 4);
    if (!camp || cands.length === 0) {
      u.hp = u.maxHp * 0.35;
      k.capture = 'free';
      k.invuln = 4;
      say('YOU BREAK FREE', 'No traitor is left to bind you', 'gold');
      return;
    }
    k.capture = 'trapped';
    k.jailCamp = camp;
    k.cage.set(u.x, u.y, u.z);
    k.carriers = cands;
    for (const c of cands) {
      c.role = 'carrier';
      c.target = null;
    }
    k.riding = null;
    u.vx = u.vz = 0;
    audio.play('cage');
    useGameStore.getState().speak('Kaalrath', CAPTURE_LINE);
    say('THE KING IS TAKEN', `They drag you toward ${camp.lordName.split(' ')[0]}'s keep — press B for the war-horn, O for a dragon`, 'crimson');
  }
  if (k.capture === 'free' || k.capture === 'trapping') return;

  const living = k.carriers.filter((c) => c.alive && c.morale === 'normal');
  if ((k.capture === 'trapped' || k.capture === 'carried') && living.length === 0) {
    freeKing(w, 'Your captors lie dead');
    return;
  }
  const camp = k.jailCamp!;
  if (camp.fallen && k.capture !== 'jailed') {
    freeKing(w, 'Their lord is dead; the carriers scatter');
    return;
  }
  const slots = [
    [1.6, 1.6],
    [-1.6, 1.6],
    [1.6, -1.6],
    [-1.6, -1.6],
  ];
  if (k.capture === 'trapped') {
    let ready = true;
    living.forEach((c, i) => {
      const tx = k.cage.x + slots[i][0];
      const tz = k.cage.z + slots[i][1];
      const dx = tx - c.x;
      const dz = tz - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.2) {
        ready = false;
        c.vx = (dx / d) * c.speed * 1.2;
        c.vz = (dz / d) * c.speed * 1.2;
        c.x += c.vx * dt;
        c.z += c.vz * dt;
        c.yaw = Math.atan2(dx, dz);
        c.walk += c.speed * dt * 2.4;
        c.move = 1;
      } else c.move = 0;
      c.y = resolveGround(w, c, c.radius);
    });
    if (ready) k.capture = 'carried';
  } else if (k.capture === 'carried') {
    const ty = camp.y + CASTLE.KEEP_H;
    const fake = { x: k.cage.x, y: k.cage.y, z: k.cage.z } as Unit;
    navTarget(w, fake, camp.x, ty, camp.z, nav);
    const dx = nav.x - k.cage.x;
    const dz = nav.z - k.cage.z;
    const d = Math.hypot(dx, dz);
    const sp = 3.4;
    if (d > 0.3) {
      k.cage.x += (dx / d) * sp * dt;
      k.cage.z += (dz / d) * sp * dt;
    }
    const g = resolveGround(w, k.cage, 1.6);
    k.cage.y += (g - k.cage.y) * Math.min(1, dt * 10);
    const yaw = Math.atan2(dx, dz);
    living.forEach((c, i) => {
      c.x = k.cage.x + slots[i][0] * Math.cos(yaw) + slots[i][1] * Math.sin(yaw);
      c.z = k.cage.z - slots[i][0] * Math.sin(yaw) + slots[i][1] * Math.cos(yaw);
      c.y = k.cage.y;
      c.yaw = yaw;
      c.walk += sp * dt * 2.4;
      c.move = 1;
    });
    if (Math.hypot(camp.x - k.cage.x, camp.z - k.cage.z) < 2 && k.cage.y > camp.y + CASTLE.KEEP_H - 1) {
      k.capture = 'jailed';
      k.jailTime = 75;
      for (const c of living) c.role = 'soldier';
      say('JAILED ATOP THE KEEP', 'The Blood-Moon rite begins. Your host must reach you!', 'crimson');
      audio.play('horn', 0.6);
    }
  } else if (k.capture === 'jailed') {
    k.jailTime -= dt;
    let rescued = false;
    queryRadius(k.cage.x, k.cage.z, 3.6, (o) => {
      if (o.team === 0 && o.alive && o !== u && !o.alt && Math.abs(o.y - k.cage.y) < 2) rescued = true;
    });
    if (rescued) freeKing(w, 'Your soldiers break the cage');
  }
  // the king rattles the bars
  const ix = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);
  const iz = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0);
  u.x = k.cage.x + ix * 0.4;
  u.z = k.cage.z + iz * 0.4;
  u.y = k.cage.y;
  u.vx = u.vz = u.vy = 0;
  if ((ix || iz) && Math.random() < dt * 4) audio.play('cage', 0.3);
}

function dragonRide(w: World, d: Unit, dt: number) {
  const k = w.king;
  const u = k.unit;
  const boost = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const fwd = input.keys.has('KeyW') ? 1 : input.keys.has('KeyS') ? -0.6 : 0;
  const target = fwd > 0 ? (boost ? 58 : 38) : fwd < 0 ? 10 : 22;
  const cur = Math.hypot(d.vx, d.vy, d.vz);
  const sp = cur + (target - cur) * Math.min(1, dt * 1.5);
  const prevYaw = d.yaw;
  d.yaw = dampAngle(d.yaw, k.camYaw, 3, dt);
  const pitch = clamp(-k.camPitch * 0.9, -0.7, 0.7) + (input.keys.has('Space') ? 0.5 : 0) - (input.keys.has('ControlLeft') || input.keys.has('KeyC') ? 0.5 : 0);
  d.vx = Math.sin(d.yaw) * Math.cos(pitch) * sp;
  d.vz = Math.cos(d.yaw) * Math.cos(pitch) * sp;
  d.vy = Math.sin(pitch) * sp;
  d.x = clamp(d.x + d.vx * dt, -1100, 1100);
  d.z = clamp(d.z + d.vz * dt, -1100, 1100);
  const g = w.terrain.heightAt(d.x, d.z);
  d.y = clamp(d.y + d.vy * dt, g + 5, g + 240);
  d.roll = clamp(-angleDelta(prevYaw, d.yaw) / Math.max(dt, 1e-3) * 0.25, -0.7, 0.7);
  d.pitch = -pitch * 0.6;
  d.walk += dt * (fwd > 0 ? 1.4 : 0.8);
  u.x = d.x;
  u.y = d.y + 2.5;
  u.z = d.z;
  u.vx = d.vx;
  u.vz = d.vz;
  // breath
  d.attack = input.lmb || input.keys.has('Tab') ? 1 : 0;
}

export function tryMountToggle(w: World) {
  const k = w.king;
  if (k.riding) {
    const d = k.riding;
    k.riding = null;
    d.dive = 0;
    const u = k.unit;
    u.x = d.x;
    u.z = d.z;
    u.y = d.y;
    u.vy = 0;
    u.grounded = false;
    u.vx = d.vx * 0.3;
    u.vz = d.vz * 0.3;
    say('DISMOUNTED', undefined, 'ember');
    return;
  }
  const dragon = w.units.find((o) => o.alive && o.type === 'dragon');
  if (!dragon) {
    say('NO DRAGON ANSWERS', `Perform the Ember Rite first (O · ${COSTS.rite} ember)`, 'ember');
    return;
  }
  dragon.dive = -1; // pickup mode
  audio.play('roar', 0.6);
}

export function updateKing(w: World, dt: number, realDt: number) {
  const k = w.king;
  const u = k.unit;
  const settings = useGameStore.getState().settings;
  const sens = 0.0022 * settings.sensitivity;
  k.camYaw -= input.mouseDX * sens;
  k.camPitch += input.mouseDY * sens * (settings.invertY ? -1 : 1);
  k.camPitch = clamp(k.camPitch, k.firstPerson ? -1.2 : -0.55, k.firstPerson ? 1.2 : 1.15);
  if (input.wheel) k.camDist = clamp(k.camDist + input.wheel * 0.9, 4, 18);
  if (k.invuln > 0) k.invuln -= dt;
  k.hurtFlash = Math.max(0, k.hurtFlash - realDt * 1.5);
  for (const key of ['cry', 'charge', 'slam', 'horn'] as const) k.cd[key] = Math.max(0, k.cd[key] - dt);
  k.throwCd -= dt;
  k.swingCd -= dt;
  const P = input.pressed;

  // global commands (work in most states)
  if (P.has('KeyV')) k.firstPerson = !k.firstPerson;
  if (P.has('KeyH')) useGameStore.getState().toggleHelp();
  if (P.has('KeyZ')) setOrder(w, 'attack');
  if (P.has('KeyX')) setOrder(w, 'guard');
  if (P.has('KeyC') && !k.riding) setOrder(w, 'hold');
  if (P.has('KeyB') || P.has('AltLeft') || P.has('AltRight')) {
    if (k.cd.horn > 0) say('THE HORN IS SILENT', `Ready in ${Math.ceil(k.cd.horn)}s`, 'ember');
    else if (w.ember < COSTS.horn) say('NOT ENOUGH EMBER', `The war-horn needs ${COSTS.horn}`, 'ember');
    else {
      w.ember -= COSTS.horn;
      k.cd.horn = COOLDOWNS.horn;
      spawnBackup(w);
    }
  }
  if (P.has('KeyO')) {
    const existing = w.units.find((o) => o.alive && o.type === 'dragon');
    const captured = k.capture === 'trapped' || k.capture === 'carried' || k.capture === 'jailed';
    if (captured && existing) {
      existing.dive = -2; // rescue mode
      audio.play('roar', 0.8);
      say('A DRAGON ANSWERS', 'It flies for your cage', 'ember');
    } else if (w.ember < COSTS.rite) say('NOT ENOUGH EMBER', `The Ember Rite needs ${COSTS.rite}`, 'ember');
    else if (w.rituals.some((r) => !r.done)) say('THE RITE IS UNDERWAY', undefined, 'ember');
    else {
      w.ember -= COSTS.rite;
      const yaw = k.camYaw;
      const base = captured ? w.royal : null;
      const x = base ? base.x : u.x + Math.sin(yaw) * 22;
      const z = base ? base.z + 50 : u.z + Math.cos(yaw) * 22;
      w.rituals.push({ x, y: w.terrain.heightAt(x, z), z, t: 0, done: false });
      audio.play('scaryWind');
      audio.play('thunder', 0.7);
      say('THE EMBER RITE', 'Stone remembers fire…', 'ember');
    }
  }
  if (P.has('KeyP')) tryMountToggle(w);

  capture(w, dt);
  if (k.capture === 'trapped' || k.capture === 'carried' || k.capture === 'jailed') return;

  if (k.riding) {
    if (!k.riding.alive) {
      tryMountToggle(w);
    } else {
      dragonRide(w, k.riding, dt);
      return;
    }
  }

  // weapons
  if (P.has('Digit1')) k.weapon = 'sword';
  if (P.has('Digit2')) k.weapon = 'spear';
  if (P.has('Digit3')) k.weapon = 'bow';
  k.aiming = input.rmb || (k.weapon === 'bow' && input.lmb);

  // ── abilities
  if (P.has('KeyQ') && k.cd.cry <= 0) {
    k.cd.cry = COOLDOWNS.cry;
    queryRadius(u.x, u.z, 28, (o) => {
      if (o.team === 0 && o.alive) {
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.4);
        o.buff = 10;
        o.flash = 0.6;
      }
    });
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.15);
    u.buff = 10;
    w.rings.push({ x: u.x, y: u.y + 0.3, z: u.z, t: 0, dur: 1.1, radius: 28, color: 'gold' });
    emit('gold', u.x, u.y + 2, u.z, 50, { speed: 10, up: 2, life: 1.2, spread: 2 });
    audio.play('warcry');
  }
  if (P.has('KeyE') && k.cd.charge <= 0 && u.grounded) {
    k.cd.charge = COOLDOWNS.charge;
    k.charging = 0.6;
    audio.play('charge');
    w.shake = Math.max(w.shake, 0.3);
  }
  if (P.has('KeyR') && k.cd.slam <= 0 && u.grounded) {
    k.cd.slam = COOLDOWNS.slam;
    k.slamT = 0;
  }
  if (P.has('KeyF')) {
    if (w.rally) {
      w.rally = null;
      say('RALLY POINT CLEARED', undefined, 'blue');
    } else if (aimPoint(w, tmp)) {
      w.rally = tmp.clone();
      say('RALLY!', 'The host moves to your banner', 'blue');
      audio.play('horn', 0.4);
    }
  }
  if (P.has('KeyG')) {
    const armySize = w.units.reduce((n, o) => n + (o.alive && o.team === 0 ? 1 : 0), 0);
    if (w.ember < COSTS.recruit) say('NOT ENOUGH EMBER', `Recruiting costs ${COSTS.recruit}`, 'ember');
    else if (armySize > 400) say('THE HOST IS FULL', undefined, 'ember');
    else {
      w.ember -= COSTS.recruit;
      const kinds = ['swordsman', 'spearman', 'archer'] as const;
      const s = makeUnit(w, kinds[Math.floor(Math.random() * 3)], 0, u.x + (Math.random() - 0.5) * 5, u.z + (Math.random() - 0.5) * 5);
      s.camp = w.royal;
      s.flash = 1;
      emit('gold', s.x, s.y + 1, s.z, 16, { speed: 4, up: 3, life: 1 });
      audio.play('recruit');
    }
  }

  // ── slam (horse rears, then crashes down)
  if (k.slamT >= 0) {
    k.slamT += dt;
    k.rear = Math.sin(Math.min(1, k.slamT / 0.45) * Math.PI * 0.5);
    if (k.slamT >= 0.45) {
      k.slamT = -1;
      k.rear = 0;
      blast(w, u.x, u.z, 14, 230, 22, 11, 0, u);
      w.rings.push({ x: u.x, y: u.y + 0.3, z: u.z, t: 0, dur: 0.8, radius: 16, color: 'gold' });
      emit('dust', u.x, u.y + 0.4, u.z, 70, { speed: 14, up: 2, size: 1.6, life: 1.4, spread: 4 });
      emit('spark', u.x, u.y + 0.6, u.z, 50, { speed: 16, up: 6, size: 0.18, life: 0.8, spread: 2 });
      audio.play('slam');
      w.shake = Math.max(w.shake, 0.9);
      w.hitStop = 0.08;
    }
  } else k.rear = Math.max(0, k.rear - dt * 3);

  // ── movement (horse physics)
  const fwdX = Math.sin(k.camYaw);
  const fwdZ = Math.cos(k.camYaw);
  const ix = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);
  const iz = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0);
  // camera-relative input; right vector = (-cos yaw, sin yaw)
  let dx = fwdX * iz - Math.cos(k.camYaw) * ix;
  let dz = fwdZ * iz + Math.sin(k.camYaw) * ix;
  const il = Math.hypot(dx, dz);
  if (il > 0) {
    dx /= il;
    dz /= il;
  }
  const wantsGallop = (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')) && il > 0 && k.stamina > 0.04;
  const gallop = wantsGallop && !k.aiming;
  let max = gallop ? 17 : k.aiming ? 6 : 10;
  if (u.buff > 0) max *= 1.12;
  let tvx = dx * max;
  let tvz = dz * max;
  if (k.charging > 0) {
    k.charging -= dt;
    tvx = Math.sin(u.yaw) * 34;
    tvz = Math.cos(u.yaw) * 34;
    emit('fire', u.x, u.y + 1.2, u.z, 3, { speed: 2, up: 2, size: 0.5, life: 0.5, spread: 1 });
    queryRadius(u.x + Math.sin(u.yaw) * 1.5, u.z + Math.cos(u.yaw) * 1.5, 3.4, (o) => {
      if (o.team !== 1 || !o.alive || w.time - o.lastHit < 0.4) return;
      damage(w, o, 150, u, Math.sin(u.yaw) + (o.x - u.x) * 0.3, Math.cos(u.yaw) + (o.z - u.z) * 0.3, 18, 9);
      emit('spark', o.x, o.y + 1.2, o.z, 8, { speed: 8, up: 3 });
      audio.playAt('impact', o.x, o.y, o.z);
      w.shake = Math.max(w.shake, 0.25);
    });
  }
  if (u.grounded) {
    const rate = il > 0 || k.charging > 0 ? (gallop ? 2.2 : 3.2) : 4.5;
    const kf = 1 - Math.exp(-rate * dt);
    u.vx += (tvx - u.vx) * kf;
    u.vz += (tvz - u.vz) * kf;
    if (P.has('Space')) {
      u.vy = 8.4;
      u.grounded = false;
      audio.play('jump');
    }
  } else {
    u.vy -= GRAV * dt;
  }
  k.stamina = clamp(k.stamina + (gallop ? -0.2 : 0.14) * dt);
  const prevGround = u.grounded;
  u.x = clamp(u.x + u.vx * dt, -1080, 1080);
  u.z = clamp(u.z + u.vz * dt, -1080, 1080);
  u.y += u.vy * dt;
  const g = resolveGround(w, u, 1.1);
  if (u.y <= g) {
    if (!prevGround && u.vy < -6) {
      audio.play('land', clamp(-u.vy / 14));
      emit('dust', u.x, g + 0.3, u.z, 20, { speed: 5, up: 1, size: 1.1, life: 1 });
      w.shake = Math.max(w.shake, clamp(-u.vy / 30));
      if (u.vy < -22) damage(w, u, (-u.vy - 22) * 40, null);
    }
    u.y = g;
    u.vy = 0;
    u.grounded = true;
  } else if (u.y > g + 0.4) u.grounded = false;
  else if (u.grounded) u.y = g;
  k.leap += ((u.grounded ? 0 : 1) - k.leap) * Math.min(1, dt * 8);

  const speed = Math.hypot(u.vx, u.vz);
  const faceCam = k.firstPerson || k.aiming || (k.weapon === 'sword' && k.swingT >= 0);
  if (faceCam) u.yaw = dampAngle(u.yaw, k.camYaw, 10, dt);
  else if (speed > 1) u.yaw = dampAngle(u.yaw, Math.atan2(u.vx, u.vz), gallop ? 4 : 6, dt);
  const stride = speed > 11 ? 5 : 3;
  const prevGait = k.gait;
  k.gait += (speed / stride) * dt;
  if (u.grounded && speed > 1 && Math.floor(k.gait * 2) !== Math.floor(prevGait * 2)) audio.play('hoof', clamp(speed / 12, 0.3, 1));

  // trample: a galloping war-horse bowls infantry over
  if (speed > 9 && u.grounded) {
    queryRadius(u.x + Math.sin(u.yaw) * 1.4, u.z + Math.cos(u.yaw) * 1.4, 1.9, (o) => {
      if (o.team !== 1 || !o.alive || o.mass > 3 || w.time - o.lastHit < 0.6) return;
      damage(w, o, 35, u, o.x - u.x, o.z - u.z, 9, 4.5);
      audio.playAt('impact', o.x, o.y, o.z, 0.7);
    });
  }

  // ── attacks
  if (k.weapon === 'sword') {
    if (k.swingT >= 0) {
      const dur = k.combo === 2 ? 0.55 : 0.42;
      const prev = k.swingT;
      k.swingT += dt;
      const hitAt = dur * 0.45;
      if (prev < hitAt && k.swingT >= hitAt) {
        const fx = Math.sin(u.yaw);
        const fz = Math.cos(u.yaw);
        let hits = 0;
        const heavy = k.combo === 2;
        queryRadius(u.x + fx * 1.2, u.z + fz * 1.2, 4.4, (o) => {
          if (o.team !== 1 || !o.alive || hits >= 6) return;
          const ox = o.x - u.x;
          const oz = o.z - u.z;
          const ol = Math.hypot(ox, oz) || 1;
          if ((ox * fx + oz * fz) / ol < 0.3 || Math.abs(o.y - u.y) > 3.5) return;
          hits++;
          damage(w, o, heavy ? 200 : 115, u, ox, oz, heavy ? 12 : 4, heavy ? 5 : 1);
          emit(o.type === 'rakshas' ? 'fire' : 'spark', o.x - (ox / ol) * 0.4, o.y + 1.3 * o.scale, o.z - (oz / ol) * 0.4, 10, { speed: 8, up: 2, size: 0.14, life: 0.4 });
        });
        audio.play(hits ? 'clash' : 'swing', hits ? 1 : 0.7);
        if (hits) {
          w.hitStop = Math.max(w.hitStop, heavy ? 0.09 : 0.045);
          w.shake = Math.max(w.shake, heavy ? 0.3 : 0.12);
        }
      }
      if (k.swingT >= dur) k.swingT = -1;
    } else if (input.lmb && k.swingCd <= 0) {
      k.combo = (k.combo + 1) % 3;
      k.swingT = 0;
      k.swingCd = k.combo === 2 ? 0.6 : 0.44;
    }
  } else if (k.weapon === 'spear') {
    if (k.swingT >= 0) {
      k.swingT += dt;
      if (k.swingT > 0.5) k.swingT = -1;
    }
    if (input.lmb && k.throwCd <= 0) {
      k.throwCd = 0.65;
      k.swingT = 0;
      const sx = u.x;
      const sy = u.y + 3;
      const sz = u.z;
      aimDirFrom(sx, sy, sz, tmp);
      spawnProjectile(w, { kind: 'royalSpear', x: sx, y: sy, z: sz, vx: tmp.x * 58, vy: tmp.y * 58 + 1.5, vz: tmp.z * 58, team: 0, damage: 170, life: 5, pierce: 3, owner: u });
      audio.play('spear');
    }
  } else {
    if (input.lmb) {
      k.drawing = true;
      k.draw = Math.min(1, k.draw + dt / 0.75);
    } else if (k.drawing) {
      k.drawing = false;
      const p = k.draw;
      const sx = u.x;
      const sy = u.y + 3;
      const sz = u.z;
      aimDirFrom(sx, sy, sz, tmp);
      const v = 38 + p * 52;
      spawnProjectile(w, { kind: 'royalArrow', x: sx, y: sy, z: sz, vx: tmp.x * v, vy: tmp.y * v + 1, vz: tmp.z * v, team: 0, damage: 55 + p * 160, life: 5, pierce: p > 0.9 ? 3 : 1, owner: u });
      audio.play('bow');
      audio.play('arrow', 0.6);
      k.draw = 0;
    }
  }

  // regeneration out of combat
  if (w.time - k.lastDamage > 6 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.025 * dt);
}
