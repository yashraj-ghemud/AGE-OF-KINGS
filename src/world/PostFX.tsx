import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, type ChromaticAberrationEffect } from 'postprocessing';
import * as THREE from 'three';
import type { Quality } from '../store/gameStore';

export function PostFX({
  quality,
  aberration,
  bloom = 1,
  vignette = 0.72,
}: {
  quality: Quality;
  aberration?: MutableRefObject<number>;
  bloom?: number;
  vignette?: number;
}) {
  const ca = useRef<ChromaticAberrationEffect>(null);
  const offset = useMemo(() => new THREE.Vector2(0.0006, 0.0004), []);
  useFrame(() => {
    if (!ca.current) return;
    const a = 0.0006 + (aberration ? aberration.current : 0) * 0.012;
    ca.current.offset.set(a, a * 0.6);
  });
  if (quality === 'performance') return null;
  const cinematic = quality === 'cinematic';
  return (
    <EffectComposer multisampling={cinematic ? 4 : 0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.9 * bloom} luminanceThreshold={0.82} luminanceSmoothing={0.2} radius={0.75} />
      <ChromaticAberration ref={ca as never} offset={offset} radialModulation modulationOffset={0.25} blendFunction={BlendFunction.NORMAL} />
      <Vignette offset={0.28} darkness={vignette} />
      <Noise opacity={cinematic ? 0.06 : 0.04} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
