import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rng } from '../lib/math';
import { shared } from './materials';
import { cloudTexture } from './textures';

// ───────────────────────── ambient embers / ash ─────────────────────────

const ambientVert = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime, uSize, uRise, uArea, uHeight, uScale, uSwirl;
uniform vec3 uCenter;
uniform vec2 uDrift;
varying float vAlpha;
varying float vSeed;
void main() {
  vec3 p = (aSeed.xyz - 0.5) * vec3(uArea, uHeight, uArea);
  float t = uTime * (0.45 + aSeed.w * 0.9);
  p.y += t * uRise;
  p.x += sin(t * 0.8 + aSeed.w * 21.0) * uSwirl + uTime * uDrift.x;
  p.z += cos(t * 0.6 + aSeed.w * 13.0) * uSwirl + uTime * uDrift.y;
  vec3 rel = p - uCenter;
  rel.xz = mod(rel.xz + uArea * 0.5, uArea) - uArea * 0.5;
  rel.y = mod(rel.y + uHeight * 0.5, uHeight) - uHeight * 0.5;
  vec3 world = uCenter + rel;
  vec4 mv = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  float edge = 1.0 - smoothstep(0.3, 0.5, max(length(rel.xz) / uArea, abs(rel.y) / uHeight));
  float flick = 0.6 + 0.4 * sin(uTime * (3.0 + aSeed.w * 6.0) + aSeed.x * 50.0);
  vAlpha = edge * flick;
  vSeed = aSeed.w;
  gl_PointSize = uSize * (0.35 + aSeed.w) * uScale / max(-mv.z, 0.5);
}
`;

const ambientFrag = /* glsl */ `
uniform vec3 uColor, uColor2;
uniform float uOpacity;
varying float vAlpha;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  vec3 col = mix(uColor, uColor2, vSeed);
  gl_FragColor = vec4(col * a * vAlpha * uOpacity, a * vAlpha * uOpacity);
}
`;

export function AmbientParticles({
  count = 1500,
  area = 120,
  height = 50,
  size = 0.5,
  rise = 1.2,
  swirl = 2.5,
  drift = [0.6, 0.2],
  color = '#ff7a2a',
  color2 = '#ffd27a',
  opacity = 1,
  additive = true,
  focus,
  opacityRef,
}: {
  count?: number;
  area?: number;
  height?: number;
  size?: number;
  rise?: number;
  swirl?: number;
  drift?: [number, number];
  color?: string;
  color2?: string;
  opacity?: number;
  additive?: boolean;
  focus?: MutableRefObject<THREE.Vector3>;
  opacityRef?: MutableRefObject<number>;
}) {
  const { camera, size: viewport } = useThree();
  const geo = useMemo(() => {
    const r = rng(count * 7 + area);
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) seeds[i] = r();
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [count, area]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ambientVert,
        fragmentShader: ambientFrag,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: {
          uTime: shared.uTime,
          uSize: { value: size },
          uRise: { value: rise },
          uArea: { value: area },
          uHeight: { value: height },
          uScale: { value: 400 },
          uSwirl: { value: swirl },
          uCenter: { value: new THREE.Vector3() },
          uDrift: { value: new THREE.Vector2(...drift) },
          uColor: { value: new THREE.Color(color) },
          uColor2: { value: new THREE.Color(color2) },
          uOpacity: { value: opacity },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useFrame(() => {
    mat.uniforms.uCenter.value.copy(focus ? focus.current : camera.position);
    mat.uniforms.uScale.value = viewport.height * 0.5;
    mat.uniforms.uOpacity.value = opacity * (opacityRef ? opacityRef.current : 1);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}

// ───────────────────────── flames ─────────────────────────

const fireVert = /* glsl */ `
attribute vec3 aBase;
attribute vec3 aSeed;
attribute float aStart;
uniform float uTime, uScale, uIntensity, uClock;
varying float vLife;
varying float vSeed;
void main() {
  float sc = aSeed.z;
  float life = fract(uTime * (0.8 + aSeed.y * 0.7) + aSeed.x);
  float sway = (1.0 - life);
  vec3 p = aBase + vec3(
    sin(aSeed.x * 40.0 + uTime * 3.1) * 0.28 * sway * sc,
    life * 2.4 * sc,
    cos(aSeed.x * 23.0 + uTime * 2.7) * 0.28 * sway * sc
  );
  p.x += life * life * 0.6 * sc; // wind lean
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vLife = life;
  vSeed = aSeed.y;
  float lit = step(aStart, uClock) * min(1.0, (uClock - aStart) * 0.8 + 0.2);
  gl_PointSize = min(mix(1.5, 0.35, life) * sc * uScale * uIntensity * lit / max(-mv.z, 0.5), 90.0);
}
`;
const fireFrag = /* glsl */ `
varying float vLife;
varying float vSeed;
uniform float uIntensity;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.05, length(c));
  vec3 hot = vec3(1.0, 0.92, 0.6);
  vec3 mid = vec3(1.0, 0.45, 0.08);
  vec3 cool = vec3(0.5, 0.06, 0.02);
  vec3 col = vLife < 0.35 ? mix(hot, mid, vLife / 0.35) : mix(mid, cool, (vLife - 0.35) / 0.65);
  float fade = sin(vLife * 3.14159) * (1.0 - vLife * 0.4);
  gl_FragColor = vec4(col * 2.6 * a * fade * uIntensity, a * fade);
}
`;

export interface FireSource {
  x: number;
  y: number;
  z: number;
  scale: number;
  /** clock time at which this fire ignites (see `clock`) */
  start?: number;
}

/** One draw call for many flames (braziers, torches, burning ruins). */
export function FireField({
  sources, perFire = 22, intensity = 1, clock,
}: { sources: FireSource[]; perFire?: number; intensity?: number; clock?: () => number }) {
  const { size } = useThree();
  const geo = useMemo(() => {
    const n = sources.length * perFire;
    const r = rng(n + 3);
    const base = new Float32Array(n * 3);
    const seed = new Float32Array(n * 3);
    const start = new Float32Array(n);
    sources.forEach((s, i) => {
      for (let k = 0; k < perFire; k++) {
        const o = (i * perFire + k) * 3;
        base[o] = s.x + (r() - 0.5) * 0.5 * s.scale;
        base[o + 1] = s.y;
        base[o + 2] = s.z + (r() - 0.5) * 0.5 * s.scale;
        seed[o] = r();
        seed[o + 1] = r();
        seed[o + 2] = s.scale;
        start[i * perFire + k] = s.start ?? -1e6;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(base, 3));
    g.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 1));
    g.computeBoundingSphere();
    return g;
  }, [sources, perFire]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: fireVert,
        fragmentShader: fireFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: shared.uTime, uScale: { value: 400 }, uIntensity: { value: intensity }, uClock: { value: 1e6 } },
      }),
    [intensity],
  );
  useFrame(() => {
    mat.uniforms.uScale.value = size.height * 0.5;
    mat.uniforms.uClock.value = clock ? clock() : 1e6;
  });
  if (!sources.length) return null;
  return <points geometry={geo} material={mat} renderOrder={6} />;
}

// ───────────────────────── clouds ─────────────────────────

export interface CloudSpec {
  x: number;
  y: number;
  z: number;
  s: number;
  seed: number;
}

/** Billboard cloud banks tinted by a mood colour each frame. */
export function Clouds({ clouds, tint, opacity = 0.85 }: { clouds: CloudSpec[]; tint: MutableRefObject<THREE.Color>; opacity?: number }) {
  const mats = useMemo(
    () =>
      [1, 2, 3].map(
        (s) =>
          new THREE.SpriteMaterial({
            map: cloudTexture(s),
            transparent: true,
            depthWrite: false,
            opacity,
            fog: true,
          }),
      ),
    [opacity],
  );
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    for (const m of mats) m.color.copy(tint.current);
    if (group.current) group.current.position.x += dt * 1.5;
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <sprite key={i} material={mats[c.seed % 3]} position={[c.x, c.y, c.z]} scale={[c.s * 1.8, c.s, 1]} />
      ))}
    </group>
  );
}
