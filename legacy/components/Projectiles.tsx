import { useFrame } from '@react-three/fiber';
import { mutableGameState, useGameStore } from '../store/gameStore';
import * as THREE from 'three';
import { useRef } from 'react';

export function Projectiles() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (useGameStore.getState().paused) return;
    if (!groupRef.current) return;
    
    // Update projectiles
    mutableGameState.projectiles.forEach((proj, id) => {
      proj.life -= delta;
      if (proj.life <= 0) {
        mutableGameState.projectiles.delete(id);
        return;
      }

      // Gravity
      proj.velocity.y -= 9.8 * delta;
      
      // Move
      proj.position.add(proj.velocity.clone().multiplyScalar(delta));
      
      // Check collisions
      let hit = false;
      mutableGameState.units.forEach((unit) => {
        if (hit || unit.dead || unit.isEnemy === proj.isEnemy) return;
        
        const targetPos = unit.position.clone();
        if (unit.type === 'eagle') targetPos.y += 10;
        
        const hitRadius = proj.type === 'fire' ? 4 : 2;
        if (proj.position.distanceTo(targetPos) < hitRadius) {
          if (unit.isPlayer && mutableGameState.playerState.isCaptured) return;
          if (unit.isPlayer && Date.now() < (mutableGameState.playerState.invulnerableUntil || 0)) return;
          unit.health -= proj.damage;
          if (unit.health <= 0) {
            unit.dead = true;
          }
          hit = true;
        }
      });

      if (hit || proj.position.y < 0) {
        mutableGameState.projectiles.delete(id);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from(mutableGameState.projectiles.values()).map((proj) => {
        if (proj.type === 'fire') {
          return (
            <group key={proj.id} position={proj.position}>
              {/* Inner core */}
              <mesh>
                <sphereGeometry args={[0.8, 16, 16]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              {/* Outer glow */}
              <mesh>
                <sphereGeometry args={[1.5, 16, 16]} />
                <meshBasicMaterial color="#ff4400" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
              </mesh>
              {/* Secondary glow */}
              <mesh>
                <sphereGeometry args={[2.5, 16, 16]} />
                <meshBasicMaterial color="#ffaa00" transparent opacity={0.3} blending={THREE.AdditiveBlending} />
              </mesh>
              <pointLight color="#ff4400" intensity={5} distance={20} />
            </group>
          );
        }
        return (
          <mesh key={proj.id} position={proj.position}>
            <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
            <meshStandardMaterial color="#9ca3af" />
          </mesh>
        );
      })}
    </group>
  );
}
