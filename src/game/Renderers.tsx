import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fx, type FxPool } from './fx';
import { breathOf } from './systems';
import type { Unit, World } from './types';
import { Dragon, Eagle, Kaalrath, Rider, makeDragonPose, makeKaalPose, makeRiderPose } from '../world/Heroes';
import { BreathStream } from '../world/Breath';
import { softSprite } from '../world/textures';
import { clamp, lerp } from '../lib/math';

const NI = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);

// ───────────────────────── the king ─────────────────────────

export function KingModel({ world }: { world: World }) {
  const g = useRef<THREE.Group>(null);
  const pose = useRef(makeRiderPose());
  useFrame(() => {
    const k = world.king;
    const u = k.unit;
    const grp = g.current;
    if (!grp) return;
    grp.visible = !k.riding && !k.firstPerson;
    grp.position.set(u.x, u.y, u.z);
    grp.rotation.y = u.yaw;
    const p = pose.current;
    const sp = Math.hypot(u.vx, u.vz);
    p.gait = k.gait;
    p.speed = clamp(sp / 16);
    p.weapon = k.weapon;
    p.attack = k.swingT >= 0 ? clamp(k.swingT / (k.combo === 2 ? 0.55 : 0.42)) : -1;
    p.draw = k.draw;
    p.rear = Math.max(k.rear, k.capture === 'trapped' ? 0.3 : 0);
    p.leap = k.leap;
    p.fire = lerp(p.fire, u.buff > 0 || k.charging > 0 ? 1 : 0.15, 0.1);
    p.raise = 0;
    p.lean = clamp((u.vx * Math.cos(u.yaw) - u.vz * Math.sin(u.yaw)) * -0.04, -0.5, 0.5);
  });
  return (
    <group ref={g}>
      <Rider pose={pose} />
    </group>
  );
}

// ───────────────────────── flyers & boss ─────────────────────────

function DragonUnit({ u }: { u: Unit }) {
  const g = useRef<THREE.Group>(null);
  const pose = useRef(makeDragonPose());
  const src = useMemo(() => breathOf.get(u.id) ?? { origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), active: 0 }, [u.id]);
  const [ready, setReady] = useState(false);
  useFrame(() => {
    if (!g.current) return;
    g.current.visible = u.alive;
    g.current.position.set(u.x, u.y, u.z);
    g.current.rotation.set(u.pitch, u.yaw, u.roll, 'YXZ');
    pose.current.flap = u.walk;
    pose.current.flapAmp = 1;
    const b = breathOf.get(u.id);
    if (b) {
      src.origin.copy(b.origin);
      src.dir.copy(b.dir);
      src.active = b.active;
      pose.current.breath = b.active;
      if (!ready) setReady(true);
    }
  });
  return (
    <>
      <group ref={g} scale={1.6}>
        <Dragon pose={pose} />
      </group>
      <BreathStream source={src} length={32} spread={10} count={700} />
    </>
  );
}

function EagleUnit({ u }: { u: Unit }) {
  const g = useRef<THREE.Group>(null);
  const flap = useRef(0);
  useFrame(() => {
    if (!g.current) return;
    g.current.visible = u.alive;
    g.current.position.set(u.x, u.y, u.z);
    g.current.rotation.set(u.pitch, u.yaw, Math.sin(u.walk * 0.3) * 0.3, 'YXZ');
    flap.current = u.dive > 0 ? 0.25 : u.walk * 0.5;
  });
  return (
    <group ref={g}>
      <Eagle flap={flap} />
    </group>
  );
}

function BossUnit({ u }: { u: Unit }) {
  const g = useRef<THREE.Group>(null);
  const pose = useRef(makeKaalPose());
  useFrame(() => {
    if (!g.current) return;
    g.current.position.set(u.x, u.y, u.z);
    g.current.rotation.y = u.yaw;
    const p = pose.current;
    p.walk = u.walk;
    p.move = u.move;
    p.swing = u.attack >= 0 ? u.attack * 0.8 : -1;
    p.flash = u.flash;
    p.kneel = u.alive ? 0 : Math.min(1, u.deadTime * 1.2);
    p.burn = u.alive ? 1 : Math.max(0, 1 - u.deadTime);
  });
  return (
    <group ref={g} scale={u.scale}>
      <Kaalrath pose={pose} />
    </group>
  );
}

/** Keeps a React list of the few special units (dragons, eagles, the boss). */
export function SpecialUnits({ world }: { world: World }) {
  const [ids, setIds] = useState<string>('');
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (t.current < 0.3) return;
    t.current = 0;
    const s = world.units.filter((u) => (u.type === 'dragon' || u.type === 'eagle' || u.type === 'boss') && (u.alive || u.type === 'boss')).map((u) => u.id).join(',');
    if (s !== ids) setIds(s);
  });
  const units = useMemo(() => {
    const set = new Set(ids.split(',').filter(Boolean).map(Number));
    return world.units.filter((u) => set.has(u.id));
  }, [ids, world]);
  return (
    <>
      {units.map((u) => (u.type === 'dragon' ? <DragonUnit key={u.id} u={u} /> : u.type === 'eagle' ? <EagleUnit key={u.id} u={u} /> : <BossUnit key={u.id} u={u} />))}
    </>
  );
}

// ───────────────────────── projectiles ─────────────────────────

const Z = new THREE.Vector3(0, 0, 1);

export function Projectiles({ world }: { world: World }) {
  const arrows = useRef<THREE.InstancedMesh | null>(null);
  const spears = useRef<THREE.InstancedMesh | null>(null);
  const geo = useMemo(
    () => ({
      arrow: mergeGeometries([
        NI(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 4).rotateX(Math.PI / 2)),
        NI(new THREE.ConeGeometry(0.04, 0.14, 4).rotateX(Math.PI / 2).translate(0, 0, 0.52)),
        NI(new THREE.BoxGeometry(0.1, 0.005, 0.16).translate(0, 0, -0.42)),
        NI(new THREE.BoxGeometry(0.005, 0.1, 0.16).translate(0, 0, -0.42)),
      ])!,
      spear: mergeGeometries([
        NI(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5).rotateX(Math.PI / 2)),
        NI(new THREE.ConeGeometry(0.07, 0.36, 5).rotateX(Math.PI / 2).translate(0, 0, 1.36)),
      ])!,
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      arrow: new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.8 }),
      spear: new THREE.MeshStandardMaterial({ color: '#8a6a3e', roughness: 0.6, metalness: 0.3, emissive: '#ff8a2a', emissiveIntensity: 0 }),
    }),
    [],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const a = arrows.current;
    const s = spears.current;
    if (!a || !s) return;
    let na = 0;
    let ns = 0;
    for (const p of world.projectiles) {
      v.set(p.vx, p.vy, p.vz).normalize();
      q.setFromUnitVectors(Z, v);
      const sink = p.stuck ? 0.25 : 0;
      m.compose(new THREE.Vector3(p.x - v.x * sink, p.y - v.y * sink, p.z - v.z * sink), q, one);
      if (p.kind === 'arrow' || p.kind === 'royalArrow') {
        if (na < a.instanceMatrix.count) {
          a.setMatrixAt(na, m);
          a.setColorAt(na, col.set(p.kind === 'royalArrow' ? '#e8c77a' : '#5a3a26'));
          na++;
        }
      } else if (ns < s.instanceMatrix.count) {
        s.setMatrixAt(ns, m);
        s.setColorAt(ns, col.set(p.kind === 'royalSpear' ? '#f5c451' : '#6b4a2e'));
        ns++;
      }
    }
    a.count = na;
    s.count = ns;
    a.instanceMatrix.needsUpdate = true;
    s.instanceMatrix.needsUpdate = true;
    if (a.instanceColor) a.instanceColor.needsUpdate = true;
    if (s.instanceColor) s.instanceColor.needsUpdate = true;
  });
  const init = (mesh: THREE.InstancedMesh | null) => {
    if (mesh && !mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3);
  };
  return (
    <>
      <instancedMesh ref={(r) => { arrows.current = r; init(r); }} args={[geo.arrow, mats.arrow, 700]} frustumCulled={false} castShadow />
      <instancedMesh ref={(r) => { spears.current = r; init(r); }} args={[geo.spear, mats.spear, 200]} frustumCulled={false} castShadow />
    </>
  );
}

// ───────────────────────── particles ─────────────────────────

const fxVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uScale / max(-mv.z, 0.3), 120.0);
}
`;
const fxFrag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
uniform float uAdd;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = uAdd > 0.5 ? vec4(vColor * a, a) : vec4(vColor, a * 0.85);
}
`;

function FxCloud({ pool, additive }: { pool: FxPool; additive: boolean }) {
  const { size } = useThree();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pool.max * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(pool.max * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(pool.max), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(pool.max), 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [pool]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: fxVert,
        fragmentShader: fxFrag,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uScale: { value: 400 }, uAdd: { value: additive ? 1 : 0 } },
      }),
    [additive],
  );
  useFrame(() => {
    mat.uniforms.uScale.value = size.height * 0.5;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const colA = geo.getAttribute('aColor') as THREE.BufferAttribute;
    const sz = geo.getAttribute('aSize') as THREE.BufferAttribute;
    const al = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
    (pos.array as Float32Array).set(pool.pos.subarray(0, pool.n * 3));
    (colA.array as Float32Array).set(pool.col.subarray(0, pool.n * 3));
    const sArr = sz.array as Float32Array;
    const aArr = al.array as Float32Array;
    for (let i = 0; i < pool.n; i++) {
      const k = pool.life[i] / pool.maxLife[i];
      aArr[i] = additive ? Math.min(1, k * 2) : Math.min(1, k * 1.5) * 0.9;
      sArr[i] = pool.size[i] * (additive ? 0.5 + k * 0.5 : 1.8 - k);
    }
    for (const a of [pos, colA, sz, al]) {
      a.needsUpdate = true;
      a.clearUpdateRanges();
      a.addUpdateRange(0, pool.n * a.itemSize);
    }
    geo.setDrawRange(0, pool.n);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={4} />;
}

export function FxPoints() {
  return (
    <>
      <FxCloud pool={fx.norm} additive={false} />
      <FxCloud pool={fx.add} additive />
    </>
  );
}

// ───────────────────────── rings, shards, cage, rituals, rally ─────────────────────────

const RING_COLORS = {
  gold: new THREE.Color(4, 3, 1.4),
  crimson: new THREE.Color(4, 0.6, 0.3),
  shadow: new THREE.Color(2.2, 0.2, 0.6),
  ember: new THREE.Color(4, 1.6, 0.4),
};

export function Rings({ world }: { world: World }) {
  const refs = useRef<THREE.Mesh[]>([]);
  const mats = useMemo(
    () => Array.from({ length: 12 }, () => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })),
    [],
  );
  useFrame(() => {
    refs.current.forEach((m, i) => {
      const r = world.rings[i];
      m.visible = !!r;
      if (!r) return;
      const k = r.t / r.dur;
      m.position.set(r.x, r.y, r.z);
      m.scale.setScalar(0.5 + (1 - Math.pow(1 - k, 3)) * r.radius);
      mats[i].color.copy(RING_COLORS[r.color]);
      mats[i].opacity = (1 - k) * 0.9;
    });
  });
  return (
    <>
      {mats.map((mat, i) => (
        <mesh key={i} ref={(m) => m && (refs.current[i] = m)} material={mat} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={3}>
          <ringGeometry args={[0.88, 1, 64]} />
        </mesh>
      ))}
    </>
  );
}

export function Shards({ world }: { world: World }) {
  const refs = useRef<THREE.Group[]>([]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffe0a0', metalness: 0.5, roughness: 0.1, emissive: '#ffb040', emissiveIntensity: 4 }), []);
  const glow = useMemo(() => new THREE.SpriteMaterial({ map: softSprite('glowGold', 'rgba(255,220,150,1)', 'rgba(255,120,20,0)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const beam = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.8, 0.8), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), []);
  useFrame((state) => {
    refs.current.forEach((g, i) => {
      const s = world.shards[i];
      g.visible = !!s && !s.collected;
      if (!s || s.collected) return;
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = state.clock.elapsedTime * 3;
      const beamMesh = g.children[2] as THREE.Mesh;
      beamMesh.visible = s.t < 1.4;
    });
  });
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <group key={i} ref={(g) => g && (refs.current[i] = g)} visible={false}>
          <mesh material={mat} scale={[0.55, 1.5, 0.55]}>
            <octahedronGeometry args={[0.45, 0]} />
          </mesh>
          <sprite material={glow} scale={[3, 3, 1]} />
          <mesh material={beam} position={[0, 30, 0]}>
            <cylinderGeometry args={[0.6, 1.4, 60, 12, 1, true]} />
          </mesh>
          <pointLight color="#ffc070" intensity={12} distance={18} />
        </group>
      ))}
    </>
  );
}

export function Cage({ world }: { world: World }) {
  const g = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.8, roughness: 0.45 }), []);
  useFrame(() => {
    const k = world.king;
    if (!g.current) return;
    g.current.visible = k.capture === 'trapped' || k.capture === 'carried' || k.capture === 'jailed';
    g.current.position.copy(k.cage);
  });
  const bars = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    bars.push(
      <mesh key={i} material={mat} position={[Math.cos(a) * 2.2, 2.4, Math.sin(a) * 2.2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 4.8, 5]} />
      </mesh>,
    );
  }
  return (
    <group ref={g} visible={false}>
      {bars}
      <mesh material={mat} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 0.2, 16]} />
      </mesh>
      <mesh material={mat} position={[0, 4.8, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 0.2, 16]} />
      </mesh>
      <mesh material={mat} position={[0, 5.4, 0]}>
        <coneGeometry args={[2.5, 1.2, 16]} />
      </mesh>
    </group>
  );
}

/** The Ember Rite: lightning, converging fire & ice beams, an orb, a cracking stone egg. */
export function Rituals({ world }: { world: World }) {
  const refs = useRef<THREE.Group[]>([]);
  const mats = useMemo(
    () => ({
      fire: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.2, 0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      ice: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      bolt: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      orb: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 4), wireframe: true, transparent: true, toneMapped: false }),
      egg: new THREE.MeshStandardMaterial({ color: '#2a2320', roughness: 0.8, emissive: '#ff6a1f', emissiveIntensity: 0 }),
    }),
    [],
  );
  useFrame((state) => {
    refs.current.forEach((g, i) => {
      const r = world.rituals.filter((x) => !x.done)[i];
      g.visible = !!r;
      if (!r) return;
      const t = r.t;
      g.position.set(r.x, r.y, r.z);
      const [fire, ice, bolt, orb, egg] = g.children as THREE.Mesh[];
      const conv = clamp(t / 1.5);
      fire.visible = t < 1.8;
      ice.visible = t < 1.8;
      fire.position.x = 30 * (1 - conv) + 15;
      ice.position.x = -30 * (1 - conv) - 15;
      fire.scale.set(1, conv, 1);
      ice.scale.set(1, conv, 1);
      mats.fire.opacity = conv;
      mats.ice.opacity = conv;
      bolt.visible = t < 1.6 && Math.sin(state.clock.elapsedTime * 40) > 0;
      bolt.scale.x = bolt.scale.z = 0.5 + Math.random();
      orb.visible = t < 2.6;
      orb.scale.setScalar(t < 1.5 ? conv * 3 : Math.max(0, 3 - (t - 1.5) * 3));
      orb.rotation.set(t * 6, t * 9, 0);
      egg.visible = t > 1.4 && t < 3.65;
      egg.position.y = Math.min(2.5, (t - 1.4) * 3) + Math.sin(t * 30) * (t > 2.8 ? 0.15 : 0);
      mats.egg.emissiveIntensity = clamp((t - 2) / 1.5) * 6;
    });
  });
  return (
    <>
      {[0, 1].map((i) => (
        <group key={i} ref={(g) => g && (refs.current[i] = g)} visible={false}>
          <mesh material={mats.fire} position={[30, 2.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.8, 0.8, 30, 8, 1, true]} />
          </mesh>
          <mesh material={mats.ice} position={[-30, 2.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.8, 0.8, 30, 8, 1, true]} />
          </mesh>
          <mesh material={mats.bolt} position={[0, 60, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 120, 5, 1, true]} />
          </mesh>
          <mesh material={mats.orb} position={[0, 2.5, 0]}>
            <icosahedronGeometry args={[1, 2]} />
          </mesh>
          <mesh material={mats.egg} scale={[1.8, 2.4, 1.8]} castShadow>
            <sphereGeometry args={[1, 20, 16]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function RallyMarker({ world }: { world: World }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!g.current) return;
    const r = world.rally;
    g.current.visible = !!r;
    if (!r) return;
    g.current.position.copy(r);
    if (ring.current) ring.current.scale.setScalar(4 + Math.sin(state.clock.elapsedTime * 3) * 0.4);
  });
  return (
    <group ref={g} visible={false}>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 6, 6]} />
        <meshStandardMaterial color="#5a3d26" />
      </mesh>
      <mesh position={[0.9, 5.2, 0]}>
        <planeGeometry args={[1.8, 1.2]} />
        <meshStandardMaterial color="#1d3f9e" side={THREE.DoubleSide} emissive="#1d3f9e" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial color={new THREE.Color(2, 3, 6)} transparent opacity={0.8} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ───────────────────────── health bars ─────────────────────────

export function HealthBars({ world }: { world: World }) {
  const { camera } = useThree();
  const bg = useRef<THREE.InstancedMesh>(null);
  const fg = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const fgGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), []);
  const bgMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.55, depthWrite: false }), []);
  const fgMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, depthWrite: false }), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const c = useMemo(() => new THREE.Color(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    for (const mesh of [fg.current]) {
      if (mesh && !mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3);
    }
  }, []);
  useFrame(() => {
    if (!bg.current || !fg.current) return;
    let n = 0;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    for (const u of world.units) {
      if (!u.alive || u.hp >= u.maxHp || u.hidden || u.morale === 'kneel' || n >= 300) continue;
      if (world.time - u.lastHit > 5 && u.type !== 'lord') continue;
      const d2 = (u.x - camera.position.x) ** 2 + (u.z - camera.position.z) ** 2;
      if (d2 > 55 * 55) continue;
      const w = u.type === 'lord' ? 1.6 : 0.9;
      const y = u.y + 2.35 * u.scale + 0.25;
      p.set(u.x, y, u.z);
      m.compose(p, camera.quaternion, s.set(w + 0.06, 0.13, 1));
      bg.current.setMatrixAt(n, m);
      const k = Math.max(0, u.hp / u.maxHp);
      p.addScaledVector(right, -w / 2);
      m.compose(p, camera.quaternion, s.set(w * k, 0.08, 1));
      fg.current.setMatrixAt(n, m);
      c.setRGB(...((u.team === 0 ? [0.4, 0.9, 2.2] : u.type === 'lord' ? [2.5, 1.5, 0.3] : [2.2, 0.35, 0.25]) as [number, number, number]));
      fg.current.setColorAt(n, c);
      n++;
    }
    bg.current.count = n;
    fg.current.count = n;
    bg.current.instanceMatrix.needsUpdate = true;
    fg.current.instanceMatrix.needsUpdate = true;
    if (fg.current.instanceColor) fg.current.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={bg} args={[geo, bgMat, 300]} frustumCulled={false} renderOrder={10} />
      <instancedMesh ref={fg} args={[fgGeo, fgMat, 300]} frustumCulled={false} renderOrder={11} />
    </>
  );
}
