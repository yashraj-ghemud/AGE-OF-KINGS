import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mutableGameState, useGameStore } from '../store/gameStore';
import { v4 as uuidv4 } from 'uuid';

import { SoundManager } from '../utils/SoundManager';

const WEAPON_RANGES = { sword: 4, spear: 50, bow: 30 };
const WEAPON_COOLDOWNS = { sword: 0.1, spear: 0.1, bow: 0.1 };
const WEAPON_DAMAGE = { sword: 400, spear: 300, bow: 250 };

export function Player() {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const weaponGroupRef = useRef<THREE.Group>(null);
  const keys = useRef<{ [key: string]: boolean }>({});
  
  const currentWeapon = useGameStore(state => state.currentWeapon);
  const setWeapon = useGameStore(state => state.setWeapon);
  const updateCounts = useGameStore(state => state.updateCounts);
  const setPlayerHealth = useGameStore(state => state.setPlayerHealth);
  
  const lastAttack = useRef(0);
  const isMouseDown = useRef(false);
  const yaw = useRef(0);
  const pitch = useRef(0.2);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.key === '1') setWeapon('sword');
      if (e.key === '2') setWeapon('spear');
      if (e.key === '3') setWeapon('bow');
      
      if (e.key === 'Control') {
        mutableGameState.attackMode = !mutableGameState.attackMode;
      }
      
      if (e.key === 'Shift') {
        mutableGameState.playerState.formation = mutableGameState.playerState.formation === 'protect' ? 'free' : 'protect';
      }
      
      if (e.key.toLowerCase() === 'p') {
        const pState = mutableGameState.playerState;
        if (pState.ridingDragonId) {
          // Dismount
          pState.ridingDragonId = null;
          const player = mutableGameState.units.get('player');
          if (player) {
            player.position.y = 0; // Drop to ground
          }
        } else {
          // Find closest dragon to mount
          const player = mutableGameState.units.get('player');
          if (player) {
            let closestDragonId: string | null = null;
            let minDistance = 20; // Mount radius
            mutableGameState.units.forEach((unit, id) => {
              if (unit.type === 'dragon' && !unit.dead) {
                const dist = unit.position.distanceTo(player.position);
                if (dist < minDistance) {
                  minDistance = dist;
                  closestDragonId = id;
                }
              }
            });
            if (closestDragonId) {
              pState.ridingDragonId = closestDragonId;
            }
          }
        }
      }
      
      if (e.key.toLowerCase() === 'o') {
        if (mutableGameState.playerState.isCaptured) {
          // Call a dragon to rescue
          let foundDragon = false;
          mutableGameState.units.forEach((unit) => {
            if (unit.type === 'dragon' && !unit.dead && !foundDragon) {
              unit.isCalled = true;
              foundDragon = true;
            }
          });
          if (!foundDragon) {
            const spawnId = uuidv4();
            mutableGameState.spawningDragons.push({
              id: spawnId,
              spawnStartTime: performance.now(),
              spawnPosition: mutableGameState.playerCamp.position.clone().add(new THREE.Vector3(0, 5, 0))
            });
            SoundManager.play('scary_wind');
          }
        } else {
          // Spawn a new dragon
          const spawnId = uuidv4();
          mutableGameState.spawningDragons.push({
            id: spawnId,
            spawnStartTime: performance.now(),
            spawnPosition: mutableGameState.playerCamp.position.clone().add(new THREE.Vector3(0, 5, 0))
          });
          SoundManager.play('scary_wind');
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const pState = mutableGameState.playerState;
        if (pState.ridingDragonId) {
          const dragon = mutableGameState.units.get(pState.ridingDragonId);
          if (dragon) {
            SoundManager.play('dragon_fire');
            const shootDir = new THREE.Vector3(
              -Math.sin(dragon.rotation),
              -0.2, // Slight downward pitch for now, or we can store pitch in dragon unit
              -Math.cos(dragon.rotation)
            ).normalize();
            
            const headPos = new THREE.Vector3(0, 1.5, -3);
            headPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), dragon.rotation);
            headPos.add(dragon.position);

            mutableGameState.projectiles.set(uuidv4(), {
              id: uuidv4(),
              position: headPos,
              velocity: shootDir.multiplyScalar(80),
              isEnemy: false,
              damage: 2000,
              life: 3,
              type: 'fire'
            });
          }
        }
      }

      if (e.key === 'Alt') {
        if (mutableGameState.playerState.captureState === 'jailed') {
          mutableGameState.isRescueSpawned = true;
        }
        
        const player = mutableGameState.units.get('player');
        if (player) {
          const spawnPos = mutableGameState.playerCamp.position.clone();
          const ministerId = uuidv4();
          mutableGameState.units.set(ministerId, {
            id: ministerId, isEnemy: false, type: 'king', weapon: 'sword', health: 5000, maxHealth: 5000,
            position: spawnPos.clone(), velocity: new THREE.Vector3(), rotation: 0, targetId: null, lastAttack: 0, dead: false, role: 'minister'
          });
          for (let i=0; i<15; i++) {
            const id = uuidv4();
            const weapons: ('sword'|'spear'|'bow')[] = ['sword', 'spear', 'bow'];
            const types: ('swordsman'|'spearman'|'archer')[] = ['swordsman', 'spearman', 'archer'];
            mutableGameState.units.set(id, {
              id, isEnemy: false, type: types[i%3], weapon: weapons[i%3], health: 800, maxHealth: 800,
              position: spawnPos.clone().add(new THREE.Vector3((Math.random()-0.5)*10, 0, (Math.random()-0.5)*10)),
              velocity: new THREE.Vector3(), rotation: 0, targetId: null, lastAttack: 0, dead: false, role: 'backup'
            });
          }
          // Add one eagle
          const eagleId = uuidv4();
          mutableGameState.units.set(eagleId, {
            id: eagleId, isEnemy: false, type: 'eagle', weapon: 'bow', health: 1200, maxHealth: 1200,
            position: spawnPos.clone().add(new THREE.Vector3(0, 0, 0)),
            velocity: new THREE.Vector3(), rotation: 0, targetId: null, lastAttack: 0, dead: false, role: 'backup'
          });
          updateCounts();
        }
      }

      const player = mutableGameState.units.get('player');
      if (!player || player.dead) return;

      // Abilities
      if (e.key.toLowerCase() === 'q') {
        mutableGameState.cooldowns.rally = 0;
        mutableGameState.effects.push({ id: uuidv4(), type: 'rally', position: player.position.clone(), life: 1, maxLife: 1 });
        mutableGameState.units.forEach(unit => {
          if (!unit.isEnemy && !unit.dead && unit.position.distanceTo(player.position) < 20) {
            unit.health = Math.min(unit.health + 500, unit.maxHealth);
            unit.buffTime = 10;
          }
        });
        setPlayerHealth(player.health);
      }
      if (e.key.toLowerCase() === 'e') {
        mutableGameState.cooldowns.charge = 0;
        mutableGameState.playerState.isCharging = true;
        mutableGameState.playerState.chargeTime = 0.4;
      }
      if (e.key.toLowerCase() === 'r') {
        mutableGameState.cooldowns.aoe = 0;
        mutableGameState.effects.push({ id: uuidv4(), type: 'aoe', position: player.position.clone(), life: 0.5, maxLife: 0.5 });
        mutableGameState.units.forEach(unit => {
          if (unit.isEnemy && !unit.dead && unit.position.distanceTo(player.position) < 15) {
            unit.health -= 1000;
            if (unit.health <= 0) { 
              unit.dead = true; 
              unit.deathTime = Date.now();
              updateCounts(); 
            }
          }
        });
      }

      if (e.key.toLowerCase() === 'f') {
        if (mutableGameState.rallyPoint) {
          mutableGameState.rallyPoint = null;
        } else {
          const lookDir = new THREE.Vector3(
            -Math.sin(yaw.current) * Math.cos(pitch.current),
            -Math.sin(pitch.current),
            -Math.cos(yaw.current) * Math.cos(pitch.current)
          ).normalize();

          if (lookDir.y < -0.01) {
            const headY = player.position.y + 2.5;
            const distToGround = -headY / lookDir.y;
            const point = player.position.clone().add(new THREE.Vector3(0, 2.5, 0)).add(lookDir.multiplyScalar(distToGround));
            point.y = 0;
            mutableGameState.rallyPoint = point;
          }
        }
      }

      if (e.key.toLowerCase() === 'g') {
        const id = uuidv4();
        const rand = Math.random();
        let type: any = 'swordsman';
        let weapon: any = 'sword';
        if (rand < 0.33) { type = 'archer'; weapon = 'bow'; }
        else if (rand < 0.66) { type = 'spearman'; weapon = 'spear'; }
        
        let health = 500;
        if (type === 'swordsman') health = 800;
        else if (type === 'spearman') health = 600;
        else if (type === 'archer') health = 400;

        mutableGameState.units.set(id, {
          id,
          isEnemy: false,
          type,
          weapon,
          health,
          maxHealth: health,
          position: player.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4)),
          velocity: new THREE.Vector3(),
          rotation: yaw.current,
          targetId: null,
          lastAttack: 0,
          dead: false,
        });
        updateCounts();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement || isMouseDown.current) {
        yaw.current -= e.movementX * 0.002;
        pitch.current += e.movementY * 0.002; // Fixed inversion
        pitch.current = Math.max(-Math.PI / 4, Math.min(Math.PI / 3, pitch.current));
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      if (!document.pointerLockElement) {
        if (document.body.requestPointerLock) {
          document.body.requestPointerLock().catch(() => {});
        }
      }
      isMouseDown.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [currentWeapon, setWeapon, updateCounts]);

  useFrame((_state, delta) => {
    if (useGameStore.getState().paused) return;
    const player = mutableGameState.units.get('player');
    if (!player || !groupRef.current) return;

    if (player.dead) {
      player.dead = false; // King never dies
    }

    const ridingDragonId = mutableGameState.playerState.ridingDragonId;
    if (ridingDragonId) {
      const dragon = mutableGameState.units.get(ridingDragonId);
      if (dragon) {
        let speed = 60;
        const moveDir = new THREE.Vector3(0, 0, 0);
        const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
        const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

        if (keys.current['KeyW']) moveDir.add(forward);
        if (keys.current['KeyS']) moveDir.sub(forward);
        if (keys.current['KeyA']) moveDir.sub(right);
        if (keys.current['KeyD']) moveDir.add(right);
        if (keys.current['ArrowUp']) dragon.position.y += 30 * delta;
        if (keys.current['ArrowDown']) dragon.position.y -= 30 * delta;
        
        dragon.position.y = Math.max(5, dragon.position.y);

        if (moveDir.length() > 0) {
          moveDir.normalize();
          dragon.position.add(moveDir.multiplyScalar(speed * delta));
        }
        
        dragon.rotation = yaw.current;
        // Pitch is not stored in UnitData, but we can just use yaw for the dragon model
        // and pitch for the camera.

        player.position.copy(dragon.position);
        
        const headPosition = dragon.position.clone().add(new THREE.Vector3(0, 5, 0));
        camera.position.copy(headPosition);
        const lookDir = new THREE.Vector3(
          -Math.sin(yaw.current) * Math.cos(pitch.current),
          -Math.sin(pitch.current),
          -Math.cos(yaw.current) * Math.cos(pitch.current)
        );
        camera.lookAt(headPosition.clone().add(lookDir));
        
        return;
      }
    }

    // Capture Logic
    if (player.health < 5000 && player.health > 0 && mutableGameState.playerState.captureState === 'free') {
      mutableGameState.playerState.captureState = 'trapping';
    }

    if (player.health <= 0 && !mutableGameState.playerState.isCaptured) {
      player.health = 0;
      player.dead = false;
      mutableGameState.playerState.isCaptured = true;
      mutableGameState.playerState.captureState = 'trapped';
      mutableGameState.cagePosition.copy(player.position);
      mutableGameState.playerState.playerLocalOffset.set(0,0,0);
      
      let nearestCamp = mutableGameState.camps[0];
      let minDist = Infinity;
      mutableGameState.camps.forEach(camp => {
        const d = camp.position.distanceTo(player.position);
        if (d < minDist) { minDist = d; nearestCamp = camp; }
      });
      mutableGameState.playerState.jailCampId = nearestCamp?.id || null;
      
      const enemies = Array.from(mutableGameState.units.values()).filter(u => u.isEnemy && !u.dead && u.type !== 'king');
      enemies.sort((a, b) => a.position.distanceTo(player.position) - b.position.distanceTo(player.position));
      mutableGameState.cageCarriers = enemies.slice(0, 4).map(u => u.id);
      mutableGameState.cageCarriers.forEach(id => {
        const u = mutableGameState.units.get(id);
        if (u) u.role = 'carrier';
      });
    }

    if (mutableGameState.playerState.isCaptured) {
      let speed = 5;
      const moveDir = new THREE.Vector3(0, 0, 0);
      const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
      const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

      if (keys.current['KeyW']) moveDir.add(forward);
      if (keys.current['KeyS']) moveDir.sub(forward);
      if (keys.current['KeyA']) moveDir.sub(right);
      if (keys.current['KeyD']) moveDir.add(right);

      if (moveDir.length() > 0) {
        moveDir.normalize();
        mutableGameState.playerState.playerLocalOffset.add(moveDir.multiplyScalar(speed * delta));
        if (mutableGameState.playerState.playerLocalOffset.length() > 1.2) {
          mutableGameState.playerState.playerLocalOffset.normalize().multiplyScalar(1.2);
        }
      }

      player.position.copy(mutableGameState.cagePosition).add(mutableGameState.playerState.playerLocalOffset);
      player.position.y = mutableGameState.cagePosition.y;

      groupRef.current.position.copy(player.position);
      player.rotation = yaw.current;
      groupRef.current.rotation.y = player.rotation;
      
      const headPosition = player.position.clone().add(new THREE.Vector3(0, 2.5, 0));
      camera.position.copy(headPosition);
      const lookDir = new THREE.Vector3(
        -Math.sin(yaw.current) * Math.cos(pitch.current),
        -Math.sin(pitch.current),
        -Math.cos(yaw.current) * Math.cos(pitch.current)
      );
      camera.lookAt(headPosition.clone().add(lookDir));
      return; // Disable normal movement and attack
    }

    // Update cooldowns
    if (mutableGameState.cooldowns.rally > 0) mutableGameState.cooldowns.rally -= delta;
    if (mutableGameState.cooldowns.charge > 0) mutableGameState.cooldowns.charge -= delta;
    if (mutableGameState.cooldowns.aoe > 0) mutableGameState.cooldowns.aoe -= delta;

    // Continuous attack
    if (isMouseDown.current && (document.pointerLockElement || useGameStore.getState().paused === false)) {
      const now = performance.now() / 1000;
      if (now - lastAttack.current >= WEAPON_COOLDOWNS[currentWeapon]) {
        lastAttack.current = now;
        
        const shootDir = new THREE.Vector3(
          -Math.sin(yaw.current) * Math.cos(pitch.current),
          -Math.sin(pitch.current),
          -Math.cos(yaw.current) * Math.cos(pitch.current)
        ).normalize();

        if (currentWeapon === 'bow' || currentWeapon === 'spear') {
          SoundManager.play(currentWeapon);
          const isSpear = currentWeapon === 'spear';
          mutableGameState.projectiles.set(uuidv4(), {
            id: uuidv4(),
            position: player.position.clone().add(new THREE.Vector3(0, 2, 0)),
            velocity: shootDir.multiplyScalar(isSpear ? 50 : 40),
            isEnemy: false,
            damage: WEAPON_DAMAGE[currentWeapon],
            life: 3,
            type: isSpear ? 'spear' : 'arrow'
          });
        } else {
          SoundManager.play('sword');
          const range = WEAPON_RANGES[currentWeapon];
          let hit = false;
          
          const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current)).normalize();
          
          mutableGameState.units.forEach((unit) => {
            if (hit || unit.dead || !unit.isEnemy || unit.type === 'eagle') return;
            
            const pPos = player.position.clone().setY(0);
            const uPos = unit.position.clone().setY(0);
            const dist = pPos.distanceTo(uPos);
            
            if (dist < range) {
              const dirToEnemy = uPos.sub(pPos).normalize();
              if (dirToEnemy.dot(forward) > 0.5) {
                unit.health -= WEAPON_DAMAGE[currentWeapon];
                if (unit.health <= 0) {
                  unit.dead = true;
                  unit.deathTime = Date.now();
                  SoundManager.play('death');
                  updateCounts();
                }
                hit = true;
              }
            }
          });
        }
      }
    }

    // Movement
    let speed = 10;
    const moveDir = new THREE.Vector3(0, 0, 0);
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

    if (mutableGameState.playerState.chargeTime > 0) {
      mutableGameState.playerState.chargeTime -= delta;
      speed = 40;
      moveDir.copy(forward);
      
      // Damage enemies in path
      mutableGameState.units.forEach(unit => {
        if (unit.isEnemy && !unit.dead && unit.type !== 'eagle' && unit.position.distanceTo(player.position) < 4) {
          unit.health -= 1000 * delta; // Continuous damage
          if (unit.health <= 0) { 
            unit.dead = true; 
            unit.deathTime = Date.now();
            updateCounts(); 
          }
        }
      });
    } else {
      if (keys.current['KeyW']) moveDir.add(forward);
      if (keys.current['KeyS']) moveDir.sub(forward);
      if (keys.current['KeyA']) moveDir.sub(right);
      if (keys.current['KeyD']) moveDir.add(right);
    }
    
    if (moveDir.length() > 0) {
      moveDir.normalize();
      player.position.add(moveDir.multiplyScalar(speed * delta));
      
      // Play footstep sound periodically
      if (!player.lastFootstep || performance.now() - player.lastFootstep > 400) {
        SoundManager.play('footstep');
        player.lastFootstep = performance.now();
      }
    }

    // Y-axis stairs logic
    let targetY = 0;
    const allCamps = [...mutableGameState.camps, mutableGameState.playerCamp];
    allCamps.forEach(camp => {
      const dx = player.position.x - camp.position.x;
      const dz = player.position.z - camp.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < 15 && dist > 7.5 && Math.abs(dx) < 4 && dz > 0) {
        targetY = Math.max(targetY, 15 * (15 - dist) / 7.5);
      } else if (dist <= 7.5) {
        targetY = Math.max(targetY, 15);
      }
    });
    player.position.y = THREE.MathUtils.lerp(player.position.y, targetY, delta * 10);

    // Update visual position
    groupRef.current.position.copy(player.position);
    player.rotation = yaw.current;
    groupRef.current.rotation.y = player.rotation;
    
    // Update camera (First person)
    const headPosition = player.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    camera.position.copy(headPosition);
    
    const lookDir = new THREE.Vector3(
      -Math.sin(yaw.current) * Math.cos(pitch.current),
      -Math.sin(pitch.current),
      -Math.cos(yaw.current) * Math.cos(pitch.current)
    );
    camera.lookAt(headPosition.clone().add(lookDir));

    // Weapon Animation
    if (weaponGroupRef.current) {
      const now = performance.now() / 1000;
      const timeSinceAttack = now - lastAttack.current;
      
      if (currentWeapon === 'bow') {
        if (timeSinceAttack < 0.1) {
          weaponGroupRef.current.position.z = THREE.MathUtils.lerp(weaponGroupRef.current.position.z, -0.2, delta * 40);
        } else {
          weaponGroupRef.current.position.z = THREE.MathUtils.lerp(weaponGroupRef.current.position.z, -0.6, delta * 5);
        }
        weaponGroupRef.current.rotation.x = pitch.current;
        weaponGroupRef.current.rotation.z = 0;
        weaponGroupRef.current.position.y = 0.5;
      } else if (currentWeapon === 'spear') {
        if (timeSinceAttack < 0.15) {
          weaponGroupRef.current.position.z = THREE.MathUtils.lerp(weaponGroupRef.current.position.z, -1.5, delta * 30);
          weaponGroupRef.current.rotation.x = THREE.MathUtils.lerp(weaponGroupRef.current.rotation.x, pitch.current - Math.PI / 2, delta * 30);
        } else if (timeSinceAttack < 0.4) {
          weaponGroupRef.current.position.y = -10; // Hide to simulate thrown
        } else {
          weaponGroupRef.current.position.y = 0.5;
          weaponGroupRef.current.position.z = THREE.MathUtils.lerp(weaponGroupRef.current.position.z, -0.5, delta * 10);
          weaponGroupRef.current.rotation.x = THREE.MathUtils.lerp(weaponGroupRef.current.rotation.x, pitch.current, delta * 10);
        }
        weaponGroupRef.current.rotation.z = 0;
      } else {
        // Sword
        if (timeSinceAttack < 0.2) {
          weaponGroupRef.current.rotation.x = THREE.MathUtils.lerp(weaponGroupRef.current.rotation.x, pitch.current - Math.PI / 2, delta * 30);
          weaponGroupRef.current.rotation.z = THREE.MathUtils.lerp(weaponGroupRef.current.rotation.z, -Math.PI / 4, delta * 30);
          weaponGroupRef.current.position.z = THREE.MathUtils.lerp(weaponGroupRef.current.position.z, -1.0, delta * 30);
        } else {
          weaponGroupRef.current.rotation.x = THREE.MathUtils.lerp(weaponGroupRef.current.rotation.x, pitch.current, delta * 10);
          weaponGroupRef.current.rotation.z = THREE.MathUtils.lerp(weaponGroupRef.current.rotation.z, 0, delta * 10);
          weaponGroupRef.current.position.z = THREE.MathUtils.lerp(weaponGroupRef.current.position.z, -0.5, delta * 10);
        }
        weaponGroupRef.current.position.y = 0.5;
      }
    }
  });

  const player = mutableGameState.units.get('player');
  if (!player) return null;

  const horseColor = '#1e3a8a';
  const isBuffed = player.buffTime && player.buffTime > 0;

  const isRiding = !!mutableGameState.playerState.ridingDragonId;

  return (
    <group ref={groupRef} position={player.position} visible={!isRiding}>
      {isBuffed && (
        <group>
          {/* Ground ring */}
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1, 1.2, 16]} />
            <meshBasicMaterial color="#fbbf24" side={THREE.DoubleSide} transparent opacity={0.6} />
          </mesh>
          {/* Glowing Aura around body */}
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.7, 0.7, 2.5, 16]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.25} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* Subtle point light */}
          <pointLight position={[0, 2, 0]} color="#fbbf24" intensity={0.5} distance={4} />
        </group>
      )}
      {/* Horse */}
      <group position={[0, 0.8, 0]}>
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 2]} />
          <meshStandardMaterial color={horseColor} roughness={0.8} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.8, 0.8]}>
          <boxGeometry args={[0.5, 0.8, 0.6]} />
          <meshStandardMaterial color={horseColor} roughness={0.8} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.4, -0.8, 0.8]}>
          <boxGeometry args={[0.2, 1, 0.2]} />
          <meshStandardMaterial color={horseColor} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.4, -0.8, 0.8]}>
          <boxGeometry args={[0.2, 1, 0.2]} />
          <meshStandardMaterial color={horseColor} />
        </mesh>
        <mesh castShadow receiveShadow position={[-0.4, -0.8, -0.8]}>
          <boxGeometry args={[0.2, 1, 0.2]} />
          <meshStandardMaterial color={horseColor} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.4, -0.8, -0.8]}>
          <boxGeometry args={[0.2, 1, 0.2]} />
          <meshStandardMaterial color={horseColor} />
        </mesh>
      </group>

        {/* Human Body */}
        <group position={[0, 0, 0]}>
          {/* Torso */}
          <mesh castShadow receiveShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.8, 8]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.8} />
          </mesh>
          {/* Left Leg */}
          <mesh castShadow receiveShadow position={[-0.15, -0.7, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.8} />
          </mesh>
          {/* Right Leg */}
          <mesh castShadow receiveShadow position={[0.15, -0.7, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
        
        {/* Weapon */}
        <group ref={weaponGroupRef} position={[0.5, 0.5, -0.5]}>
          {currentWeapon === 'sword' && (
            <group position={[0, 0.4, 0]} rotation={[Math.PI / 4, 0, 0]}>
              {/* Blade */}
              <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
                <boxGeometry args={[0.05, 0.8, 0.15]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Crossguard */}
              <mesh castShadow receiveShadow position={[0, 0, 0]}>
                <boxGeometry args={[0.3, 0.05, 0.1]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Handle */}
              <mesh castShadow receiveShadow position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
                <meshStandardMaterial color="#78350f" roughness={0.9} />
              </mesh>
              {/* Pommel */}
              <mesh castShadow receiveShadow position={[0, -0.35, 0]}>
                <sphereGeometry args={[0.06, 8, 8]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          )}
          {currentWeapon === 'spear' && (
            <group position={[0, 0.5, 0]} rotation={[Math.PI / 3, 0, 0]}>
              {/* Shaft */}
              <mesh castShadow receiveShadow position={[0, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 2.5, 8]} />
                <meshStandardMaterial color="#5c4033" roughness={0.9} />
              </mesh>
              {/* Tip */}
              <mesh castShadow receiveShadow position={[0, 1.3, 0]}>
                <coneGeometry args={[0.08, 0.4, 8]} />
                <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Tassel */}
              <mesh castShadow receiveShadow position={[0, 1.0, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.1, 8]} />
                <meshStandardMaterial color="#ef4444" roughness={0.8} />
              </mesh>
            </group>
          )}
          {currentWeapon === 'bow' && (
            <group position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              {/* Bow Arc */}
              <mesh castShadow receiveShadow>
                <torusGeometry args={[0.5, 0.04, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#5c4033" roughness={0.9} />
              </mesh>
              {/* Bow String */}
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.005, 0.005, 1.0, 4]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.5} />
              </mesh>
              {/* Arrow (loaded) */}
              <group position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <mesh castShadow receiveShadow position={[0, 0, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, 1.2, 8]} />
                  <meshStandardMaterial color="#8B4513" roughness={0.9} />
                </mesh>
                <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
                  <coneGeometry args={[0.04, 0.15, 8]} />
                  <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh castShadow receiveShadow position={[0, -0.55, 0]}>
                  <boxGeometry args={[0.08, 0.2, 0.01]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.8} />
                </mesh>
              </group>
            </group>
          )}
        </group>
    </group>
  );
}
