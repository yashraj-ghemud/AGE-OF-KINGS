import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../lib/math';

/** Everything that defines the look of the sky + lighting at one moment. */
export interface Mood {
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  glow: THREE.Color;
  sun: THREE.Color;
  corona: THREE.Color;
  moon: THREE.Color;
  fog: THREE.Color;
  light: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  sunIntensity: number;
  glowAmt: number;
  coronaAmt: number;
  stars: number;
  /** 0 = moon far from the sun, 1 = total eclipse. */
  eclipse: number;
  sunElev: number;
  sunAzim: number;
  fogDensity: number;
  lightIntensity: number;
  hemiIntensity: number;
  exposure: number;
}

const c = (h: string) => new THREE.Color(h);

function mood(p: {
  zenith: string; horizon: string; ground: string; glow: string; sun: string; corona: string; moon?: string;
  fog: string; light: string; hemiSky: string; hemiGround: string;
  sunIntensity: number; glowAmt: number; coronaAmt: number; stars: number; eclipse: number;
  sunElev: number; sunAzim?: number; fogDensity: number; lightIntensity: number; hemiIntensity: number; exposure?: number;
}): Mood {
  return {
    zenith: c(p.zenith), horizon: c(p.horizon), ground: c(p.ground), glow: c(p.glow), sun: c(p.sun),
    corona: c(p.corona), moon: c(p.moon ?? '#07060a'), fog: c(p.fog), light: c(p.light), hemiSky: c(p.hemiSky),
    hemiGround: c(p.hemiGround), sunIntensity: p.sunIntensity, glowAmt: p.glowAmt, coronaAmt: p.coronaAmt,
    stars: p.stars, eclipse: p.eclipse, sunElev: p.sunElev, sunAzim: p.sunAzim ?? 0, fogDensity: p.fogDensity,
    lightIntensity: p.lightIntensity, hemiIntensity: p.hemiIntensity, exposure: p.exposure ?? 1,
  };
}

export const MOODS = {
  night: mood({
    zenith: '#010208', horizon: '#0b0e22', ground: '#020204', glow: '#3b2b55', sun: '#fff0c8', corona: '#ffd9a0',
    fog: '#04050b', light: '#4a64a8', hemiSky: '#1a2144', hemiGround: '#050508', sunIntensity: 0, glowAmt: 0.25,
    coronaAmt: 0, stars: 1, eclipse: 0, sunElev: -0.12, fogDensity: 0.0005, lightIntensity: 0.25, hemiIntensity: 0.35,
  }),
  dawnGold: mood({
    zenith: '#3a68a6', horizon: '#ffbf78', ground: '#3b3226', glow: '#ffae5c', sun: '#fff3d0', corona: '#ffe0a0',
    fog: '#d8a478', light: '#ffd49a', hemiSky: '#a6bedf', hemiGround: '#5c4630', sunIntensity: 26, glowAmt: 1.1,
    coronaAmt: 0, stars: 0, eclipse: 0, sunElev: 0.2, fogDensity: 0.00085, lightIntensity: 3.2, hemiIntensity: 0.9, exposure: 0.95,
  }),
  eclipse: mood({
    zenith: '#040308', horizon: '#5c0f19', ground: '#0a0506', glow: '#b8261d', sun: '#ff7a44', corona: '#ffc27a',
    moon: '#050306', fog: '#1d0a0e', light: '#ff6048', hemiSky: '#5a2c3c', hemiGround: '#140a0a', sunIntensity: 0,
    glowAmt: 1.0, coronaAmt: 1.6, stars: 0.75, eclipse: 1, sunElev: 0.2, fogDensity: 0.0013, lightIntensity: 1.5,
    hemiIntensity: 1.1, exposure: 1.15,
  }),
  amber: mood({
    zenith: '#121731', horizon: '#b8562a', ground: '#1a1210', glow: '#ff8a3a', sun: '#ffd2a0', corona: '#ffd9a0',
    fog: '#3a2119', light: '#ffa468', hemiSky: '#6a5070', hemiGround: '#1c1210', sunIntensity: 10, glowAmt: 1.1,
    coronaAmt: 0.9, stars: 0.3, eclipse: 0.55, sunElev: 0.2, fogDensity: 0.0011, lightIntensity: 2.0, hemiIntensity: 0.85,
  }),
  sunrise: mood({
    zenith: '#5c90d2', horizon: '#ffcf8c', ground: '#43382a', glow: '#ffb466', sun: '#fff7e2', corona: '#fff0c0',
    fog: '#e3c197', light: '#ffe4b4', hemiSky: '#b8cde8', hemiGround: '#5a4a34', sunIntensity: 30, glowAmt: 1.2,
    coronaAmt: 0, stars: 0, eclipse: 0, sunElev: 0.22, fogDensity: 0.0007, lightIntensity: 3.4, hemiIntensity: 1.0, exposure: 0.95,
  }),
  cave: mood({
    zenith: '#000000', horizon: '#000000', ground: '#000000', glow: '#000000', sun: '#000000', corona: '#000000',
    fog: '#050203', light: '#ff5a2a', hemiSky: '#2a1414', hemiGround: '#050303', sunIntensity: 0, glowAmt: 0,
    coronaAmt: 0, stars: 0, eclipse: 1, sunElev: 0.2, fogDensity: 0.02, lightIntensity: 0.2, hemiIntensity: 0.25,
  }),
};

export function cloneMood(m: Mood): Mood {
  return {
    ...m,
    zenith: m.zenith.clone(), horizon: m.horizon.clone(), ground: m.ground.clone(), glow: m.glow.clone(),
    sun: m.sun.clone(), corona: m.corona.clone(), moon: m.moon.clone(), fog: m.fog.clone(), light: m.light.clone(),
    hemiSky: m.hemiSky.clone(), hemiGround: m.hemiGround.clone(),
  };
}

const COLOR_KEYS = ['zenith', 'horizon', 'ground', 'glow', 'sun', 'corona', 'moon', 'fog', 'light', 'hemiSky', 'hemiGround'] as const;
const NUM_KEYS = [
  'sunIntensity', 'glowAmt', 'coronaAmt', 'stars', 'eclipse', 'sunElev', 'sunAzim', 'fogDensity',
  'lightIntensity', 'hemiIntensity', 'exposure',
] as const;

/** out = lerp(a, b, t). `out` may alias `a`. */
export function mixMood(out: Mood, a: Mood, b: Mood, t: number): Mood {
  t = clamp(t);
  for (const k of COLOR_KEYS) out[k].copy(a[k]).lerp(b[k], t);
  for (const k of NUM_KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
}

/**
 * In-game mood from story progress. 0 = the crimson Endless Eclipse, 1 = sunrise.
 * `bossDark` deepens it again during Kaalrath's eclipse phase.
 */
export function moodForDawn(out: Mood, dawn: number, bossDark = 0): Mood {
  if (dawn < 0.7) mixMood(out, MOODS.eclipse, MOODS.amber, smoothstep(0, 0.7, dawn));
  else mixMood(out, MOODS.amber, MOODS.sunrise, smoothstep(0.7, 1, dawn));
  if (bossDark > 0) mixMood(out, out, MOODS.eclipse, bossDark);
  return out;
}

export const SUN_SIZE = 0.065;
export const MOON_SIZE = SUN_SIZE * 1.05;

export function sunDirection(m: Mood, out = new THREE.Vector3()) {
  const ce = Math.cos(m.sunElev);
  return out.set(Math.sin(m.sunAzim) * ce, Math.sin(m.sunElev), Math.cos(m.sunAzim) * ce).normalize();
}

/** Moon direction: offset from the sun along a tilted arc; eclipse=1 means centred on the sun. */
export function moonDirection(m: Mood, sun: THREE.Vector3, out = new THREE.Vector3()) {
  const off = (1 - m.eclipse) * SUN_SIZE * 3.2;
  const side = new THREE.Vector3().crossVectors(sun, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(side, sun).normalize();
  return out
    .copy(sun)
    .addScaledVector(side, Math.cos(0.5) * off)
    .addScaledVector(up, Math.sin(0.5) * off)
    .normalize();
}

/** How much direct sunlight reaches the ground (0 under a total eclipse). */
export function sunVisibility(m: Mood) {
  return 1 - smoothstep(0.35, 1, m.eclipse);
}
