import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cine } from './cine';
import { COMET_LAUNCH, type CineLayout } from './layout';
import { clamp, easeInCubic, easeOutCubic, lerp, rng, smoothstep } from '../lib/math';
import { veinTexture, softSprite } from '../world/textures';

// ───────────────────────── Sun Crown + shards + comets ─────────────────────────

/** Moment the black blade meets the crown. */
export const HIT_T = 38.3;
const SHARDS = 7;

/** Ending timeline (ending program seconds). */
export const END = {
  shardsLaunch: 3.0,
  shardsArrive: [8.6, 9.0, 9.4, 9.8, 10.2, 10.6, 11.0],
  reform: 13.8,
};

const ringOffset = (i: number, out: THREE.Vector3) => {
  const a = (i / SHARDS) * Math.PI * 2;
  return out.set(Math.cos(a) * 0.55, 0.22, Math.sin(a) * 0.55);
};
const driftDir = (i: number, out: THREE.Vector3) => {
  const a = (i / SHARDS) * Math.PI * 2 + 0.3;
  return out.set(Math.cos(a), 0.55 + (i % 3) * 0.2, Math.sin(a)).normalize();
};

function bezier(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, u: number, out: THREE.Vector3) {
  const v = 1 - u;
  return out.set(
    v * v * a.x + 2 * v * u * c.x + u * u * b.x,
    v * v * a.y + 2 * v * u * c.y + u * u * b.y,
    v * v * a.z + 2 * v * u * c.z + u * u * b.z,
  );
}

const trailVert = /* glsl */ `
attribute float aFade;
varying float vFade;
void main() {
  vFade = aFade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const trailFrag = /* glsl */ `
varying float vFade;
uniform vec3 uHot, uCool;
void main() {
  vec3 c = mix(uCool, uHot, vFade * vFade);
  gl_FragColor = vec4(c * vFade * 3.0, vFade);
}
`;

const TRAIL = 56;

export function CrownAndShards({ layout, mode }: { layout: CineLayout; mode: 'intro' | 'menu' | 'ending' }) {
  const { camera } = useThree();
  const crownRef = useRef<THREE.Group>(null);
  const shardRefs = useRef<THREE.Mesh[]>([]);
  const glowRefs = useRef<THREE.Sprite[]>([]);
  const lightRef = useRef<THREE.PointLight>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const mats = useMemo(
    () => ({
      gold: new THREE.MeshStandardMaterial({ color: '#ffd27a', metalness: 1, roughness: 0.18, emissive: '#ff9a20', emissiveIntensity: 0.35 }),
      ruby: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 0.3), toneMapped: false }),
      sunGem: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4, 1.6), toneMapped: false }),
      shard: new THREE.MeshStandardMaterial({ color: '#ffe0a0', metalness: 0.5, roughness: 0.1, emissive: '#ffb040', emissiveIntensity: 4, toneMapped: false }),
      glow: new THREE.SpriteMaterial({ map: softSprite('glowGold', 'rgba(255,220,150,1)', 'rgba(255,120,20,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }),
      ring: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      trail: new THREE.ShaderMaterial({
        vertexShader: trailVert,
        fragmentShader: trailFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uHot: { value: new THREE.Color(1.2, 0.95, 0.7) }, uCool: { value: new THREE.Color(1.0, 0.18, 0.06) } },
      }),
    }),
    [],
  );
  const shardGeo = useMemo(() => new THREE.OctahedronGeometry(0.26, 0).scale(0.55, 1.5, 0.55), []);
  const trailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = SHARDS * TRAIL * 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aFade', new THREE.BufferAttribute(new Float32Array(n), 1));
    const idx: number[] = [];
    for (let s = 0; s < SHARDS; s++) {
      for (let k = 0; k < TRAIL - 1; k++) {
        const a = (s * TRAIL + k) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, []);

  // per-shard flight curves
  const flights = useMemo(() => {
    const base = layout.crown;
    return layout.impacts.map((imp, i) => {
      const start = base.clone().add(ringOffset(i, new THREE.Vector3())).addScaledVector(driftDir(i, new THREE.Vector3()), (COMET_LAUNCH - HIT_T) * 0.9);
      const end = imp.clone().add(new THREE.Vector3(0, 3, 0));
      const dist = start.distanceTo(end);
      const ctrl = start.clone().lerp(end, 0.4).add(new THREE.Vector3(0, 260 + dist * 0.22, 0));
      return { start, end, ctrl };
    });
  }, [layout]);

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), view: new THREE.Vector3() }), []);

  /** Where shard i is at program time t (and whether it is in flight). */
  const shardAt = (i: number, t: number, out: THREE.Vector3): { state: 'crown' | 'drift' | 'flight' | 'landed' | 'hover'; u: number } => {
    const f = flights[i];
    if (mode === 'ending') {
      const t0 = END.shardsLaunch;
      const t1 = END.shardsArrive[i];
      if (t < t0) {
        out.copy(f.end);
        return { state: 'landed', u: 0 };
      }
      if (t < t1) {
        const u = easeInCubic(clamp((t - t0) / (t1 - t0))) ** 0.8;
        // reversed flight: from impact to a hover point around the crown
        const hover = layout.crown.clone().add(ringOffset(i, tmp.d).multiplyScalar(4)).add(new THREE.Vector3(0, 2, 0));
        const ctrl = hover.clone().lerp(f.end, 0.5).add(new THREE.Vector3(0, 220, 0));
        bezier(f.end, ctrl, hover, u, out);
        return { state: 'flight', u };
      }
      const k = smoothstep(t1, END.reform, t);
      const spin = t * 1.5 + i;
      const r = lerp(4, 0.55, k);
      const a = (i / SHARDS) * Math.PI * 2 + spin * (1 - k);
      out.set(layout.crown.x + Math.cos(a) * r, layout.crown.y + lerp(2, 0.22, k), layout.crown.z + Math.sin(a) * r);
      return { state: 'hover', u: 1 };
    }
    if (mode === 'menu') {
      out.copy(f.end);
      return { state: 'landed', u: 1 };
    }
    if (t < HIT_T) return { state: 'crown', u: 0 };
    if (t < COMET_LAUNCH) {
      out.copy(layout.crown).add(ringOffset(i, tmp.d)).addScaledVector(driftDir(i, tmp.c), (t - HIT_T) * 0.9);
      return { state: 'drift', u: 0 };
    }
    const T = layout.impactTimes[i];
    if (t >= T) {
      out.copy(f.end);
      return { state: 'landed', u: 1 };
    }
    const u = Math.pow(clamp((t - COMET_LAUNCH) / (T - COMET_LAUNCH)), 1.25);
    bezier(f.start, f.ctrl, f.end, u, out);
    return { state: 'flight', u };
  };

  useFrame(() => {
    const t = cine.t;
    const pos = trailGeo.getAttribute('position') as THREE.BufferAttribute;
    const fade = trailGeo.getAttribute('aFade') as THREE.BufferAttribute;
    const intact = mode === 'intro' ? t < HIT_T : mode === 'ending' ? t >= END.reform : false;

    if (crownRef.current) {
      crownRef.current.visible = intact;
      crownRef.current.rotation.y = t * 0.35;
      crownRef.current.position.set(layout.crown.x, layout.crown.y + Math.sin(t * 1.2) * 0.08, layout.crown.z);
      if (mode === 'ending') crownRef.current.scale.setScalar(1 + Math.max(0, 1 - (t - END.reform) * 2) * 0.5);
    }
    if (lightRef.current) {
      const burst = mode === 'intro' ? Math.max(0, 1 - Math.abs(t - HIT_T) * 1.5) * 30 : mode === 'ending' ? Math.max(0, 1 - Math.abs(t - END.reform) * 1.2) * 40 : 0;
      lightRef.current.intensity = (intact ? 14 : 0) + burst * 0.5;
      lightRef.current.position.copy(layout.crown);
    }
    if (ringRef.current) {
      const since = mode === 'intro' ? t - HIT_T : mode === 'ending' ? t - END.reform : -1;
      const live = since > 0 && since < 2.5;
      ringRef.current.visible = live;
      if (live) {
        const s = easeOutCubic(since / (mode === 'intro' && t < COMET_LAUNCH ? 8 : 1.2)) * 30 + 0.5;
        ringRef.current.scale.setScalar(s);
        ringRef.current.position.copy(layout.crown);
        (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 1 - since / 2.5;
      }
    }

    tmp.view.copy(camera.position);
    for (let i = 0; i < SHARDS; i++) {
      const mesh = shardRefs.current[i];
      const glow = glowRefs.current[i];
      const st = shardAt(i, t, tmp.a);
      const visible = st.state === 'drift' || st.state === 'flight' || st.state === 'hover';
      if (mesh) {
        mesh.visible = visible && !intact;
        mesh.position.copy(tmp.a);
        mesh.rotation.set(t * (0.6 + i * 0.1), t * (1.1 + i * 0.07), i);
        const far = st.state === 'flight' ? 1 + st.u * 0 + tmp.a.distanceTo(camera.position) * 0.012 : 1;
        mesh.scale.setScalar(Math.max(1, far));
      }
      if (glow) {
        glow.visible = visible && !intact;
        glow.position.copy(tmp.a);
        const d = tmp.a.distanceTo(camera.position);
        glow.scale.setScalar(st.state === 'flight' ? 3 + d * 0.05 : 0.7);
      }
      // trail samples back in time
      for (let k = 0; k < TRAIL; k++) {
        const tk = t - k * 0.045;
        const s2 = shardAt(i, tk, tmp.b);
        const inFlight = s2.state === 'flight' && st.state === 'flight';
        const o = (i * TRAIL + k) * 2;
        // side vector perpendicular to the trail and the view
        shardAt(i, tk - 0.03, tmp.c);
        const tan = tmp.c.sub(tmp.b).normalize();
        const toCam = tmp.d.copy(tmp.view).sub(tmp.b).normalize();
        const side = tan.cross(toCam).normalize();
        const w = inFlight ? (1 - k / TRAIL) * (1.2 + tmp.b.distanceTo(tmp.view) * 0.012) : 0;
        pos.setXYZ(o, tmp.b.x + side.x * w, tmp.b.y + side.y * w, tmp.b.z + side.z * w);
        pos.setXYZ(o + 1, tmp.b.x - side.x * w, tmp.b.y - side.y * w, tmp.b.z - side.z * w);
        const fv = inFlight ? 1 - k / TRAIL : 0;
        fade.setX(o, fv);
        fade.setX(o + 1, fv);
      }
    }
    pos.needsUpdate = true;
    fade.needsUpdate = true;
  });

  shardRefs.current = [];
  glowRefs.current = [];

  return (
    <group>
      <group ref={crownRef}>
        <mesh material={mats.gold}>
          <cylinderGeometry args={[0.55, 0.5, 0.32, 32, 1, true]} />
        </mesh>
        <mesh material={mats.gold} position={[0, -0.16, 0]}>
          <torusGeometry args={[0.52, 0.05, 8, 32]} />
        </mesh>
        <mesh material={mats.gold} position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.035, 8, 32]} />
        </mesh>
        {Array.from({ length: 14 }).map((_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const tall = i % 2 === 0;
          return (
            <group key={i} position={[Math.cos(a) * 0.54, 0.2, Math.sin(a) * 0.54]}>
              <mesh material={mats.gold} position={[0, tall ? 0.28 : 0.16, 0]} rotation={[Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]}>
                <coneGeometry args={[0.06, tall ? 0.62 : 0.34, 4]} />
              </mesh>
              {tall && (
                <mesh material={mats.ruby} position={[Math.cos(a) * 0.06, 0.62, Math.sin(a) * 0.06]}>
                  <sphereGeometry args={[0.045, 8, 6]} />
                </mesh>
              )}
            </group>
          );
        })}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh key={i} material={mats.sunGem} position={[Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56]}>
              <sphereGeometry args={[0.07, 10, 8]} />
            </mesh>
          );
        })}
        <sprite material={mats.glow} scale={[4, 4, 1]} />
      </group>
      <pointLight ref={lightRef} color="#ffc070" distance={40} decay={1.6} />
      {Array.from({ length: SHARDS }).map((_, i) => (
        <group key={i}>
          <mesh ref={(m) => m && (shardRefs.current[i] = m)} geometry={shardGeo} material={mats.shard} visible={false} />
          <sprite ref={(s) => s && (glowRefs.current[i] = s)} material={mats.glow} visible={false} />
        </group>
      ))}
      <mesh geometry={trailGeo} material={mats.trail} frustumCulled={false} renderOrder={8} />
      <mesh ref={ringRef} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.94, 1, 64]} />
      </mesh>
    </group>
  );
}

// ───────────────────────── crimson pillars of light ─────────────────────────

const pillarVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const pillarFrag = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
uniform vec3 uColor;
uniform float uIntensity, uTime;
void main() {
  float rim = pow(1.0 - abs(dot(vN, vV)), 1.5);
  float core = 1.0 - rim;
  float h = vUv.y;
  float fall = pow(1.0 - h, 2.2);
  float flick = 0.85 + 0.15 * sin(uTime * 6.0 + h * 40.0);
  float a = (core * 0.9 + 0.2) * fall * uIntensity * flick;
  gl_FragColor = vec4(uColor * a, a);
}
`;

export function LightPillars({ layout, intensity }: { layout: CineLayout; intensity: (i: number, t: number) => number }) {
  const refs = useRef<THREE.Mesh[]>([]);
  const waves = useRef<THREE.Mesh[]>([]);
  const mats = useMemo(
    () =>
      layout.impacts.map(
        () =>
          new THREE.ShaderMaterial({
            vertexShader: pillarVert,
            fragmentShader: pillarFrag,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            uniforms: { uColor: { value: new THREE.Color(3.2, 0.35, 0.18) }, uIntensity: { value: 0 }, uTime: { value: 0 } },
          }),
      ),
    [layout],
  );
  const waveMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.6, 0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    [],
  );
  useFrame((state) => {
    const t = cine.t;
    layout.impacts.forEach((_, i) => {
      const k = intensity(i, t);
      mats[i].uniforms.uIntensity.value = k;
      mats[i].uniforms.uTime.value = state.clock.elapsedTime;
      if (refs.current[i]) refs.current[i].visible = k > 0.01;
      const w = waves.current[i];
      if (w) {
        const since = cine.program === 'intro' ? t - layout.impactTimes[i] : -1;
        w.visible = since > 0 && since < 2;
        if (w.visible) {
          w.scale.setScalar(5 + easeOutCubic(since / 2) * 160);
          (w.material as THREE.MeshBasicMaterial).opacity = (1 - since / 2) * 0.9;
        }
      }
    });
  });
  refs.current = [];
  waves.current = [];
  return (
    <group>
      {layout.impacts.map((p, i) => (
        <group key={i} position={p}>
          <mesh ref={(m) => m && (refs.current[i] = m)} material={mats[i]} position={[0, 350, 0]} frustumCulled={false}>
            <cylinderGeometry args={[7, 10, 700, 20, 1, true]} />
          </mesh>
          <mesh ref={(m) => m && (waves.current[i] = m)} material={waveMat.clone()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 2, 0]} visible={false}>
            <ringGeometry args={[0.92, 1, 64]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ───────────────────────── lightning ─────────────────────────

export function Lightning({ from, to, active }: { from: () => THREE.Vector3; to: () => THREE.Vector3; active: (t: number) => number }) {
  const { camera } = useThree();
  const SEG = 28;
  const BR = 3;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = (SEG + 1) * 2 * (1 + BR);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx: number[] = [];
    for (let b = 0; b <= BR; b++) {
      for (let k = 0; k < SEG; k++) {
        const a = (b * (SEG + 1) + k) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 7, 10), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    [],
  );
  const mesh = useRef<THREE.Mesh>(null);
  const seed = useRef(1);
  const last = useRef(0);
  useFrame((state) => {
    const k = active(cine.t);
    if (!mesh.current) return;
    mesh.current.visible = k > 0.02;
    if (!mesh.current.visible) return;
    mat.opacity = k;
    if (state.clock.elapsedTime - last.current > 0.055) {
      last.current = state.clock.elapsedTime;
      seed.current++;
    }
    const r = rng(seed.current);
    const a = from();
    const b = to();
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const pts: THREE.Vector3[] = [];
    const dir = b.clone().sub(a);
    const len = dir.length();
    const side1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0.3)).normalize();
    const side2 = new THREE.Vector3().crossVectors(dir, side1).normalize();
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const env = Math.sin(u * Math.PI);
      const p = a.clone().lerp(b, u).addScaledVector(side1, (r() - 0.5) * len * 0.07 * env).addScaledVector(side2, (r() - 0.5) * len * 0.07 * env);
      pts.push(p);
    }
    const writeStrip = (stripIdx: number, list: THREE.Vector3[], width: number) => {
      for (let i = 0; i <= SEG; i++) {
        const p = list[Math.min(i, list.length - 1)];
        const q = list[Math.min(i + 1, list.length - 1)];
        const tan = q.clone().sub(p);
        if (tan.lengthSq() < 1e-6) tan.set(0, 1, 0);
        const toCam = camera.position.clone().sub(p);
        const s = tan.cross(toCam).normalize().multiplyScalar(width * (1 - (i / SEG) * 0.4));
        const o = (stripIdx * (SEG + 1) + i) * 2;
        pos.setXYZ(o, p.x + s.x, p.y + s.y, p.z + s.z);
        pos.setXYZ(o + 1, p.x - s.x, p.y - s.y, p.z - s.z);
      }
    };
    writeStrip(0, pts, 0.3 + len * 0.0015);
    for (let b2 = 1; b2 <= BR; b2++) {
      const startI = Math.floor(SEG * (0.2 + r() * 0.5));
      const branch: THREE.Vector3[] = [];
      let p = pts[startI].clone();
      const bd = dir.clone().normalize().add(side1.clone().multiplyScalar((r() - 0.5) * 2)).normalize();
      for (let i = 0; i <= SEG; i++) {
        branch.push(p.clone());
        p = p.addScaledVector(bd, (len * 0.25) / SEG).addScaledVector(side2, (r() - 0.5) * 1.5);
      }
      writeStrip(b2, branch, 0.12);
    }
    pos.needsUpdate = true;
  });
  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={9} visible={false} />;
}

// ───────────────────────── the egg chamber ─────────────────────────

export function EggChamber({ layout, glow }: { layout: CineLayout; glow: () => number }) {
  const eggMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2a2320', roughness: 0.85, metalness: 0.1, emissive: '#ff6a1f', emissiveMap: veinTexture(5), emissiveIntensity: 1,
      }),
    [],
  );
  const eggGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 40, 30);
    const p = g.getAttribute('position');
    const r = rng(8);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const s = 1 + (y > 0 ? y * 0.18 : 0) + (r() - 0.5) * 0.02;
      p.setXYZ(i, p.getX(i) * s * 0.95, y * 1.35, p.getZ(i) * s * 0.95);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const caveGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(26, 48, 32);
    const p = g.getAttribute('position');
    const r = rng(4);
    for (let i = 0; i < p.count; i++) {
      const s = 1 + (r() - 0.5) * 0.12;
      p.setXYZ(i, p.getX(i) * s, Math.max(p.getY(i) * s, -2), p.getZ(i) * s);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#130e0d', roughness: 1, side: THREE.BackSide, flatShading: true }), []);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1d1614', roughness: 1, flatShading: true }), []);
  const shaftMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.35, 0.15), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    [],
  );
  const light = useRef<THREE.PointLight>(null);
  const egg = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const g = glow();
    eggMat.emissiveIntensity = 0.6 + g * 5;
    if (light.current) light.current.intensity = 3 + g * 25;
    if (egg.current) egg.current.scale.setScalar(1 + g * 0.012);
  });
  const c = layout.cave;
  return (
    <group position={c}>
      <mesh geometry={caveGeo} material={rockMat} />
      <mesh material={floorMat} position={[0, -1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[26, 32]} />
      </mesh>
      <mesh material={floorMat} position={[0, -1.4, 0]}>
        <cylinderGeometry args={[1.8, 2.4, 1.2, 9]} />
      </mesh>
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const d = 5 + (i % 3) * 3;
        return (
          <mesh key={i} material={floorMat} position={[Math.cos(a) * d, -1.2 + (i % 2), Math.sin(a) * d]} rotation={[i, i * 2, 0]} scale={0.6 + (i % 4) * 0.4}>
            <dodecahedronGeometry args={[1, 0]} />
          </mesh>
        );
      })}
      <mesh ref={egg} geometry={eggGeo} material={eggMat} position={[0, 0.55, 0]} castShadow />
      <pointLight ref={light} color="#ff7a2a" position={[0, 1.5, 1.8]} distance={30} decay={1.8} />
      <mesh material={shaftMat} position={[0, 10, 0]}>
        <coneGeometry args={[2.2, 24, 24, 1, true]} />
      </mesh>
    </group>
  );
}
