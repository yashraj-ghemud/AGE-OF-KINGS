import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { clamp, easeInOutCubic, lerp, noise1 } from '../lib/math';
import { audio } from '../audio/audio';
import { camState } from './player';
import type { World } from './types';

const pivot = new THREE.Vector3();
const smoothPivot = new THREE.Vector3();
const look = new THREE.Vector3();
const want = new THREE.Vector3();
const dir = new THREE.Vector3();
let fov = 60;
let initialised = false;

export function resetCamera() {
  initialised = false;
}

/** Spring-arm third person, first person, dragon, captive and kill-cam cameras. */
export function updateCamera(w: World, cam: THREE.PerspectiveCamera, realDt: number) {
  const k = w.king;
  const u = k.unit;
  const shakeOn = useGameStore.getState().settings.shake;
  let targetFov = 60;
  const sinP = Math.sin(k.camPitch);
  const cosP = Math.cos(k.camPitch);
  dir.set(Math.sin(k.camYaw) * cosP, -sinP, Math.cos(k.camYaw) * cosP);

  if (w.killcam) {
    const kc = w.killcam;
    const a = kc.t * (kc.boss ? 0.35 : 0.8) + k.camYaw + Math.PI * 0.6;
    const r = kc.boss ? 17 : 8.5;
    want.set(kc.x + Math.sin(a) * r, kc.y + (kc.boss ? 6 : 3), kc.z + Math.cos(a) * r);
    look.set(kc.x, kc.y + (kc.boss ? 4 : 1.6), kc.z);
    cam.position.lerp(want, 1 - Math.exp(-realDt * 6));
    cam.lookAt(look);
    targetFov = 42;
  } else if (k.capture === 'trapped' || k.capture === 'carried' || k.capture === 'jailed') {
    const a = k.camYaw;
    want.set(k.cage.x - Math.sin(a) * 9, k.cage.y + 4.5 + k.camPitch * 4, k.cage.z - Math.cos(a) * 9);
    look.set(k.cage.x, k.cage.y + 1.5, k.cage.z);
    cam.position.lerp(want, 1 - Math.exp(-realDt * 5));
    cam.lookAt(look);
    targetFov = 55;
  } else if (k.riding) {
    const d = k.riding;
    pivot.set(d.x, d.y + 3, d.z);
    smoothPivot.lerp(pivot, initialised ? 1 - Math.exp(-realDt * 10) : 1);
    want.copy(smoothPivot).addScaledVector(dir, -20).add(new THREE.Vector3(0, 4, 0));
    cam.position.copy(want);
    look.copy(smoothPivot).addScaledVector(dir, 30);
    cam.lookAt(look);
    targetFov = 62 + clamp(Math.hypot(d.vx, d.vz) / 58) * 14;
  } else if (k.firstPerson) {
    want.set(u.x + Math.sin(u.yaw) * 0.25, u.y + 3.2, u.z + Math.cos(u.yaw) * 0.25);
    cam.position.copy(want);
    look.copy(want).addScaledVector(dir, 10);
    cam.lookAt(look);
    targetFov = 70;
  } else {
    pivot.set(u.x, u.y + 2.9, u.z);
    smoothPivot.lerp(pivot, initialised ? 1 - Math.exp(-realDt * 16) : 1);
    const dist = k.aiming ? 4.6 : k.camDist;
    const shoulder = k.aiming ? 1.25 : 0.5;
    const rx = -Math.cos(k.camYaw);
    const rz = Math.sin(k.camYaw);
    want.copy(smoothPivot).addScaledVector(dir, -dist);
    want.x += rx * shoulder;
    want.z += rz * shoulder;
    const g = w.terrain.heightAt(want.x, want.z) + 0.7;
    if (want.y < g) want.y = g;
    cam.position.copy(want);
    look.copy(want).addScaledVector(dir, 20);
    cam.lookAt(look);
    const sp = Math.hypot(u.vx, u.vz);
    targetFov = 58 + clamp((sp - 9) / 8) * 10 + (k.charging > 0 ? 16 : 0) - k.draw * 16 - (k.aiming ? 6 : 0);
  }
  initialised = true;

  // opening fly-in: sweep down from above Suryagarh
  if (w.intro < 1) {
    w.intro = Math.min(1, w.intro + realDt / 4);
    const e = easeInOutCubic(w.intro);
    const hi = new THREE.Vector3(u.x - 120, u.y + 140, u.z - 160);
    cam.position.lerpVectors(hi, cam.position.clone(), e);
    look.lerpVectors(new THREE.Vector3(u.x, u.y, u.z + 60), look, e);
    cam.lookAt(look);
  }

  // trauma shake
  const s = shakeOn ? w.shake * w.shake : 0;
  if (s > 0.001) {
    const t = performance.now() / 1000;
    cam.position.x += noise1(t * 28) * s * 0.9;
    cam.position.y += noise1(t * 31 + 7) * s * 0.7;
    cam.rotateZ(noise1(t * 23 + 3) * s * 0.03);
  }

  fov = lerp(fov, targetFov, 1 - Math.exp(-realDt * 5));
  cam.fov = fov;
  cam.updateProjectionMatrix();

  camState.pos.copy(cam.position);
  cam.getWorldDirection(camState.dir);
  const yaw = Math.atan2(camState.dir.x, camState.dir.z);
  audio.setListener(cam.position.x, cam.position.y, cam.position.z, yaw);
}
