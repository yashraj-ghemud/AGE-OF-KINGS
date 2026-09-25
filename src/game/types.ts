import type * as THREE from 'three';
import type { Puppet, PuppetKind } from '../world/Puppets';
import type { Terrain } from '../world/terrain';
import type { CastleKind } from '../world/fortress';
import type { Chapter } from '../story/campaign';
import type { ArmyOrder, CaptureState, WeaponType } from '../store/gameStore';

export type UnitKind = PuppetKind | 'eagle' | 'dragon' | 'boss' | 'king';
export type Role = 'soldier' | 'lord' | 'carrier' | 'backup' | 'raider' | 'boss' | 'flyer' | 'king';
export type Morale = 'normal' | 'kneel' | 'flee' | 'ash' | 'sworn';

export interface Unit extends Omit<Puppet, 'kind'> {
  kind: PuppetKind;
  /** real unit type (puppet kind is what gets drawn) */
  type: UnitKind;
  id: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  radius: number;
  mass: number;
  speed: number;
  damage: number;
  range: number;
  cooldownMax: number;
  camp: Camp | null;
  role: Role;
  target: Unit | null;
  retarget: number;
  cooldown: number;
  /** seconds since the current attack started, -1 = none */
  attackT: number;
  attackDur: number;
  attackHit: boolean;
  special: number;
  javelin: number;
  goalX: number;
  goalZ: number;
  patrol: number;
  deadTime: number;
  spinX: number;
  spinZ: number;
  morale: Morale;
  moraleT: number;
  slot: number;
  lordName?: string;
  buff: number;
  sleep: number;
  lastHit: number;
  /** flyers: target altitude above ground */
  alt: number;
  /** flyers: dive state timer */
  dive: number;
  burn: number;
}

export interface Camp {
  id: number;
  x: number;
  z: number;
  y: number;
  rot: number;
  cos: number;
  sin: number;
  kind: CastleKind;
  lord: Unit | null;
  lordName: string;
  fallen: boolean;
  royal: boolean;
}

export type ProjectileKind = 'arrow' | 'javelin' | 'royalSpear' | 'royalArrow';

export interface Projectile {
  kind: ProjectileKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  team: 0 | 1;
  damage: number;
  life: number;
  pierce: number;
  stuck: boolean;
  stuckT: number;
  owner: Unit | null;
  hits: Set<number> | null;
}

export interface Shard {
  x: number;
  y: number;
  z: number;
  t: number;
  collected: boolean;
}

export interface Ring {
  x: number;
  y: number;
  z: number;
  t: number;
  dur: number;
  radius: number;
  color: 'gold' | 'crimson' | 'shadow' | 'ember';
}

export interface Ritual {
  x: number;
  y: number;
  z: number;
  t: number;
  done: boolean;
}

export interface ShadowWave {
  x: number;
  z: number;
  t: number;
  hit: Set<number>;
}

export interface KingState {
  unit: Unit;
  camYaw: number;
  camPitch: number;
  camDist: number;
  stamina: number;
  weapon: WeaponType;
  swingT: number;
  combo: number;
  swingCd: number;
  draw: number;
  drawing: boolean;
  throwCd: number;
  cd: { cry: number; charge: number; slam: number; horn: number };
  charging: number;
  slamT: number;
  rear: number;
  leap: number;
  gait: number;
  capture: CaptureState;
  cage: THREE.Vector3;
  cageVel: THREE.Vector3;
  jailCamp: Camp | null;
  jailTime: number;
  carriers: Unit[];
  invuln: number;
  lastDamage: number;
  riding: Unit | null;
  firstPerson: boolean;
  aiming: boolean;
  trample: number;
  footstep: number;
  kills: number;
  comboCount: number;
  comboT: number;
  hurtFlash: number;
}

export interface World {
  chapter: Chapter;
  terrain: Terrain;
  camps: Camp[];
  royal: Camp;
  units: Unit[];
  projectiles: Projectile[];
  shards: Shard[];
  rings: Ring[];
  rituals: Ritual[];
  waves: ShadowWave[];
  king: KingState;
  boss: Unit | null;
  bossPhase: number;
  bossTimers: { wave: number; rift: number };
  order: ArmyOrder;
  rally: THREE.Vector3 | null;
  ember: number;
  emberEarned: number;
  time: number;
  timeScale: number;
  killcam: { t: number; dur: number; x: number; y: number; z: number; boss: boolean } | null;
  hitStop: number;
  shake: number;
  raidTimer: number;
  raidMarker: { x: number; z: number; t: number; name: string } | null;
  lordsTotal: number;
  lordsSlain: number;
  sworn: number;
  dragonsSummoned: number;
  dawnBase: number;
  dawn: number;
  ended: boolean;
  endTimer: number;
  victory: boolean | null;
  defeatReason: string;
  nextId: number;
  combatHeat: number;
  intro: number;
}
