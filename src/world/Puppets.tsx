import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type PuppetKind = 'swordsman' | 'spearman' | 'archer' | 'rakshas' | 'lord' | 'minister';

/** Visual state of one soldier. Owned by the simulation / cinematic, read by the renderer. */
export interface Puppet {
  x: number;
  y: number;
  z: number;
  yaw: number;
  kind: PuppetKind;
  team: 0 | 1;
  scale: number;
  /** walk cycle phase, radians */
  walk: number;
  /** 0..1 walk amplitude */
  move: number;
  /** 0..1 progress of the current attack, <0 = idle */
  attack: number;
  /** body tilt (death / kneel) */
  pitch: number;
  roll: number;
  kneel: number;
  /** 0..1 white hit flash */
  flash: number;
  /** archer draw / aim amount */
  aim?: number;
  torch?: boolean;
  sworn?: boolean;
  hidden?: boolean;
}

export function makePuppet(p: Partial<Puppet> & Pick<Puppet, 'kind' | 'team'>): Puppet {
  return {
    x: 0, y: 0, z: 0, yaw: 0, scale: 1, walk: Math.random() * 6.28, move: 0, attack: -1,
    pitch: 0, roll: 0, kneel: 0, flash: 0, ...p,
  };
}

const NI = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
const merged = (...g: THREE.BufferGeometry[]) => mergeGeometries(g.map(NI), false)!;

function buildParts() {
  return {
    leg: merged(
      new THREE.BoxGeometry(0.17, 0.62, 0.2).translate(0, -0.31, 0),
      new THREE.BoxGeometry(0.19, 0.36, 0.26).translate(0, -0.78, 0.03),
    ),
    torso: merged(
      new THREE.CylinderGeometry(0.25, 0.2, 0.74, 8).translate(0, 0.37, 0),
      new THREE.CylinderGeometry(0.23, 0.26, 0.3, 8).translate(0, -0.05, 0), // skirt / tabard
    ),
    head: new THREE.SphereGeometry(0.16, 10, 8),
    arm: merged(
      new THREE.BoxGeometry(0.13, 0.4, 0.14).translate(0, -0.2, 0),
      new THREE.BoxGeometry(0.12, 0.3, 0.13).translate(0, -0.52, 0.02),
    ),
    shoulder: new THREE.SphereGeometry(0.15, 8, 6).scale(1.2, 0.8, 1.1),
    helmDome: merged(
      new THREE.SphereGeometry(0.185, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.BoxGeometry(0.035, 0.16, 0.05).translate(0, -0.04, 0.18),
    ),
    helmCone: merged(new THREE.ConeGeometry(0.2, 0.42, 8).translate(0, 0.17, 0), new THREE.TorusGeometry(0.18, 0.03, 4, 12).rotateX(Math.PI / 2)),
    hood: new THREE.ConeGeometry(0.24, 0.5, 8, 1, true).translate(0, 0.1, -0.03),
    horn: new THREE.ConeGeometry(0.055, 0.34, 6).translate(0, 0.17, 0),
    eye: new THREE.SphereGeometry(0.03, 6, 4),
    crown: merged(
      new THREE.CylinderGeometry(0.17, 0.17, 0.09, 12, 1, true),
      ...[0, 1, 2, 3, 4, 5].map((i) =>
        new THREE.ConeGeometry(0.035, 0.13, 4).translate(Math.cos((i / 6) * Math.PI * 2) * 0.17, 0.1, Math.sin((i / 6) * Math.PI * 2) * 0.17),
      ),
    ),
    cape: new THREE.PlaneGeometry(0.62, 1.3, 1, 3).translate(0, -0.65, 0),
    sword: merged(
      new THREE.BoxGeometry(0.05, 0.9, 0.11).translate(0, 0.62, 0),
      new THREE.ConeGeometry(0.056, 0.14, 4).translate(0, 1.13, 0),
      new THREE.BoxGeometry(0.3, 0.05, 0.07).translate(0, 0.16, 0),
      new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5).translate(0, 0.04, 0),
    ),
    spear: merged(
      new THREE.CylinderGeometry(0.03, 0.03, 2.7, 5).translate(0, 0.6, 0),
      new THREE.ConeGeometry(0.06, 0.32, 5).translate(0, 2.1, 0),
    ),
    bow: new THREE.TorusGeometry(0.55, 0.025, 4, 16, Math.PI * 0.9).rotateZ(Math.PI / 2 - Math.PI * 0.45).rotateY(Math.PI / 2),
    shield: merged(
      new THREE.CylinderGeometry(0.38, 0.38, 0.05, 14).rotateX(Math.PI / 2),
      new THREE.SphereGeometry(0.08, 6, 4).scale(1, 1, 0.5).translate(0, 0, 0.04),
    ),
    club: merged(
      new THREE.CylinderGeometry(0.1, 0.05, 1.1, 6).translate(0, 0.55, 0),
      ...[0, 1, 2, 3].map((i) => new THREE.ConeGeometry(0.04, 0.14, 4).rotateZ(Math.PI / 2).translate(0.1, 0.8 + i * 0.08, 0).rotateY(i * 1.6)),
    ),
    torch: new THREE.CylinderGeometry(0.035, 0.03, 0.9, 5).translate(0, 0.3, 0),
    flame: new THREE.SphereGeometry(0.13, 6, 5).scale(1, 1.6, 1),
  };
}

type PartName = keyof ReturnType<typeof buildParts>;

const STEEL = new THREE.Color('#a4a9b1');
const IRON = new THREE.Color('#3b3537');
const GOLD = new THREE.Color('#f5b83d');
const SKIN = new THREE.Color('#c9936a');
const RAK_SKIN = new THREE.Color('#4a1413');
const WOOD = new THREE.Color('#5a3d26');
const WHITE = new THREE.Color('#ffffff');
const TROUSER = [new THREE.Color('#2a2c3a'), new THREE.Color('#231a18')];

const TUNIC: Record<PuppetKind, [THREE.Color, THREE.Color]> = {
  swordsman: [new THREE.Color('#2f5dd8'), new THREE.Color('#8e1622')],
  spearman: [new THREE.Color('#2446a8'), new THREE.Color('#6e1119')],
  archer: [new THREE.Color('#3b5fa0'), new THREE.Color('#5a1a1a')],
  rakshas: [new THREE.Color('#4a1413'), new THREE.Color('#4a1413')],
  lord: [new THREE.Color('#e7c56a'), new THREE.Color('#1c1216')],
  minister: [new THREE.Color('#f1e6cc'), new THREE.Color('#f1e6cc')],
};
const CAPE = [new THREE.Color('#1c3fa0'), new THREE.Color('#7a0f1b')];

interface PartSpec {
  name: PartName;
  per: number;
  mat: 'cloth' | 'metal' | 'skin' | 'glow' | 'wood' | 'clothDouble';
  shadow: boolean;
}
const PARTS: PartSpec[] = [
  { name: 'leg', per: 2, mat: 'cloth', shadow: true },
  { name: 'torso', per: 1, mat: 'cloth', shadow: true },
  { name: 'head', per: 1, mat: 'skin', shadow: true },
  { name: 'arm', per: 2, mat: 'cloth', shadow: true },
  { name: 'shoulder', per: 2, mat: 'metal', shadow: false },
  { name: 'helmDome', per: 1, mat: 'metal', shadow: false },
  { name: 'helmCone', per: 1, mat: 'metal', shadow: false },
  { name: 'hood', per: 1, mat: 'clothDouble', shadow: false },
  { name: 'horn', per: 2, mat: 'metal', shadow: false },
  { name: 'eye', per: 2, mat: 'glow', shadow: false },
  { name: 'crown', per: 1, mat: 'metal', shadow: false },
  { name: 'cape', per: 1, mat: 'clothDouble', shadow: true },
  { name: 'sword', per: 1, mat: 'metal', shadow: true },
  { name: 'spear', per: 1, mat: 'wood', shadow: true },
  { name: 'bow', per: 1, mat: 'wood', shadow: false },
  { name: 'shield', per: 1, mat: 'metal', shadow: true },
  { name: 'club', per: 1, mat: 'wood', shadow: false },
  { name: 'torch', per: 1, mat: 'wood', shadow: false },
  { name: 'flame', per: 1, mat: 'glow', shadow: false },
];

let partCache: ReturnType<typeof buildParts> | null = null;

// scratch
const mRoot = new THREE.Matrix4();
const mLocal = new THREE.Matrix4();
const mTmp = new THREE.Matrix4();
const mArmR = new THREE.Matrix4();
const mArmL = new THREE.Matrix4();
const mTorso = new THREE.Matrix4();
const mHead = new THREE.Matrix4();
const qRoot = new THREE.Quaternion();
const eRoot = new THREE.Euler(0, 0, 0, 'YXZ');
const vPos = new THREE.Vector3();
const vScale = new THREE.Vector3();
const cTmp = new THREE.Color();
const sphere = new THREE.Sphere();
const frustum = new THREE.Frustum();
const projView = new THREE.Matrix4();

/** local = T(x,y,z) · Rx(rx) · Ry(ry) · Rz(rz) */
function local(out: THREE.Matrix4, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  eRoot.set(rx, ry, rz, 'XYZ');
  out.makeRotationFromEuler(eRoot);
  out.elements[12] = x;
  out.elements[13] = y;
  out.elements[14] = z;
  return out;
}

export interface PuppetRendererProps {
  puppets: MutableRefObject<Puppet[]>;
  capacity?: number;
  maxDistance?: number;
  shadows?: boolean;
}

export function PuppetRenderer({ puppets, capacity = 2500, maxDistance = 320, shadows = true }: PuppetRendererProps) {
  const parts = useMemo(() => (partCache ??= buildParts()), []);
  const { camera } = useThree();
  const meshes = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const mats = useMemo(
    () => ({
      cloth: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      clothDouble: new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }),
      metal: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.75 }),
      skin: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
      wood: new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2 }),
      glow: new THREE.MeshBasicMaterial({ toneMapped: false }),
    }),
    [],
  );
  const counts = useMemo(() => ({} as Record<string, number>), []);

  useFrame((state) => {
    const list = puppets.current;
    const t = state.clock.elapsedTime;
    for (const p of PARTS) counts[p.name] = 0;
    projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projView);
    const cx = camera.position.x;
    const cz = camera.position.z;
    const maxD2 = maxDistance * maxDistance;

    const put = (name: PartName, m: THREE.Matrix4, color: THREE.Color) => {
      const mesh = meshes.current[name];
      if (!mesh) return;
      const i = counts[name]++;
      if (i >= mesh.instanceMatrix.count) return;
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color);
    };
    const flashed = (c: THREE.Color, f: number) => (f > 0 ? cTmp.copy(c).lerp(WHITE, f) : c);

    for (let n = 0; n < list.length; n++) {
      const p = list[n];
      if (p.hidden) continue;
      const dx = p.x - cx;
      const dz = p.z - cz;
      if (dx * dx + dz * dz > maxD2) continue;
      sphere.center.set(p.x, p.y + 1, p.z);
      sphere.radius = 2.5 * p.scale;
      if (!frustum.intersectsSphere(sphere)) continue;

      const team = p.sworn ? 0 : p.team;
      const k = p.kind;
      const kneelDrop = p.kneel * 0.55;
      eRoot.set(p.pitch + p.kneel * 0.25, p.yaw, p.roll, 'YXZ');
      qRoot.setFromEuler(eRoot);
      vPos.set(p.x, p.y - kneelDrop * p.scale, p.z);
      vScale.setScalar(p.scale);
      mRoot.compose(vPos, qRoot, vScale);

      const sw = Math.sin(p.walk) * p.move;
      const bob = Math.abs(Math.cos(p.walk)) * 0.05 * p.move;
      const atk = p.attack >= 0 ? p.attack : -1;
      const f = p.flash;

      // legs
      const legSw = sw * 0.75;
      put('leg', mTmp.multiplyMatrices(mRoot, local(mLocal, -0.13, 0.95 + bob, 0, legSw - p.kneel * 1.3)), flashed(TROUSER[team], f));
      put('leg', mTmp.multiplyMatrices(mRoot, local(mLocal, 0.13, 0.95 + bob, 0, -legSw + p.kneel * 0.2)), flashed(TROUSER[team], f));

      // torso (leans into attacks)
      let twist = 0;
      let lean = 0.06 * p.move;
      if (atk >= 0) {
        const s = Math.sin(atk * Math.PI);
        twist = (k === 'spearman' ? 0.2 : -0.5) * s;
        lean += 0.25 * s;
      }
      mTorso.multiplyMatrices(mRoot, local(mLocal, 0, 0.95 + bob, 0, lean, twist + sw * 0.08, 0));
      const tunic = k === 'rakshas' ? RAK_SKIN : TUNIC[k][team];
      put('torso', mTorso, flashed(tunic, f));

      mHead.multiplyMatrices(mTorso, local(mLocal, 0, 0.9, 0.02, -lean * 0.5));
      put('head', mHead, flashed(k === 'rakshas' ? RAK_SKIN : SKIN, f));
      const metal = team === 0 ? STEEL : IRON;
      if (k === 'swordsman') put('helmDome', mHead, metal);
      else if (k === 'spearman') put('helmCone', mTmp.multiplyMatrices(mHead, local(mLocal, 0, 0.06, 0)), metal);
      else if (k === 'archer') put('hood', mHead, tunic);
      else if (k === 'rakshas') {
        put('horn', mTmp.multiplyMatrices(mHead, local(mLocal, -0.1, 0.08, 0, -0.4, 0, 0.5)), IRON);
        put('horn', mTmp.multiplyMatrices(mHead, local(mLocal, 0.1, 0.08, 0, -0.4, 0, -0.5)), IRON);
        const glow = cTmp.setRGB(6, 0.6 + Math.sin(t * 7 + n) * 0.3, 0.15);
        put('eye', mTmp.multiplyMatrices(mHead, local(mLocal, -0.06, 0.02, 0.14)), glow);
        put('eye', mTmp.multiplyMatrices(mHead, local(mLocal, 0.06, 0.02, 0.14)), glow);
      } else if (k === 'lord' || k === 'minister') {
        put('crown', mTmp.multiplyMatrices(mHead, local(mLocal, 0, 0.12, 0)), k === 'lord' && team === 1 ? IRON : GOLD);
      }

      // arms
      let rArm = -sw * 0.6;
      let lArm = sw * 0.6;
      let rArmZ = 0.12;
      let lArmZ = -0.12;
      if (p.torch) rArm = -2.6;
      if (atk >= 0) {
        if (k === 'spearman') {
          const th = atk < 0.35 ? atk / 0.35 : 1 - (atk - 0.35) / 0.65;
          rArm = -0.2 - th * 0.35;
        } else if (k === 'archer') {
          rArm = -1.45;
          lArm = -1.5;
          rArmZ = 0.35;
        } else {
          // overhead chop: wind up (0..0.35) then swing down
          rArm = atk < 0.35 ? -2.8 * (atk / 0.35) : -2.8 + 2.3 * Math.min(1, (atk - 0.35) / 0.3);
          rArmZ = 0.3;
        }
      } else if (p.aim && p.aim > 0) {
        rArm = -1.45 * p.aim;
        lArm = -1.5 * p.aim;
      }
      if (k === 'swordsman' && atk < 0) lArm = -0.5; // shield forward
      if (p.kneel > 0) {
        rArm = rArm * (1 - p.kneel) - 0.2 * p.kneel;
        lArm = lArm * (1 - p.kneel) - 0.2 * p.kneel;
      }
      const armCol = flashed(k === 'rakshas' ? RAK_SKIN : tunic, f);
      mArmR.multiplyMatrices(mTorso, local(mLocal, 0.31, 0.64, 0, rArm, 0, rArmZ));
      mArmL.multiplyMatrices(mTorso, local(mLocal, -0.31, 0.64, 0, lArm, 0, lArmZ));
      put('arm', mArmR, armCol);
      put('arm', mArmL, armCol);
      if (k !== 'rakshas' && k !== 'archer') {
        put('shoulder', mTmp.multiplyMatrices(mTorso, local(mLocal, 0.3, 0.66, 0)), metal);
        put('shoulder', mTmp.multiplyMatrices(mTorso, local(mLocal, -0.3, 0.66, 0)), metal);
      }

      if (k === 'lord' || k === 'minister') {
        const capeSwing = 0.18 + p.move * 0.55 + Math.sin(t * 2 + n) * 0.06;
        put('cape', mTmp.multiplyMatrices(mTorso, local(mLocal, 0, 0.66, -0.24, capeSwing)), k === 'minister' ? CAPE[0] : CAPE[team]);
      }

      // weapons in the right hand (hand = end of arm)
      if (p.torch) {
        mTmp.multiplyMatrices(mArmR, local(mLocal, 0, -0.66, 0.05, Math.PI));
        put('torch', mTmp, WOOD);
        const fl = 1 + Math.sin(t * 13 + n * 1.7) * 0.15;
        mLocal.makeScale(fl, fl, fl);
        mLocal.setPosition(0, 0.8, 0);
        put('flame', mTmp.multiply(mLocal), cTmp.setRGB(5, 2.2, 0.5));
      } else if (k === 'swordsman' || k === 'lord' || k === 'minister') {
        mTmp.multiplyMatrices(mArmR, local(mLocal, 0, -0.64, 0.04, Math.PI / 2));
        if (k === 'lord') mTmp.multiply(mLocal.makeScale(1.25, 1.35, 1.25));
        put('sword', mTmp, team === 1 && k === 'lord' ? IRON : STEEL);
      } else if (k === 'spearman') {
        put('spear', mTmp.multiplyMatrices(mArmR, local(mLocal, 0, -0.64, 0.02, atk >= 0 ? Math.PI / 2 : 0.2)), WOOD);
      } else if (k === 'rakshas') {
        put('club', mTmp.multiplyMatrices(mArmR, local(mLocal, 0, -0.64, 0.02, Math.PI / 2.4)), WOOD);
      }
      if (k === 'archer') put('bow', mTmp.multiplyMatrices(mArmL, local(mLocal, 0, -0.64, 0.05)), WOOD);
      if (k === 'swordsman') put('shield', mTmp.multiplyMatrices(mArmL, local(mLocal, -0.06, -0.42, 0.14)), team === 0 ? cTmp.set('#c8a24a') : cTmp.set('#4a2226'));
    }

    for (const p of PARTS) {
      const mesh = meshes.current[p.name];
      if (!mesh) continue;
      mesh.count = Math.min(counts[p.name], mesh.instanceMatrix.count);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {PARTS.map((p) => (
        <instancedMesh
          key={p.name}
          ref={(m) => {
            meshes.current[p.name] = m;
            if (m && !m.instanceColor) {
              m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3), 3);
            }
          }}
          args={[parts[p.name], mats[p.mat], capacity * p.per]}
          frustumCulled={false}
          castShadow={shadows && p.shadow}
          receiveShadow={p.mat !== 'glow'}
        />
      ))}
    </group>
  );
}
