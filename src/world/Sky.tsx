import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MOON_SIZE, SUN_SIZE, moonDirection, sunDirection, sunVisibility, type Mood } from './mood';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // pin to the far plane
}
`;

const frag = /* glsl */ `
uniform vec3 uZenith, uHorizon, uGround, uGlow, uSun, uCorona, uMoon;
uniform vec3 uSunDir, uMoonDir;
uniform float uSunIntensity, uGlowAmt, uCoronaAmt, uStars, uTime, uSunSize, uMoonSize, uFlash, uMoonVis;
varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 dir = normalize(vDir);
  float y = dir.y;
  float hor = pow(1.0 - max(y, 0.0), 5.0);
  vec3 col = mix(uZenith, uHorizon, hor);
  col = mix(col, uGround, smoothstep(0.0, -0.12, y));

  float sd = dot(dir, uSunDir);
  float ang = acos(clamp(sd, -1.0, 1.0));
  float md = acos(clamp(dot(dir, uMoonDir), -1.0, 1.0));
  float moon = (1.0 - smoothstep(uMoonSize * 0.985, uMoonSize, md)) * uMoonVis;

  // atmospheric glow toward the sun, strongest along the horizon
  float glow = pow(max(sd, 0.0), 5.0) * 0.55 + pow(max(sd, 0.0), 48.0) * 0.9;
  col += uGlow * glow * (0.3 + hor * 0.9) * uGlowAmt;

  // sun disc + halo
  float disc = 1.0 - smoothstep(uSunSize * 0.9, uSunSize, ang);
  float halo = exp(-ang / (uSunSize * 1.4)) * 0.35;
  col += uSun * (disc + halo * 0.12) * uSunIntensity * (1.0 - moon);

  // eclipse corona: streamers around the occluded sun
  vec3 up = abs(uSunDir.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tx = normalize(cross(up, uSunDir));
  vec3 ty = cross(uSunDir, tx);
  float a = atan(dot(dir, ty), dot(dir, tx));
  float rays = 0.55 + 0.25 * sin(a * 7.0 + uTime * 0.15) + 0.14 * sin(a * 17.0 - uTime * 0.11) + 0.08 * sin(a * 41.0 + uTime * 0.05);
  float r = ang / uSunSize;
  float corona = smoothstep(0.9, 1.05, r) * exp(-(r - 1.0) * (1.6 - rays * 0.7)) * rays;
  float rim = smoothstep(uMoonSize * 0.93, uMoonSize, md) * (1.0 - smoothstep(uMoonSize, uMoonSize * 1.06, md));
  col += uCorona * (corona * 2.2 + rim * 5.0 * (1.0 - smoothstep(uSunSize * 1.1, uSunSize * 1.8, ang))) * uCoronaAmt;
  col += uCorona * exp(-ang * 3.0) * 0.25 * uCoronaAmt;

  // moon body with faint earthshine
  col = mix(col, uMoon + uCorona * 0.015 * uCoronaAmt, moon);

  // stars
  if (y > -0.02 && uStars > 0.001) {
    vec3 p = dir * 160.0;
    vec3 cell = floor(p);
    float h = hash(cell);
    if (h > 0.985) {
      vec3 f = fract(p) - 0.5;
      float size = 0.08 + fract(h * 91.7) * 0.12;
      float s = smoothstep(size, 0.0, length(f));
      float tw = 0.55 + 0.45 * sin(uTime * (1.5 + h * 3.0) + h * 80.0);
      col += vec3(1.0, 0.94, 0.86) * s * tw * uStars * 2.2 * smoothstep(-0.02, 0.25, y) * (1.0 - moon);
    }
  }

  col += vec3(uFlash);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: true,
    uniforms: {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uSun: { value: new THREE.Color() },
      uCorona: { value: new THREE.Color() },
      uMoon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.2, 1).normalize() },
      uMoonDir: { value: new THREE.Vector3(0, 0.2, 1).normalize() },
      uSunIntensity: { value: 1 },
      uGlowAmt: { value: 1 },
      uCoronaAmt: { value: 0 },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uSunSize: { value: SUN_SIZE },
      uMoonSize: { value: MOON_SIZE },
      uFlash: { value: 0 },
      uMoonVis: { value: 0 },
    },
  });
}

export interface AtmosphereProps {
  mood: MutableRefObject<Mood>;
  /** Point the shadow frustum follows. */
  focus?: MutableRefObject<THREE.Vector3>;
  shadowSize?: number;
  shadowMapSize?: number;
  shadows?: boolean;
  /** Extra white flash added to the sky (lightning). */
  flash?: MutableRefObject<number>;
  /** Called with the directional light so owners can tweak it. */
  lightRef?: MutableRefObject<THREE.DirectionalLight | null>;
}

/** Sky dome + fog + sun/hemisphere lights, all driven by a mutable Mood each frame. */
export function Atmosphere({ mood, focus, shadowSize = 90, shadowMapSize = 2048, shadows = true, flash, lightRef }: AtmosphereProps) {
  const { scene, gl, camera } = useThree();
  const skyMat = useMemo(createSkyMaterial, []);
  const skyRef = useRef<THREE.Mesh>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const fog = useMemo(() => new THREE.FogExp2('#000', 0.001), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    scene.fog = fog;
    scene.add(target);
    return () => {
      scene.fog = null;
      scene.remove(target);
    };
  }, [scene, fog, target]);

  useFrame((state) => {
    const m = mood.current;
    const u = skyMat.uniforms;
    sunDirection(m, sunDir);
    u.uSunDir.value.copy(sunDir);
    moonDirection(m, sunDir, u.uMoonDir.value);
    u.uZenith.value.copy(m.zenith);
    u.uHorizon.value.copy(m.horizon);
    u.uGround.value.copy(m.ground);
    u.uGlow.value.copy(m.glow);
    u.uSun.value.copy(m.sun);
    u.uCorona.value.copy(m.corona);
    u.uMoon.value.copy(m.moon);
    const vis = sunVisibility(m);
    u.uSunIntensity.value = m.sunIntensity * Math.max(vis, 0.02);
    u.uGlowAmt.value = m.glowAmt;
    u.uCoronaAmt.value = m.coronaAmt * (1 - vis * 0.8);
    u.uStars.value = m.stars;
    u.uTime.value = state.clock.elapsedTime;
    u.uFlash.value = flash ? flash.current : 0;
    u.uMoonVis.value = Math.min(1, Math.max(0, (m.eclipse - 0.05) * 4));

    if (skyRef.current) skyRef.current.position.copy(camera.position);

    fog.color.copy(m.fog);
    fog.density = m.fogDensity;
    gl.toneMappingExposure = m.exposure;

    const f = flash ? flash.current : 0;
    if (dirRef.current) {
      const d = dirRef.current;
      d.color.copy(m.light);
      d.intensity = m.lightIntensity + f * 6;
      const fp = focus?.current ?? camera.position;
      target.position.copy(fp);
      d.position.copy(fp).addScaledVector(sunDir, 400);
      d.target = target;
      if (lightRef) lightRef.current = d;
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(m.hemiSky);
      hemiRef.current.groundColor.copy(m.hemiGround);
      hemiRef.current.intensity = m.hemiIntensity + f * 2;
    }
  }, -1);

  return (
    <>
      <mesh ref={skyRef} material={skyMat} frustumCulled={false} renderOrder={-1000}>
        <sphereGeometry args={[4000, 48, 24]} />
      </mesh>
      <hemisphereLight ref={hemiRef} />
      <directionalLight
        ref={dirRef}
        castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-shadowSize}
        shadow-camera-right={shadowSize}
        shadow-camera-top={shadowSize}
        shadow-camera-bottom={-shadowSize}
        shadow-camera-near={10}
        shadow-camera-far={900}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
    </>
  );
}
