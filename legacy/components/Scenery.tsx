import { useMemo } from 'react';

export function Scenery() {
  const trees = useMemo(() => {
    const temp = [];
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * 800;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.5 + Math.random() * 1.5;
      temp.push({ position: [x, 0, z] as [number, number, number], scale });
    }
    return temp;
  }, []);

  const rocks = useMemo(() => {
    const temp = [];
    for (let i = 0; i < 100; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 800;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.5 + Math.random() * 2;
      const rotation = [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number];
      temp.push({ position: [x, 0, z] as [number, number, number], scale, rotation });
    }
    return temp;
  }, []);

  return (
    <group>
      {trees.map((tree, i) => (
        <group key={`tree-${i}`} position={tree.position} scale={tree.scale}>
          {/* Trunk */}
          <mesh position={[0, 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.8, 4, 8]} />
            <meshStandardMaterial color="#5c4033" roughness={1} />
          </mesh>
          {/* Leaves */}
          <mesh position={[0, 6, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[3]} />
            <meshStandardMaterial color="#166534" roughness={0.8} />
          </mesh>
          <mesh position={[1.5, 5, 1.5]} castShadow receiveShadow>
            <dodecahedronGeometry args={[2]} />
            <meshStandardMaterial color="#15803d" roughness={0.8} />
          </mesh>
          <mesh position={[-1.5, 5.5, -1]} castShadow receiveShadow>
            <dodecahedronGeometry args={[2.5]} />
            <meshStandardMaterial color="#166534" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {rocks.map((rock, i) => (
        <mesh key={`rock-${i}`} position={rock.position} rotation={rock.rotation} scale={rock.scale} castShadow receiveShadow>
          <dodecahedronGeometry args={[2]} />
          <meshStandardMaterial color="#71717a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
