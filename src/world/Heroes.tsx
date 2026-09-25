import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { applyClothWave } from './materials';
import { veinTexture } from './textures';
import { clamp, lerp } from '../lib/math';

/** A plane with an aWave attribute (0 at the top edge) for cloth animation. */
function clothPlane(w: number, h: number, sx = 4, sy = 10, taper = 1) {
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  const pos = g.getAttribute('position');
  const wave = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (h / 2 - y) / h;
    wave[i] = t;
    pos.setX(i, pos.getX(i) * lerp(1, taper, t));
  }
  g.setAttribute('aWave', new THREE.BufferAttribute(wave, 1));
  g.translate(0, -h / 2, 0);
  return g;
}

// ───────────────────────────── Rider (Vikram on Toofan) ─────────────────────────────

export interface RiderPose {
  /** gait phase in cycles */
  gait: number;
  /** 0 idle .. 1 full gallop */
  speed: number;
  /** -1 = idle, 0..1 = attack progress */
  attack: number;
  /** 0..1 raise the sword to the sky */
  raise: number;
  /** 0..1 solar fire on the blade */
  fire: number;
  weapon: 'sword' | 'spear' | 'bow';
  /** 0..1 horse rearing */
  rear: number;
  /** bow draw 0..1 */
  draw: number;
  /** body lean into turns */
  lean: number;
  /** airborne leap 0..1 */
  leap: number;
}

export const makeRiderPose = (): RiderPose => ({
  gait: 0, speed: 0, attack: -1, raise: 0, fire: 0, weapon: 'sword', rear: 0, draw: 0, lean: 0, leap: 0,
});

const HORSE = '#1b191c';
const MANE = '#070707';

function Leg({ legRef, x, y, z, front }: { legRef: MutableRefObject<THREE.Group[]>; x: number; y: number; z: number; front: boolean }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: HORSE, roughness: 0.55 }), []);
  const hoof = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.8 }), []);
  return (
    <group position={[x, y, z]} ref={(g) => g && legRef.current.push(g)}>
      <mesh material={mat} position={[0, -0.28, 0]} castShadow>
        <cylinderGeometry args={[front ? 0.13 : 0.16, 0.09, 0.62, 7]} />
      </mesh>
      <group position={[0, -0.56, 0]} name="knee">
        <mesh material={mat} position={[0, -0.3, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.06, 0.62, 6]} />
        </mesh>
        <mesh material={hoof} position={[0, -0.64, 0.02]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.1, 7]} />
        </mesh>
        <mesh material={mat} position={[0, -0.52, 0]}>
          <sphereGeometry args={[0.085, 6, 5]} />
        </mesh>
      </group>
    </group>
  );
}

export function Rider({ pose, shadows = true }: { pose: MutableRefObject<RiderPose>; shadows?: boolean }) {
  const horse = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const rider = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group[]>([]);
  const swordRef = useRef<THREE.Group>(null);
  const spearRef = useRef<THREE.Group>(null);
  const bowRef = useRef<THREE.Group>(null);
  const bladeLight = useRef<THREE.PointLight>(null);
  const wrist = useRef<THREE.Group>(null);

  const m = useMemo(() => {
    const cape = applyClothWave(new THREE.MeshStandardMaterial({ color: '#1f45b0', roughness: 0.8, side: THREE.DoubleSide }), 0.35);
    return {
      horse: new THREE.MeshStandardMaterial({ color: HORSE, roughness: 0.5, metalness: 0.05 }),
      mane: new THREE.MeshStandardMaterial({ color: MANE, roughness: 0.9 }),
      caparison: new THREE.MeshStandardMaterial({ color: '#1d3f9e', roughness: 0.8, side: THREE.DoubleSide }),
      gold: new THREE.MeshStandardMaterial({ color: '#f5b83d', metalness: 1, roughness: 0.25, emissive: '#3a2000', emissiveIntensity: 0.5 }),
      armor: new THREE.MeshStandardMaterial({ color: '#d9b35c', metalness: 0.95, roughness: 0.28 }),
      leather: new THREE.MeshStandardMaterial({ color: '#4a2f1d', roughness: 0.85 }),
      skin: new THREE.MeshStandardMaterial({ color: '#b98260', roughness: 0.7 }),
      cloth: new THREE.MeshStandardMaterial({ color: '#f1e6cc', roughness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: '#dfe3ea', metalness: 1, roughness: 0.15, emissive: '#ff9a2a', emissiveIntensity: 0 }),
      wood: new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 0.8 }),
      eye: new THREE.MeshBasicMaterial({ color: '#000' }),
      cape,
    };
  }, []);
  const capeGeo = useMemo(() => clothPlane(1.15, 2.3, 5, 12, 1.5), []);

  useFrame((state) => {
    const p = pose.current;
    const t = state.clock.elapsedTime;
    const ph = p.gait * Math.PI * 2;
    const sp = p.speed;
    // legs: LF, RF, LH, RH — transverse gallop offsets
    const offs = [0, 0.12, 0.55, 0.67];
    legs.current.slice(0, 4).forEach((g, i) => {
      const o = offs[i] * Math.PI * 2;
      const front = i < 2;
      const amp = lerp(0.12, front ? 0.85 : 0.75, sp);
      let a = Math.sin(ph + o) * amp;
      let knee = Math.max(0, Math.sin(ph + o + (front ? 1.2 : -1.0))) * lerp(0.2, 1.2, sp) * (front ? -1 : 1);
      if (sp < 0.05) {
        a = Math.sin(t * 0.8 + i) * 0.02;
        knee = 0;
      }
      if (p.rear > 0 && front) {
        a = lerp(a, -1.1 + Math.sin(t * 9 + i) * 0.3, p.rear);
        knee = lerp(knee, -1.6, p.rear);
      }
      if (p.leap > 0) {
        a = lerp(a, front ? -0.9 : 0.9, p.leap);
        knee = lerp(knee, front ? -1.5 : 1.2, p.leap);
      }
      g.rotation.x = a;
      const k = g.getObjectByName('knee');
      if (k) k.rotation.x = knee;
    });
    if (horse.current) {
      const rock = Math.sin(ph * 1) * 0.07 * sp;
      horse.current.rotation.x = -rock - p.rear * 0.75 - p.leap * 0.12;
      horse.current.position.y = Math.abs(Math.sin(ph)) * 0.12 * sp + p.rear * 0.55 + Math.sin(t * 1.3) * 0.01;
      horse.current.rotation.z = p.lean * 0.2;
    }
    if (neck.current) neck.current.rotation.x = 0.1 + Math.sin(ph + 0.6) * 0.12 * sp + Math.sin(t * 0.7) * 0.04 * (1 - sp) - p.rear * 0.4;
    if (tail.current) {
      tail.current.rotation.x = 0.5 + sp * 0.6 + Math.sin(t * 3) * 0.08;
      tail.current.rotation.z = Math.sin(t * 2.2) * 0.2 * (1 - sp * 0.5);
    }
    if (rider.current) {
      rider.current.rotation.x = 0.1 * sp + Math.sin(ph) * 0.05 * sp - p.rear * 0.2;
      rider.current.position.y = 2.05 + Math.abs(Math.cos(ph)) * 0.06 * sp;
      rider.current.rotation.z = -p.lean * 0.15;
    }
    // arms
    let rx = -0.3;
    let rz = 0.2;
    let lx = -0.5;
    if (p.attack >= 0) {
      const a = p.attack;
      if (p.weapon === 'sword') {
        rx = a < 0.3 ? lerp(-0.3, -2.9, a / 0.3) : lerp(-2.9, -0.2, clamp((a - 0.3) / 0.35));
        rz = lerp(0.2, 0.9, Math.sin(a * Math.PI));
      } else if (p.weapon === 'spear') {
        rx = a < 0.4 ? lerp(-0.3, -2.6, a / 0.4) : lerp(-2.6, -1.2, clamp((a - 0.4) / 0.3));
      }
    }
    if (p.weapon === 'bow') {
      lx = -1.5;
      rx = -1.45;
      rz = lerp(0.2, 0.9, p.draw);
    }
    if (p.raise > 0) {
      rx = lerp(rx, -3.05, p.raise);
      rz = lerp(rz, 0.05, p.raise);
    }
    if (armR.current) {
      armR.current.rotation.x = rx;
      armR.current.rotation.z = rz;
    }
    if (armL.current) armL.current.rotation.x = lx;
    // wrist turns the blade skyward when the sword is raised
    if (wrist.current) wrist.current.rotation.x = lerp(Math.PI / 2, -rx, p.raise);
    if (swordRef.current) swordRef.current.visible = p.weapon === 'sword';
    if (spearRef.current) spearRef.current.visible = p.weapon === 'spear';
    if (bowRef.current) bowRef.current.visible = p.weapon === 'bow';
    m.steel.emissiveIntensity = p.fire * (4 + Math.sin(t * 20) * 0.8);
    if (bladeLight.current) bladeLight.current.intensity = p.fire * 12;
  });

  legs.current = [];

  return (
    <group>
      <group ref={horse}>
        {/* body */}
        <mesh material={m.horse} position={[0, 1.38, 0]} scale={[0.52, 0.58, 1.18]} castShadow={shadows}>
          <sphereGeometry args={[1, 16, 12]} />
        </mesh>
        <mesh material={m.horse} position={[0, 1.42, 0.72]} scale={[0.5, 0.6, 0.55]} castShadow={shadows}>
          <sphereGeometry args={[1, 12, 10]} />
        </mesh>
        <mesh material={m.horse} position={[0, 1.46, -0.72]} scale={[0.54, 0.58, 0.58]} castShadow={shadows}>
          <sphereGeometry args={[1, 12, 10]} />
        </mesh>
        {/* caparison */}
        <mesh material={m.caparison} position={[0, 1.22, -0.05]} castShadow={shadows}>
          <cylinderGeometry args={[0.6, 0.66, 1.9, 14, 1, true, Math.PI * 0.08, Math.PI * 0.84]} />
        </mesh>
        <mesh material={m.caparison} position={[0, 1.22, -0.05]} rotation={[0, Math.PI, 0]} castShadow={shadows}>
          <cylinderGeometry args={[0.6, 0.66, 1.9, 14, 1, true, Math.PI * 0.08, Math.PI * 0.84]} />
        </mesh>
        <mesh material={m.gold} position={[0.64, 0.8, -0.05]}>
          <boxGeometry args={[0.03, 0.06, 1.7]} />
        </mesh>
        <mesh material={m.gold} position={[-0.64, 0.8, -0.05]}>
          <boxGeometry args={[0.03, 0.06, 1.7]} />
        </mesh>
        <mesh material={m.gold} position={[0.63, 1.2, 0.1]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.2, 12]} />
        </mesh>
        <mesh material={m.gold} position={[-0.63, 1.2, 0.1]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.2, 12]} />
        </mesh>
        {/* saddle */}
        <mesh material={m.leather} position={[0, 1.93, -0.05]} castShadow={shadows}>
          <boxGeometry args={[0.6, 0.18, 0.75]} />
        </mesh>
        <mesh material={m.gold} position={[0, 2.03, 0.3]}>
          <boxGeometry args={[0.5, 0.12, 0.1]} />
        </mesh>
        {/* neck + head */}
        <group ref={neck} position={[0, 1.7, 0.95]}>
          <mesh material={m.horse} position={[0, 0.42, 0.28]} rotation={[0.62, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.2, 0.36, 1.05, 10]} />
          </mesh>
          <mesh material={m.mane} position={[0, 0.62, 0.12]} rotation={[0.62, 0, 0]}>
            <boxGeometry args={[0.08, 1.05, 0.22]} />
          </mesh>
          <group position={[0, 0.9, 0.62]} rotation={[1.25, 0, 0]}>
            <mesh material={m.horse} position={[0, 0.3, 0]} castShadow={shadows}>
              <cylinderGeometry args={[0.1, 0.19, 0.72, 9]} />
            </mesh>
            <mesh material={m.horse} position={[0, 0.02, -0.05]} scale={[1, 1, 1.1]}>
              <sphereGeometry args={[0.19, 10, 8]} />
            </mesh>
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh material={m.horse} position={[s * 0.08, -0.12, -0.18]} rotation={[-0.4, 0, s * -0.2]}>
                  <coneGeometry args={[0.05, 0.18, 5]} />
                </mesh>
                <mesh material={m.eye} position={[s * 0.15, 0.1, 0.05]}>
                  <sphereGeometry args={[0.03, 6, 4]} />
                </mesh>
              </group>
            ))}
            {/* chanfron (face armour) */}
            <mesh material={m.gold} position={[0, 0.25, 0.1]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.16, 0.5, 0.04]} />
            </mesh>
          </group>
        </group>
        {/* tail */}
        <group ref={tail} position={[0, 1.7, -1.25]}>
          <mesh material={m.mane} position={[0, -0.45, 0]}>
            <cylinderGeometry args={[0.09, 0.03, 0.95, 6]} />
          </mesh>
        </group>
        {/* legs */}
        <Leg legRef={legs} x={-0.26} y={1.15} z={0.75} front />
        <Leg legRef={legs} x={0.26} y={1.15} z={0.75} front />
        <Leg legRef={legs} x={-0.27} y={1.2} z={-0.78} front={false} />
        <Leg legRef={legs} x={0.27} y={1.2} z={-0.78} front={false} />

        {/* rider */}
        <group ref={rider} position={[0, 2.05, -0.05]}>
          {/* thighs straddling */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh material={m.cloth} position={[s * 0.3, -0.05, 0.18]} rotation={[1.2, 0, s * 0.25]} castShadow={shadows}>
                <cylinderGeometry args={[0.1, 0.09, 0.5, 6]} />
              </mesh>
              <mesh material={m.armor} position={[s * 0.4, -0.38, 0.32]} rotation={[0.1, 0, s * 0.1]} castShadow={shadows}>
                <cylinderGeometry args={[0.08, 0.07, 0.5, 6]} />
              </mesh>
            </group>
          ))}
          <mesh material={m.armor} position={[0, 0.42, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.27, 0.22, 0.75, 10]} />
          </mesh>
          <mesh material={m.gold} position={[0, 0.5, 0.2]} rotation={[0.08, 0, 0]}>
            <circleGeometry args={[0.13, 12]} />
          </mesh>
          <mesh material={m.leather} position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.24, 0.25, 0.1, 10]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={m.armor} position={[s * 0.32, 0.76, 0]} scale={[1.2, 0.75, 1.1]} castShadow={shadows}>
              <sphereGeometry args={[0.16, 8, 6]} />
            </mesh>
          ))}
          {/* head + sun crown helm */}
          <mesh material={m.skin} position={[0, 1.02, 0.02]} castShadow={shadows}>
            <sphereGeometry args={[0.16, 12, 10]} />
          </mesh>
          <mesh material={m.armor} position={[0, 1.08, 0]}>
            <sphereGeometry args={[0.178, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          </mesh>
          <group position={[0, 1.2, 0]}>
            <mesh material={m.gold}>
              <cylinderGeometry args={[0.17, 0.18, 0.08, 14, 1, true]} />
            </mesh>
            {Array.from({ length: 9 }).map((_, i) => {
              const a = (i / 9) * Math.PI * 2;
              return (
                <mesh key={i} material={m.gold} position={[Math.sin(a) * 0.17, 0.1, Math.cos(a) * 0.17]} rotation={[Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]}>
                  <coneGeometry args={[0.028, i % 2 ? 0.14 : 0.22, 4]} />
                </mesh>
              );
            })}
          </group>
          {/* cape */}
          <mesh geometry={capeGeo} material={m.cape} position={[0, 0.8, -0.26]} rotation={[0.35, 0, 0]} castShadow={shadows} />
          {/* right arm + weapons */}
          <group ref={armR} position={[0.34, 0.72, 0]}>
            <mesh material={m.armor} position={[0, -0.22, 0]} castShadow={shadows}>
              <cylinderGeometry args={[0.075, 0.065, 0.46, 6]} />
            </mesh>
            <mesh material={m.armor} position={[0, -0.52, 0.02]} castShadow={shadows}>
              <cylinderGeometry args={[0.065, 0.055, 0.34, 6]} />
            </mesh>
            <group ref={wrist} position={[0, -0.7, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <group ref={swordRef}>
                <mesh material={m.steel} position={[0, 0.78, 0]} castShadow={shadows}>
                  <boxGeometry args={[0.06, 1.22, 0.13]} />
                </mesh>
                <mesh material={m.steel} position={[0, 1.44, 0]}>
                  <coneGeometry args={[0.07, 0.16, 4]} />
                </mesh>
                <mesh material={m.gold} position={[0, 0.16, 0]}>
                  <boxGeometry args={[0.42, 0.06, 0.09]} />
                </mesh>
                <mesh material={m.leather} position={[0, 0.02, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.24, 6]} />
                </mesh>
                <mesh material={m.gold} position={[0, -0.12, 0]}>
                  <sphereGeometry args={[0.05, 6, 5]} />
                </mesh>
                <pointLight ref={bladeLight} position={[0, 1, 0]} color="#ffae4a" intensity={0} distance={12} decay={2} />
              </group>
              <group ref={spearRef} visible={false}>
                <mesh material={m.wood} position={[0, 0.6, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 2.8, 6]} />
                </mesh>
                <mesh material={m.steel} position={[0, 2.12, 0]}>
                  <coneGeometry args={[0.08, 0.4, 5]} />
                </mesh>
                <mesh material={m.gold} position={[0, 1.85, 0]}>
                  <cylinderGeometry args={[0.06, 0.06, 0.1, 6]} />
                </mesh>
              </group>
            </group>
          </group>
          <group ref={armL} position={[-0.34, 0.72, 0]}>
            <mesh material={m.armor} position={[0, -0.22, 0]} castShadow={shadows}>
              <cylinderGeometry args={[0.075, 0.065, 0.46, 6]} />
            </mesh>
            <mesh material={m.armor} position={[0, -0.52, 0.02]}>
              <cylinderGeometry args={[0.065, 0.055, 0.34, 6]} />
            </mesh>
            <group ref={bowRef} position={[0, -0.7, 0.05]} visible={false}>
              <mesh material={m.wood} rotation={[0, Math.PI / 2, Math.PI / 2 - 0.5]}>
                <torusGeometry args={[0.7, 0.03, 5, 18, 1.0 * Math.PI * 0.95]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

// ───────────────────────────── Kaalrath, the Eclipse King ─────────────────────────────

export interface KaalPose {
  /** 0..1 blade swing (0 raised overhead, 1 struck down); -1 = idle guard */
  swing: number;
  walk: number;
  move: number;
  kneel: number;
  /** 0..1 intensity of the burning blade */
  burn: number;
  /** 0..1 white hit flash */
  flash: number;
}
export const makeKaalPose = (): KaalPose => ({ swing: -1, walk: 0, move: 0, kneel: 0, burn: 1, flash: 0 });

export function Kaalrath({ pose, shadows = true }: { pose: MutableRefObject<KaalPose>; shadows?: boolean }) {
  const body = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      plate: new THREE.MeshStandardMaterial({ color: '#16131a', metalness: 0.9, roughness: 0.32, emissive: '#000', emissiveIntensity: 1 }),
      plate2: new THREE.MeshStandardMaterial({ color: '#2a232c', metalness: 0.85, roughness: 0.4 }),
      edge: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.5, 0.2), toneMapped: false }),
      eyes: new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.8, 0.3), toneMapped: false }),
      blade: new THREE.MeshStandardMaterial({ color: '#08060a', metalness: 1, roughness: 0.2, emissive: '#ff2a10', emissiveIntensity: 0.6, emissiveMap: veinTexture(21) }),
      cape: applyClothWave(new THREE.MeshStandardMaterial({ color: '#2a060c', roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 }), 0.7),
    }),
    [],
  );
  const capeGeo = useMemo(() => clothPlane(1.5, 2.6, 6, 12, 1.4), []);

  useFrame((state) => {
    const p = pose.current;
    const t = state.clock.elapsedTime;
    const sw = Math.sin(p.walk) * p.move;
    if (legL.current) legL.current.rotation.x = sw * 0.6 - p.kneel * 1.4;
    if (legR.current) legR.current.rotation.x = -sw * 0.6 + p.kneel * 0.3;
    if (body.current) {
      body.current.position.y = -p.kneel * 0.55 + Math.sin(t * 1.4) * 0.02;
      body.current.rotation.x = p.kneel * 0.35;
    }
    let rx = -0.35 + Math.sin(t * 1.1) * 0.05;
    if (p.swing >= 0) rx = p.swing < 0.4 ? lerp(-0.35, -3.1, p.swing / 0.4) : lerp(-3.1, -0.5, clamp((p.swing - 0.4) / 0.25));
    if (armR.current) {
      armR.current.rotation.x = rx;
      armR.current.rotation.z = 0.15;
    }
    if (armL.current) armL.current.rotation.x = -0.2 + sw * 0.4;
    m.blade.emissiveIntensity = 0.4 + p.burn * (1.6 + Math.sin(t * 9) * 0.4);
    m.plate.emissive.setRGB(p.flash, p.flash, p.flash);
  });

  return (
    <group>
      <group ref={body}>
        {/* legs */}
        {[
          [legL, -0.2],
          [legR, 0.2],
        ].map(([ref, x], i) => (
          <group key={i} ref={ref as MutableRefObject<THREE.Group>} position={[x as number, 1.0, 0]}>
            <mesh material={m.plate} position={[0, -0.28, 0]} castShadow={shadows}>
              <boxGeometry args={[0.24, 0.58, 0.28]} />
            </mesh>
            <mesh material={m.plate2} position={[0, -0.75, 0.03]} castShadow={shadows}>
              <boxGeometry args={[0.22, 0.5, 0.3]} />
            </mesh>
            <mesh material={m.plate} position={[0, -0.52, 0.16]}>
              <sphereGeometry args={[0.1, 6, 5]} />
            </mesh>
          </group>
        ))}
        {/* torso */}
        <mesh material={m.plate} position={[0, 1.42, 0]} castShadow={shadows}>
          <cylinderGeometry args={[0.36, 0.26, 0.9, 8]} />
        </mesh>
        <mesh material={m.plate2} position={[0, 1.0, 0]} castShadow={shadows}>
          <cylinderGeometry args={[0.28, 0.36, 0.3, 8]} />
        </mesh>
        <mesh material={m.edge} position={[0, 1.5, 0.3]} rotation={[0.15, 0, Math.PI / 4]}>
          <boxGeometry args={[0.12, 0.12, 0.05]} />
        </mesh>
        {/* pauldrons with spikes */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.48, 1.8, 0]}>
            <mesh material={m.plate} scale={[1.3, 0.9, 1.2]} castShadow={shadows}>
              <sphereGeometry args={[0.24, 10, 8]} />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} material={m.plate2} position={[s * 0.12, 0.18, -0.1 + k * 0.1]} rotation={[0, 0, -s * (0.5 + k * 0.15)]}>
                <coneGeometry args={[0.05, 0.42 - k * 0.08, 5]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* helm with horns + eye slit */}
        <group position={[0, 2.08, 0.02]}>
          <mesh material={m.plate} castShadow={shadows}>
            <sphereGeometry args={[0.22, 12, 10]} />
          </mesh>
          <mesh material={m.plate} position={[0, -0.1, 0.08]}>
            <boxGeometry args={[0.3, 0.2, 0.26]} />
          </mesh>
          <mesh material={m.eyes} position={[0, 0.01, 0.2]}>
            <boxGeometry args={[0.24, 0.035, 0.03]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.18, 0.12, 0]} rotation={[-0.5, 0, -s * 0.9]}>
              <mesh material={m.plate2} position={[0, 0.25, 0]}>
                <coneGeometry args={[0.06, 0.55, 6]} />
              </mesh>
            </group>
          ))}
          <mesh material={m.plate2} position={[0, 0.26, -0.02]} rotation={[-0.3, 0, 0]}>
            <coneGeometry args={[0.05, 0.3, 5]} />
          </mesh>
        </group>
        <mesh geometry={capeGeo} material={m.cape} position={[0, 1.9, -0.33]} rotation={[0.18, 0, 0]} castShadow={shadows} />
        {/* sword arm */}
        <group ref={armR} position={[0.5, 1.72, 0]}>
          <mesh material={m.plate} position={[0, -0.3, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.1, 0.09, 0.6, 7]} />
          </mesh>
          <mesh material={m.plate2} position={[0, -0.72, 0.02]}>
            <cylinderGeometry args={[0.1, 0.08, 0.36, 7]} />
          </mesh>
          <group position={[0, -0.92, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh material={m.blade} position={[0, 1.15, 0]} castShadow={shadows}>
              <boxGeometry args={[0.07, 2.1, 0.22]} />
            </mesh>
            <mesh material={m.edge} position={[0, 1.15, 0.115]}>
              <boxGeometry args={[0.02, 2.0, 0.015]} />
            </mesh>
            <mesh material={m.blade} position={[0, 2.3, 0]}>
              <coneGeometry args={[0.12, 0.3, 4]} />
            </mesh>
            <mesh material={m.plate2} position={[0, 0.1, 0]}>
              <boxGeometry args={[0.55, 0.08, 0.12]} />
            </mesh>
          </group>
        </group>
        <group ref={armL} position={[-0.5, 1.72, 0]}>
          <mesh material={m.plate} position={[0, -0.3, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.1, 0.09, 0.6, 7]} />
          </mesh>
          <mesh material={m.plate2} position={[0, -0.72, 0.02]}>
            <cylinderGeometry args={[0.1, 0.08, 0.36, 7]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ───────────────────────────── Dragon ─────────────────────────────

export interface DragonPose {
  flap: number;
  /** 0 = folded glide, 1 = full flap */
  flapAmp: number;
  /** 0..1 jaw open / breathing fire */
  breath: number;
  bank: number;
  /** 0..1 wing spread (0 folded, e.g. emerging from the egg) */
  spread: number;
}
export const makeDragonPose = (): DragonPose => ({ flap: 0, flapAmp: 1, breath: 0, bank: 0, spread: 1 });

function wingGeometry() {
  // membrane: fan between arm and finger bones
  const pts = [
    [0, 0, 0],
    [3.2, 0.6, -0.2],
    [6.0, 0.2, -0.6],
    [5.2, 0, -2.6],
    [3.6, 0, -3.4],
    [1.8, 0, -3.0],
    [0.2, 0, -1.6],
  ];
  const pos: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function Dragon({ pose, variant = 'ember', shadows = true }: { pose: MutableRefObject<DragonPose>; variant?: 'ember' | 'sun'; shadows?: boolean }) {
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const tipL = useRef<THREE.Group>(null);
  const tipR = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group[]>([]);
  const tailSeg = useRef<THREE.Group[]>([]);
  const jaw = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const sun = variant === 'sun';
  const m = useMemo(() => {
    const vein = veinTexture(sun ? 33 : 7);
    return {
      scale: new THREE.MeshStandardMaterial({
        color: sun ? '#d8a33a' : '#1a1416', metalness: sun ? 0.8 : 0.35, roughness: sun ? 0.3 : 0.55,
        emissive: sun ? '#ffb040' : '#ff4a10', emissiveMap: vein, emissiveIntensity: sun ? 1.6 : 1.2,
      }),
      belly: new THREE.MeshStandardMaterial({ color: sun ? '#fff0c0' : '#3a2016', roughness: 0.6, emissive: sun ? '#ffb040' : '#401000', emissiveIntensity: sun ? 0.6 : 0.3 }),
      membrane: new THREE.MeshStandardMaterial({
        color: sun ? '#ffcf70' : '#3a0d0d', roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.94,
        emissive: sun ? '#ff9a30' : '#5a0a04', emissiveIntensity: sun ? 0.9 : 0.5,
      }),
      horn: new THREE.MeshStandardMaterial({ color: sun ? '#fff3d0' : '#0a0808', metalness: 0.6, roughness: 0.3 }),
      eye: new THREE.MeshBasicMaterial({ color: sun ? new THREE.Color(8, 7, 4) : new THREE.Color(8, 3, 0.4), toneMapped: false }),
      mouth: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2, 0.4), toneMapped: false }),
    };
  }, [sun]);
  const wingGeo = useMemo(wingGeometry, []);

  useFrame((state) => {
    const p = pose.current;
    const t = state.clock.elapsedTime;
    const f = Math.sin(p.flap * Math.PI * 2) * p.flapAmp;
    const spread = p.spread;
    const base = lerp(1.25, 0.12, spread);
    if (wingL.current) wingL.current.rotation.z = base + f * 0.75;
    if (wingR.current) wingR.current.rotation.z = -(base + f * 0.75);
    const tip = Math.sin(p.flap * Math.PI * 2 - 0.9) * p.flapAmp * 0.5;
    if (tipL.current) tipL.current.rotation.z = tip + lerp(1.8, 0, spread);
    if (tipR.current) tipR.current.rotation.z = -tip - lerp(1.8, 0, spread);
    neck.current.forEach((g, i) => {
      g.rotation.x = -0.12 + Math.sin(t * 1.6 - i * 0.5) * 0.05 - p.breath * 0.06;
      g.rotation.y = Math.sin(t * 0.9 - i * 0.4) * 0.05;
    });
    tailSeg.current.forEach((g, i) => {
      g.rotation.y = Math.sin(t * 2 - i * 0.6) * 0.12;
      g.rotation.x = 0.03 + Math.sin(t * 1.3 - i * 0.5) * 0.04;
    });
    if (jaw.current) jaw.current.rotation.x = 0.1 + p.breath * 0.65;
    if (root.current) {
      root.current.rotation.z = p.bank;
      root.current.position.y = -f * 0.25;
    }
  });

  neck.current = [];
  tailSeg.current = [];

  // Build nested neck (forward +z) and tail (backward -z) chains.
  const neckChain = (i: number): JSX.Element => (
    <group ref={(g) => g && neck.current.push(g)} position={[0, 0.12, i === 0 ? 1.7 : 0.62]}>
      <mesh material={m.scale} castShadow={shadows} scale={[1, 1, 1.3]}>
        <sphereGeometry args={[0.44 - i * 0.05, 10, 8]} />
      </mesh>
      <mesh material={m.horn} position={[0, 0.4 - i * 0.04, 0]} rotation={[-0.5, 0, 0]}>
        <coneGeometry args={[0.07, 0.3, 4]} />
      </mesh>
      {i < 4 ? (
        neckChain(i + 1)
      ) : (
        <group position={[0, 0.1, 0.55]}>
          <mesh material={m.scale} castShadow={shadows} scale={[0.9, 0.7, 1.5]}>
            <sphereGeometry args={[0.42, 12, 10]} />
          </mesh>
          <mesh material={m.scale} position={[0, 0.02, 0.62]} scale={[0.7, 0.45, 1.2]}>
            <sphereGeometry args={[0.32, 10, 8]} />
          </mesh>
          <group ref={jaw} position={[0, -0.14, 0.2]}>
            <mesh material={m.belly} position={[0, -0.05, 0.42]} scale={[0.6, 0.25, 1.2]}>
              <sphereGeometry args={[0.3, 8, 6]} />
            </mesh>
          </group>
          <mesh material={m.mouth} position={[0, -0.12, 0.7]} scale={[0.35, 0.08, 0.5]}>
            <sphereGeometry args={[0.3, 8, 6]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh material={m.eye} position={[s * 0.22, 0.14, 0.42]}>
                <sphereGeometry args={[0.06, 6, 5]} />
              </mesh>
              <mesh material={m.horn} position={[s * 0.2, 0.3, -0.25]} rotation={[-1.1, 0, s * -0.3]}>
                <coneGeometry args={[0.08, 0.9, 6]} />
              </mesh>
              <mesh material={m.horn} position={[s * 0.3, 0.05, -0.1]} rotation={[-1.3, 0, s * -0.8]}>
                <coneGeometry args={[0.05, 0.45, 5]} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
  const tailChain = (i: number): JSX.Element => (
    <group ref={(g) => g && tailSeg.current.push(g)} position={[0, 0, i === 0 ? -1.7 : -0.7]}>
      <mesh material={m.scale} castShadow={shadows} scale={[1, 0.9, 1.6]}>
        <sphereGeometry args={[0.42 * Math.pow(0.8, i), 8, 6]} />
      </mesh>
      <mesh material={m.horn} position={[0, 0.38 * Math.pow(0.8, i), 0]} rotation={[-0.6, 0, 0]}>
        <coneGeometry args={[0.05, 0.25, 4]} />
      </mesh>
      {i < 7 ? (
        tailChain(i + 1)
      ) : (
        <mesh material={m.horn} position={[0, 0, -0.35]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 0.3]}>
          <coneGeometry args={[0.3, 0.8, 4]} />
        </mesh>
      )}
    </group>
  );

  return (
    <group ref={root}>
      <mesh material={m.scale} castShadow={shadows} scale={[1.05, 0.95, 2.1]}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <mesh material={m.belly} position={[0, -0.35, 0.1]} scale={[0.85, 0.65, 1.8]}>
        <sphereGeometry args={[1, 12, 8]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} material={m.horn} position={[0, 0.95 - Math.abs(i - 2) * 0.05, 1.2 - i * 0.6]} rotation={[-0.4, 0, 0]}>
          <coneGeometry args={[0.1, 0.5, 4]} />
        </mesh>
      ))}
      {neckChain(0)}
      {tailChain(0)}
      {/* legs tucked */}
      {[
        [-0.7, -0.7, 0.9],
        [0.7, -0.7, 0.9],
        [-0.75, -0.7, -0.9],
        [0.75, -0.7, -0.9],
      ].map((v, i) => (
        <mesh key={i} material={m.scale} position={v as [number, number, number]} rotation={[0.9, 0, 0]} castShadow={shadows}>
          <cylinderGeometry args={[0.18, 0.1, 0.9, 6]} />
        </mesh>
      ))}
      {/* wings */}
      <group ref={wingL} position={[-0.7, 0.55, 0.6]} rotation={[0, 0, 0]} scale={[-1, 1, 1]}>
        <mesh material={m.scale} position={[1.6, 0.3, 0]} rotation={[0, 0, -0.18]}>
          <cylinderGeometry args={[0.1, 0.16, 3.3, 6]} />
        </mesh>
        <mesh geometry={wingGeo} material={m.membrane} castShadow={shadows} />
        <group ref={tipL} position={[3.2, 0.6, -0.2]}>
          <mesh material={m.scale} position={[1.4, -0.2, -0.2]} rotation={[0, 0.2, 1.4]}>
            <cylinderGeometry args={[0.05, 0.1, 2.9, 5]} />
          </mesh>
        </group>
      </group>
      <group ref={wingR} position={[0.7, 0.55, 0.6]}>
        <mesh material={m.scale} position={[1.6, 0.3, 0]} rotation={[0, 0, -0.18]}>
          <cylinderGeometry args={[0.1, 0.16, 3.3, 6]} />
        </mesh>
        <mesh geometry={wingGeo} material={m.membrane} castShadow={shadows} />
        <group ref={tipR} position={[3.2, 0.6, -0.2]}>
          <mesh material={m.scale} position={[1.4, -0.2, -0.2]} rotation={[0, 0.2, 1.4]}>
            <cylinderGeometry args={[0.05, 0.1, 2.9, 5]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ───────────────────────────── Eagle ─────────────────────────────

export function Eagle({ flap }: { flap: MutableRefObject<number> }) {
  const wl = useRef<THREE.Group>(null);
  const wr = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.8 }),
      head: new THREE.MeshStandardMaterial({ color: '#f1e8d8', roughness: 0.8 }),
      beak: new THREE.MeshStandardMaterial({ color: '#f5b83d', roughness: 0.5 }),
      wing: new THREE.MeshStandardMaterial({ color: '#3a2418', roughness: 0.85, side: THREE.DoubleSide }),
    }),
    [],
  );
  useFrame(() => {
    const a = Math.sin(flap.current * Math.PI * 2) * 0.7;
    if (wl.current) wl.current.rotation.z = a;
    if (wr.current) wr.current.rotation.z = -a;
  });
  return (
    <group scale={1.6}>
      <mesh material={m.body} scale={[0.35, 0.3, 0.9]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      <mesh material={m.head} position={[0, 0.15, 0.85]}>
        <sphereGeometry args={[0.2, 8, 6]} />
      </mesh>
      <mesh material={m.beak} position={[0, 0.1, 1.08]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 0.22, 5]} />
      </mesh>
      <mesh material={m.wing} position={[0, 0, -0.95]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 0.6]} />
      </mesh>
      <group ref={wl} position={[-0.25, 0.05, 0]}>
        <mesh material={m.wing} position={[-1.1, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <planeGeometry args={[2.2, 0.8]} />
        </mesh>
      </group>
      <group ref={wr} position={[0.25, 0.05, 0]}>
        <mesh material={m.wing} position={[1.1, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <planeGeometry args={[2.2, 0.8]} />
        </mesh>
      </group>
    </group>
  );
}
