import { useMemo } from 'react';
import * as THREE from 'three';
import { buildCastleGeometry, type CastleGeometry, type CastleKind } from './fortress';
import { castleMaterials } from './materials';

const geoCache = new Map<CastleKind, CastleGeometry>();
export function castleGeometry(kind: CastleKind) {
  let g = geoCache.get(kind);
  if (!g) {
    g = buildCastleGeometry(kind);
    geoCache.set(kind, g);
  }
  return g;
}

export function Castle({
  kind,
  position,
  rotation = 0,
  shadows = true,
}: {
  kind: CastleKind;
  position: THREE.Vector3 | [number, number, number];
  rotation?: number;
  shadows?: boolean;
}) {
  const geo = useMemo(() => castleGeometry(kind), [kind]);
  const mats = useMemo(() => castleMaterials(kind), [kind]);
  const pos = Array.isArray(position) ? position : ([position.x, position.y, position.z] as [number, number, number]);
  return (
    <group position={pos} rotation={[0, rotation, 0]}>
      <mesh geometry={geo.stone} material={mats.stone} castShadow={shadows} receiveShadow />
      <mesh geometry={geo.trim} material={mats.trim} castShadow={shadows} receiveShadow />
      <mesh geometry={geo.roof} material={mats.roof} castShadow={shadows} receiveShadow />
      <mesh geometry={geo.wood} material={mats.wood} castShadow={shadows} />
      <mesh geometry={geo.metal} material={mats.metal} castShadow={shadows} />
      {kind === 'royal' || kind === 'court' ? <mesh geometry={geo.gold} material={mats.gold} receiveShadow /> : null}
      <mesh geometry={geo.glow} material={mats.glow} />
      <mesh geometry={geo.banners} material={mats.banner} castShadow={shadows} />
    </group>
  );
}
