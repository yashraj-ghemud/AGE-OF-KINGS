import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../lib/math';
import { createNoise2D, fbm } from './noise';
import { distToSegment, type Terrain } from './terrain';
import { applyFoliageSway, shared } from './materials';

export interface Zone {
  x: number;
  z: number;
  r: number;
}

function jitter(g: THREE.BufferGeometry, amt: number, seed: number) {
  const r = rng(seed);
  const pos = g.getAttribute('position');
  const map = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let d = map.get(k);
    if (!d) {
      d = [(r() - 0.5) * amt, (r() - 0.5) * amt, (r() - 0.5) * amt];
      map.set(k, d);
    }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  g.computeVertexNormals();
  return g;
}

function mergeNI(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
}

function treeGeometries() {
  const pineTrunk = new THREE.CylinderGeometry(0.22, 0.42, 5, 6).translate(0, 2.5, 0);
  const pineLeaves = mergeNI([
    jitter(new THREE.ConeGeometry(2.8, 4.4, 8, 2).translate(0, 4.6, 0), 0.35, 1),
    jitter(new THREE.ConeGeometry(2.2, 3.8, 8, 2).translate(0, 6.9, 0), 0.3, 2),
    jitter(new THREE.ConeGeometry(1.4, 3.2, 7, 1).translate(0, 9.0, 0), 0.2, 3),
  ]);
  const broadTrunk = mergeNI([
    new THREE.CylinderGeometry(0.28, 0.55, 5, 6).translate(0, 2.5, 0),
    new THREE.CylinderGeometry(0.12, 0.2, 2.6, 5).rotateZ(0.8).translate(0.8, 4.4, 0),
    new THREE.CylinderGeometry(0.12, 0.2, 2.4, 5).rotateZ(-0.7).rotateY(1.2).translate(-0.4, 4.6, 0.6),
  ]);
  const broadLeaves = mergeNI([
    jitter(new THREE.IcosahedronGeometry(2.6, 1).translate(0, 6.6, 0), 0.7, 4),
    jitter(new THREE.IcosahedronGeometry(2.0, 1).translate(1.6, 5.8, 0.6), 0.6, 5),
    jitter(new THREE.IcosahedronGeometry(1.9, 1).translate(-1.4, 6.0, -0.8), 0.6, 6),
    jitter(new THREE.IcosahedronGeometry(1.6, 1).translate(0.2, 8.0, -0.3), 0.5, 7),
  ]);
  const deadTrunk = mergeNI([
    new THREE.CylinderGeometry(0.18, 0.45, 6, 5).translate(0, 3, 0),
    new THREE.CylinderGeometry(0.06, 0.16, 3, 4).rotateZ(0.9).translate(0.9, 4.6, 0),
    new THREE.CylinderGeometry(0.05, 0.14, 2.6, 4).rotateZ(-0.8).rotateY(2).translate(-0.6, 5.2, 0.5),
    new THREE.CylinderGeometry(0.05, 0.12, 2.2, 4).rotateZ(0.6).rotateY(4).translate(0.2, 5.8, -0.7),
  ]);
  const rock = jitter(new THREE.IcosahedronGeometry(1, 1), 0.45, 11);
  const rock2 = jitter(new THREE.DodecahedronGeometry(1, 0), 0.3, 12);
  return { pineTrunk, pineLeaves, broadTrunk, broadLeaves, deadTrunk, rock, rock2 };
}

let geoCache: ReturnType<typeof treeGeometries> | null = null;

export interface ForestProps {
  terrain: Terrain;
  seed: number;
  count: number;
  radius: number;
  avoid: Zone[];
  deadZones?: Zone[];
  ash?: number;
  rocks?: number;
  shadows?: boolean;
}

/** Instanced forest: pines, broadleaf, dead trees and rocks placed on the terrain. */
export function Forest({ terrain, seed, count, radius, avoid, deadZones = [], ash = 0, rocks = 300, shadows = true }: ForestProps) {
  const geo = useMemo(() => (geoCache ??= treeGeometries()), []);
  const mats = useMemo(() => {
    const leaves = applyFoliageSway(new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), 0.35);
    return {
      trunk: new THREE.MeshStandardMaterial({ color: '#3d2b1f', roughness: 0.95 }),
      leaves,
      dead: new THREE.MeshStandardMaterial({ color: '#1e1814', roughness: 1 }),
      rock: new THREE.MeshStandardMaterial({ color: '#77716a', roughness: 0.92, flatShading: true }),
    };
  }, []);

  const data = useMemo(() => {
    const r = rng(seed);
    const n = createNoise2D(seed + 5);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const pine: THREE.Matrix4[] = [];
    const broad: THREE.Matrix4[] = [];
    const dead: THREE.Matrix4[] = [];
    const pineC: THREE.Color[] = [];
    const broadC: THREE.Color[] = [];
    const rocksM: THREE.Matrix4[] = [];
    const rockC: THREE.Color[] = [];
    const roads = terrain.spec.roads ?? [];
    const ringR = terrain.spec.mountainRing?.r0 ?? radius;
    const ashCol = new THREE.Color('#403c2e');

    let tries = 0;
    while (pine.length + broad.length + dead.length < count && tries < count * 12) {
      tries++;
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * radius;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (avoid.some((z0) => Math.hypot(x - z0.x, z - z0.z) < z0.r)) continue;
      if (roads.some((rd) => distToSegment(x, z, rd.ax, rd.az, rd.bx, rd.bz) < rd.w * 1.6)) continue;
      const density = fbm(n, x / 180, z / 180, 3);
      if (density < -0.05 + r() * 0.3) continue; // clumpy forests
      terrain.normalAt(x, z, nrm);
      if (nrm.y < 0.82) continue;
      const y = terrain.heightAt(x, z);
      if (Math.hypot(x, z) > ringR + 60 && y > 90) continue;
      const scale = 0.7 + r() * 0.8;
      p.set(x, y - 0.3, z);
      q.setFromAxisAngle(up, r() * Math.PI * 2);
      const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize(), (r() - 0.5) * 0.12);
      q.multiply(lean);
      s.setScalar(scale);
      m.compose(p, q, s);
      const inDead = deadZones.some((z0) => Math.hypot(x - z0.x, z - z0.z) < z0.r);
      if (inDead || r() < ash * 0.6) {
        dead.push(m.clone());
      } else if (density > 0.2 || r() < 0.45) {
        pine.push(m.clone());
        pineC.push(new THREE.Color().setHSL(0.27 + r() * 0.05, 0.38 + r() * 0.15, 0.17 + r() * 0.07).lerp(ashCol, ash));
      } else {
        broad.push(m.clone());
        broadC.push(new THREE.Color().setHSL(0.2 + r() * 0.08, 0.42 + r() * 0.15, 0.22 + r() * 0.08).lerp(ashCol, ash));
      }
    }
    for (let i = 0; i < rocks; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * (radius + 150);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (avoid.some((z0) => Math.hypot(x - z0.x, z - z0.z) < z0.r * 0.9)) continue;
      const y = terrain.heightAt(x, z);
      const sc = 0.5 + Math.pow(r(), 2.5) * 5;
      p.set(x, y - sc * 0.3, z);
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
      s.set(sc * (0.8 + r() * 0.6), sc * (0.5 + r() * 0.4), sc * (0.8 + r() * 0.6));
      m.compose(p, q, s);
      rocksM.push(m.clone());
      rockC.push(new THREE.Color().setHSL(0.08, 0.05 + r() * 0.05, 0.3 + r() * 0.15));
    }
    const even = <T,>(a: T[]) => a.filter((_, i) => i % 2 === 0);
    const odd = <T,>(a: T[]) => a.filter((_, i) => i % 2 === 1);
    return {
      pine, broad, dead, pineC, broadC,
      rockA: even(rocksM), rockAC: even(rockC), rockB: odd(rocksM), rockBC: odd(rockC),
    };
  }, [terrain, seed, count, radius, avoid, deadZones, ash, rocks]);

  return (
    <group>
      <Instanced geometry={geo.pineTrunk} material={mats.trunk} matrices={data.pine} shadows={shadows} />
      <Instanced geometry={geo.pineLeaves} material={mats.leaves} matrices={data.pine} colors={data.pineC} shadows={shadows} />
      <Instanced geometry={geo.broadTrunk} material={mats.trunk} matrices={data.broad} shadows={shadows} />
      <Instanced geometry={geo.broadLeaves} material={mats.leaves} matrices={data.broad} colors={data.broadC} shadows={shadows} />
      <Instanced geometry={geo.deadTrunk} material={mats.dead} matrices={data.dead} shadows={shadows} />
      <Instanced geometry={geo.rock} material={mats.rock} matrices={data.rockA} colors={data.rockAC} shadows={shadows} />
      <Instanced geometry={geo.rock2} material={mats.rock} matrices={data.rockB} colors={data.rockBC} shadows={shadows} />
    </group>
  );
}

function Instanced({
  geometry, material, matrices, colors, shadows,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  colors?: THREE.Color[];
  shadows: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices, colors]);
  if (!matrices.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, matrices.length]}
      castShadow={shadows}
      receiveShadow
    />
  );
}

// ───────────────────────────── grass ─────────────────────────────

function bladeGeometry() {
  const segs = [
    [0, 0.1],
    [0.35, 0.08],
    [0.7, 0.05],
    [1, 0],
  ];
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const base = new THREE.Color('#2c3d1a');
  const tip = new THREE.Color('#b5bf6e');
  const c = new THREE.Color();
  for (const [h, w] of segs) {
    c.copy(base).lerp(tip, h);
    pos.push(-w, h, 0, w, h, 0);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    nrm.push(0, 1, 0, 0, 1, 0);
  }
  const idx: number[] = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

const hash2 = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Wind-swept grass that re-seeds itself on a world-aligned grid around the focus point. */
export function GrassField({
  terrain, focus, count, radius = 48, avoid = [], tint = 0,
}: {
  terrain: Terrain;
  focus: MutableRefObject<THREE.Vector3>;
  count: number;
  radius?: number;
  avoid?: Zone[];
  /** 0 = green, 1 = ashen. */
  tint?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const center = useMemo(() => new THREE.Vector3(1e9, 0, 1e9), []);
  const uniforms = useMemo(() => ({ uCenter: { value: new THREE.Vector3() }, uRadius: { value: radius } }), [radius]);
  const geo = useMemo(bladeGeometry, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = shared.uTime;
      shader.uniforms.uCenter = uniforms.uCenter;
      shader.uniforms.uRadius = uniforms.uRadius;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform vec3 uCenter;\nuniform float uRadius;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
           float fd = distance(ip.xz, uCenter.xz);
           transformed *= 1.0 - smoothstep(uRadius * 0.7, uRadius, fd);
           float h = position.y;
           float gust = sin(uTime * 0.9 + ip.x * 0.04 + ip.z * 0.03);
           float w = sin(uTime * 2.2 + ip.x * 0.35 + ip.z * 0.27) * 0.35 + gust * 0.55;
           transformed.x += w * h * h * 0.45;
           transformed.z += w * h * h * 0.25;`,
        );
    };
    return m;
  }, [uniforms]);

  const tintColor = useMemo(() => new THREE.Color().lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#8f8468'), tint), [tint]);
  const spacing = Math.sqrt((Math.PI * radius * radius) / Math.max(count, 1));

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || count === 0) return;
    const f = focus.current;
    uniforms.uCenter.value.copy(f);
    if (Math.hypot(f.x - center.x, f.z - center.z) < radius * 0.22) return;
    center.set(f.x, 0, f.z);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const roads = terrain.spec.roads ?? [];
    const plateaus = terrain.spec.plateaus ?? [];
    let n = 0;
    const i0 = Math.floor((center.x - radius) / spacing);
    const i1 = Math.ceil((center.x + radius) / spacing);
    const j0 = Math.floor((center.z - radius) / spacing);
    const j1 = Math.ceil((center.z + radius) / spacing);
    for (let i = i0; i <= i1 && n < count; i++) {
      for (let j = j0; j <= j1 && n < count; j++) {
        const hx = hash2(i, j);
        const hz = hash2(j + 17.3, i - 4.1);
        const x = (i + hx) * spacing;
        const z = (j + hz) * spacing;
        if (Math.hypot(x - center.x, z - center.z) > radius) continue;
        if (plateaus.some((pl) => Math.hypot(x - pl.x, z - pl.z) < pl.r * 0.9)) continue;
        if (avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r)) continue;
        if (roads.some((rd) => distToSegment(x, z, rd.ax, rd.az, rd.bx, rd.bz) < rd.w * 0.8)) continue;
        const y = terrain.heightAt(x, z);
        const hs = hash2(x * 0.37, z * 0.71);
        p.set(x, y - 0.02, z);
        q.setFromAxisAngle(up, hs * Math.PI * 2);
        const sc = 0.3 + hs * 0.5;
        s.set(0.7 + hx * 0.5, sc, 1);
        m.compose(p, q, s);
        mesh.setMatrixAt(n, m);
        col.setHSL(0.19 + hz * 0.07, 0.35 + hx * 0.2, 0.42 + hs * 0.2).multiply(tintColor);
        mesh.setColorAt(n, col);
        n++;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (count === 0) return null;
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} receiveShadow />;
}

