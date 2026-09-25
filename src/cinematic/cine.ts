import * as THREE from 'three';
import { clamp, easeInOutSine } from '../lib/math';

export type ProgramName = 'intro' | 'menu' | 'ending';

/** Mutable cinematic state shared between the 3D director and the HTML overlay (no React re-renders). */
export const cine = {
  program: 'intro' as ProgramName,
  t: 0,
  /** program time at which the program was (re)started — used by overlays */
  playing: true,
  /** 0..1 black overlay */
  fade: 0,
  /** 0..1 white/gold overlay */
  flash: 0,
  flashColor: '255,244,220',
  /** 0..1 letterbox bars */
  letterbox: 1,
  /** chromatic aberration strength */
  aberration: 0,
  /** requested jump (seconds) — consumed by the director */
  seek: null as number | null,
  /** set when the program finished */
  done: false,
  /** mouse parallax -1..1 */
  mouse: new THREE.Vector2(),
  /** dawn used by the menu sky (campaign progress) */
  dawn: 0,
};

export function resetCine(program: ProgramName, t = 0) {
  cine.program = program;
  cine.t = t;
  cine.playing = true;
  cine.fade = program === 'menu' ? 0 : 1;
  cine.flash = 0;
  cine.letterbox = program === 'menu' ? 0 : 1;
  cine.aberration = 0;
  cine.seek = null;
  cine.done = false;
}

export interface Shot {
  start: number;
  end: number;
  pos: THREE.Vector3[];
  look: THREE.Vector3[];
  fov: [number, number];
  ease?: (t: number) => number;
  /** handheld noise amplitude (m) */
  shake?: number;
  roll?: [number, number];
  /** optional per-frame look override (e.g. tilt into the sky) */
  lookFn?: (u: number, t: number, out: THREE.Vector3, pos: THREE.Vector3) => void;
}

export interface CompiledShot extends Shot {
  posCurve: THREE.CatmullRomCurve3;
  lookCurve: THREE.CatmullRomCurve3;
}

const curve = (pts: THREE.Vector3[]) =>
  new THREE.CatmullRomCurve3(pts.length === 1 ? [pts[0], pts[0].clone()] : pts, false, 'centripetal', 0.5);

export function compileShots(shots: Shot[]): CompiledShot[] {
  return shots.map((s) => ({ ...s, posCurve: curve(s.pos), lookCurve: curve(s.look) }));
}

export function evalShot(s: CompiledShot, t: number, pos: THREE.Vector3, look: THREE.Vector3) {
  const u = (s.ease ?? easeInOutSine)(clamp((t - s.start) / (s.end - s.start)));
  s.posCurve.getPoint(u, pos);
  s.lookCurve.getPoint(u, look);
  if (s.lookFn) s.lookFn(u, t, look, pos);
  const fov = s.fov[0] + (s.fov[1] - s.fov[0]) * u;
  const roll = s.roll ? s.roll[0] + (s.roll[1] - s.roll[0]) * u : 0;
  return { u, fov, roll };
}

export interface Subtitle {
  start: number;
  end: number;
  text: string;
  /** 'name' = carved name card, 'card' = trailer intertitle, 'presents' = studio card */
  style?: 'narration' | 'name' | 'card' | 'presents';
}

export interface Cue {
  t: number;
  name: string;
}

/** Transition dips: black fades and bright flashes around cut points. */
export interface Dip {
  t: number;
  dur: number;
  kind: 'black' | 'white' | 'gold';
}

export function dipAmount(dips: Dip[], t: number, kind: Dip['kind']) {
  let v = 0;
  for (const d of dips) {
    if (d.kind !== kind) continue;
    const x = Math.abs(t - d.t) / (d.dur / 2);
    if (x < 1) v = Math.max(v, kind === 'black' ? 1 - x * x : Math.pow(1 - x, 2));
  }
  return v;
}
