import { audio } from '../audio/audio';
import { useGameStore } from '../store/gameStore';
import { emit, fx } from './fx';
import { queryRadius } from './physics';
import { makeUnit } from './world';
import type { Unit, World } from './types';
import { BOSS_DEATH_LINE, DYING_WORDS } from '../story/campaign';

export const GRAV = 22;

const say = (title: string, subtitle: string | undefined, tone: 'gold' | 'crimson' | 'ember' | 'blue') =>
  useGameStore.getState().pushBanner({ title, subtitle, tone });

export function knock(u: Unit, dx: number, dz: number, force: number, up: number) {
  const l = Math.hypot(dx, dz) || 1;
  const m = 1 / Math.max(0.5, u.mass);
  u.vx += (dx / l) * force * m;
  u.vz += (dz / l) * force * m;
  u.vy += up * m;
  if (up * m > 1.5) u.grounded = false;
}

/** Apply damage; handles death, ember, morale break, shards and the king's capture threshold. */
export function damage(w: World, target: Unit, amount: number, from: Unit | null, kx = 0, kz = 0, force = 0, up = 0) {
  if (!target.alive) return;
  const king = w.king;
  if (target === king.unit) {
    if (king.invuln > 0 || king.capture !== 'free' && king.capture !== 'trapping') return;
    if (king.riding) return;
    amount *= 0.6;
    king.lastDamage = w.time;
    king.hurtFlash = Math.min(1, king.hurtFlash + amount / 250);
    if (amount > 20) audio.play('hurt', 0.8);
  }
  if (target.morale === 'kneel' || target.morale === 'ash') return;
  if (from && from.buff > 0) amount *= 1.5;
  target.hp -= amount;
  target.flash = 1;
  target.lastHit = w.time;
  if (force || up) knock(target, kx, kz, force, up);
  if (target.hp > 0) return;

  if (target === king.unit) {
    target.hp = 0;
    return; // capture handled by the king system
  }
  kill(w, target, from, kx, kz, force);
}

export function kill(w: World, u: Unit, from: Unit | null, kx = 0, kz = 0, force = 0) {
  u.alive = false;
  u.hp = 0;
  u.deadTime = 0;
  u.target = null;
  u.attack = -1;
  u.attackT = -1;
  const f = Math.max(force, 4);
  const l = Math.hypot(kx, kz) || 1;
  // ragdoll tumble: spin backwards away from the blow
  u.spinX = -(3 + Math.random() * 5) * (f / 8);
  u.spinZ = (Math.random() - 0.5) * 6;
  if (u.grounded) {
    u.vy += 2 + Math.random() * 2;
    u.grounded = false;
  }
  u.vx += (kx / l) * 0.5;
  u.vz += (kz / l) * 0.5;
  if (u.type !== 'eagle' && u.type !== 'dragon') audio.playAt('death', u.x, u.y, u.z, 0.8);

  const king = w.king;
  if (u.team === 1) {
    const gain = u.type === 'rakshas' ? 5 : u.type === 'lord' ? 60 : u.type === 'boss' ? 200 : 2;
    w.ember += gain;
    w.emberEarned += gain;
    emit('ember', u.x, u.y + 1.2, u.z, Math.min(10, 2 + gain), { speed: 3, up: 3, life: 1.6, size: 0.22, homing: true });
    if (from === king.unit || from?.id === king.riding?.id) {
      king.kills++;
      king.comboCount++;
      king.comboT = 3.5;
    }
    if (u.type === 'lord') lordFalls(w, u);
    if (u.type === 'boss') bossFalls(w, u);
  }
}

function lordFalls(w: World, lord: Unit) {
  w.lordsSlain++;
  audio.play('lordSlain');
  w.killcam = { t: 0, dur: 2.2, x: lord.x, y: lord.y, z: lord.z, boss: false };
  w.timeScale = 0.2;
  w.shards.push({ x: lord.x, y: lord.y + 1.5, z: lord.z, t: 0, collected: false });
  say('TRAITOR LORD SLAIN', lord.lordName, 'gold');
  useGameStore.getState().speak(lord.lordName ?? 'Traitor Lord', DYING_WORDS[Math.floor(Math.random() * DYING_WORDS.length)]);
  const camp = lord.camp;
  if (camp) {
    camp.fallen = true;
    let knelt = 0;
    for (const u of w.units) {
      if (!u.alive || u.camp !== camp || u.team !== 1 || u === lord) continue;
      if (u.type === 'rakshas') {
        u.morale = 'ash';
        u.moraleT = Math.random() * 2.5;
      } else if (Math.random() < 0.6) {
        u.morale = 'kneel';
        u.moraleT = 1.5 + Math.random() * 1.5;
        knelt++;
      } else {
        u.morale = 'flee';
        u.moraleT = 0;
      }
    }
    if (knelt > 0) {
      setTimeout(() => say('THEY KNEEL', `${knelt} of ${(lord.lordName ?? 'the lord').split(' ')[0]}'s soldiers swear fealty to you`, 'blue'), 2600);
    }
  }
}

function bossFalls(w: World, boss: Unit) {
  audio.play('lordSlain', 1.3);
  audio.play('roar', 0.6);
  w.killcam = { t: 0, dur: 4, x: boss.x, y: boss.y, z: boss.z, boss: true };
  w.timeScale = 0.12;
  say('THE ECLIPSE KING FALLS', 'Kaalrath is defeated', 'gold');
  useGameStore.getState().speak('Kaalrath', BOSS_DEATH_LINE);
  for (const u of w.units) {
    if (u.alive && u.team === 1) {
      if (u.type === 'rakshas') {
        u.morale = 'ash';
        u.moraleT = Math.random() * 3;
      } else {
        u.morale = 'kneel';
        u.moraleT = 1 + Math.random() * 2;
      }
    }
  }
}

/** Area blast used by Solar Slam, lord slams and Kaalrath's shadow wave. */
export function blast(w: World, x: number, z: number, radius: number, dmg: number, force: number, up: number, team: 0 | 1, from: Unit | null) {
  queryRadius(x, z, radius, (u, d2) => {
    if (u.team === team || !u.alive) return;
    const d = Math.sqrt(d2);
    const k = 1 - d / radius;
    damage(w, u, dmg * (0.4 + 0.6 * k), from, u.x - x, u.z - z, force * (0.4 + 0.6 * k), up * (0.5 + 0.5 * k));
  });
}

export function spawnBackup(w: World) {
  const c = w.royal;
  const gx = c.x;
  const gz = c.z + 48;
  const minister = makeUnit(w, 'minister', 0, gx, gz);
  minister.role = 'backup';
  minister.camp = c;
  const kinds = ['swordsman', 'spearman', 'archer'] as const;
  for (let i = 0; i < 14; i++) {
    const u = makeUnit(w, kinds[i % 3], 0, gx + (Math.random() - 0.5) * 12, gz + 3 + Math.random() * 10);
    u.role = 'backup';
    u.camp = c;
  }
  const e = makeUnit(w, 'eagle', 0, gx, gz);
  e.role = 'flyer';
  audio.play('horn');
  say('THE WAR-HORN ANSWERS', 'Devdutt rides out of Suryagarh with the host', 'blue');
}

export function comboTick(w: World, dt: number) {
  const k = w.king;
  if (k.comboT > 0) {
    k.comboT -= dt;
    if (k.comboT <= 0) k.comboCount = 0;
  }
  fx.homeX = k.unit.x;
  fx.homeY = k.unit.y;
  fx.homeZ = k.unit.z;
}
