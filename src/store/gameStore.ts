import { create } from 'zustand';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

export type WeaponType = 'sword' | 'spear' | 'bow';
export type UnitType = 'king' | 'swordsman' | 'spearman' | 'archer' | 'eagle' | 'rakshas' | 'dragon';

export interface UnitData {
  id: string;
  isEnemy: boolean;
  type: UnitType;
  weapon: WeaponType;
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  targetId: string | null;
  lastAttack: number;
  dead: boolean;
  deathTime?: number;
  isPlayer?: boolean;
  buffTime?: number;
  role?: 'carrier' | 'minister' | 'backup';
  formationOffset?: THREE.Vector3;
  campId?: string;
  lastFootstep?: number;
  isCalled?: boolean;
}

export interface ProjectileData {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isEnemy: boolean;
  damage: number;
  life: number;
  type?: 'arrow' | 'spear' | 'fire';
}

export interface EffectData {
  id: string;
  type: 'aoe' | 'rally';
  position: THREE.Vector3;
  life: number;
  maxLife: number;
}

// Mutable game state for high-frequency updates (avoid React re-renders)
export const mutableGameState = {
  units: new Map<string, UnitData>(),
  projectiles: new Map<string, ProjectileData>(),
  effects: [] as EffectData[],
  camps: [] as { position: THREE.Vector3, id: string }[],
  playerCamp: { position: new THREE.Vector3(0, 0, 0), id: 'player_camp' },
  cooldowns: { rally: 0, charge: 0, aoe: 0 },
  playerState: { 
    isCharging: false, 
    chargeTime: 0,
    isCaptured: false,
    captureState: 'free' as 'free' | 'trapping' | 'trapped' | 'carried' | 'jailed',
    jailCampId: null as string | null,
    playerLocalOffset: new THREE.Vector3(),
    invulnerableUntil: 0,
    formation: 'free' as 'free' | 'protect',
    ridingDragonId: null as string | null
  },
  spawningDragons: [] as { id: string, spawnStartTime: number, spawnPosition: THREE.Vector3 }[],
  cagePosition: new THREE.Vector3(),
  cageCarriers: [] as string[],
  attackMode: false,
  playerPos: new THREE.Vector3(),
  isGameOver: false,
  isRescueSpawned: false,
  rallyPoint: null as THREE.Vector3 | null,
};

export interface CampaignNode {
  id: string;
  title: string;
  description: string;
  type: 'invasion' | 'defense' | 'diplomacy';
  choices: { text: string; nextNodeId: string }[];
  levelConfig: {
    numCamps: number;
    playerStartUnits: number;
    enemyDifficulty: number;
  };
}

export const CAMPAIGN_NODES: Record<string, CampaignNode> = {
  start: {
    id: 'start',
    title: 'The Kingdom Divided',
    description: 'Your kingdom has fractured. Rebellious lords have established their own camps. You must decide how to proceed.',
    type: 'defense',
    choices: [
      { text: 'Launch a direct invasion into the heartland', nextNodeId: 'invasion_1' },
      { text: 'Send diplomats to negotiate with the eastern lords', nextNodeId: 'diplomacy_1' },
      { text: 'Fortify your position and wait for them to attack', nextNodeId: 'defense_1' }
    ],
    levelConfig: { numCamps: 6, playerStartUnits: 30, enemyDifficulty: 1 }
  },
  invasion_1: {
    id: 'invasion_1',
    title: 'The Heartland Offensive',
    description: 'You march your army into the central plains. The enemy is caught off guard but they are numerous.',
    type: 'invasion',
    choices: [
      { text: 'Push forward to the capital', nextNodeId: 'final_battle' },
      { text: 'Secure the supply lines first', nextNodeId: 'defense_2' }
    ],
    levelConfig: { numCamps: 10, playerStartUnits: 40, enemyDifficulty: 1.5 }
  },
  diplomacy_1: {
    id: 'diplomacy_1',
    title: 'The Eastern Alliance',
    description: 'The eastern lords agree to join your cause, providing you with a larger army to face the remaining rebels.',
    type: 'diplomacy',
    choices: [
      { text: 'March on the capital together', nextNodeId: 'final_battle' }
    ],
    levelConfig: { numCamps: 8, playerStartUnits: 60, enemyDifficulty: 1.2 }
  },
  defense_1: {
    id: 'defense_1',
    title: 'The Siege of the High Keep',
    description: 'The rebels attack your fortified position. You must hold the line.',
    type: 'defense',
    choices: [
      { text: 'Counter-attack while they are weak', nextNodeId: 'invasion_1' }
    ],
    levelConfig: { numCamps: 8, playerStartUnits: 50, enemyDifficulty: 1.5 }
  },
  defense_2: {
    id: 'defense_2',
    title: 'Securing the Supply Lines',
    description: 'You defend your supply caravans from rebel ambushes.',
    type: 'defense',
    choices: [
      { text: 'March on the capital', nextNodeId: 'final_battle' }
    ],
    levelConfig: { numCamps: 7, playerStartUnits: 40, enemyDifficulty: 1.2 }
  },
  final_battle: {
    id: 'final_battle',
    title: 'The Battle for the Capital',
    description: 'The final confrontation. Defeat the remaining rebel lords to reunite the kingdom.',
    type: 'invasion',
    choices: [],
    levelConfig: { numCamps: 15, playerStartUnits: 50, enemyDifficulty: 2 }
  }
};

interface GameState {
  screen: 'menu' | 'campaign' | 'playing' | 'won' | 'lost';
  campaignNodeId: string;
  level: number;
  playerHealth: number;
  playerMaxHealth: number;
  currentWeapon: WeaponType;
  enemiesCount: number;
  friendliesCount: number;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  setScreen: (screen: 'menu' | 'campaign' | 'playing' | 'won' | 'lost') => void;
  setCampaignNodeId: (id: string) => void;
  setLevel: (level: number) => void;
  setPlayerHealth: (health: number) => void;
  setWeapon: (weapon: WeaponType) => void;
  updateCounts: () => void;
  initLevel: (nodeId: string) => void;
  attackMode: boolean;
  captureState: 'free' | 'trapping' | 'trapped' | 'carried' | 'jailed';
  isRescueSpawned: boolean;
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'menu',
  campaignNodeId: 'start',
  level: 1,
  playerHealth: 50000,
  playerMaxHealth: 50000,
  currentWeapon: 'sword',
  enemiesCount: 0,
  friendliesCount: 0,
  attackMode: false,
  captureState: 'free',
  isRescueSpawned: false,
  paused: false,
  setPaused: (paused) => set({ paused }),
  formation: 'free' as 'free' | 'protect',
  setScreen: (screen) => set({ screen }),
  setCampaignNodeId: (id) => set({ campaignNodeId: id }),
  setLevel: (level) => set({ level }),
  setPlayerHealth: (health) => set({ playerHealth: health }),
  setWeapon: (weapon) => set({ currentWeapon: weapon }),
  updateCounts: () => {
    let enemies = 0;
    let friendlies = 0;
    mutableGameState.units.forEach((u) => {
      if (!u.dead) {
        if (u.isEnemy) enemies++;
        else if (!u.isPlayer) friendlies++;
      }
    });
    set({ 
      enemiesCount: enemies, 
      friendliesCount: friendlies,
      attackMode: mutableGameState.attackMode,
      captureState: mutableGameState.playerState.captureState,
      isRescueSpawned: mutableGameState.isRescueSpawned
    });
    
    // Check win/loss
    if (enemies === 0 && get().screen === 'playing') {
      if (!mutableGameState.isGameOver) {
        mutableGameState.isGameOver = true;
        setTimeout(() => set({ screen: 'won' }), 3000);
      }
    }
  },
  initLevel: (nodeId: string) => {
    const node = CAMPAIGN_NODES[nodeId] || CAMPAIGN_NODES['start'];
    set({ campaignNodeId: nodeId });

    mutableGameState.units.clear();
    mutableGameState.projectiles.clear();
    mutableGameState.effects = [];
    mutableGameState.camps = [];
    mutableGameState.isGameOver = false;
    mutableGameState.isRescueSpawned = false;
    mutableGameState.rallyPoint = null;
    
    let numEnemies = 0;
    let numFriendlies = 0;
    
    // Player
    const playerId = 'player';
    mutableGameState.units.set(playerId, {
      id: playerId,
      isEnemy: false,
      type: 'king',
      weapon: 'sword',
      health: 50000,
      maxHealth: 50000,
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(),
      rotation: 0,
      targetId: null,
      lastAttack: 0,
      dead: false,
      isPlayer: true,
    });
    
    // Generate Open World Camps
    const numCamps = node.levelConfig.numCamps;
    for (let c = 0; c < numCamps; c++) {
      let campPos;
      let valid = false;
      let attempts = 0;
      while (!valid && attempts < 100) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 150 + Math.random() * 600;
        campPos = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        valid = true;
        for (const existing of mutableGameState.camps) {
          if (existing.position.distanceTo(campPos) < 120) {
            valid = false;
            break;
          }
        }
        attempts++;
      }
      if (!campPos) continue;

      const campId = uuidv4();
      mutableGameState.camps.push({ position: campPos, id: campId });

      // Enemy King for this camp
      const kingId = uuidv4();
      mutableGameState.units.set(kingId, {
        id: kingId,
        isEnemy: true,
        type: 'king',
        weapon: 'sword',
        health: 55000 * node.levelConfig.enemyDifficulty,
        maxHealth: 55000 * node.levelConfig.enemyDifficulty,
        position: campPos.clone(),
        velocity: new THREE.Vector3(),
        rotation: Math.random() * Math.PI * 2,
        targetId: null,
        lastAttack: 0,
        dead: false,
        campId
      });
      numEnemies++;

      // Enemy Soldiers for this camp
      const numSoldiers = Math.floor((40 + Math.random() * 40) * node.levelConfig.enemyDifficulty); // Increased enemy count for larger kingdom
      for (let i = 0; i < numSoldiers; i++) {
        let type: UnitType = 'swordsman';
        let weapon: WeaponType = 'sword';
        const rand = Math.random();
        if (rand < 0.15) { type = 'rakshas'; weapon = 'sword'; }
        else if (rand < 0.40) { type = 'archer'; weapon = 'bow'; }
        else if (rand < 0.70) { type = 'spearman'; weapon = 'spear'; }

        let health = 500;
        if (type === 'rakshas') health = 2500;
        else if (type === 'swordsman') health = 800;
        else if (type === 'spearman') health = 600;
        else if (type === 'archer') health = 400;
        health *= node.levelConfig.enemyDifficulty * 2.5; // 2.5x stronger base health

        const id = uuidv4();
        const offset = new THREE.Vector3((Math.random() - 0.5) * 70, 0, (Math.random() - 0.5) * 70);
        mutableGameState.units.set(id, {
          id,
          isEnemy: true,
          type,
          weapon,
          health,
          maxHealth: health,
          position: campPos.clone().add(offset),
          velocity: new THREE.Vector3(),
          rotation: Math.random() * Math.PI * 2,
          targetId: null,
          lastAttack: 0,
          dead: false,
          campId
        });
        numEnemies++;
      }
    }
    
    // Friendlies (Spawn around player)
    numFriendlies = node.levelConfig.playerStartUnits;
    for (let i = 0; i < numFriendlies; i++) {
      let type: UnitType = 'swordsman';
      let weapon: WeaponType = 'sword';
      const rand = Math.random();
      if (rand < 0.33) { type = 'archer'; weapon = 'bow'; }
      else if (rand < 0.66) { type = 'spearman'; weapon = 'spear'; }
      
      let health = 500;
      if (type === 'swordsman') health = 800;
      else if (type === 'spearman') health = 600;
      else if (type === 'archer') health = 400;

      const id = uuidv4();
      mutableGameState.units.set(id, {
        id,
        isEnemy: false,
        type,
        weapon,
        health,
        maxHealth: health,
        position: new THREE.Vector3((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60),
        velocity: new THREE.Vector3(),
        rotation: 0,
        targetId: null,
        lastAttack: 0,
        dead: false,
      });
    }

    // Add 2 Eagles
    for (let i = 0; i < 2; i++) {
      const id = uuidv4();
      mutableGameState.units.set(id, {
        id,
        isEnemy: false,
        type: 'eagle',
        weapon: 'bow',
        health: 1200,
        maxHealth: 1200,
        position: new THREE.Vector3((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60),
        velocity: new THREE.Vector3(),
        rotation: 0,
        targetId: null,
        lastAttack: 0,
        dead: false,
      });
      numFriendlies++;
    }
    
    set({ 
      screen: 'playing', 
      playerHealth: 50000, 
      playerMaxHealth: 50000,
      currentWeapon: 'sword',
      enemiesCount: numEnemies,
      friendliesCount: numFriendlies,
      paused: false
    });
  }
}));
