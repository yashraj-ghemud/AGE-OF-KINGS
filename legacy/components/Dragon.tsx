import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mutableGameState, UnitData } from '../store/gameStore';
import { SoundManager } from '../utils/SoundManager';
import { v4 as uuidv4 } from 'uuid';

function DragonCinematic({ spawn }: { spawn: { id: string, spawnStartTime: number, spawnPosition: THREE.Vector3 } }) {
  const cinematicGroupRef = useRef<THREE.Group>(null);
  const thunderRef = useRef<THREE.Mesh>(null);
  const fireBeamRef = useRef<THREE.Mesh>(null);
  const iceBeamRef = useRef<THREE.Mesh>(null);
  const magicBallRef = useRef<THREE.Mesh>(null);
  const stoneRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 400;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
      velocities.push(new THREE.Vector3((Math.random() - 0.5) * 30, Math.random() * 30, (Math.random() - 0.5) * 30));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geo, velocities };
  }, []);

  useFrame((_state, delta) => {
    const now = performance.now();
    const spawnElapsed = (now - spawn.spawnStartTime) / 1000;

    if (cinematicGroupRef.current) {
      cinematicGroupRef.current.position.copy(spawn.spawnPosition);
    }

    if (spawnElapsed < 2.0) {
      const progress = spawnElapsed / 2.0;
      if (thunderRef.current) {
        thunderRef.current.visible = true;
        thunderRef.current.scale.x = progress * (Math.random() > 0.5 ? 1 : 0.2);
        thunderRef.current.scale.z = progress * (Math.random() > 0.5 ? 1 : 0.2);
        (thunderRef.current.material as THREE.MeshStandardMaterial).opacity = progress;
      }
      if (fireBeamRef.current) {
        fireBeamRef.current.visible = true;
        fireBeamRef.current.position.x = 40 - 40 * progress;
        fireBeamRef.current.scale.y = progress;
        (fireBeamRef.current.material as THREE.MeshStandardMaterial).opacity = progress;
      }
      if (iceBeamRef.current) {
        iceBeamRef.current.visible = true;
        iceBeamRef.current.position.x = -40 + 40 * progress;
        iceBeamRef.current.scale.y = progress;
        (iceBeamRef.current.material as THREE.MeshStandardMaterial).opacity = progress;
      }
      if (magicBallRef.current) {
        magicBallRef.current.visible = true;
        magicBallRef.current.scale.setScalar(progress * 3);
        magicBallRef.current.rotation.y += delta * 10;
        magicBallRef.current.rotation.x += delta * 7;
      }
      if (stoneRef.current) stoneRef.current.visible = false;
      if (particlesRef.current) particlesRef.current.visible = false;
    } else if (spawnElapsed < 4.0) {
      if (thunderRef.current) thunderRef.current.visible = false;
      if (fireBeamRef.current) fireBeamRef.current.visible = false;
      if (iceBeamRef.current) iceBeamRef.current.visible = false;
      
      if (magicBallRef.current) {
        magicBallRef.current.scale.setScalar(Math.max(0, 3 - (spawnElapsed - 2.0) * 2));
      }
      
      if (stoneRef.current) {
        stoneRef.current.visible = true;
        stoneRef.current.position.y = Math.sin(spawnElapsed * 15) * 0.5;
        const crackProgress = (spawnElapsed - 2.0) / 1.5;
        const mat = stoneRef.current.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(0xffaa00);
        mat.emissiveIntensity = crackProgress * 5;
      }
      
      if (spawnElapsed > 3.5 && spawnElapsed < 3.6 && stoneRef.current && stoneRef.current.visible) {
        stoneRef.current.visible = false;
        SoundManager.play('dragon_roar');
      }
      
      if (spawnElapsed > 3.5 && particlesRef.current) {
        particlesRef.current.visible = true;
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particles.velocities.length; i++) {
          positions[i * 3] += particles.velocities[i].x * delta;
          positions[i * 3 + 1] += particles.velocities[i].y * delta;
          positions[i * 3 + 2] += particles.velocities[i].z * delta;
          particles.velocities[i].y -= 30 * delta;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }
    } else {
      // Spawn complete
      const index = mutableGameState.spawningDragons.findIndex(s => s.id === spawn.id);
      if (index !== -1) {
        mutableGameState.spawningDragons.splice(index, 1);
        const newDragonId = uuidv4();
        mutableGameState.units.set(newDragonId, {
          id: newDragonId,
          isEnemy: false,
          type: 'dragon',
          weapon: 'sword',
          health: 10000,
          maxHealth: 10000,
          position: spawn.spawnPosition.clone(),
          velocity: new THREE.Vector3(),
          rotation: 0,
          targetId: null,
          lastAttack: 0,
          dead: false,
          isCalled: true // Auto fly to player after spawn
        });
      }
    }
  });

  return (
    <group ref={cinematicGroupRef}>
      <mesh ref={magicBallRef} position={[0, 0, 0]} visible={false}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={2} transparent opacity={0.8} wireframe />
      </mesh>
      <mesh ref={thunderRef} position={[0, 40, 0]} visible={false}>
        <cylinderGeometry args={[0.5, 0.5, 80, 8]} />
        <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={5} transparent opacity={0} />
      </mesh>
      <mesh ref={fireBeamRef} position={[40, 0, 0]} rotation={[0, 0, Math.PI / 2]} visible={false}>
        <cylinderGeometry args={[1, 1, 80, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={3} transparent opacity={0} />
      </mesh>
      <mesh ref={iceBeamRef} position={[-40, 0, 0]} rotation={[0, 0, -Math.PI / 2]} visible={false}>
        <cylinderGeometry args={[1, 1, 80, 8]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={3} transparent opacity={0} />
      </mesh>
      <mesh ref={stoneRef} visible={false}>
        <dodecahedronGeometry args={[3, 1]} />
        <meshStandardMaterial color="#222" roughness={0.9} metalness={0.3} />
      </mesh>
      <points ref={particlesRef} geometry={particles.geo} visible={false}>
        <pointsMaterial size={0.8} color="#ff8800" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

function DragonModel({ unit }: { unit: UnitData }) {
  const groupRef = useRef<THREE.Group>(null);
  const wingsRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const now = performance.now();
    const isRiding = mutableGameState.playerState.ridingDragonId === unit.id;

    if (unit.isCalled && !isRiding) {
      const player = mutableGameState.units.get('player');
      if (player) {
        const targetPos = player.position.clone().add(new THREE.Vector3(0, 5, 0));
        const dist = unit.position.distanceTo(targetPos);
        
        if (dist < 5) {
          unit.isCalled = false;
          if (mutableGameState.playerState.isCaptured) {
            mutableGameState.playerState.isCaptured = false;
            mutableGameState.playerState.captureState = 'free';
            player.health = player.maxHealth;
            SoundManager.play('dragon_roar');
          }
        } else {
          const dir = targetPos.clone().sub(unit.position).normalize();
          unit.position.add(dir.multiplyScalar(delta * 60));
          const targetRotation = Math.atan2(dir.x, dir.z);
          const rotDiff = targetRotation - unit.rotation;
          unit.rotation += Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff)) * delta * 5;
        }
      }
    } else if (!isRiding && !unit.isCalled) {
      // AI Logic: Act as army unit
      let target: UnitData | null = null;
      let minDistance = Infinity;

      // Find closest enemy
      for (const otherUnit of mutableGameState.units.values()) {
        if (otherUnit.isEnemy !== unit.isEnemy && !otherUnit.dead) {
          const dist = unit.position.distanceTo(otherUnit.position);
          if (dist < minDistance) {
            minDistance = dist;
            target = otherUnit;
          }
        }
      }

      if (target) {
        const targetPos = target.position.clone();
        const dist = unit.position.distanceTo(targetPos);
        const dir = targetPos.clone().sub(unit.position).normalize();

        // Face target
        const targetRotation = Math.atan2(dir.x, dir.z);
        const rotDiff = targetRotation - unit.rotation;
        unit.rotation += Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff)) * delta * 5;

        if (dist > 40) {
          // Move towards target
          unit.position.add(dir.multiplyScalar(delta * 20)); // Speed 20
          unit.position.y = THREE.MathUtils.lerp(unit.position.y, 15, delta * 2); // Fly height
        } else {
          // Attack
          const timeSinceAttack = now / 1000 - unit.lastAttack;
          if (timeSinceAttack > 3) { // 3 seconds cooldown
            unit.lastAttack = now / 1000;
            SoundManager.play('dragon_fire');
            
            const shootDir = new THREE.Vector3(
              -Math.sin(unit.rotation),
              -0.2,
              -Math.cos(unit.rotation)
            ).normalize();
            
            const headPos = new THREE.Vector3(0, 1.5, -3);
            headPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), unit.rotation);
            headPos.add(unit.position);

            mutableGameState.projectiles.set(uuidv4(), {
              id: uuidv4(),
              position: headPos,
              velocity: shootDir.multiplyScalar(80),
              isEnemy: unit.isEnemy,
              damage: 2000,
              life: 3,
              type: 'fire'
            });
          }
        }
      } else {
        // Idle flying
        unit.position.y = THREE.MathUtils.lerp(unit.position.y, 15, delta * 2);
      }
    } else if (isRiding) {
      // Sync health with player
      const player = mutableGameState.units.get('player');
      if (player) {
        if (unit.health < player.health) {
          player.health = unit.health;
        } else if (player.health < unit.health) {
          unit.health = player.health;
        }
        unit.maxHealth = player.maxHealth;
      }
    }

    groupRef.current.position.copy(unit.position);
    groupRef.current.rotation.y = unit.rotation;
    // Pitch is not stored in UnitData, we can use a small tilt based on velocity if needed
    // For now, keep it flat or add pitch to UnitData later.

    const time = now / 1000;
    const wingSpeed = isRiding ? 10 : 20;
    
    if (wingsRef.current) {
      const flap = Math.sin(time * wingSpeed) * 0.6;
      wingsRef.current.children[0].rotation.z = flap;
      wingsRef.current.children[1].rotation.z = -flap;
    }
    
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(time * 5) * 0.3;
      tailRef.current.rotation.x = Math.cos(time * 5) * 0.1;
    }
    
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(time * 3) * 0.1;
      headRef.current.rotation.y = Math.cos(time * 2) * 0.05;
    }
  });

  const dragonBodyMat = <meshPhysicalMaterial color="#4a0404" roughness={0.6} metalness={0.3} clearcoat={0.2} clearcoatRoughness={0.4} />;
  const dragonScaleMat = <meshPhysicalMaterial color="#1a0000" roughness={0.8} metalness={0.4} clearcoat={0.1} />;
  const dragonGoldMat = <meshPhysicalMaterial color="#fbbf24" roughness={0.2} metalness={0.9} clearcoat={0.5} />;
  const dragonWingMat = <meshPhysicalMaterial color="#6b0505" roughness={0.9} metalness={0.1} side={THREE.DoubleSide} transmission={0.1} thickness={0.5} />;

  return (
    <group ref={groupRef}>
      {/* Main Body */}
      <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[1.2, 4, 8, 16]} />
        {dragonBodyMat}
      </mesh>
      
      {/* Back Spikes */}
      {[-1.5, -0.5, 0.5, 1.5].map((z, i) => (
        <mesh key={i} castShadow position={[0, 1.2, z]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.3, 1.5, 4]} />
          {dragonGoldMat}
        </mesh>
      ))}

      {/* Head Group */}
      <group ref={headRef} position={[0, 1.5, -3.5]}>
        <mesh castShadow position={[0, -1, 1.5]} rotation={[-Math.PI / 4, 0, 0]}>
          <cylinderGeometry args={[0.8, 1.2, 2.5, 8]} />
          {dragonScaleMat}
        </mesh>
        <mesh castShadow position={[0, 0, -1]}>
          <boxGeometry args={[1.2, 1, 2]} />
          {dragonBodyMat}
        </mesh>
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[1.6, 1.2, 1.6]} />
          {dragonScaleMat}
        </mesh>
        <mesh castShadow position={[-0.6, 1, 0.5]} rotation={[-0.5, 0, 0.3]}>
          <coneGeometry args={[0.2, 1.5, 4]} />
          {dragonGoldMat}
        </mesh>
        <mesh castShadow position={[0.6, 1, 0.5]} rotation={[-0.5, 0, -0.3]}>
          <coneGeometry args={[0.2, 1.5, 4]} />
          {dragonGoldMat}
        </mesh>
        <mesh position={[-0.85, 0.5, -0.5]}>
          <sphereGeometry args={[0.15]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
        </mesh>
        <mesh position={[0.85, 0.5, -0.5]}>
          <sphereGeometry args={[0.15]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
        </mesh>
      </group>

      {/* Tail Group */}
      <group ref={tailRef} position={[0, 0, 2.5]}>
        <mesh castShadow position={[0, 0, 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.2, 0.2, 4, 8]} />
          {dragonScaleMat}
        </mesh>
        <mesh castShadow position={[0, 0.5, 2]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.2, 1, 4]} />
          {dragonGoldMat}
        </mesh>
        <mesh castShadow position={[0, 0.3, 3]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.15, 0.8, 4]} />
          {dragonGoldMat}
        </mesh>
      </group>

      {/* Wings */}
      <group ref={wingsRef} position={[0, 1, -1]}>
        <group position={[-1, 0, 0]}>
          <mesh castShadow position={[-3, 0, 1]} rotation={[0, -0.2, 0]}>
            <boxGeometry args={[6, 0.1, 4]} />
            {dragonWingMat}
          </mesh>
          <mesh castShadow position={[-3, 0.1, -1]} rotation={[0, -0.2, Math.PI/2]}>
            <cylinderGeometry args={[0.1, 0.1, 6]} />
            {dragonGoldMat}
          </mesh>
        </group>
        <group position={[1, 0, 0]}>
          <mesh castShadow position={[3, 0, 1]} rotation={[0, 0.2, 0]}>
            <boxGeometry args={[6, 0.1, 4]} />
            {dragonWingMat}
          </mesh>
          <mesh castShadow position={[3, 0.1, -1]} rotation={[0, 0.2, Math.PI/2]}>
            <cylinderGeometry args={[0.1, 0.1, 6]} />
            {dragonGoldMat}
          </mesh>
        </group>
      </group>
      
      {/* Legs */}
      <mesh castShadow position={[-1, -1.5, -1]}>
        <cylinderGeometry args={[0.4, 0.3, 2]} />
        {dragonScaleMat}
      </mesh>
      <mesh castShadow position={[1, -1.5, -1]}>
        <cylinderGeometry args={[0.4, 0.3, 2]} />
        {dragonScaleMat}
      </mesh>
      <mesh castShadow position={[-1, -1.5, 1.5]}>
        <cylinderGeometry args={[0.5, 0.4, 2]} />
        {dragonScaleMat}
      </mesh>
      <mesh castShadow position={[1, -1.5, 1.5]}>
        <cylinderGeometry args={[0.5, 0.4, 2]} />
        {dragonScaleMat}
      </mesh>
    </group>
  );
}

export function Dragons() {
  const [spawns, setSpawns] = useState(mutableGameState.spawningDragons);
  const [dragons, setDragons] = useState<UnitData[]>([]);

  useFrame(() => {
    // We could use a more optimized way to sync state, but for now this works
    setSpawns([...mutableGameState.spawningDragons]);
    
    const currentDragons: UnitData[] = [];
    mutableGameState.units.forEach(unit => {
      if (unit.type === 'dragon' && !unit.dead) {
        currentDragons.push(unit);
      }
    });
    setDragons(currentDragons);
  });

  return (
    <>
      {spawns.map(spawn => (
        <DragonCinematic key={spawn.id} spawn={spawn} />
      ))}
      {dragons.map(dragon => (
        <DragonModel key={dragon.id} unit={dragon} />
      ))}
    </>
  );
}
