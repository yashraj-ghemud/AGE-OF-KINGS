import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, type HudState } from '../store/gameStore';
import { CHAPTERS, OPENING_LINES, TAUNTS, dawnForProgress } from '../story/campaign';
import { audio } from '../audio/audio';
import { createWorld } from './world';
import { updateUnits } from './ai';
import { updateKing } from './player';
import { stepSystems } from './systems';
import { updateCamera, resetCamera } from './camera';
import { comboTick } from './combat';
import { clearFx } from './fx';
import { attachInput, consumeFrame, input, requestLock } from './input';
import type { World } from './types';
import { Atmosphere } from '../world/Sky';
import { MOODS, cloneMood, moodForDawn } from '../world/mood';
import { SharedClock } from '../world/materials';
import { createTerrainMaterial } from '../world/terrain';
import { Castle, castleGeometry } from '../world/Castle';
import { Forest, GrassField } from '../world/Vegetation';
import { AmbientParticles, FireField, type FireSource } from '../world/Particles';
import { PuppetRenderer } from '../world/Puppets';
import { PostFX } from '../world/PostFX';
import { rng } from '../lib/math';
import { Cage, FxPoints, HealthBars, KingModel, Projectiles, RallyMarker, Rings, Rituals, Shards, SpecialUnits } from './Renderers';
import { HUD } from '../ui/HUD';
import { PauseMenu, Results } from '../ui/GameOverlays';

export const gameRef: { world: World | null } = { world: null };

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const DEMO = params.get('demo') === '1';

/** Debug autopilot (?demo=1): ride at the nearest stronghold and fight — used for automated visual checks. */
function autopilot(w: World) {
  const k = w.king;
  const u = k.unit;
  const camp = w.camps.find((c) => !c.royal && !c.fallen);
  input.keys.clear();
  input.lmb = false;
  if (!camp) return;
  const gx = camp.x + camp.sin * 50;
  const gz = camp.z + camp.cos * 50;
  let tx = gx;
  let tz = gz;
  let best = 30 * 30;
  for (const o of w.units) {
    if (!o.alive || o.team !== 1 || o.alt) continue;
    const d = (o.x - u.x) ** 2 + (o.z - u.z) ** 2;
    if (d < best) {
      best = d;
      tx = o.x;
      tz = o.z;
    }
  }
  const want = Math.atan2(tx - u.x, tz - u.z);
  k.camYaw += Math.atan2(Math.sin(want - k.camYaw), Math.cos(want - k.camYaw)) * 0.1;
  k.camPitch = 0.22;
  if (best < 30 * 30) {
    if (best > 9) input.keys.add('KeyW');
    input.lmb = true;
  } else {
    input.keys.add('KeyW');
    input.keys.add('ShiftLeft');
  }
}

function Loop({ world }: { world: World }) {
  const { camera } = useThree();
  const hudT = useRef(0);
  const store = useGameStore;
  const finished = useRef(false);

  useFrame((_, rawDt) => {
    const realDt = Math.min(rawDt, 0.05);
    const { paused, screen } = store.getState();
    const running = screen === 'playing' && !paused;
    if (params.get('nointro')) world.intro = 1;
    input.enabled = running;
    if (running) {
      const scale = world.hitStop > 0 ? 0.06 : world.timeScale;
      const dt = realDt * scale;
      world.time += dt;
      if (DEMO) autopilot(world);
      updateKing(world, dt, realDt);
      comboTick(world, dt);
      updateUnits(world, dt);
      stepSystems(world, dt, realDt);
    }
    updateCamera(world, camera as THREE.PerspectiveCamera, realDt);
    consumeFrame();
    audio.battleIntensity = world.combatHeat;

    hudT.current += realDt;
    if (hudT.current > 0.1) {
      hudT.current = 0;
      store.getState().setHud(snapshot(world));
    }
    if (world.ended && world.endTimer <= 0 && !finished.current) {
      finished.current = true;
      document.exitPointerLock?.();
      store.getState().finish({
        victory: !!world.victory,
        reason: world.victory ? CHAPTERS[world.chapter.id].victory : world.defeatReason,
        chapterId: world.chapter.id,
        stats: {
          kills: world.king.kills, lords: world.lordsSlain + (world.boss && !world.boss.alive ? 1 : 0), sworn: world.sworn,
          time: world.time, ember: world.emberEarned, dragons: world.dragonsSummoned,
        },
      });
    }
  }, -2);
  return null;
}

function snapshot(w: World): HudState {
  const k = w.king;
  let army = 0;
  let enemies = 0;
  for (const u of w.units) {
    if (!u.alive || u === k.unit) continue;
    if (u.team === 0) army++;
    else if (u.morale === 'normal') enemies++;
  }
  // nearest living lord within 60m gets the boss bar
  let boss: HudState['boss'] = null;
  let bd = 60 * 60;
  for (const c of w.camps) {
    const l = c.lord;
    if (!l || !l.alive) continue;
    const d = (l.x - k.unit.x) ** 2 + (l.z - k.unit.z) ** 2;
    if (d < bd || (l.type === 'boss' && d < 110 * 110)) {
      bd = d;
      boss = { name: l.lordName ?? 'Traitor Lord', hp: l.hp, max: l.maxHp };
    }
  }
  return {
    health: k.unit.hp, maxHealth: k.unit.maxHp, stamina: k.stamina, ember: Math.floor(w.ember), army, enemies,
    lordsLeft: w.lordsTotal - w.lordsSlain + (w.boss && w.boss.alive ? 1 : 0), lordsTotal: w.lordsTotal + (w.boss ? 1 : 0),
    order: w.order, weapon: k.weapon, cd: { ...k.cd }, capture: k.capture, jailTime: k.jailTime, boss,
    riding: !!k.riding, nearDragon: w.units.some((u) => u.alive && u.type === 'dragon'), bowDraw: k.draw, combo: k.comboCount,
    dawn: w.dawn, firstPerson: k.firstPerson, aiming: k.aiming, rally: !!w.rally, summoning: w.rituals.some((r) => !r.done),
  };
}

function Battlefield({ world }: { world: World }) {
  const quality = useGameStore((s) => s.settings.quality);
  const shadows = quality !== 'performance';
  const terrainGeo = useMemo(() => world.terrain.buildGeometry(), [world]);
  const terrainMat = useMemo(createTerrainMaterial, []);
  const mood = useRef(cloneMood(MOODS.eclipse));
  const focus = useRef(new THREE.Vector3());
  const puppets = useRef(world.units);
  const aberr = useRef(0);
  const bossDark = useRef(0);

  useFrame((_, dt) => {
    puppets.current = world.units;
    const k = world.king;
    focus.current.set(k.unit.x, k.unit.y, k.unit.z);
    bossDark.current += ((world.bossPhase ? 0.7 : 0) - bossDark.current) * Math.min(1, dt * 0.5);
    moodForDawn(mood.current, world.dawn, bossDark.current);
    mood.current.sunElev = 0.32;
    mood.current.sunAzim = 0.4;
    // gameplay needs to read clearly even under the eclipse
    mood.current.hemiIntensity *= 2.1;
    mood.current.lightIntensity *= 1.5;
    mood.current.fogDensity *= 0.7;
    mood.current.exposure *= 1.2;
    mood.current.hemiSky.lerp(new THREE.Color('#8a6a78'), 0.35);
    aberr.current = Math.max(k.hurtFlash * 0.6, world.hitStop > 0 ? 0.5 : 0, world.killcam ? 0.25 : 0);
  }, -1);

  const fires = useMemo<FireSource[]>(() => {
    const out: FireSource[] = [];
    const r = rng(world.chapter.config.seed + 7);
    for (const c of world.camps) {
      for (const v of castleGeometry(c.kind).fires) {
        out.push({ x: c.x + v.x * c.cos + v.z * c.sin, y: c.y + v.y, z: c.z - v.x * c.sin + v.z * c.cos, scale: 1.1 });
      }
      if (!c.royal) {
        for (let i = 0; i < 8; i++) {
          const a = r() * Math.PI * 2;
          const d = 70 + r() * 60;
          const x = c.x + Math.cos(a) * d;
          const z = c.z + Math.sin(a) * d;
          out.push({ x, y: world.terrain.heightAt(x, z), z, scale: 1.5 + r() * 3 });
        }
      }
    }
    return out;
  }, [world]);
  const avoid = useMemo(() => world.camps.map((c) => ({ x: c.x, z: c.z, r: 105 })), [world]);
  const dead = useMemo(() => world.camps.filter((c) => !c.royal).map((c) => ({ x: c.x, z: c.z, r: 170 })), [world]);
  const grass = quality === 'cinematic' ? 30000 : quality === 'balanced' ? 16000 : 0;

  return (
    <>
      <SharedClock />
      <Atmosphere mood={mood} focus={focus} shadowSize={75} shadowMapSize={quality === 'cinematic' ? 4096 : 2048} shadows={shadows} />
      <mesh geometry={terrainGeo} material={terrainMat} receiveShadow />
      {world.camps.map((c) => (
        <Castle key={c.id} kind={c.kind} position={[c.x, c.y, c.z]} rotation={c.rot} shadows={shadows} />
      ))}
      <Forest terrain={world.terrain} seed={world.chapter.config.seed} count={quality === 'performance' ? 800 : 1600} radius={1000} avoid={avoid} deadZones={dead} ash={world.terrain.spec.ash} shadows={shadows} />
      <GrassField terrain={world.terrain} focus={focus} count={grass} radius={45} tint={world.terrain.spec.ash ?? 0} />
      <FireField sources={fires} />
      <AmbientParticles count={1200} area={130} height={50} size={0.5} rise={1.4} color="#ff6a1f" color2="#ffc070" opacity={0.9} />
      <AmbientParticles count={600} area={140} height={60} size={0.8} rise={-0.7} swirl={3} color="#3a3230" color2="#5a4a44" additive={false} opacity={0.45} />
      <PuppetRenderer puppets={puppets} capacity={1800} maxDistance={260} shadows={shadows} />
      <KingModel world={world} />
      <SpecialUnits world={world} />
      <Projectiles world={world} />
      <FxPoints />
      <Rings world={world} />
      <Shards world={world} />
      <Cage world={world} />
      <Rituals world={world} />
      <RallyMarker world={world} />
      <HealthBars world={world} />
      <PostFX quality={quality} aberration={aberr} />
      <Loop world={world} />
    </>
  );
}

export default function Game() {
  const chapterId = useGameStore((s) => s.chapterId);
  const runId = useGameStore((s) => s.runId);
  const quality = useGameStore((s) => s.settings.quality);
  const paused = useGameStore((s) => s.paused);
  const screen = useGameStore((s) => s.screen);
  const wrap = useRef<HTMLDivElement>(null);
  const world = useMemo(() => {
    clearFx();
    resetCamera();
    const done = useGameStore.getState().progress.completed.length;
    const w = createWorld(CHAPTERS[chapterId] ?? CHAPTERS.start, dawnForProgress(done));
    if (new URLSearchParams(location.search).get('near')) {
      // debug: start in front of the first stronghold
      const c = w.camps[1];
      const u = w.king.unit;
      u.x = c.x + c.sin * 95;
      u.z = c.z + c.cos * 95;
      u.y = w.terrain.heightAt(u.x, u.z);
      w.king.camYaw = Math.atan2(c.x - u.x, c.z - u.z);
      for (const s of w.units) {
        if (s.team === 0 && s !== u && !s.alt) {
          s.x = u.x + (Math.random() - 0.5) * 20;
          s.z = u.z + (Math.random() - 0.5) * 20;
          s.y = w.terrain.heightAt(s.x, s.z);
        }
      }
    }
    return w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, runId]);
  gameRef.world = world;

  useEffect(() => {
    audio.startBattleMusic();
    const el = wrap.current!;
    const detach = attachInput(el);
    const onLock = () => {
      if (!document.pointerLockElement && useGameStore.getState().screen === 'playing' && !world.ended) {
        useGameStore.getState().setPaused(true);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !document.pointerLockElement && useGameStore.getState().screen === 'playing') {
        useGameStore.getState().setPaused(!useGameStore.getState().paused);
      }
    };
    document.addEventListener('pointerlockchange', onLock);
    window.addEventListener('keydown', esc);
    useGameStore.getState().pushBanner({ title: `CHAPTER ${world.chapter.numeral}`, subtitle: world.chapter.title, tone: 'gold' });
    setTimeout(() => useGameStore.getState().pushBanner({ title: 'OBJECTIVE', subtitle: world.chapter.objective, tone: 'ember' }), 3200);
    const timers: number[] = [];
    (OPENING_LINES[world.chapter.id] ?? []).forEach(([who, line], i) => {
      timers.push(window.setTimeout(() => useGameStore.getState().speak(who, line), 7500 + i * 6000));
    });
    // the Eclipse King watches: an occasional taunt while the battle rages
    let taunt = Math.floor(Math.random() * TAUNTS.length);
    const tauntTimer = window.setInterval(() => {
      const s = useGameStore.getState();
      if (s.screen !== 'playing' || s.paused || world.ended) return;
      s.speak('Kaalrath', TAUNTS[taunt++ % TAUNTS.length]);
    }, 95000);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(tauntTimer);
      detach();
      document.removeEventListener('pointerlockchange', onLock);
      window.removeEventListener('keydown', esc);
      document.exitPointerLock?.();
      gameRef.world = null;
    };
  }, [world]);

  const dpr: [number, number] = quality === 'cinematic' ? [1, 2] : quality === 'balanced' ? [1, 1.5] : [0.7, 1];
  return (
    <div ref={wrap} className="absolute inset-0" onMouseDown={() => !paused && screen === 'playing' && requestLock(wrap.current!)}>
      <Canvas
        shadows={quality !== 'performance' ? 'soft' : false}
        dpr={dpr}
        camera={{ fov: 60, near: 0.2, far: 6000, position: [0, 200, -200] }}
        gl={{ antialias: quality === 'performance', powerPreference: 'high-performance', stencil: false }}
      >
        <Battlefield world={world} />
      </Canvas>
      {screen === 'playing' && <HUD world={world} />}
      {screen === 'playing' && paused && <PauseMenu onResume={() => requestLock(wrap.current!)} />}
      {screen === 'results' && <Results />}
    </div>
  );
}
