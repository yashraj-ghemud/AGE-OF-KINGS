import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mutableGameState, useGameStore } from '../store/gameStore';

export function RallyPointIndicator() {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (useGameStore.getState().paused) return;
    if (!groupRef.current || !ringRef.current || !coreRef.current) return;
    
    if (mutableGameState.rallyPoint) {
      groupRef.current.visible = true;
      groupRef.current.position.copy(mutableGameState.rallyPoint);
      
      ringRef.current.rotation.z += delta * 2;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      ringRef.current.scale.set(scale, scale, scale);
      
      coreRef.current.position.y = 4 + Math.sin(state.clock.elapsedTime * 2) * 0.5;
    } else {
      groupRef.current.visible = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} ref={ringRef}>
        <ringGeometry args={[1.5, 2, 32]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 4]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 4, 0]} ref={coreRef}>
        <sphereGeometry args={[0.3]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}
