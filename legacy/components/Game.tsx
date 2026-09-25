import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Sky, ContactShadows } from '@react-three/drei';
import { Player } from './Player';
import { Unit } from './Unit';
import { ArrowManager } from './ArrowManager';
import { Effects } from './Effects';
import { RallyPointIndicator } from './RallyPointIndicator';
import { Scenery } from './Scenery';
import { Dragons } from './Dragon';
import { mutableGameState, useGameStore } from '../store/gameStore';
import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';

function Castles() {
  return (
    <>
      {/* Player Castle */}
      <group position={mutableGameState.playerCamp.position}>
        {/* Yellow Boundary Ring */}
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[99, 100, 64]} />
          <meshBasicMaterial color="#eab308" transparent opacity={0.8} />
        </mesh>

        {/* Outer Walls */}
        <mesh position={[0, 4, -40]} castShadow receiveShadow>
          <boxGeometry args={[80, 8, 2]} />
          <meshStandardMaterial color="#1e40af" roughness={0.9} />
        </mesh>
        <mesh position={[-30.5, 4, 40]} castShadow receiveShadow>
          <boxGeometry args={[19, 8, 2]} />
          <meshStandardMaterial color="#1e40af" roughness={0.9} />
        </mesh>
        <mesh position={[30.5, 4, 40]} castShadow receiveShadow>
          <boxGeometry args={[19, 8, 2]} />
          <meshStandardMaterial color="#1e40af" roughness={0.9} />
        </mesh>
        <mesh position={[-40, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[2, 8, 80]} />
          <meshStandardMaterial color="#1e40af" roughness={0.9} />
        </mesh>
        <mesh position={[40, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[2, 8, 80]} />
          <meshStandardMaterial color="#1e40af" roughness={0.9} />
        </mesh>

        {/* Gatehouse */}
        <mesh position={[-18, 6, 40]} castShadow receiveShadow>
          <boxGeometry args={[6, 12, 4]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.9} />
        </mesh>
        <mesh position={[18, 6, 40]} castShadow receiveShadow>
          <boxGeometry args={[6, 12, 4]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 10, 40]} castShadow receiveShadow>
          <boxGeometry args={[30, 4, 4]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.9} />
        </mesh>

        {/* Outer Towers */}
        {[[-40, -40], [40, -40], [-40, 40], [40, 40]].map((pos, i) => (
          <group key={`p-outer-tower-${i}`} position={[pos[0], 8, pos[1]]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[3, 3.5, 16, 8]} />
              <meshStandardMaterial color="#1e3a8a" roughness={0.9} />
            </mesh>
            {/* Outer Tower Battlements */}
            {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((angle, j) => (
              <mesh key={`p-o-tower-battlement-${j}`} position={[Math.cos(angle)*2.5, 8.5, Math.sin(angle)*2.5]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                <boxGeometry args={[2, 1.5, 0.5]} />
                <meshStandardMaterial color="#1e3a8a" />
              </mesh>
            ))}
          </group>
        ))}

        {/* Tents / Bases in Courtyard */}
        {[[-25, -20], [25, -20], [-25, 0], [25, 0], [-25, 20], [25, 20]].map((pos, i) => (
          <group key={`p-tent-${i}`} position={[pos[0], 2, pos[1]]}>
            <mesh castShadow receiveShadow position={[0, 0, 0]}>
              <cylinderGeometry args={[0, 4, 4, 4]} />
              <meshStandardMaterial color="#1e3a8a" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.5, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 1]} />
              <meshStandardMaterial color="#d1d5db" />
            </mesh>
            <mesh position={[0.5, 2.5, 0]} castShadow>
              <planeGeometry args={[1, 0.8]} />
              <meshStandardMaterial color="#3b82f6" side={2} />
            </mesh>
          </group>
        ))}

        <mesh position={[0, 7.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[15, 15, 15]} />
          <meshStandardMaterial color="#2563eb" roughness={0.9} />
        </mesh>
        {/* Battlements for Player Keep */}
        {[-7, -3.5, 0, 3.5, 7].map((x, i) => (
          <group key={`p-keep-battlement-${i}`}>
            <mesh position={[x, 15.5, 7]} castShadow receiveShadow><boxGeometry args={[1.5, 1, 1]} /><meshStandardMaterial color="#2563eb" /></mesh>
            <mesh position={[x, 15.5, -7]} castShadow receiveShadow><boxGeometry args={[1.5, 1, 1]} /><meshStandardMaterial color="#2563eb" /></mesh>
            <mesh position={[7, 15.5, x]} castShadow receiveShadow><boxGeometry args={[1, 1, 1.5]} /><meshStandardMaterial color="#2563eb" /></mesh>
            <mesh position={[-7, 15.5, x]} castShadow receiveShadow><boxGeometry args={[1, 1, 1.5]} /><meshStandardMaterial color="#2563eb" /></mesh>
          </group>
        ))}
        {[[-8.5, -8.5], [8.5, -8.5], [-8.5, 8.5], [8.5, 8.5]].map((pos, i) => (
          <group key={i} position={[pos[0], 10, pos[1]]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[2, 2.5, 20, 8]} />
              <meshStandardMaterial color="#1e40af" roughness={0.9} />
            </mesh>
            {/* Tower Battlements */}
            {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((angle, j) => (
              <mesh key={`p-tower-battlement-${j}`} position={[Math.cos(angle)*1.8, 10.5, Math.sin(angle)*1.8]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.5, 1, 0.5]} />
                <meshStandardMaterial color="#1e40af" />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 18, 0]} castShadow>
          <planeGeometry args={[2, 1.5]} />
          <meshStandardMaterial color="#3b82f6" side={2} />
        </mesh>
        <mesh position={[-0.9, 16.5, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 5]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        {/* Stairs */}
        {Array.from({ length: 30 }).map((_, i) => (
          <mesh key={`p-stair-${i}`} position={[0, i * 0.5 + 0.25, 7.5 + (30 - i) * 0.5]} castShadow receiveShadow>
            <boxGeometry args={[4, 0.5, 0.5]} />
            <meshStandardMaterial color="#1e40af" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Enemy Castles */}
      {mutableGameState.camps.map(camp => (
        <group key={camp.id} position={camp.position}>
          {/* Range Marker */}
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[99, 100, 64]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[98, 99, 64]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
          </mesh>

          {/* Outer Walls */}
          <mesh position={[0, 4, -40]} castShadow receiveShadow>
            <boxGeometry args={[80, 8, 2]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
          </mesh>
          <mesh position={[-30.5, 4, 40]} castShadow receiveShadow>
            <boxGeometry args={[19, 8, 2]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
          </mesh>
          <mesh position={[30.5, 4, 40]} castShadow receiveShadow>
            <boxGeometry args={[19, 8, 2]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
          </mesh>
          <mesh position={[-40, 4, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 8, 80]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
          </mesh>
          <mesh position={[40, 4, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 8, 80]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
          </mesh>

          {/* Gatehouse */}
          <mesh position={[-18, 6, 40]} castShadow receiveShadow>
            <boxGeometry args={[6, 12, 4]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
          </mesh>
          <mesh position={[18, 6, 40]} castShadow receiveShadow>
            <boxGeometry args={[6, 12, 4]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 10, 40]} castShadow receiveShadow>
            <boxGeometry args={[30, 4, 4]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
          </mesh>

          {/* Outer Towers */}
          {[[-40, -40], [40, -40], [-40, 40], [40, 40]].map((pos, i) => (
            <group key={`outer-tower-${i}`} position={[pos[0], 8, pos[1]]}>
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[3, 3.5, 16, 8]} />
                <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
              </mesh>
              {/* Outer Tower Battlements */}
              {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((angle, j) => (
                <mesh key={`o-tower-battlement-${j}`} position={[Math.cos(angle)*2.5, 8.5, Math.sin(angle)*2.5]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                  <boxGeometry args={[2, 1.5, 0.5]} />
                  <meshStandardMaterial color="#2a2a2a" />
                </mesh>
              ))}
            </group>
          ))}

          {/* Tents / Bases in Courtyard */}
          {[[-25, -20], [25, -20], [-25, 0], [25, 0], [-25, 20], [25, 20]].map((pos, i) => (
            <group key={`tent-${i}`} position={[pos[0], 2, pos[1]]}>
              <mesh castShadow receiveShadow position={[0, 0, 0]}>
                <cylinderGeometry args={[0, 4, 4, 4]} />
                <meshStandardMaterial color="#7f1d1d" roughness={0.9} />
              </mesh>
              <mesh position={[0, 2.5, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, 1]} />
                <meshStandardMaterial color="#d1d5db" />
              </mesh>
              <mesh position={[0.5, 2.5, 0]} castShadow>
                <planeGeometry args={[1, 0.8]} />
                <meshStandardMaterial color="#ef4444" side={2} />
              </mesh>
            </group>
          ))}

          {/* Main Keep */}
          <mesh position={[0, 7.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[15, 15, 15]} />
            <meshStandardMaterial color="#4a4a4a" roughness={0.9} />
          </mesh>
          {/* Battlements for Enemy Keep */}
          {[-7, -3.5, 0, 3.5, 7].map((x, i) => (
            <group key={`e-keep-battlement-${i}`}>
              <mesh position={[x, 15.5, 7]} castShadow receiveShadow><boxGeometry args={[1.5, 1, 1]} /><meshStandardMaterial color="#4a4a4a" /></mesh>
              <mesh position={[x, 15.5, -7]} castShadow receiveShadow><boxGeometry args={[1.5, 1, 1]} /><meshStandardMaterial color="#4a4a4a" /></mesh>
              <mesh position={[7, 15.5, x]} castShadow receiveShadow><boxGeometry args={[1, 1, 1.5]} /><meshStandardMaterial color="#4a4a4a" /></mesh>
              <mesh position={[-7, 15.5, x]} castShadow receiveShadow><boxGeometry args={[1, 1, 1.5]} /><meshStandardMaterial color="#4a4a4a" /></mesh>
            </group>
          ))}
          {/* Towers */}
          {[[-8.5, -8.5], [8.5, -8.5], [-8.5, 8.5], [8.5, 8.5]].map((pos, i) => (
            <group key={i} position={[pos[0], 10, pos[1]]}>
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[2, 2.5, 20, 8]} />
                <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
              </mesh>
              {/* Tower Battlements */}
              {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((angle, j) => (
                <mesh key={`e-tower-battlement-${j}`} position={[Math.cos(angle)*1.8, 10.5, Math.sin(angle)*1.8]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1.5, 1, 0.5]} />
                  <meshStandardMaterial color="#3a3a3a" />
                </mesh>
              ))}
            </group>
          ))}
          {/* Flags */}
          <mesh position={[0, 18, 0]} castShadow>
            <planeGeometry args={[2, 1.5]} />
            <meshStandardMaterial color="#ef4444" side={2} />
          </mesh>
          <mesh position={[-0.9, 16.5, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 5]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          {/* Stairs */}
          {Array.from({ length: 30 }).map((_, i) => (
            <mesh key={`e-stair-${i}`} position={[0, i * 0.5 + 0.25, 7.5 + (30 - i) * 0.5]} castShadow receiveShadow>
              <boxGeometry args={[4, 0.5, 0.5]} />
              <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function Cage() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (useGameStore.getState().paused) return;
    if (groupRef.current) {
      groupRef.current.visible = mutableGameState.playerState.isCaptured;
      if (mutableGameState.playerState.isCaptured) {
        groupRef.current.position.copy(mutableGameState.cagePosition);
      }
    }
  });

  const bars = [];
  for (let i = -1.5; i <= 1.5; i += 0.5) {
    bars.push(<mesh key={`x1-${i}`} position={[i, 1.5, 1.5]}><cylinderGeometry args={[0.05, 0.05, 3]} /><meshStandardMaterial color="#3f3f46" /></mesh>);
    bars.push(<mesh key={`x2-${i}`} position={[i, 1.5, -1.5]}><cylinderGeometry args={[0.05, 0.05, 3]} /><meshStandardMaterial color="#3f3f46" /></mesh>);
    bars.push(<mesh key={`z1-${i}`} position={[1.5, 1.5, i]}><cylinderGeometry args={[0.05, 0.05, 3]} /><meshStandardMaterial color="#3f3f46" /></mesh>);
    bars.push(<mesh key={`z2-${i}`} position={[-1.5, 1.5, i]}><cylinderGeometry args={[0.05, 0.05, 3]} /><meshStandardMaterial color="#3f3f46" /></mesh>);
  }

  return (
    <group ref={groupRef} visible={false}>
      {/* Base */}
      <mesh position={[0, 0.1, 0]}><boxGeometry args={[3.2, 0.2, 3.2]} /><meshStandardMaterial color="#52525b" /></mesh>
      {/* Top */}
      <mesh position={[0, 3, 0]}><boxGeometry args={[3.2, 0.2, 3.2]} /><meshStandardMaterial color="#52525b" /></mesh>
      {/* Bars */}
      {bars}
    </group>
  );
}

function EnvironmentManager() {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const skyRef = useRef<any>(null);

  useFrame(() => {
    if (mutableGameState.spawningDragons.length > 0) {
      // Scary environment
      if (ambientRef.current) ambientRef.current.intensity = 0.1;
      if (dirLightRef.current) dirLightRef.current.intensity = 0.2;
    } else {
      // Return to normal
      if (ambientRef.current) ambientRef.current.intensity = 0.5;
      if (dirLightRef.current) dirLightRef.current.intensity = 1.5;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.5} />
      <directionalLight
        ref={dirLightRef}
        castShadow
        position={[50, 50, 20]}
        intensity={1.5}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <Sky ref={skyRef} sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
      <Environment preset="sunset" />
    </>
  );
}

export function Game() {
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const screen = useGameStore(state => state.screen);
  const friendliesCount = useGameStore(state => state.friendliesCount);
  const enemiesCount = useGameStore(state => state.enemiesCount);

  useEffect(() => {
    if (screen === 'playing') {
      const ids: string[] = [];
      mutableGameState.units.forEach((_u, id) => {
        if (id !== 'player') ids.push(id);
      });
      setUnitIds(ids);
    }
  }, [screen, friendliesCount, enemiesCount]);

  if (screen !== 'playing') return null;

  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas shadows camera={{ position: [0, 10, 20], fov: 50 }}>
        <EnvironmentManager />
        
        {/* Ground */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color="#4ade80" roughness={1} metalness={0} />
        </mesh>
        
        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={100} blur={2} far={10} />

        <Scenery />
        <Castles />
        <Cage />
        <Dragons />
        <Player />
        
        {unitIds.map(id => (
          <Unit key={id} id={id} />
        ))}
        
        <ArrowManager />
        <Effects />
        <RallyPointIndicator />
      </Canvas>
    </div>
  );
}
