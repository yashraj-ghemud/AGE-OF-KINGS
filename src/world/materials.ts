import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { bannerTexture, stoneTexture, type BannerKind } from './textures';
import type { CastleKind } from './fortress';

/** Shared time uniform for every wind/cloth/flicker shader. */
export const shared = {
  uTime: { value: 0 },
  uWind: { value: 1 },
};

/** Mount once per Canvas to advance the shared time uniform. */
export function SharedClock() {
  useFrame((_, dt) => {
    shared.uTime.value += Math.min(dt, 0.1);
  }, -3);
  return null;
}

/** Waving cloth: displaces along the normal, weighted by the `aWave` attribute (0 = pinned). */
export function applyClothWave(mat: THREE.Material, strength = 0.55) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWind = shared.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aWave;
         uniform float uTime;
         uniform float uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float wv = aWave * aWave;
         float ph = uTime * 2.4 + position.x * 0.31 + position.z * 0.27 - aWave * 3.2;
         float wav = sin(ph) * 0.7 + sin(ph * 2.3 + 1.7) * 0.3;
         transformed += objectNormal * wav * wv * ${strength.toFixed(2)} * uWind;
         transformed.y += abs(wav) * wv * 0.12;`,
      );
  };
  mat.customProgramCacheKey = () => 'cloth' + strength;
  return mat;
}

/** Wind sway for foliage: bends by height, phase from instance world position. */
export function applyFoliageSway(mat: THREE.Material, amount = 0.35) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWind = shared.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uWind;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
         #else
           vec3 ip = vec3(0.0);
         #endif
         float hsw = max(position.y, 0.0);
         float sw = sin(uTime * 1.3 + ip.x * 0.05 + ip.z * 0.07) * 0.6 + sin(uTime * 2.7 + ip.x * 0.13) * 0.25;
         transformed.x += sw * hsw * hsw * 0.012 * ${amount.toFixed(2)} * 10.0 * uWind;
         transformed.z += sw * hsw * hsw * 0.008 * ${amount.toFixed(2)} * 10.0 * uWind;`,
      );
  };
  mat.customProgramCacheKey = () => 'sway' + amount;
  return mat;
}

export interface CastleMaterials {
  stone: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  glow: THREE.MeshBasicMaterial;
  banner: THREE.MeshStandardMaterial;
}

const matCache = new Map<CastleKind, CastleMaterials>();

export function castleMaterials(kind: CastleKind): CastleMaterials {
  const hit = matCache.get(kind);
  if (hit) return hit;
  const tex = stoneTexture();
  const palette = {
    royal: { stone: '#e2d8c4', trim: '#c9bca2', roof: '#27458f', banner: 'royal' as BannerKind, glow: [3.2, 1.9, 0.8] },
    court: { stone: '#e8dfcc', trim: '#cfc2a8', roof: '#27458f', banner: 'royal' as BannerKind, glow: [3.2, 1.9, 0.8] },
    traitor: { stone: '#6d6760', trim: '#4b4642', roof: '#5d161c', banner: 'traitor' as BannerKind, glow: [3.4, 1.2, 0.4] },
    obsidian: { stone: '#2b2830', trim: '#1a171d', roof: '#310a10', banner: 'eclipse' as BannerKind, glow: [4, 0.6, 0.3] },
  }[kind];
  const stone = new THREE.MeshStandardMaterial({
    color: palette.stone, map: tex, bumpMap: tex, bumpScale: 3, roughness: 0.92,
    metalness: kind === 'obsidian' ? 0.3 : 0,
  });
  const trim = new THREE.MeshStandardMaterial({ color: palette.trim, map: tex, bumpMap: tex, bumpScale: 2, roughness: 0.9 });
  const banner = applyClothWave(
    new THREE.MeshStandardMaterial({
      map: bannerTexture(palette.banner), side: THREE.DoubleSide, roughness: 0.85, alphaTest: 0.5,
    }),
  ) as THREE.MeshStandardMaterial;
  const mats: CastleMaterials = {
    stone,
    trim,
    roof: new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.62, metalness: 0.1 }),
    wood: new THREE.MeshStandardMaterial({ color: kind === 'obsidian' ? '#1b1412' : '#4a3222', roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: '#2d2f35', roughness: 0.38, metalness: 0.85 }),
    gold: new THREE.MeshStandardMaterial({ color: '#f5b83d', roughness: 0.22, metalness: 1, emissive: '#5a3000', emissiveIntensity: 0.4 }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(...palette.glow), toneMapped: false }),
    banner,
  };
  matCache.set(kind, mats);
  return mats;
}
