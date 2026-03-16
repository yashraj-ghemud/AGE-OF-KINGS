import { useFrame } from '@react-three/fiber';
import { mutableGameState, useGameStore } from '../store/gameStore';
import * as THREE from 'three';
import { useRef } from 'react';

export function Effects() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (useGameStore.getState().paused) return;
    if (!groupRef.current) return;
    
    // Update effects
    for (let i = mutableGameState.effects.length - 1; i >= 0; i--) {
      const effect = mutableGameState.effects[i];
      effect.life -= delta;
      if (effect.life <= 0) {
        mutableGameState.effects.splice(i, 1);
      }
    }
    
    // Update visuals
    groupRef.current.children.forEach((child, i) => {
      const effect = mutableGameState.effects[i];
      if (!effect) {
        child.visible = false;
        return;
      }
      child.visible = true;
      child.position.copy(effect.position);
      
      const progress = 1 - (effect.life / effect.maxLife);
      
      if (effect.type === 'aoe') {
        const scale = progress * 15;
        child.scale.set(scale, scale, scale);
        ((child as THREE.Mesh).material as THREE.Material).opacity = 1 - progress;
      } else if (effect.type === 'rally') {
        const scale = progress * 20;
        child.scale.set(scale, scale, scale);
        ((child as THREE.Mesh).material as THREE.Material).opacity = (1 - progress) * 0.5;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <ringGeometry args={[0.8, 1, 32]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
