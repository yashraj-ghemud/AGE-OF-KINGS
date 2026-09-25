import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cine, dipAmount, evalShot, resetCine, type ProgramName } from './cine';
import { cineLayout, IMPACT_XZ } from './layout';
import { introProgram, endingProgram, introSunElev, sunDirFromElev, TITLE_T, type Program } from './programs';
import { CrownAndShards, EggChamber, END, HIT_T, LightPillars, Lightning } from './sets';
import { Atmosphere } from '../world/Sky';
import { MOODS, cloneMood, mixMood, moodForDawn, type Mood } from '../world/mood';
import { SharedClock } from '../world/materials';
import { createTerrainMaterial } from '../world/terrain';
import { Castle, castleGeometry } from '../world/Castle';
import { Forest, GrassField } from '../world/Vegetation';
import { AmbientParticles, Clouds, FireField, type CloudSpec, type FireSource } from '../world/Particles';
import { PuppetRenderer, makePuppet, type Puppet } from '../world/Puppets';
import { Dragon, Kaalrath, Rider, makeDragonPose, makeKaalPose, makeRiderPose } from '../world/Heroes';
import { BreathStream, type BreathSource } from '../world/Breath';
import { PostFX } from '../world/PostFX';
import { audio } from '../audio/audio';
import { clamp, easeInOutSine, lerp, noise1, pulse, rng, smoothstep } from '../lib/math';
import { useGameStore, type Quality } from '../store/gameStore';

const tmpV = new THREE.Vector3();

function Director({
  program,
  refs,
}: {
  program: ProgramName;
  refs: SceneRefs;
}) {
  const { camera } = useThree();
  const L = useMemo(cineLayout, []);
  const programs = useMemo(() => ({ intro: introProgram(L), ending: endingProgram(L) }), [L]);
  const lastT = useRef(0);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const smoothLook = useMemo(() => new THREE.Vector3(), []);
  const menuT = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const startT = Number(params.get('t') ?? 0) || 0;
    resetCine(program, program === 'menu' ? 0 : startT);
    if (params.get('freeze')) cine.playing = false;
    lastT.current = startT - 0.001;
    menuT.current = program === 'menu' ? startT : 0;
    if (program === 'ending') audio.resetMusicBus();
  }, [program]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const prog: Program | null = program === 'intro' ? programs.intro : program === 'ending' ? programs.ending : null;
    if (cine.seek !== null) {
      cine.t = cine.seek;
      lastT.current = cine.seek - 0.001;
      cine.seek = null;
    }
    if (cine.playing) cine.t += dt;
    const t = cine.t;

    // audio cues crossed this frame (skip stale ones after a seek)
    if (prog) {
      for (const c of prog.cues) {
        if (c.t > lastT.current && c.t <= t && t - c.t < 0.5) audio.cue(c.name);
      }
      if (t >= prog.duration) cine.done = true;
    }
    lastT.current = t;

    const cam = camera as THREE.PerspectiveCamera;
    const mood = refs.mood.current;
    let shake = 0;

    if (prog) {
      const shot = prog.shots.find((s) => t >= s.start && t < s.end) ?? prog.shots[prog.shots.length - 1];
      const { fov, roll } = evalShot(shot, t, pos, look);
      const hs = shot.shake ?? 0;
      pos.x += noise1(t * 0.7) * hs;
      pos.y += noise1(t * 0.6 + 10) * hs;
      look.x += noise1(t * 0.5 + 20) * hs * 0.5;
      cam.fov = fov;
      cam.position.copy(pos);
      cam.up.set(Math.sin(roll), Math.cos(roll), 0);
      cam.lookAt(look);
      cine.fade = Math.max(dipAmount(prog.dips, t, 'black'), program === 'intro' ? 1 - smoothstep(0.2, 3.2, t) : 1 - smoothstep(0, 1.5, t));
      cine.flash = Math.max(dipAmount(prog.dips, t, 'white'), dipAmount(prog.dips, t, 'gold'));
      cine.flashColor = dipAmount(prog.dips, t, 'gold') > dipAmount(prog.dips, t, 'white') ? '255,214,140' : '255,246,232';
      cine.letterbox = 1;
    } else {
      // MENU: slow orbit around Suryagarh; the first seconds descend from the sky
      menuT.current += dt;
      const m = menuT.current;
      const th = Math.PI + m * 0.022;
      pos.set(Math.sin(th) * 170, L.hC + 58 + Math.sin(m * 0.13) * 6, Math.cos(th) * 170);
      look.set(cine.mouse.x * 14, L.hC + 10 - cine.mouse.y * 6, 0);
      pos.x += cine.mouse.x * 6;
      pos.y += cine.mouse.y * 4;
      const k = easeInOutSine(smoothstep(0.2, 4.5, m));
      if (k < 1) {
        sunDirFromElev(0.45, tmpV);
        const sky = pos.clone().addScaledVector(tmpV, 100);
        look.lerp(sky, 1 - k);
      }
      cam.fov = 48;
      cam.position.copy(pos);
      smoothLook.lerp(look, m < 0.1 || smoothLook.lengthSq() === 0 ? 1 : 1 - Math.exp(-dt * 4));
      cam.up.set(0, 1, 0);
      cam.lookAt(smoothLook);
      cine.fade = 0;
      cine.flash = 0;
      cine.letterbox = 0;
    }
    cam.updateProjectionMatrix();

    // ── mood
    if (program === 'intro') {
      if (t < 7) mixMood(mood, MOODS.night, MOODS.dawnGold, smoothstep(1, 9, t));
      else if (t < 23) mixMood(mood, MOODS.dawnGold, MOODS.dawnGold, 0);
      else mixMood(mood, MOODS.dawnGold, MOODS.eclipse, smoothstep(24, 30.5, t));
      if (t >= 58 && t < 64) mixMood(mood, MOODS.cave, MOODS.cave, 0);
      mood.sunElev = introSunElev(t);
      mood.coronaAmt += pulse(t, 72, 72.3, 73, 76) * 2.5;
    } else if (program === 'ending') {
      if (t < 27) mixMood(mood, MOODS.eclipse, MOODS.eclipse, 0);
      else mixMood(mood, MOODS.eclipse, MOODS.sunrise, smoothstep(27, 34, t));
      mood.sunElev = lerp(0.6, 0.32, smoothstep(27, 40, t));
      mood.eclipse = 1 - smoothstep(27.5, 32, t);
    } else {
      moodForDawn(mood, cine.dawn);
      mood.sunElev = 0.45;
    }
    mood.sunAzim = 0;
    refs.cloudTint.current.copy(mood.horizon).lerp(mood.sun, 0.25).multiplyScalar(program === 'intro' && t < 23 ? 1.2 : 0.4);

    // ── transient effects
    const aberr = program === 'intro' ? Math.max(0, 1 - Math.abs(t - HIT_T) * 1.2) + pulse(t, 72, 72.1, 72.5, 73.5) * 0.8 + pulse(t, 69.75, 69.8, 70.0, 70.6) * 0.5 : program === 'ending' ? pulse(t, END.reform - 0.1, END.reform, END.reform + 0.2, END.reform + 1.2) * 0.6 : 0;
    cine.aberration = aberr;
    refs.aberration.current = aberr;
    let lightning = 0;
    if (program === 'intro') {
      lightning = pulse(t, 31.0, 31.05, 31.2, 31.5) + pulse(t, 33.4, 33.45, 33.55, 33.8) * 0.8 + pulse(t, 35.6, 35.62, 35.7, 36) * 0.9 + pulse(t, 69.8, 69.82, 70.0, 70.4);
      shake = Math.max(0, 1 - Math.abs(t - HIT_T) * 2) * 0.35 + pulse(t, 72, 72.05, 72.3, 73) * 0.4 + pulse(t, 69.8, 69.85, 70, 70.5) * 0.25;
      for (const it of L.impactTimes) shake += pulse(t, it, it + 0.05, it + 0.2, it + 1) * 0.6;
    } else if (program === 'ending') {
      shake = pulse(t, 18.4, 18.6, 21, 23) * 0.3 + pulse(t, END.reform, END.reform + 0.05, END.reform + 0.2, END.reform + 0.8) * 0.2;
    }
    refs.flash.current = lightning * 0.6;
    if (shake > 0) {
      const tt = state.clock.elapsedTime * 30;
      cam.position.x += noise1(tt) * shake;
      cam.position.y += noise1(tt + 50) * shake;
    }

    // ── focus for grass + shadows: point on the ground in front of the camera
    refs.focus.current.copy(program === 'menu' ? L.castle : look);
    if (program === 'intro' && t >= 64) refs.focus.current.copy(L.hero);
    refs.focus.current.y = L.terrain.heightAt(refs.focus.current.x, refs.focus.current.z);

    // particles
    refs.goldDust.current = program === 'intro' ? pulse(t, 6, 9, 22, 25) : 0;
    refs.embers.current = program === 'intro' ? smoothstep(24, 31, t) * (t >= 58 && t < 64 ? 0.2 : 1) : program === 'ending' ? 1 - smoothstep(30, 36, t) * 0.6 : 1;
    refs.clouds.current = program === 'intro' && t > 4 && t < 17;

    // ── set pieces
    const kaal = refs.kaalGroup.current;
    const kp = refs.kaalPose.current;
    if (kaal) {
      if (program === 'intro' && t >= 30.5 && t < 37) {
        kaal.visible = true;
        kaal.position.set(0, L.hC + 15.6, 40);
        kaal.rotation.y = Math.PI;
        kp.swing = -1;
        kp.burn = 1;
        kp.kneel = 0;
      } else if (program === 'intro' && t >= 37 && t < 43) {
        kaal.visible = true;
        kaal.position.set(1.7, L.hC, 27.4);
        kaal.rotation.y = Math.PI;
        kp.kneel = 0;
        kp.swing =
          t < 37.4 ? -1 :
          t < 38.1 ? lerp(0, 0.4, (t - 37.4) / 0.7) :
          t < HIT_T ? lerp(0.4, 0.557, (t - 38.1) / (HIT_T - 38.1)) :
          t < 41 ? lerp(0.557, 0.6, (t - HIT_T) / (41 - HIT_T)) :
          lerp(0.6, 0.8, clamp((t - 41) / 0.4));
      } else if (program === 'ending' && t < 5.2) {
        kaal.visible = true;
        kaal.position.set(0, L.hC, 27.2);
        kaal.rotation.y = Math.PI;
        kp.swing = -1;
        kp.kneel = smoothstep(0.2, 2.2, t);
        kp.burn = 1 - smoothstep(1, 4, t);
      } else kaal.visible = false;
    }

    const hero = refs.heroGroup.current;
    const hp = refs.heroPose.current;
    if (hero) {
      hero.visible = program === 'intro' && t >= 63.5;
      hero.position.copy(L.hero);
      hero.rotation.y = Math.PI;
      hp.speed = 0;
      hp.gait += dt * 0.5;
      hp.raise = smoothstep(68.3, 69.5, t);
      hp.fire = smoothstep(69.8, 70.3, t);
      hp.rear = pulse(t, 70.0, 70.5, 71.0, 71.9);
    }

    // horde march
    const hordeVisible = program === 'intro' && t > 42.5;
    const march = 1.5 * (t - 51);
    const perp = tmpV.set(-L.hordeDir.z, 0, L.hordeDir.x);
    const yaw = Math.atan2(L.hordeDir.x, L.hordeDir.z);
    for (let i = 0; i < L.horde.length; i++) {
      const p = L.horde[i];
      const o = L.hordeOffsets[i];
      p.hidden = !hordeVisible;
      if (!hordeVisible) continue;
      const along = march - o.along;
      p.x = L.hordeStart.x + L.hordeDir.x * along + perp.x * o.side;
      p.z = L.hordeStart.z + L.hordeDir.z * along + perp.z * o.side;
      p.y = L.terrain.heightAt(p.x, p.z);
      p.yaw = yaw + Math.sin(t * 0.7 + i) * 0.05;
      p.walk = t * 5.2 + i * 0.37;
      p.move = 1;
    }

    // ending: the royal army cheers at dawn
    const army = refs.army.current;
    for (let i = 0; i < army.length; i++) {
      const p = army[i];
      p.hidden = !(program === 'ending' && t > 30);
      const cheer = t > 34 ? ((t * 0.9 + i * 0.137) % 1.4) / 1.0 : -1;
      p.attack = cheer >= 0 && cheer <= 1 ? cheer : -1;
    }

    // Aruna
    const dg = refs.dragonGroup.current;
    const dp = refs.dragonPose.current;
    const br = refs.breath;
    if (dg) {
      const on = program === 'ending' && t > 18.6;
      dg.visible = on;
      br.active = 0;
      if (on) {
        const path = refs.dragonPath;
        // burst out of the court fast, then a long majestic climb
        const u = t < 23 ? 0.3 * smoothstep(18.6, 23, t) : 0.3 + 0.7 * easeInOutSine(clamp((t - 23) / 17));
        path.getPoint(u, tmpV);
        dg.position.copy(tmpV);
        path.getPoint(Math.min(1, u + 0.01), look);
        const breathing = pulse(t, 26.8, 27.3, 30.6, 31.4);
        sunDirFromElev(mood.sunElev, pos);
        const target = dg.position.clone().add(breathing > 0.05 ? pos.clone().multiplyScalar(50) : look.clone().sub(dg.position).normalize().multiplyScalar(50));
        const m = new THREE.Matrix4().lookAt(target, dg.position, new THREE.Vector3(0, 1, 0));
        dg.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 1 - Math.exp(-dt * 3));
        dg.scale.setScalar(2.2 * smoothstep(18.6, 19.6, t) + 0.01);
        dp.flap += dt * (t < 22 ? 1.4 : 0.9);
        dp.flapAmp = 1;
        dp.spread = smoothstep(18.8, 20.5, t);
        dp.breath = breathing;
        // mouth ≈ 5.5 units ahead of the body centre (scaled)
        br.origin.copy(dg.position).addScaledVector(pos, 12);
        br.dir.copy(pos);
        br.active = breathing;
      }
    }

    // intro finished → the overlay moves on to the menu
    if (program === 'intro' && t > TITLE_T) cine.letterbox = 1 - smoothstep(TITLE_T + 5.5, TITLE_T + 8, t);
  }, -2);

  return null;
}

interface SceneRefs {
  mood: React.MutableRefObject<Mood>;
  focus: React.MutableRefObject<THREE.Vector3>;
  flash: React.MutableRefObject<number>;
  aberration: React.MutableRefObject<number>;
  goldDust: React.MutableRefObject<number>;
  embers: React.MutableRefObject<number>;
  clouds: React.MutableRefObject<boolean>;
  cloudTint: React.MutableRefObject<THREE.Color>;
  kaalGroup: React.MutableRefObject<THREE.Group | null>;
  kaalPose: React.MutableRefObject<ReturnType<typeof makeKaalPose>>;
  heroGroup: React.MutableRefObject<THREE.Group | null>;
  heroPose: React.MutableRefObject<ReturnType<typeof makeRiderPose>>;
  horde: React.MutableRefObject<Puppet[]>;
  army: React.MutableRefObject<Puppet[]>;
  dragonGroup: React.MutableRefObject<THREE.Group | null>;
  dragonPose: React.MutableRefObject<ReturnType<typeof makeDragonPose>>;
  dragonPath: THREE.CatmullRomCurve3;
  breath: BreathSource;
}

function CloudLayer({ show, tint }: { show: React.MutableRefObject<boolean>; tint: React.MutableRefObject<THREE.Color> }) {
  const L = cineLayout();
  const clouds = useMemo<CloudSpec[]>(() => {
    const r = rng(12);
    const out: CloudSpec[] = [];
    for (let i = 0; i < 70; i++) {
      out.push({ x: -260 + r() * 460, y: L.hC + 170 + r() * 90, z: -720 + r() * 460, s: 60 + r() * 90, seed: i });
    }
    return out;
  }, [L]);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (g.current) g.current.visible = show.current;
  });
  return (
    <group ref={g}>
      <Clouds clouds={clouds} tint={tint} opacity={0.8} />
    </group>
  );
}

function Scene({ program, quality }: { program: ProgramName; quality: Quality }) {
  const L = useMemo(cineLayout, []);
  const terrainGeo = useMemo(() => L.terrain.buildGeometry(), [L]);
  const terrainMat = useMemo(() => {
    const m = createTerrainMaterial();
    m.map!.repeat.set(1, 1);
    return m;
  }, []);
  const refs: SceneRefs = {
    mood: useRef(cloneMood(MOODS.night)),
    focus: useRef(new THREE.Vector3()),
    flash: useRef(0),
    aberration: useRef(0),
    goldDust: useRef(0),
    embers: useRef(0),
    clouds: useRef(false),
    cloudTint: useRef(new THREE.Color()),
    kaalGroup: useRef<THREE.Group>(null),
    kaalPose: useRef(makeKaalPose()),
    heroGroup: useRef<THREE.Group>(null),
    heroPose: useRef(makeRiderPose()),
    horde: useRef(L.horde),
    army: useRef<Puppet[]>([]),
    dragonGroup: useRef<THREE.Group>(null),
    dragonPose: useRef(makeDragonPose()),
    dragonPath: useMemo(
      () =>
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, L.hC - 8, 20),
          new THREE.Vector3(0, L.hC + 18, 24),
          new THREE.Vector3(-6, L.hC + 45, 40),
          new THREE.Vector3(4, L.hC + 70, 80),
          new THREE.Vector3(10, L.hC + 120, 170),
          new THREE.Vector3(0, L.hC + 260, 420),
        ]),
      [L],
    ),
    breath: useMemo(() => ({ origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), active: 0 }), []),
  };

  // royal army for the ending
  useMemo(() => {
    const r = rng(5);
    const out: Puppet[] = [];
    for (let row = 0; row < 12; row++) {
      for (let c = 0; c < 20; c++) {
        const x = (c - 9.5) * 2.2 + (r() - 0.5) * 0.5;
        const z = 70 + row * 2.4 + (r() - 0.5) * 0.5;
        const kinds = ['swordsman', 'spearman', 'archer'] as const;
        const p = makePuppet({ kind: kinds[(row + c) % 3], team: 0, x, z, y: L.terrain.heightAt(x, z), yaw: Math.PI, hidden: true });
        out.push(p);
      }
    }
    out.push(makePuppet({ kind: 'minister', team: 0, x: 0, z: 64, y: L.terrain.heightAt(0, 64), yaw: Math.PI, hidden: true }));
    refs.army.current = out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);
  const allPuppets = useRef<Puppet[]>([]);
  useFrame(() => {
    allPuppets.current = refs.horde.current.concat(refs.army.current);
  }, -1);

  const fires = useMemo<FireSource[]>(() => {
    const f: FireSource[] = castleGeometry('court').fires.map((v) => ({ x: v.x + L.castle.x, y: v.y + L.castle.y, z: v.z + L.castle.z, scale: 1.1 }));
    const r = rng(3);
    L.impacts.forEach((p, i) => {
      f.push({ x: p.x, y: p.y + 1, z: p.z, scale: 9, start: L.impactTimes[i] });
      for (let k = 0; k < 10; k++) {
        const a = r() * Math.PI * 2;
        const d = 20 + r() * 70;
        const x = p.x + Math.cos(a) * d;
        const z = p.z + Math.sin(a) * d;
        f.push({ x, y: L.terrain.heightAt(x, z), z, scale: 2 + r() * 4, start: L.impactTimes[i] + 0.3 + r() * 2 });
      }
    });
    return f;
  }, [L]);

  const avoid = useMemo(
    () => [
      { x: 0, z: 0, r: 120 },
      { x: 0, z: 716, r: 40 },
      ...IMPACT_XZ.map(([x, z]) => ({ x, z, r: 40 })),
    ],
    [],
  );
  const dead = useMemo(() => IMPACT_XZ.map(([x, z]) => ({ x, z, r: 110 })), []);
  const shadows = quality !== 'performance';
  const grass = quality === 'cinematic' ? 26000 : quality === 'balanced' ? 14000 : 0;

  const pillarIntensity = (i: number, t: number) => {
    if (program === 'intro') {
      const it = L.impactTimes[i];
      if (t < it) return 0;
      return 0.55 + Math.max(0, 1 - (t - it) * 0.6) * 1.8;
    }
    if (program === 'ending') return 0.6 * (1 - smoothstep(END.shardsLaunch, END.shardsLaunch + 1.5, t));
    return 0.5 * (1 - cine.dawn * 0.8);
  };

  const heroLightningFrom = useMemo(() => L.hero.clone().add(new THREE.Vector3(-170, 300, 40)), [L]);
  const heroLightningTo = useMemo(() => L.hero.clone().add(new THREE.Vector3(-0.34, 5, 0.1)), [L]);
  const kaalBoltFrom = useMemo(() => new THREE.Vector3(-120, L.hC + 420, 260), [L]);
  const kaalBoltTo = useMemo(() => new THREE.Vector3(-30, L.hC + 40, 120), [L]);

  return (
    <>
      <SharedClock />
      <Director program={program} refs={refs} />
      <Atmosphere mood={refs.mood} focus={refs.focus} shadowSize={110} shadowMapSize={quality === 'cinematic' ? 4096 : 2048} shadows={shadows} flash={refs.flash} />
      <mesh geometry={terrainGeo} material={terrainMat} receiveShadow />
      <Castle kind="court" position={L.castle} shadows={shadows} />
      <Forest terrain={L.terrain} seed={21} count={quality === 'performance' ? 900 : 1800} radius={1150} avoid={avoid} deadZones={dead} shadows={shadows} />
      <GrassField terrain={L.terrain} focus={refs.focus} count={grass} radius={42} />
      <FireField sources={fires} clock={() => (program === 'intro' ? cine.t : 1e6)} />
      <AmbientParticles count={1400} area={140} height={60} size={0.55} rise={1.6} color="#ff6a1f" color2="#ffc070" opacityRef={refs.embers} />
      <AmbientParticles count={700} area={160} height={70} size={0.9} rise={-0.8} swirl={3} color="#3a3230" color2="#5a4a44" additive={false} opacity={0.5} opacityRef={refs.embers} />
      <AmbientParticles count={900} area={120} height={50} size={0.45} rise={0.35} swirl={4} color="#ffe0a0" color2="#ffffff" opacityRef={refs.goldDust} />
      <CloudLayer show={refs.clouds} tint={refs.cloudTint} />
      <CrownAndShards layout={L} mode={program} />
      <LightPillars layout={L} intensity={pillarIntensity} />
      <Lightning from={() => heroLightningFrom} to={() => heroLightningTo} active={(t) => (program === 'intro' ? pulse(t, 69.78, 69.8, 70.05, 70.3) : 0)} />
      <Lightning from={() => kaalBoltFrom} to={() => kaalBoltTo} active={(t) => (program === 'intro' ? pulse(t, 31.0, 31.02, 31.15, 31.4) + pulse(t, 33.4, 33.42, 33.5, 33.7) + pulse(t, 35.6, 35.62, 35.7, 35.9) : 0)} />
      <EggChamber layout={L} glow={() => {
        const t = cine.t;
        if (program !== 'intro' || t < 57 || t > 65) return 0;
        const beat = (t - 58) % 1.0;
        return Math.exp(-Math.pow(beat * 7, 2)) + Math.exp(-Math.pow((beat - 0.27) * 7, 2)) * 0.6 + smoothstep(62, 64, t) * 0.4;
      }} />
      <group ref={refs.kaalGroup} visible={false} scale={3.2}>
        <Kaalrath pose={refs.kaalPose} shadows={shadows} />
      </group>
      <group ref={refs.heroGroup} visible={false}>
        <Rider pose={refs.heroPose} shadows={shadows} />
      </group>
      <group ref={refs.dragonGroup} visible={false}>
        <Dragon pose={refs.dragonPose} variant="sun" shadows={shadows} />
      </group>
      <BreathStream source={refs.breath} length={160} spread={24} count={1400} />
      <PuppetRenderer puppets={allPuppets} capacity={700} maxDistance={600} shadows={shadows} />
      <PostFX quality={quality} aberration={refs.aberration} />
    </>
  );
}

export default function CinematicWorld({ program }: { program: ProgramName }) {
  const quality = useGameStore((s) => s.settings.quality);
  const dpr: [number, number] = quality === 'cinematic' ? [1, 2] : quality === 'balanced' ? [1, 1.5] : [0.7, 1];
  return (
    <Canvas
      shadows={quality !== 'performance' ? 'soft' : false}
      dpr={dpr}
      camera={{ fov: 50, near: 0.3, far: 9000, position: [0, 300, -900] }}
      gl={{ antialias: quality === 'performance', powerPreference: 'high-performance', stencil: false }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene program={program} quality={quality} />
    </Canvas>
  );
}
