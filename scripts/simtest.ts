// Headless simulation soak test: plays every chapter with an autopilot king (no rendering).
// Run: npx esbuild scripts/simtest.ts --bundle --platform=node --outfile=/tmp/simtest.cjs && node /tmp/simtest.cjs
import { CHAPTERS, CHAPTER_ORDER } from '../src/story/campaign';
import { createWorld } from '../src/game/world';
import { updateUnits } from '../src/game/ai';
import { updateKing, camState } from '../src/game/player';
import { stepSystems } from '../src/game/systems';
import { comboTick } from '../src/game/combat';
import { input, consumeFrame } from '../src/game/input';
import type { World } from '../src/game/types';
import { navTarget } from '../src/game/physics';

const nav = { x: 0, z: 0 };

function pilot(w: World) {
  const k = w.king;
  const u = k.unit;
  input.keys.clear();
  input.lmb = false;
  const camp = w.camps.find((c) => !c.royal && !c.fallen && (c.lord?.alive ?? false));
  if (!camp) return;
  const lord = camp.lord!;
  let tx = lord.x;
  let tz = lord.z;
  let best = 25 * 25;
  for (const o of w.units) {
    if (!o.alive || o.team !== 1 || o.alt) continue;
    const d = (o.x - u.x) ** 2 + (o.z - u.z) ** 2;
    if (d < best) { best = d; tx = o.x; tz = o.z; }
  }
  const ty = best < 25 * 25 ? u.y : lord.y;
  navTarget(w, u, tx, ty, tz, nav);
  const want = Math.atan2(nav.x - u.x, nav.z - u.z);
  k.camYaw = want;
  camState.pos.set(u.x - Math.sin(want) * 8, u.y + 4, u.z - Math.cos(want) * 8);
  camState.dir.set(Math.sin(want), -0.1, Math.cos(want)).normalize();
  input.keys.add('KeyW');
  if (best > 20 * 20) input.keys.add('ShiftLeft');
  else input.lmb = true;
  if (Math.random() < 0.01) input.pressed.add('KeyR');
  if (Math.random() < 0.005) input.pressed.add('KeyE');
  if (Math.random() < 0.004) input.pressed.add('KeyQ');
  if (w.ember > 150 && Math.random() < 0.01) input.pressed.add('KeyO');
  if (u.hp < u.maxHp * 0.25) u.hp = u.maxHp; // keep the pilot alive so the soak covers whole chapters
}

let failures = 0;
for (const id of CHAPTER_ORDER) {
  const w = createWorld(CHAPTERS[id], 0.2);
  const t0 = performance.now();
  let steps = 0;
  let worst = 0;
  const dt = 1 / 60;
  let simT = 0;
  try {
    while (simT < 900 && !(w.ended && w.endTimer <= 0)) {
      const s0 = performance.now();
      pilot(w);
      const scale = w.hitStop > 0 ? 0.06 : w.timeScale;
      const d = dt * scale;
      w.time += d;
      updateKing(w, d, dt);
      comboTick(w, d);
      updateUnits(w, d);
      stepSystems(w, d, dt);
      consumeFrame();
      simT += dt;
      steps++;
      if (process.env.TRACE === id && steps % 1800 === 0) {
        const k = w.king.unit;
        const c = w.camps.find((cc) => !cc.royal && !cc.fallen && (cc.lord?.alive ?? false));
        console.log(`  t=${simT.toFixed(0)} king ${k.x.toFixed(0)},${k.y.toFixed(1)},${k.z.toFixed(0)} v=${Math.hypot(k.vx, k.vz).toFixed(1)} cap=${w.king.capture} riding=${!!w.king.riding} camp=${c?.id} lord=${c?.lord?.x.toFixed(0)},${c?.lord?.y.toFixed(1)},${c?.lord?.z.toFixed(0)} hp=${c?.lord?.hp.toFixed(0)}`);
      }
      worst = Math.max(worst, performance.now() - s0);
      for (const u of w.units) {
        if (!Number.isFinite(u.x + u.y + u.z + u.vx + u.vy + u.vz)) throw new Error(`NaN on unit ${u.type} ${u.id}`);
      }
    }
  } catch (e) {
    failures++;
    console.log(`✗ ${id}: ${(e as Error).stack}`);
    continue;
  }
  if (!w.ended) {
    // diagnose a stall: where are the surviving lords relative to their castles?
    const k = w.king.unit;
    console.log(`  king at ${k.x.toFixed(0)},${k.y.toFixed(1)},${k.z.toFixed(0)} capture=${w.king.capture}`);
    for (const c of w.camps) {
      const lx = (k.x - c.x) * c.cos - (k.z - c.z) * c.sin;
      const lz = (k.x - c.x) * c.sin + (k.z - c.z) * c.cos;
      if (Math.hypot(lx, lz) < 120) {
        navTarget(w, k, c.lord?.x ?? c.x, c.lord?.y ?? c.y, c.lord?.z ?? c.z, nav);
        const nx = (nav.x - c.x) * c.cos - (nav.z - c.z) * c.sin;
        const nz = (nav.x - c.x) * c.sin + (nav.z - c.z) * c.cos;
        console.log(`  king local to camp ${c.id}: ${lx.toFixed(1)},${(k.y - c.y).toFixed(1)},${lz.toFixed(1)} → waypoint ${nx.toFixed(1)},${nz.toFixed(1)}`);
      }
    }
    for (const c of w.camps) {
      const l = c.lord;
      if (!l || !l.alive) continue;
      const lx = (l.x - c.x) * c.cos - (l.z - c.z) * c.sin;
      const lz = (l.x - c.x) * c.sin + (l.z - c.z) * c.cos;
      console.log(`  ${l.type} ${l.lordName} local ${lx.toFixed(1)},${(l.y - c.y).toFixed(1)},${lz.toFixed(1)} hp ${l.hp.toFixed(0)} target=${l.target?.type ?? '-'}`);
    }
  }
  const ms = (performance.now() - t0) / steps;
  const alive = w.units.filter((u) => u.alive).length;
  console.log(
    `${w.victory ? '✓' : '·'} ${id.padEnd(13)} sim ${simT.toFixed(0)}s  lords ${w.lordsSlain}/${w.lordsTotal}${w.boss ? ` boss ${w.boss.alive ? 'alive' : 'slain'}` : ''}  ` +
      `sworn ${w.sworn}  kills ${w.king.kills}  units ${alive}  dragons ${w.dragonsSummoned}  avg ${ms.toFixed(2)}ms worst ${worst.toFixed(1)}ms  ended=${w.ended} victory=${w.victory}`,
  );
}
process.exit(failures ? 1 : 0);
