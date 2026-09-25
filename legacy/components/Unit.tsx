import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { UnitData, mutableGameState, useGameStore } from '../store/gameStore';
import { v4 as uuidv4 } from 'uuid';

import { SoundManager } from '../utils/SoundManager';

const WEAPON_RANGES = {
  sword: 3,
  spear: 50,
  bow: 25,
};

const WEAPON_COOLDOWNS = {
  sword: 0.8,
  spear: 2.0,
  bow: 2.5,
};

const WEAPON_DAMAGE = {
  sword: 250,
  spear: 200,
  bow: 150,
};

const UNIT_SPEEDS = {
  king: 6,
  swordsman: 5,
  spearman: 4,
  archer: 6,
  eagle: 8,
  rakshas: 6.5,
};

export function Unit({ id }: { id: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const healthBarRef = useRef<THREE.Group>(null);
  const weaponRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  
  const updateCounts = useGameStore(state => state.updateCounts);
  const setPlayerHealth = useGameStore(state => state.setPlayerHealth);

  const fallRotationZ = useRef((Math.random() - 0.5) * Math.PI / 2);

  useFrame((state, delta) => {
    if (useGameStore.getState().paused) return;
    const unit = mutableGameState.units.get(id);
    if (!unit || !groupRef.current) return;

    if (unit.dead) {
      // Cinematic death animation
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -Math.PI / 2, delta * 4);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, fallRotationZ.current, delta * 4);
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, -0.8, delta * 1.5); // Sink slightly into ground
      
      // Garbage collection after 3 seconds
      if (unit.deathTime && Date.now() - unit.deathTime > 3000) {
        mutableGameState.units.delete(unit.id);
      }
      return;
    }

    // If it's the player, we don't control movement here, but we update the visual position
    if (unit.isPlayer) {
      groupRef.current.position.copy(unit.position);
      groupRef.current.rotation.y = unit.rotation;
      return;
    }

    // Y-axis stairs logic
    let targetY = 0;
    const allCamps = [...mutableGameState.camps, mutableGameState.playerCamp];
    allCamps.forEach(camp => {
      const dx = unit.position.x - camp.position.x;
      const dz = unit.position.z - camp.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < 15 && dist > 7.5 && Math.abs(dx) < 4 && dz > 0) {
        targetY = Math.max(targetY, 15 * (15 - dist) / 7.5);
      } else if (dist <= 7.5) {
        targetY = Math.max(targetY, 15);
      }
    });
    unit.position.y = THREE.MathUtils.lerp(unit.position.y, targetY, delta * 10);

    const isCarrier = unit.role === 'carrier';
    const moveDir = new THREE.Vector3();
    let isRetreating = false;
    let isAttacking = false;

    // Capture Logic (Carriers)
    if (isCarrier && mutableGameState.playerState.isCaptured) {
      const { captureState, jailCampId } = mutableGameState.playerState;
      const camp = mutableGameState.camps.find(c => c.id === jailCampId);
      
      if (captureState === 'trapped') {
        moveDir.copy(mutableGameState.cagePosition).sub(unit.position);
        moveDir.y = 0;
        if (moveDir.length() < 2) {
          moveDir.set(0,0,0);
          let allClose = true;
          let aliveCarriersCount = 0;
          mutableGameState.cageCarriers.forEach(cid => {
            const c = mutableGameState.units.get(cid);
            if (c && !c.dead) {
              aliveCarriersCount++;
              if (c.position.distanceTo(mutableGameState.cagePosition) > 3) allClose = false;
            }
          });
          if (aliveCarriersCount === 0) {
            mutableGameState.playerState.isCaptured = false;
            mutableGameState.playerState.captureState = 'free';
            mutableGameState.playerState.invulnerableUntil = Date.now() + 5000;
            const player = mutableGameState.units.get('player');
            if (player) {
              player.health = player.maxHealth;
              setPlayerHealth(player.maxHealth);
            }
          } else if (allClose) {
            mutableGameState.playerState.captureState = 'carried';
          }
        } else {
          moveDir.normalize();
        }
      } else if (captureState === 'carried') {
        if (camp) {
          const jailPos = camp.position.clone().add(new THREE.Vector3(0, 15, 0));
          const cageDir = jailPos.clone().sub(mutableGameState.cagePosition);
          if (cageDir.length() < 2) {
            mutableGameState.playerState.captureState = 'jailed';
          } else {
            // Only move XZ towards the castle, Y is handled by stairs logic
            const moveXZ = new THREE.Vector3(cageDir.x, 0, cageDir.z).normalize().multiplyScalar(4 * delta);
            
            // Y-axis logic for cage
            let cageTargetY = 0;
            const cdx = mutableGameState.cagePosition.x - camp.position.x;
            const cdz = mutableGameState.cagePosition.z - camp.position.z;
            const cdist = Math.sqrt(cdx*cdx + cdz*cdz);
            if (cdist < 22.5 && cdist > 7.5 && Math.abs(cdx) < 4 && cdz > 0) {
              cageTargetY = 15 * (22.5 - cdist) / 15;
            } else if (cdist <= 7.5) {
              cageTargetY = 15;
            }
            mutableGameState.cagePosition.y = THREE.MathUtils.lerp(mutableGameState.cagePosition.y, cageTargetY, delta * 10);
            
            const aliveCarriers = mutableGameState.cageCarriers.filter(cid => {
              const c = mutableGameState.units.get(cid);
              return c && !c.dead;
            });
            
            if (aliveCarriers.length === 0) {
              mutableGameState.playerState.isCaptured = false;
              mutableGameState.playerState.captureState = 'free';
              mutableGameState.playerState.invulnerableUntil = Date.now() + 5000;
              const player = mutableGameState.units.get('player');
              if (player) {
                player.health = player.maxHealth;
                setPlayerHealth(player.maxHealth);
              }
              return;
            }

            // Only one alive carrier moves the cage to avoid double speed
            const firstAliveCarrier = aliveCarriers[0];
            if (firstAliveCarrier === unit.id) {
              mutableGameState.cagePosition.add(moveXZ);
            }
            
            const carrierIndex = aliveCarriers.indexOf(unit.id);
            const offsets = [[1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]];
            const offset = offsets[carrierIndex] || [0, 0];
            const targetPos = mutableGameState.cagePosition.clone().add(new THREE.Vector3(offset[0], 0, offset[1]));
            targetPos.y = targetY;
            unit.position.copy(targetPos);
            
            // Update visual position and rotation
            groupRef.current.position.copy(unit.position);
            const rotTarget = Math.atan2(cageDir.x, cageDir.z);
            let diff = rotTarget - unit.rotation;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            unit.rotation += diff * delta * 8;
            groupRef.current.rotation.y = unit.rotation;
            return;
          }
        }
      } else if (captureState === 'jailed') {
        unit.role = undefined; // Return to normal AI
      }
    }

    let speedMult = 1;

    // AI Logic
    let target = unit.targetId ? mutableGameState.units.get(unit.targetId) : null;
    let closestDistSq = Infinity;
    let closestTarget = null;
    
    const homeCamp = mutableGameState.camps.find(c => c.id === unit.campId);

    mutableGameState.units.forEach((other) => {
      if (other.dead || other.isEnemy === unit.isEnemy) return;
      if (other.isPlayer && mutableGameState.playerState.isCaptured) return;
      
      // Enemies only care about targets inside their own territory
      if (unit.isEnemy && homeCamp) {
        if (other.position.distanceTo(homeCamp.position) > 100) return;
      }
      
      // Player soldiers only care about targets inside player territory when not attacking
      if (!unit.isEnemy && !unit.isPlayer) {
        if (!mutableGameState.attackMode) {
          if (other.position.distanceTo(mutableGameState.playerCamp.position) > 100) return;
        } else {
          // In attack mode, only care about targets near the player
          const player = mutableGameState.units.get('player');
          if (player && other.position.distanceTo(player.position) > 100) return;
        }
      }

      // Swordsmen cannot target eagles
      if (unit.weapon === 'sword' && other.type === 'eagle') return;

      const distSq = unit.position.distanceToSquared(other.position);
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestTarget = other;
      }
    });

    if (!target || target.dead || (target.isPlayer && mutableGameState.playerState.isCaptured)) {
      if (closestTarget) {
        unit.targetId = (closestTarget as UnitData).id;
        target = closestTarget;
      } else {
        unit.targetId = null;
      }
    } else if (closestTarget && closestTarget !== target) {
      // Switch target if the new one is significantly closer (e.g., 25 units squared closer)
      const currentTargetDistSq = unit.position.distanceToSquared(target.position);
      if (closestDistSq < currentTargetDistSq - 25) {
        unit.targetId = (closestTarget as UnitData).id;
        target = closestTarget;
      }
    }

    const hasRallyPoint = !unit.isEnemy && !unit.isPlayer && mutableGameState.rallyPoint;
    const aggroRadiusSq = 15 * 15;

    // Override target if enemy and target is outside castle range
    if (unit.isEnemy && homeCamp && target) {
      if (target.position.distanceTo(homeCamp.position) > 100) {
        target = null;
      }
    }
    
    // Override target if player soldier and target is outside player range when not attacking
    if (!unit.isEnemy && !unit.isPlayer && !mutableGameState.attackMode && target) {
      if (target.position.distanceTo(mutableGameState.playerCamp.position) > 100) {
        target = null;
      }
    }

    if (isCarrier && mutableGameState.playerState.isCaptured) {
      // Handled above
    } else if (unit.isEnemy && mutableGameState.playerState.captureState === 'trapping') {
      const player = mutableGameState.units.get('player');
      if (player) {
        target = player;
        const angle = (unit.id.charCodeAt(0) % 8) * (Math.PI / 4);
        const surroundPos = player.position.clone().add(new THREE.Vector3(Math.cos(angle)*4, 0, Math.sin(angle)*4));
        moveDir.copy(surroundPos).sub(unit.position);
        moveDir.y = 0;
        if (moveDir.length() > 1) {
          moveDir.normalize();
          isAttacking = false;
        } else {
          moveDir.set(0,0,0);
          isAttacking = true;
        }
      }
    } else if (unit.isEnemy && !target && homeCamp) {
      const distToHome = unit.position.distanceTo(homeCamp.position);
      if (distToHome > 80) {
        moveDir.copy(homeCamp.position).sub(unit.position);
        moveDir.y = 0;
        moveDir.normalize();
      } else {
        if (!unit.formationOffset || Math.random() < 0.01) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 80;
          unit.formationOffset = new THREE.Vector3(Math.cos(angle)*radius, 0, Math.sin(angle)*radius);
        }
        const targetPos = homeCamp.position.clone().add(unit.formationOffset);
        moveDir.copy(targetPos).sub(unit.position);
        moveDir.y = 0;
        if (moveDir.length() > 2) {
          moveDir.normalize();
          speedMult = 0.3;
        } else {
          moveDir.set(0,0,0);
        }
      }
    } else if (!unit.isEnemy && mutableGameState.playerState.isCaptured) {
      const distToCage = unit.position.distanceTo(mutableGameState.cagePosition);
      if (distToCage < 4) {
        mutableGameState.playerState.isCaptured = false;
        mutableGameState.playerState.captureState = 'free';
        mutableGameState.playerState.invulnerableUntil = Date.now() + 5000;
        const player = mutableGameState.units.get('player');
        if (player) {
          player.health = player.maxHealth;
          setPlayerHealth(player.maxHealth);
        }
      } else {
        moveDir.copy(mutableGameState.cagePosition).sub(unit.position);
        moveDir.y = 0;
        moveDir.normalize();
        if (target && unit.position.distanceTo(target.position) > 5) {
          target = null;
        }
      }
    } else if (!unit.isEnemy && !unit.isPlayer && mutableGameState.playerState.formation === 'protect' && !mutableGameState.playerState.isCaptured) {
      const player = mutableGameState.units.get('player');
      if (player) {
        const hash = unit.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        let ring = 1;
        if (unit.weapon === 'spear') ring = 2;
        if (unit.weapon === 'bow') ring = 3;
        
        const radius = ring * 5;
        const angle = (hash % (ring * 8)) * (Math.PI * 2 / (ring * 8));
        
        const targetPos = player.position.clone().add(new THREE.Vector3(Math.cos(angle)*radius, 0, Math.sin(angle)*radius));
        moveDir.copy(targetPos).sub(unit.position);
        moveDir.y = 0;
        
        if (moveDir.length() > 1.5) {
          moveDir.normalize();
          speedMult = 1.2; // Move slightly faster to catch up
        } else {
          moveDir.set(0,0,0);
          // Look outward
          const lookDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          unit.rotation = Math.atan2(lookDir.x, lookDir.z);
        }
        
        if (target) {
          const distToTarget = unit.position.distanceTo(target.position);
          if (distToTarget < WEAPON_RANGES[unit.weapon]) {
            isAttacking = true;
            moveDir.set(0,0,0);
          } else if (distToTarget < 15) {
             const dirToTarget = target.position.clone().sub(unit.position);
             dirToTarget.y = 0;
             dirToTarget.normalize();
             moveDir.add(dirToTarget.multiplyScalar(0.5)).normalize();
          } else {
            target = null;
          }
        }
      }
    } else if (!unit.isEnemy && !unit.isPlayer && !mutableGameState.attackMode && !mutableGameState.playerState.isCaptured) {
      const distToPlayerCamp = unit.position.distanceTo(mutableGameState.playerCamp.position);
      if (distToPlayerCamp > 80) {
        moveDir.copy(mutableGameState.playerCamp.position).sub(unit.position);
        moveDir.y = 0;
        moveDir.normalize();
        target = null;
      } else if (!target) {
        if (!unit.formationOffset || Math.random() < 0.01) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 60;
          unit.formationOffset = new THREE.Vector3(Math.cos(angle)*radius, 0, Math.sin(angle)*radius);
        }
        const targetPos = mutableGameState.playerCamp.position.clone().add(unit.formationOffset);
        moveDir.copy(targetPos).sub(unit.position);
        moveDir.y = 0;
        if (moveDir.length() > 2) {
          moveDir.normalize();
          speedMult = 0.3;
        } else {
          moveDir.set(0,0,0);
        }
      } else if (target) {
        if (target.position.distanceTo(mutableGameState.playerCamp.position) > 100) {
          target = null;
        } else {
          const dist = unit.position.distanceTo(target.position);
          const range = WEAPON_RANGES[unit.weapon];
          const dirToTarget = target.position.clone().sub(unit.position);
          dirToTarget.y = 0;
          dirToTarget.normalize();
          
          if (unit.weapon === 'bow' && dist < 12) {
            moveDir.copy(dirToTarget).multiplyScalar(-1);
            isRetreating = true;
          } else if (dist > range * 0.8) {
            moveDir.copy(dirToTarget);
            if (unit.weapon === 'sword') {
              const right = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x);
              const flankDir = (unit.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
              moveDir.add(right.multiplyScalar(0.7 * flankDir));
            } else if (unit.weapon === 'spear') {
              moveDir.multiplyScalar(0.8);
            }
          } else {
            isAttacking = true;
          }
        }
      }
    } else if (!unit.isEnemy && !unit.isPlayer && mutableGameState.attackMode && !mutableGameState.playerState.isCaptured) {
      const player = mutableGameState.units.get('player');
      if (player) {
        const distToPlayer = unit.position.distanceTo(player.position);
        if (distToPlayer > 100 || !target || unit.position.distanceTo(target.position) > 100) {
          if (!unit.formationOffset) {
            const hash = unit.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const angle = (hash % 12) * (Math.PI / 6);
            let radius = 0;
            if (unit.weapon === 'sword') radius = 6;
            else if (unit.weapon === 'spear') radius = 9;
            else if (unit.weapon === 'bow') radius = 12;
            unit.formationOffset = new THREE.Vector3(Math.cos(angle)*radius, 0, Math.sin(angle)*radius);
          }
          const targetPos = player.position.clone().add(unit.formationOffset);
          moveDir.copy(targetPos).sub(unit.position);
          moveDir.y = 0;
          if (moveDir.length() > 2) moveDir.normalize();
          else moveDir.set(0,0,0);
          target = null;
        } else if (target) {
          const dist = unit.position.distanceTo(target.position);
          const range = WEAPON_RANGES[unit.weapon];
          const dirToTarget = target.position.clone().sub(unit.position);
          dirToTarget.y = 0;
          dirToTarget.normalize();
          
          if (unit.weapon === 'bow' && dist < 12) {
            moveDir.copy(dirToTarget).multiplyScalar(-1);
            isRetreating = true;
          } else if (dist > range * 0.8) {
            moveDir.copy(dirToTarget);
            if (unit.weapon === 'sword') {
              const right = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x);
              const flankDir = (unit.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
              moveDir.add(right.multiplyScalar(0.7 * flankDir));
            } else if (unit.weapon === 'spear') {
              moveDir.multiplyScalar(0.8);
            }
          } else {
            isAttacking = true;
          }
        }
      }
    } else if (unit.role === 'minister') {
      if (mutableGameState.playerState.isCaptured) {
        const distToCage = unit.position.distanceTo(mutableGameState.cagePosition);
        if (distToCage < 4) {
          mutableGameState.playerState.isCaptured = false;
          mutableGameState.playerState.captureState = 'free';
          mutableGameState.isRescueSpawned = false;
          mutableGameState.playerState.invulnerableUntil = Date.now() + 5000;
          const player = mutableGameState.units.get('player');
          if (player) {
            player.health = player.maxHealth;
            setPlayerHealth(player.maxHealth);
          }
        } else {
          moveDir.copy(mutableGameState.cagePosition).sub(unit.position);
          moveDir.y = 0;
          moveDir.normalize();
          if (target && unit.position.distanceTo(target.position) > 5) {
            target = null;
          }
        }
      } else {
        const player = mutableGameState.units.get('player');
        if (player) {
          const distToPlayer = unit.position.distanceTo(player.position);
          if (distToPlayer > 30 || !target || unit.position.distanceTo(target.position) > 60) {
            moveDir.copy(player.position).sub(unit.position);
            moveDir.y = 0;
            if (moveDir.length() > 2) moveDir.normalize();
            else moveDir.set(0,0,0);
            target = null;
          } else if (target) {
            const dist = unit.position.distanceTo(target.position);
            const range = WEAPON_RANGES[unit.weapon];
            const dirToTarget = target.position.clone().sub(unit.position);
            dirToTarget.y = 0;
            dirToTarget.normalize();
            
            if (unit.weapon === 'bow' && dist < 12) {
              moveDir.copy(dirToTarget).multiplyScalar(-1);
              isRetreating = true;
            } else if (dist > range * 0.8) {
              moveDir.copy(dirToTarget);
              if (unit.weapon === 'sword') {
                const right = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x);
                const flankDir = (unit.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
                moveDir.add(right.multiplyScalar(0.7 * flankDir));
              } else if (unit.weapon === 'spear') {
                moveDir.multiplyScalar(0.8);
              }
            } else {
              isAttacking = true;
            }
          }
        }
      }
    } else if (unit.role === 'backup') {
      let minister: UnitData | undefined;
      for (const u of mutableGameState.units.values()) {
        if (u.role === 'minister' && !u.dead) {
          minister = u;
          break;
        }
      }
      if (minister) {
        const distToMinister = unit.position.distanceTo(minister.position);
        if (distToMinister > 60 || !target || unit.position.distanceTo(target.position) > 100) {
          if (!unit.formationOffset) {
            const hash = unit.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const angle = (hash % 12) * (Math.PI / 6);
            let radius = 0;
            if (unit.weapon === 'sword') radius = 6;
            else if (unit.weapon === 'spear') radius = 9;
            else if (unit.weapon === 'bow') radius = 12;
            unit.formationOffset = new THREE.Vector3(Math.cos(angle)*radius, 0, Math.sin(angle)*radius);
          }
          const targetPos = minister.position.clone().add(unit.formationOffset);
          moveDir.copy(targetPos).sub(unit.position);
          moveDir.y = 0;
          if (moveDir.length() > 2) moveDir.normalize();
          else moveDir.set(0,0,0);
          target = null;
        } else if (target) {
          const dist = unit.position.distanceTo(target.position);
          const range = WEAPON_RANGES[unit.weapon];
          const dirToTarget = target.position.clone().sub(unit.position);
          dirToTarget.y = 0;
          dirToTarget.normalize();
          
          if (unit.weapon === 'bow' && dist < 12) {
            moveDir.copy(dirToTarget).multiplyScalar(-1);
            isRetreating = true;
          } else if (dist > range * 0.8) {
            moveDir.copy(dirToTarget);
            if (unit.weapon === 'sword') {
              const right = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x);
              const flankDir = (unit.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
              moveDir.add(right.multiplyScalar(0.7 * flankDir));
            } else if (unit.weapon === 'spear') {
              moveDir.multiplyScalar(0.8);
            }
          } else {
            isAttacking = true;
          }
        }
      }
    } else if (hasRallyPoint && (!target || closestDistSq > aggroRadiusSq)) {
      const distToRally = unit.position.distanceTo(mutableGameState.rallyPoint!);
      if (distToRally > 3) {
        moveDir.copy(mutableGameState.rallyPoint!).sub(unit.position);
        moveDir.y = 0;
        moveDir.normalize();
      } else {
        if (target) {
          moveDir.copy(target.position).sub(unit.position);
          moveDir.y = 0;
          moveDir.normalize().multiplyScalar(0.001);
        }
      }
    } else if (target) {
      const dist = unit.position.distanceTo(target.position);
      const range = WEAPON_RANGES[unit.weapon];
      const dirToTarget = target.position.clone().sub(unit.position);
      dirToTarget.y = 0;
      dirToTarget.normalize();
      
      if (unit.weapon === 'bow' && dist < 12) {
        if (unit.isEnemy && homeCamp && unit.position.distanceTo(homeCamp.position) > 50) {
          isAttacking = true;
        } else {
          moveDir.copy(dirToTarget).multiplyScalar(-1);
          isRetreating = true;
        }
      } else if (dist > range * 0.8) {
        moveDir.copy(dirToTarget);
        if (unit.weapon === 'sword') {
          const right = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x);
          const flankDir = (unit.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
          moveDir.add(right.multiplyScalar(0.7 * flankDir));
        }
      } else {
        isAttacking = true;
      }
    } else if (unit.isEnemy && unit.campId) {
      const camp = mutableGameState.camps.find(c => c.id === unit.campId);
      if (camp) {
        if (!unit.formationOffset || Math.random() < 0.01) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 80;
          unit.formationOffset = new THREE.Vector3(Math.cos(angle)*radius, 0, Math.sin(angle)*radius);
        }
        const targetPos = camp.position.clone().add(unit.formationOffset);
        moveDir.copy(targetPos).sub(unit.position);
        moveDir.y = 0;
        if (moveDir.length() > 2) {
          moveDir.normalize();
          speedMult = 0.3;
        } else {
          moveDir.set(0,0,0);
        }
      }
    }

    // Calculate separation force
    const separation = new THREE.Vector3();
    let count = 0;
    mutableGameState.units.forEach((other) => {
      if (other.id === unit.id || other.dead) return;
      const distSq = unit.position.distanceToSquared(other.position);
      if (distSq < 4) {
        const diff = unit.position.clone().sub(other.position);
        diff.normalize().divideScalar(Math.sqrt(distSq));
        separation.add(diff);
        count++;
      }
    });
    if (count > 0) separation.divideScalar(count).multiplyScalar(1.5);

    // Apply separation
    if (separation.lengthSq() > 0.001) {
      moveDir.add(separation);
    }
    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize();
    }

    // Look direction
    let lookDir = moveDir.clone();
    if (isRetreating && target) {
      lookDir.copy(target.position).sub(unit.position).normalize();
    } else if (moveDir.lengthSq() < 0.001 && target) {
      lookDir.copy(target.position).sub(unit.position).normalize();
    }

    if (lookDir.lengthSq() > 0.001) {
      const targetRotation = Math.atan2(lookDir.x, lookDir.z);
      
      // Smooth rotation with wrap-around fix
      let diff = targetRotation - unit.rotation;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      unit.rotation += diff * delta * 8;
      groupRef.current.rotation.y = unit.rotation;
    }

    if (unit.buffTime && unit.buffTime > 0) {
      unit.buffTime -= delta;
    }

    // Apply Movement
    if (moveDir.lengthSq() > 0.001 && (!isAttacking || isRetreating)) {
      const baseSpeed = UNIT_SPEEDS[unit.type as keyof typeof UNIT_SPEEDS] || 4;
      const speed = baseSpeed * (unit.buffTime && unit.buffTime > 0 ? 1.5 : 1) * speedMult;
      unit.velocity.copy(moveDir).multiplyScalar(speed);
      unit.position.add(unit.velocity.clone().multiplyScalar(delta));
    }

    // Attack
    if (isAttacking && !isRetreating && target) {
      const now = state.clock.elapsedTime;
      if (now - unit.lastAttack > WEAPON_COOLDOWNS[unit.weapon]) {
        unit.lastAttack = now;
        
        if (unit.weapon === 'bow' || unit.weapon === 'spear') {
          SoundManager.play(unit.weapon);
          // Ranged attack with realistic arc and slight inaccuracy
          const spawnPos = unit.position.clone().add(new THREE.Vector3(0, unit.type === 'eagle' ? 10 : 1.5, 0));
          const targetPos = target.position.clone().add(new THREE.Vector3(0, target.type === 'eagle' ? 10 : 1, 0));
          const shootDir = targetPos.sub(spawnPos).normalize();
          
          // Aim higher based on distance for realistic gravity arc
          const dist = unit.position.distanceTo(target.position);
          if (unit.weapon === 'bow') {
            shootDir.y += dist * 0.004;
          }
          
          // Add slight inaccuracy (spread)
          shootDir.x += (Math.random() - 0.5) * 0.08;
          shootDir.z += (Math.random() - 0.5) * 0.08;
          shootDir.normalize();
          
          const isSpear = unit.weapon === 'spear';
          let damageMult = (unit.buffTime && unit.buffTime > 0) ? 1.5 : 1;
          if (unit.isEnemy) damageMult *= 2.5; // 2.5x stronger damage
          if (unit.type === 'king') damageMult *= 1.6; // King hits harder (250 * 1.6 = 400, matching player)
          if (unit.type === 'rakshas') damageMult *= 2.0; // Rakshas hits very hard
          
          mutableGameState.projectiles.set(uuidv4(), {
            id: uuidv4(),
            position: spawnPos,
            velocity: shootDir.multiplyScalar(isSpear ? 50 : 35),
            isEnemy: unit.isEnemy,
            damage: WEAPON_DAMAGE[unit.weapon] * damageMult,
            life: 3,
            type: isSpear ? 'spear' : 'arrow'
          });
        } else {
          // Melee attack
          SoundManager.play('sword');
          const isBuffed = unit.buffTime && unit.buffTime > 0;
          let damageMult = isBuffed ? 1.5 : 1;
          if (unit.isEnemy) damageMult *= 2.5; // 2.5x stronger damage
          if (unit.type === 'king') damageMult *= 1.6; // King hits harder
          if (unit.type === 'rakshas') damageMult *= 2.0; // Rakshas hits very hard
          
          if (target.isPlayer && mutableGameState.playerState.isCaptured) {
            // Do no damage to captured player
          } else if (target.isPlayer && Date.now() < (mutableGameState.playerState.invulnerableUntil || 0)) {
            // Invulnerable
          } else {
            target.health -= WEAPON_DAMAGE[unit.weapon] * damageMult;
            SoundManager.play('impact');
            
            // Slight lunge forward for impact realism
            const dirToTarget = target.position.clone().sub(unit.position).normalize();
            unit.position.add(dirToTarget.multiplyScalar(0.4));

            if (target.health <= 0) {
              if (!target.isPlayer) {
                target.dead = true;
                target.deathTime = Date.now();
                SoundManager.play('death');
                updateCounts();
              }
            }
            if (target.isPlayer) {
              setPlayerHealth(target.health);
            }
          }
        }
      }
    }

    // Update visual position
    groupRef.current.position.copy(unit.position);
    
    // Update health bar
    if (healthBarRef.current) {
      const healthPercent = Math.max(0, unit.health / unit.maxHealth);
      healthBarRef.current.scale.x = healthPercent;
      const mesh = healthBarRef.current.children[0] as THREE.Mesh;
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(
        healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.2 ? 0xffff00 : 0xff0000
      );
    }

    // Limb and Weapon Animation
    const now = performance.now() / 1000;
    const timeSinceAttack = now - unit.lastAttack;
    const isMoving = moveDir.lengthSq() > 0.01;
    
    // Walk cycle
    if (isMoving) {
      const walkSpeed = 15;
      const walkCycle = Math.sin(now * walkSpeed);
      if (leftLegRef.current) leftLegRef.current.rotation.x = walkCycle * 0.5;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -walkCycle * 0.5;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -walkCycle * 0.5;
      if (rightArmRef.current && timeSinceAttack > 0.5) rightArmRef.current.rotation.x = walkCycle * 0.5;
    } else {
      if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, delta * 10);
      if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, delta * 10);
      if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0, delta * 10);
      if (rightArmRef.current && timeSinceAttack > 0.5) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, delta * 10);
    }

    if (weaponRef.current && rightArmRef.current) {
      if (unit.weapon === 'bow') {
        if (timeSinceAttack < 0.1) {
          weaponRef.current.position.z = THREE.MathUtils.lerp(weaponRef.current.position.z, 0.2, delta * 40);
        } else {
          weaponRef.current.position.z = THREE.MathUtils.lerp(weaponRef.current.position.z, 0.4, delta * 5);
        }
        weaponRef.current.rotation.x = 0;
        weaponRef.current.rotation.z = 0;
        weaponRef.current.position.y = 0;
        
        // Aiming pose
        rightArmRef.current.rotation.x = -Math.PI / 2;
        if (leftArmRef.current) leftArmRef.current.rotation.x = -Math.PI / 2 + 0.2;
      } else if (unit.weapon === 'spear') {
        if (timeSinceAttack < 0.15) {
          weaponRef.current.position.z = THREE.MathUtils.lerp(weaponRef.current.position.z, -0.8, delta * 30);
          weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, -Math.PI / 2, delta * 30);
          rightArmRef.current.rotation.x = -Math.PI / 2;
        } else if (timeSinceAttack < 0.4) {
          weaponRef.current.position.y = -10; // Hide temporarily
        } else {
          weaponRef.current.position.y = 0;
          weaponRef.current.position.z = THREE.MathUtils.lerp(weaponRef.current.position.z, 0.4, delta * 10);
          weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, delta * 10);
        }
        weaponRef.current.rotation.z = 0;
      } else {
        // Sword
        if (timeSinceAttack < 0.2) {
          weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, -Math.PI / 2, delta * 30);
          weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, -Math.PI / 4, delta * 30);
          weaponRef.current.position.z = THREE.MathUtils.lerp(weaponRef.current.position.z, -0.5, delta * 30);
          rightArmRef.current.rotation.x = -Math.PI / 2;
        } else {
          weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, delta * 10);
          weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0, delta * 10);
          weaponRef.current.position.z = THREE.MathUtils.lerp(weaponRef.current.position.z, 0.4, delta * 10);
        }
        weaponRef.current.position.y = 0;
      }
    }
  });

  const unit = mutableGameState.units.get(id);
  if (!unit || unit.type === 'dragon') return null;

  const isKing = unit.type === 'king';
  const isEagle = unit.type === 'eagle';
  const isRakshas = unit.type === 'rakshas';
  const color = unit.isEnemy ? (isRakshas ? '#4c0519' : '#ef4444') : '#3b82f6'; // Dark red for rakshas, Red for enemy, Blue for friendly
  const horseColor = '#78350f'; // Brown
  const eagleColor = '#451a03'; // Dark Brown
  const isBuffed = unit.buffTime && unit.buffTime > 0;

  const yOffset = isEagle ? 10 : 0;

  return (
    <group ref={groupRef} position={unit.position} scale={isRakshas ? [1.8, 1.8, 1.8] : [1, 1, 1]}>
      <group position={[0, yOffset, 0]}>
        {isBuffed && (
          <group>
            {/* Ground ring */}
            <mesh position={[0, 0.1 - yOffset, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1, 1.2, 16]} />
              <meshBasicMaterial color="#fbbf24" side={THREE.DoubleSide} transparent opacity={0.6} />
            </mesh>
            {/* Glowing Aura around body */}
            <mesh position={[0, isKing ? 1.5 : 1, 0]}>
              <cylinderGeometry args={[0.7, 0.7, isKing ? 2.5 : 1.5, 16]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={0.25} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            {/* Subtle point light */}
            <pointLight position={[0, isKing ? 2 : 1, 0]} color="#fbbf24" intensity={0.5} distance={4} />
          </group>
        )}
        {/* Health Bar */}
        {!unit.dead && (
          <Billboard position={[0, isKing ? 3.5 : 2.5, 0]}>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[1.2, 0.15]} />
              <meshBasicMaterial color="black" side={THREE.DoubleSide} />
            </mesh>
            <group ref={healthBarRef} position={[-0.55, 0, 0.01]}>
              <mesh position={[0.55, 0, 0]}>
                <planeGeometry args={[1.1, 0.1]} />
                <meshBasicMaterial color="#00ff00" side={THREE.DoubleSide} />
              </mesh>
            </group>
          </Billboard>
        )}

        {/* Eagle */}
        {isEagle && (
          <group position={[0, 0, 0]}>
            {/* Body */}
            <mesh castShadow receiveShadow position={[0, 0, 0]}>
              <boxGeometry args={[1.5, 0.8, 2.5]} />
              <meshStandardMaterial color={eagleColor} roughness={0.9} />
            </mesh>
            {/* Head */}
            <mesh castShadow receiveShadow position={[0, 0.2, 1.5]}>
              <boxGeometry args={[0.6, 0.6, 0.8]} />
              <meshStandardMaterial color={eagleColor} roughness={0.9} />
            </mesh>
            {/* Beak */}
            <mesh castShadow receiveShadow position={[0, 0.1, 2.0]}>
              <coneGeometry args={[0.2, 0.6, 4]} />
              <meshStandardMaterial color="#fcd34d" />
            </mesh>
            {/* Wings */}
            <mesh castShadow receiveShadow position={[-1.5, 0, 0]} rotation={[0, 0, -0.2]}>
              <boxGeometry args={[2, 0.1, 1.5]} />
              <meshStandardMaterial color={eagleColor} roughness={0.9} />
            </mesh>
            <mesh castShadow receiveShadow position={[1.5, 0, 0]} rotation={[0, 0, 0.2]}>
              <boxGeometry args={[2, 0.1, 1.5]} />
              <meshStandardMaterial color={eagleColor} roughness={0.9} />
            </mesh>
            {/* Tail */}
            <mesh castShadow receiveShadow position={[0, 0, -1.5]} rotation={[-0.2, 0, 0]}>
              <boxGeometry args={[1, 0.1, 1]} />
              <meshStandardMaterial color={eagleColor} roughness={0.9} />
            </mesh>
          </group>
        )}

        {/* Horse (if king) */}
        {isKing && (
          <group position={[0, 0.8, 0]}>
            {/* Body */}
            <mesh castShadow receiveShadow position={[0, 0, 0]}>
              <boxGeometry args={[1, 1, 2]} />
              <meshStandardMaterial color={horseColor} roughness={0.8} />
            </mesh>
            {/* Head */}
            <mesh castShadow receiveShadow position={[0, 0.8, 0.8]}>
              <boxGeometry args={[0.5, 0.8, 0.6]} />
              <meshStandardMaterial color={horseColor} roughness={0.8} />
            </mesh>
            {/* Legs */}
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
        )}

        {/* Human Body */}
        <group position={[0, isKing ? 2 : (isEagle ? 0.8 : 1), 0]}>
          {/* Torso */}
          <mesh castShadow receiveShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.8, 8]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
          </mesh>
          
          {/* Head */}
          <group position={[0, 0.6, 0]}>
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial color={isRakshas ? '#9f1239' : '#fcd34d'} roughness={0.4} />
            </mesh>
            {isRakshas && (
              <>
                <mesh position={[-0.15, 0.15, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
                  <coneGeometry args={[0.05, 0.3, 8]} />
                  <meshStandardMaterial color="#000000" />
                </mesh>
                <mesh position={[0.15, 0.15, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow>
                  <coneGeometry args={[0.05, 0.3, 8]} />
                  <meshStandardMaterial color="#000000" />
                </mesh>
              </>
            )}
          </group>

          {/* Left Arm */}
          <group ref={leftArmRef} position={[-0.4, 0.3, 0]}>
            <mesh castShadow receiveShadow position={[0, -0.3, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
              <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
            </mesh>
          </group>

          {/* Right Arm & Weapon */}
          <group ref={rightArmRef} position={[0.4, 0.3, 0]}>
            <mesh castShadow receiveShadow position={[0, -0.3, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
              <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
            </mesh>
            
            {/* Weapon attached to hand */}
            <group ref={weaponRef} position={[0, -0.6, 0.2]}>
              {unit.weapon === 'sword' && (
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
              {unit.weapon === 'spear' && (
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
              {unit.weapon === 'bow' && (
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

          {/* Left Leg */}
          <group ref={leftLegRef} position={[-0.15, -0.4, 0]}>
            <mesh castShadow receiveShadow position={[0, -0.3, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
              <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
            </mesh>
          </group>

          {/* Right Leg */}
          <group ref={rightLegRef} position={[0.15, -0.4, 0]}>
            <mesh castShadow receiveShadow position={[0, -0.3, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
              <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
            </mesh>
          </group>
        </group>
    </group>
  </group>
  );
}
