import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mutableGameState, useGameStore } from '../store/gameStore';
import { SoundManager } from '../utils/SoundManager';

const MAX_PROJECTILES = 200;

export function ArrowManager() {
  const arrowShaftRef = useRef<THREE.InstancedMesh>(null);
  const arrowTipRef = useRef<THREE.InstancedMesh>(null);
  const arrowFeatherRef = useRef<THREE.InstancedMesh>(null);
  
  const spearShaftRef = useRef<THREE.InstancedMesh>(null);
  const spearTipRef = useRef<THREE.InstancedMesh>(null);
  const spearTasselRef = useRef<THREE.InstancedMesh>(null);
  
  const fireRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const updateCounts = useGameStore(state => state.updateCounts);
  const setPlayerHealth = useGameStore(state => state.setPlayerHealth);

  useFrame((_state, delta) => {
    if (useGameStore.getState().paused) return;
    
    let arrowCount = 0;
    let spearCount = 0;
    let fireCount = 0;
    const toDelete: string[] = [];

    mutableGameState.projectiles.forEach((proj, id) => {
      proj.life -= delta;
      if (proj.life <= 0) {
        toDelete.push(id);
        return;
      }

      // Gravity
      if (proj.type !== 'spear' && proj.type !== 'fire') {
        proj.velocity.y -= 9.8 * delta;
      }
      
      // Move
      proj.position.add(proj.velocity.clone().multiplyScalar(delta));
      
      // Check collisions
      let hit = false;
      mutableGameState.units.forEach((unit) => {
        if (hit || unit.dead || unit.isEnemy === proj.isEnemy) return;
        
        // Check 2D distance (XZ plane) and height (Y)
        const dx = proj.position.x - unit.position.x;
        const dz = proj.position.z - unit.position.z;
        const distSq2D = dx * dx + dz * dz;
        
        // Unit radius is roughly 0.8, height is roughly 3
        const yOffset = unit.type === 'eagle' ? 10 : 0;
        const hitRadius = proj.type === 'fire' ? 10 : 1.5; // Fire has larger hit radius
        if (distSq2D < hitRadius && proj.position.y >= yOffset && proj.position.y <= yOffset + 3.5) {
          unit.health -= proj.damage;
          SoundManager.play('impact');
          if (unit.health <= 0) {
            unit.dead = true;
            unit.deathTime = Date.now();
            SoundManager.play('death');
            updateCounts();
          }
          if (unit.isPlayer) {
            setPlayerHealth(unit.health);
          }
          if (proj.type !== 'fire') hit = true; // Fire pierces through
        }
      });

      if (hit || proj.position.y < 0) {
        toDelete.push(id);
        return;
      }

      // Update instance
      dummy.position.copy(proj.position);
      // Point arrow in velocity direction
      const dir = proj.velocity.clone().normalize();
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      dummy.updateMatrix();

      if (proj.type === 'fire') {
        if (fireRef.current) {
          fireRef.current.setMatrixAt(fireCount, dummy.matrix);
          fireCount++;
        }
      } else if (proj.type === 'spear') {
        if (spearShaftRef.current && spearTipRef.current && spearTasselRef.current) {
          spearShaftRef.current.setMatrixAt(spearCount, dummy.matrix);
          
          // Tip offset
          dummy.translateY(1.5);
          dummy.updateMatrix();
          spearTipRef.current.setMatrixAt(spearCount, dummy.matrix);
          
          // Tassel offset
          dummy.translateY(-0.3);
          dummy.updateMatrix();
          spearTasselRef.current.setMatrixAt(spearCount, dummy.matrix);
          
          spearCount++;
        }
      } else {
        if (arrowShaftRef.current && arrowTipRef.current && arrowFeatherRef.current) {
          arrowShaftRef.current.setMatrixAt(arrowCount, dummy.matrix);
          
          // Tip offset
          dummy.translateY(0.75);
          dummy.updateMatrix();
          arrowTipRef.current.setMatrixAt(arrowCount, dummy.matrix);
          
          // Feather offset
          dummy.translateY(-1.4);
          dummy.updateMatrix();
          arrowFeatherRef.current.setMatrixAt(arrowCount, dummy.matrix);
          
          arrowCount++;
        }
      }
    });

    toDelete.forEach(id => mutableGameState.projectiles.delete(id));

    // Hide remaining instances
    dummy.position.set(0, -1000, 0);
    dummy.updateMatrix();

    if (arrowShaftRef.current && arrowTipRef.current && arrowFeatherRef.current) {
      for (let j = arrowCount; j < MAX_PROJECTILES; j++) {
        arrowShaftRef.current.setMatrixAt(j, dummy.matrix);
        arrowTipRef.current.setMatrixAt(j, dummy.matrix);
        arrowFeatherRef.current.setMatrixAt(j, dummy.matrix);
      }
      arrowShaftRef.current.instanceMatrix.needsUpdate = true;
      arrowTipRef.current.instanceMatrix.needsUpdate = true;
      arrowFeatherRef.current.instanceMatrix.needsUpdate = true;
      arrowShaftRef.current.count = arrowCount;
      arrowTipRef.current.count = arrowCount;
      arrowFeatherRef.current.count = arrowCount;
    }

    if (spearShaftRef.current && spearTipRef.current && spearTasselRef.current) {
      for (let j = spearCount; j < MAX_PROJECTILES; j++) {
        spearShaftRef.current.setMatrixAt(j, dummy.matrix);
        spearTipRef.current.setMatrixAt(j, dummy.matrix);
        spearTasselRef.current.setMatrixAt(j, dummy.matrix);
      }
      spearShaftRef.current.instanceMatrix.needsUpdate = true;
      spearTipRef.current.instanceMatrix.needsUpdate = true;
      spearTasselRef.current.instanceMatrix.needsUpdate = true;
      spearShaftRef.current.count = spearCount;
      spearTipRef.current.count = spearCount;
      spearTasselRef.current.count = spearCount;
    }

    if (fireRef.current) {
      for (let j = fireCount; j < MAX_PROJECTILES; j++) {
        fireRef.current.setMatrixAt(j, dummy.matrix);
      }
      fireRef.current.instanceMatrix.needsUpdate = true;
      fireRef.current.count = fireCount;
    }
  });

  return (
    <group>
      {/* Arrows */}
      <instancedMesh ref={arrowShaftRef} args={[undefined, undefined, MAX_PROJECTILES]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.5, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={arrowTipRef} args={[undefined, undefined, MAX_PROJECTILES]} castShadow>
        <coneGeometry args={[0.06, 0.2, 8]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.2} />
      </instancedMesh>
      <instancedMesh ref={arrowFeatherRef} args={[undefined, undefined, MAX_PROJECTILES]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.02]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>

      {/* Spears */}
      <instancedMesh ref={spearShaftRef} args={[undefined, undefined, MAX_PROJECTILES]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 3, 8]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={spearTipRef} args={[undefined, undefined, MAX_PROJECTILES]} castShadow>
        <coneGeometry args={[0.12, 0.5, 8]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.1} />
      </instancedMesh>
      <instancedMesh ref={spearTasselRef} args={[undefined, undefined, MAX_PROJECTILES]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.15, 8]} />
        <meshStandardMaterial color="#ef4444" roughness={0.8} />
      </instancedMesh>

      {/* Fireballs */}
      <instancedMesh ref={fireRef} args={[undefined, undefined, MAX_PROJECTILES]}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial color="#ff4500" transparent opacity={0.8} />
      </instancedMesh>
    </group>
  );
}
