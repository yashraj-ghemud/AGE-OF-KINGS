// CPU particle pool for combat effects: sparks, dust, ember motes, ash, blood-ember.
// Rendered by <FxPoints/> as two point clouds (additive + normal blending).

export type FxKind = 'spark' | 'fire' | 'ember' | 'dust' | 'ash' | 'gold' | 'hit' | 'ice' | 'smoke';

const ADD = new Set<FxKind>(['spark', 'fire', 'ember', 'gold', 'hit', 'ice']);

export interface FxPool {
  n: number;
  max: number;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  size: Float32Array;
  col: Float32Array;
  grav: Float32Array;
  drag: Float32Array;
  home: Float32Array; // 1 = homing to the king
}

function pool(max: number): FxPool {
  return {
    n: 0, max,
    pos: new Float32Array(max * 3), vel: new Float32Array(max * 3), life: new Float32Array(max), maxLife: new Float32Array(max),
    size: new Float32Array(max), col: new Float32Array(max * 3), grav: new Float32Array(max), drag: new Float32Array(max), home: new Float32Array(max),
  };
}

export const fx = { add: pool(5000), norm: pool(2500), homeX: 0, homeY: 0, homeZ: 0 };

const COLORS: Record<FxKind, [number, number, number]> = {
  spark: [4, 2.6, 1.0],
  fire: [4, 1.4, 0.3],
  ember: [4, 1.6, 0.5],
  gold: [4, 3.2, 1.4],
  hit: [3.2, 0.9, 0.35],
  ice: [1.2, 2.4, 4],
  dust: [0.45, 0.38, 0.3],
  ash: [0.12, 0.1, 0.1],
  smoke: [0.18, 0.15, 0.14],
};

export function emit(
  kind: FxKind, x: number, y: number, z: number, count: number,
  o: { speed?: number; up?: number; size?: number; life?: number; spread?: number; dir?: [number, number, number]; homing?: boolean } = {},
) {
  const p = ADD.has(kind) ? fx.add : fx.norm;
  const c = COLORS[kind];
  const speed = o.speed ?? 6;
  for (let k = 0; k < count; k++) {
    let i = p.n;
    if (i >= p.max) i = Math.floor(Math.random() * p.max);
    else p.n++;
    const s = o.spread ?? 0.3;
    p.pos[i * 3] = x + (Math.random() - 0.5) * s;
    p.pos[i * 3 + 1] = y + (Math.random() - 0.5) * s;
    p.pos[i * 3 + 2] = z + (Math.random() - 0.5) * s;
    let dx = Math.random() - 0.5;
    let dy = Math.random() - 0.3;
    let dz = Math.random() - 0.5;
    if (o.dir) {
      dx = o.dir[0] + dx * 0.6;
      dy = o.dir[1] + dy * 0.6;
      dz = o.dir[2] + dz * 0.6;
    }
    const l = Math.hypot(dx, dy, dz) || 1;
    const sp = speed * (0.4 + Math.random() * 0.8);
    p.vel[i * 3] = (dx / l) * sp;
    p.vel[i * 3 + 1] = (dy / l) * sp + (o.up ?? 0);
    p.vel[i * 3 + 2] = (dz / l) * sp;
    const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.8);
    p.life[i] = life;
    p.maxLife[i] = life;
    p.size[i] = (o.size ?? 0.25) * (0.6 + Math.random() * 0.8);
    const j = 0.85 + Math.random() * 0.3;
    p.col[i * 3] = c[0] * j;
    p.col[i * 3 + 1] = c[1] * j;
    p.col[i * 3 + 2] = c[2] * j;
    p.grav[i] = kind === 'spark' || kind === 'hit' || kind === 'dust' ? 14 : kind === 'ash' ? 1.5 : kind === 'smoke' ? -1.2 : kind === 'fire' ? -3 : 0;
    p.drag[i] = kind === 'dust' || kind === 'smoke' ? 2.5 : kind === 'ember' || kind === 'gold' ? 1.2 : 0.6;
    p.home[i] = o.homing ? 1 : 0;
  }
}

export function stepFx(dt: number) {
  for (const p of [fx.add, fx.norm]) {
    for (let i = 0; i < p.n; i++) {
      p.life[i] -= dt;
      if (p.life[i] <= 0) {
        // swap-remove
        const last = --p.n;
        if (i !== last) {
          p.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
          p.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
          p.col.copyWithin(i * 3, last * 3, last * 3 + 3);
          p.life[i] = p.life[last];
          p.maxLife[i] = p.maxLife[last];
          p.size[i] = p.size[last];
          p.grav[i] = p.grav[last];
          p.drag[i] = p.drag[last];
          p.home[i] = p.home[last];
          i--;
        }
        continue;
      }
      const o = i * 3;
      if (p.home[i] > 0) {
        const age = 1 - p.life[i] / p.maxLife[i];
        const k = Math.min(1, age * age * 6) * 14;
        p.vel[o] += (fx.homeX - p.pos[o]) * k * dt;
        p.vel[o + 1] += (fx.homeY + 1.5 - p.pos[o + 1]) * k * dt;
        p.vel[o + 2] += (fx.homeZ - p.pos[o + 2]) * k * dt;
      }
      const d = Math.max(0, 1 - p.drag[i] * dt);
      p.vel[o] *= d;
      p.vel[o + 1] = p.vel[o + 1] * d - p.grav[i] * dt;
      p.vel[o + 2] *= d;
      p.pos[o] += p.vel[o] * dt;
      p.pos[o + 1] += p.vel[o + 1] * dt;
      p.pos[o + 2] += p.vel[o + 2] * dt;
    }
  }
}

export function clearFx() {
  fx.add.n = 0;
  fx.norm.n = 0;
}
