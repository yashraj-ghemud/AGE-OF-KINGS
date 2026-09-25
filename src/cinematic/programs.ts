import * as THREE from 'three';
import { compileShots, type CompiledShot, type Cue, type Dip, type Subtitle } from './cine';
import type { CineLayout } from './layout';
import { HIT_T, END } from './sets';
import { easeInOutCubic, easeOutCubic, smoothstep } from '../lib/math';

export interface Program {
  duration: number;
  shots: CompiledShot[];
  subtitles: Subtitle[];
  cues: Cue[];
  dips: Dip[];
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const TITLE_T = 72;
export const INTRO_END = 80.5;
export const ENDING_END = 47;

/** Sun elevation during the prologue (the sun climbs while the moon swallows it). */
export function introSunElev(t: number) {
  if (t < 12) return -0.1 + 0.3 * smoothstep(0, 12, t);
  if (t < 23) return 0.2;
  return 0.2 + 0.4 * smoothstep(23, 30, t);
}

export function sunDirFromElev(elev: number, out: THREE.Vector3) {
  return out.set(0, Math.sin(elev), Math.cos(elev)).normalize();
}

function lookToSky(from: number, to: number, elevFn: (t: number) => number) {
  const sun = new THREE.Vector3();
  return (u: number, t: number, out: THREE.Vector3, pos: THREE.Vector3) => {
    const k = easeInOutCubic(smoothstep(from, to, u));
    sunDirFromElev(elevFn(t), sun);
    const sky = pos.clone().addScaledVector(sun, 100);
    out.lerp(sky, k);
  };
}

export function introProgram(L: CineLayout): Program {
  const hC = L.hC;
  const T = L.terrain;
  const G = (x: number, y: number, z: number) => V(x, T.heightAt(x, z) + y, z);
  const c = L.crown;
  const h = L.hero;
  const cave = L.cave;
  const shots = compileShots([
    // 1. Before memory
    { start: 0, end: 7, pos: [V(0, hC + 300, -900), V(0, hC + 318, -790)], look: [V(0, hC + 400, 200), V(0, hC + 392, 200)], fov: [50, 46] },
    // 2. Suryagarh — through the clouds
    {
      start: 7, end: 16,
      pos: [V(30, hC + 330, -720), V(-40, hC + 228, -470), V(-150, hC + 118, -250), V(-168, hC + 62, -92), V(-118, hC + 36, 46)],
      look: [V(0, hC + 250, 0), V(0, hC + 120, 0), V(0, hC + 40, 0), V(0, hC + 18, 0), V(0, hC + 12, 6)],
      fov: [58, 42], ease: (u) => easeInOutCubic(u) * 0.9 + u * 0.1, shake: 0.15,
    },
    // 3. The Crown
    {
      start: 16, end: 23,
      pos: [V(-9, hC + 2.4, 31), V(-5.5, hC + 3.3, 28.6), V(-2.2, hC + 4.3, 26.8)],
      look: [c.clone().add(V(0, 0.15, 0))], fov: [38, 30], shake: 0.03,
    },
    // 4. The Eclipse — behind the crown, tilting into the sky
    {
      start: 23, end: 31,
      pos: [V(-1.2, hC + 1.9, 11.2), V(-0.4, hC + 3.2, 10.6), V(0, hC + 5, 10)],
      look: [c.clone()], fov: [40, 56], shake: 0.04,
      lookFn: lookToSky(0.2, 0.85, introSunElev),
    },
    // 5. Kaalrath on the gatehouse
    { start: 31, end: 37, pos: [V(2.4, hC + 1.4, 14), V(0.6, hC + 2.1, 19)], look: [V(0, hC + 20, 40), V(0, hC + 21.8, 40)], fov: [44, 36], shake: 0.05 },
    // 6. The Shattering
    { start: 37, end: 43, pos: [V(-10.8, hC + 3.7, 23.2), V(-9.6, hC + 4.1, 22.7), V(-8.9, hC + 4.6, 22.4)], look: [V(0, hC + 5.4, 23.6), V(0, hC + 5.6, 23), V(0, hC + 7.5, 22)], fov: [40, 38], shake: 0.03 },
    // 7. Seven Fires
    { start: 43, end: 51, pos: [V(-70, hC + 235, -200), V(40, hC + 262, -130)], look: [V(0, hC + 60, 420), V(0, hC + 40, 450)], fov: [56, 52], shake: 0.3 },
    // 8. The Horde
    {
      start: 51, end: 58,
      pos: [G(29, 1.7, 493), G(31, 2.4, 484)], look: [G(40, 2.3, 510), G(41, 3.2, 502)], fov: [42, 38], shake: 0.06,
    },
    // 9. The Egg
    { start: 58, end: 64, pos: [V(0, cave.y + 1.3, 7.6), V(0.3, cave.y + 0.95, 3.5)], look: [V(0, cave.y + 0.7, 0)], fov: [40, 33], shake: 0.02 },
    // 10. The Last King — orbit from behind to the front
    {
      start: 64, end: 72,
      pos: [V(h.x + 3.5, h.y + 3.4, h.z + 13), V(h.x + 8.5, h.y + 2.8, h.z + 4), V(h.x + 5.5, h.y + 1.8, h.z - 5.5), V(h.x + 2.4, h.y + 1.45, h.z - 7.5)],
      look: [V(h.x, h.y + 1.8, h.z - 18), V(h.x, h.y + 2.4, h.z - 2), V(h.x, h.y + 3.5, h.z + 2), V(h.x, h.y + 4.4, h.z + 2)],
      fov: [40, 44], shake: 0.04,
    },
    // 11. Title — tilt up into the eclipse
    {
      start: 72, end: INTRO_END + 5,
      pos: [V(h.x + 2.4, h.y + 1.45, h.z - 7.5), V(h.x + 2.2, h.y + 1.35, h.z - 8.2)],
      look: [V(h.x, h.y + 4.4, h.z + 2)], fov: [44, 50], ease: easeOutCubic,
      lookFn: lookToSky(0.0, 0.45, introSunElev),
    },
  ]);

  const subtitles: Subtitle[] = [
    { start: 0.4, end: 3.9, text: 'Yashraj Ghemud|presents', style: 'presents' },
    { start: 4.0, end: 6.8, text: 'Before there were kings… there was the Sun.' },
    { start: 8.6, end: 15.2, text: 'And the Sun had a keeper — the Crown of Suryagarh.' },
    { start: 16.8, end: 22.6, text: 'For a thousand years its light held back the dark… and kept the dragon dreaming.' },
    { start: 24.2, end: 30.4, text: 'Until the night your brother traded the Sun for a crown of shadow.' },
    { start: 30.5, end: 32.1, text: 'ONE BETRAYAL', style: 'card' },
    { start: 32.2, end: 36.6, text: 'Kaalrath|The Eclipse King', style: 'name' },
    { start: 39.0, end: 40.9, text: 'ONE NIGHT', style: 'card' },
    { start: 44.2, end: 50.4, text: 'Seven shards fell. Seven traitor lords rose to claim them.' },
    { start: 50.5, end: 51.7, text: 'SEVEN TRAITORS', style: 'card' },
    { start: 51.8, end: 57.4, text: 'And from the Ashen Deep… the Rakshas answered.' },
    { start: 58.8, end: 63.6, text: 'Yet beneath the ashes, the dragon still dreams…' },
    { start: 63.7, end: 64.9, text: 'ONE KING', style: 'card' },
    { start: 65.0, end: 68.4, text: '…and one king still stands.' },
    { start: 69.9, end: 71.8, text: 'Rise, Vikram. Take back the light.' },
  ];

  const cues: Cue[] = [
    { t: 0.15, name: 'opening' },
    { t: 30.5, name: 'card' },
    { t: 39.0, name: 'cardSilent' },
    { t: 50.5, name: 'card' },
    { t: 63.7, name: 'card' },
    { t: 7, name: 'suryagarh' },
    { t: 16, name: 'crown' },
    { t: 23, name: 'eclipse' },
    { t: 31, name: 'kaalrath' },
    { t: 33.4, name: 'thunderFar' },
    { t: 35.6, name: 'thunderFar' },
    { t: HIT_T, name: 'shatter' },
    { t: 41, name: 'rise' },
    { t: 43, name: 'sevenFires' },
    ...L.impactTimes.map((t) => ({ t, name: 'impact' })),
    { t: 51, name: 'horde' },
    { t: 58, name: 'egg' },
    { t: 64, name: 'lastKing' },
    { t: 69.8, name: 'lightning' },
    { t: TITLE_T, name: 'title' },
  ];

  const dips: Dip[] = [
    { t: 7, dur: 0.9, kind: 'gold' },
    { t: 16, dur: 0.7, kind: 'black' },
    { t: 23, dur: 0.4, kind: 'black' },
    { t: 31, dur: 0.6, kind: 'white' },
    { t: 37, dur: 0.5, kind: 'black' },
    { t: HIT_T, dur: 0.5, kind: 'white' },
    { t: 43, dur: 0.4, kind: 'white' },
    { t: 51, dur: 0.7, kind: 'black' },
    { t: 58, dur: 1.0, kind: 'black' },
    { t: 64, dur: 1.0, kind: 'black' },
    { t: 69.8, dur: 0.35, kind: 'white' },
    { t: TITLE_T, dur: 0.9, kind: 'white' },
  ];

  return { duration: INTRO_END, shots, subtitles, cues, dips };
}

/** The Dawn — ending cinematic, staged back in the Sun Court where it all began. */
export function endingProgram(L: CineLayout): Program {
  const hC = L.hC;
  const c = L.crown;
  const shots = compileShots([
    // 1. The Eclipse King falls (symbolic, in the Sun Court)
    { start: 0, end: 5, pos: [V(-12, hC + 2.6, 29.5), V(-10, hC + 3.1, 28.8)], look: [V(0, hC + 3.6, 27.2), V(0, hC + 3.2, 27.2)], fov: [42, 36], shake: 0.03 },
    // 2. Shards return — aerial, looking out at the pillars
    { start: 5, end: 12.5, pos: [V(-40, hC + 70, -60), V(-10, hC + 52, -40)], look: [V(0, hC + 90, 500), V(0, hC + 20, 30)], fov: [55, 48] },
    // 3. The Crown reforms
    { start: 12.5, end: 17, pos: [V(-6, hC + 3.6, 28), V(-2.6, hC + 4.6, 26.4)], look: [c.clone()], fov: [36, 30], shake: 0.02 },
    // 4. The dragon wakes — low angle
    { start: 17, end: 25, pos: [V(-13, hC + 1.4, 31), V(-15, hC + 1.9, 33)], look: [V(0, hC + 4, 20), V(0, hC + 30, 26)], fov: [50, 60], shake: 0.12 },
    // 5. Aruna's breath — following up into the eclipse
    {
      start: 25, end: 33,
      pos: [V(-20, hC + 20, 10), V(-30, hC + 70, 20)], look: [V(0, hC + 60, 70), V(0, hC + 200, 300)], fov: [56, 60], shake: 0.1,
    },
    // 6. Dawn over Suryagarh
    { start: 33, end: 41, pos: [V(-130, hC + 30, 110), V(-90, hC + 70, 140)], look: [V(0, hC + 10, 20), V(0, hC + 20, 30)], fov: [48, 52], shake: 0.05 },
    // 7. Pull away
    { start: 41, end: ENDING_END + 5, pos: [V(-90, hC + 70, 140), V(-40, hC + 190, 240)], look: [V(0, hC + 20, 30), V(0, hC + 60, 500)], fov: [52, 56] },
  ]);
  const subtitles: Subtitle[] = [
    { start: 0.6, end: 2.6, text: 'The Eclipse King falls.' },
    { start: 2.7, end: 5.0, text: '“It was never mine, brother… the Deep wanted the Sun.”' },
    { start: 6.2, end: 11.4, text: 'Shard by shard, the Crown remembers its shape.' },
    { start: 18.4, end: 23.4, text: 'And the dragon… wakes.' },
    { start: 34.2, end: 39.4, text: 'Dawn.' },
  ];
  const cues: Cue[] = [
    { t: 0.1, name: 'kaalrath' },
    { t: END.shardsLaunch, name: 'shardsReturn' },
    { t: END.reform, name: 'crownReformed' },
    { t: 18.4, name: 'dragonWakes' },
    { t: 27, name: 'breath' },
    { t: 31, name: 'dawn' },
  ];
  const dips: Dip[] = [
    { t: 5, dur: 0.6, kind: 'black' },
    { t: 12.5, dur: 0.5, kind: 'black' },
    { t: END.reform, dur: 0.8, kind: 'gold' },
    { t: 17, dur: 0.5, kind: 'black' },
    { t: 19, dur: 0.9, kind: 'gold' },
    { t: 25, dur: 0.5, kind: 'white' },
    { t: 31.5, dur: 1.4, kind: 'gold' },
  ];
  return { duration: ENDING_END, shots, subtitles, cues, dips };
}
