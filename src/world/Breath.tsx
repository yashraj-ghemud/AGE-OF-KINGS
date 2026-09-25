import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rng } from '../lib/math';
import { shared } from './materials';

const vert = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime, uLength, uSpread, uScale, uActive, uRate;
uniform vec3 uOrigin, uDir, uSide, uUp;
varying float vLife;
varying float vAlpha;
void main() {
  float life = fract(uTime * uRate * (0.8 + aSeed.w * 0.4) + aSeed.x);
  float d = life * uLength;
  float spread = uSpread * (0.15 + life * 1.2);
  vec3 p = uOrigin + uDir * d
    + uSide * (aSeed.y - 0.5) * spread
    + uUp * ((aSeed.z - 0.5) * spread + life * life * uLength * 0.08);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vLife = life;
  // particles born while the stream was off stay hidden
  vAlpha = uActive * step(0.02, life);
  gl_PointSize = (0.8 + life * 5.0) * uScale / max(-mv.z, 0.5) * vAlpha;
}
`;
const frag = /* glsl */ `
varying float vLife;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c));
  vec3 hot = vec3(1.0, 0.95, 0.75);
  vec3 mid = vec3(1.0, 0.45, 0.08);
  vec3 smoke = vec3(0.12, 0.05, 0.03);
  vec3 col = vLife < 0.3 ? mix(hot, mid, vLife / 0.3) : mix(mid, smoke, (vLife - 0.3) / 0.7);
  float fade = (1.0 - vLife) * vAlpha;
  gl_FragColor = vec4(col * 3.0 * a * fade, a * fade);
}
`;

export interface BreathSource {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  active: number;
}

/** Continuous cone of dragon fire. `source` is mutated by its owner every frame. */
export function BreathStream({ source, length = 30, spread = 7, count = 900 }: { source: BreathSource; length?: number; spread?: number; count?: number }) {
  const { size } = useThree();
  const geo = useMemo(() => {
    const r = rng(count + 17);
    const g = new THREE.BufferGeometry();
    const s = new Float32Array(count * 4);
    for (let i = 0; i < s.length; i++) s[i] = r();
    g.setAttribute('aSeed', new THREE.BufferAttribute(s, 4));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: shared.uTime,
          uLength: { value: length },
          uSpread: { value: spread },
          uScale: { value: 400 },
          uActive: { value: 0 },
          uRate: { value: 1.6 },
          uOrigin: { value: new THREE.Vector3() },
          uDir: { value: new THREE.Vector3(0, 0, 1) },
          uSide: { value: new THREE.Vector3(1, 0, 0) },
          uUp: { value: new THREE.Vector3(0, 1, 0) },
        },
      }),
    [length, spread],
  );
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(() => {
    const u = mat.uniforms;
    u.uScale.value = size.height * 0.5;
    u.uActive.value = source.active;
    u.uOrigin.value.copy(source.origin);
    u.uDir.value.copy(source.dir).normalize();
    u.uSide.value.crossVectors(u.uDir.value, up).normalize();
    if (u.uSide.value.lengthSq() < 0.01) u.uSide.value.set(1, 0, 0);
    u.uUp.value.crossVectors(u.uSide.value, u.uDir.value).normalize();
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={7} />;
}
