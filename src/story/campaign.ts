// The story of AGE OF KINGS — The Endless Eclipse.
// See docs/REMASTER_PLAN.md §1 for the full story bible.

export type ChapterMode = 'reclaim' | 'invasion' | 'alliance' | 'siege' | 'escort' | 'boss';

export interface ChapterConfig {
  camps: number;
  soldiersPerCamp: [number, number];
  rakshasRatio: number;
  difficulty: number;
  startArmy: number;
  eagles: number;
  dragons: number;
  /** Seconds between war-horn raids. 0 disables raids. */
  raidInterval: number;
  raidSize: [number, number];
  raidTarget: 'king' | 'castle';
  boss: boolean;
  seed: number;
  startEmber: number;
}

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
  region: string;
  mode: ChapterMode;
  narration: string[];
  objective: string;
  victory: string;
  choices: { text: string; nextNodeId: string; hint: string }[];
  /** Position on the war map, in percent of the map box. */
  map: { x: number; y: number };
  config: ChapterConfig;
}

export const CHAPTERS: Record<string, Chapter> = {
  start: {
    id: 'start',
    numeral: 'I',
    title: 'Ashes of Suryagarh',
    region: 'The Sun Fortress',
    mode: 'reclaim',
    narration: [
      'The palace still smoulders, my King. Kaalrath is gone, but three of his traitor lords have raised their banners in the hills around the capital.',
      'Each of them carries a splinter of the Sun Crown. Take them back, and the sky will remember the colour of morning.',
    ],
    objective: 'Slay the traitor lords around Suryagarh and reclaim their crown shards.',
    victory: 'The hills are ours again, and the eclipse bleeds amber at its edge. But a dying lord whispered one word before the end: “Kaalgarh.” Your brother is waiting.',
    choices: [
      { text: 'Ride into the Burning Plains', nextNodeId: 'invasion_1', hint: 'Invasion · Rakshas warbands' },
      { text: 'Seek the Eagle-Queen of the East', nextNodeId: 'diplomacy_1', hint: 'Alliance · Start with eagles and a dragon' },
      { text: 'Hold the walls of Suryagarh', nextNodeId: 'defense_1', hint: 'Siege · Waves assault your castle' },
    ],
    map: { x: 46, y: 58 },
    config: {
      camps: 3, soldiersPerCamp: [26, 36], rakshasRatio: 0.12, difficulty: 1,
      startArmy: 30, eagles: 2, dragons: 0, raidInterval: 110, raidSize: [8, 12], raidTarget: 'king',
      boss: false, seed: 1107, startEmber: 60,
    },
  },
  invasion_1: {
    id: 'invasion_1',
    numeral: 'II',
    title: 'The Burning Plains',
    region: 'Agnikshetra',
    mode: 'invasion',
    narration: [
      'The plains of Agnikshetra fed the kingdom once. Now the fields burn day and night, and the Rakshas hunt in the smoke.',
      'Five lords hold the plains. Strike fast, my King. Every hour we wait, the Ashen Deep sends more of its children up into the dark.',
    ],
    objective: 'Break the five warbands of the Burning Plains.',
    victory: 'The fires gutter out across Agnikshetra. Yet the Rakshas did not flee. They dug, down, toward something that answered from far below.',
    choices: [
      { text: 'March on the Obsidian Citadel', nextNodeId: 'final_battle', hint: 'Final battle · Face Kaalrath' },
      { text: 'Secure the Ember Roads first', nextNodeId: 'defense_2', hint: 'Escort · More lords, more ember' },
    ],
    map: { x: 25, y: 38 },
    config: {
      camps: 5, soldiersPerCamp: [30, 42], rakshasRatio: 0.3, difficulty: 1.35,
      startArmy: 40, eagles: 2, dragons: 0, raidInterval: 85, raidSize: [10, 16], raidTarget: 'king',
      boss: false, seed: 2203, startEmber: 120,
    },
  },
  diplomacy_1: {
    id: 'diplomacy_1',
    numeral: 'II',
    title: 'Wings of the East',
    region: 'The Garuda Heights',
    mode: 'alliance',
    narration: [
      'Suparna, the Eagle-Queen, has answered your seal. Her eyries are under siege, and she offers her wings in exchange for your sword.',
      'Her eagles fly with you, my King, and an ember-kin dragon has been woken in your name. Break the siege of the Heights.',
    ],
    objective: 'Lift the siege of the Garuda Heights. Slay the four besieging lords.',
    victory: 'Suparna\'s eagles darken the sky. Then her scouts return pale: the Obsidian Citadel is not a fortress. It is a door.',
    choices: [{ text: 'Fly with the Eagle-Queen to the Citadel', nextNodeId: 'final_battle', hint: 'Final battle · Face Kaalrath' }],
    map: { x: 74, y: 30 },
    config: {
      camps: 4, soldiersPerCamp: [30, 40], rakshasRatio: 0.2, difficulty: 1.2,
      startArmy: 45, eagles: 8, dragons: 1, raidInterval: 100, raidSize: [8, 14], raidTarget: 'king',
      boss: false, seed: 3301, startEmber: 100,
    },
  },
  defense_1: {
    id: 'defense_1',
    numeral: 'II',
    title: 'The Siege of Suryagarh',
    region: 'The Sun Fortress',
    mode: 'siege',
    narration: [
      'Their war-horns sound from every hill. Kaalrath means to take back the capital while it is still weak.',
      'Hold the walls, my King. Each lord will send wave after wave against our gates. Kill the lords, and the waves will break.',
    ],
    objective: 'Defend Suryagarh from the war-horn waves and slay the three siege lords.',
    victory: 'The walls held. But in the ashes of the last siege-tower, a message burned into the stone: “Brother, come home.”',
    choices: [{ text: 'Counter-attack into the Burning Plains', nextNodeId: 'invasion_1', hint: 'Invasion · Carry the fight to them' }],
    map: { x: 52, y: 74 },
    config: {
      camps: 3, soldiersPerCamp: [24, 32], rakshasRatio: 0.2, difficulty: 1.3,
      startArmy: 50, eagles: 2, dragons: 0, raidInterval: 55, raidSize: [14, 22], raidTarget: 'castle',
      boss: false, seed: 4409, startEmber: 90,
    },
  },
  defense_2: {
    id: 'defense_2',
    numeral: 'III',
    title: 'The Ember Roads',
    region: 'The Caravan Roads',
    mode: 'escort',
    narration: [
      'The Ember Roads carry fire-salt from the southern mines. Without it, no dragon egg will wake.',
      'Four lords raid the caravans. Clear the roads, gather ember, and let the Citadel hear us coming.',
    ],
    objective: 'Clear the four raider lords from the Ember Roads.',
    victory: 'The caravans roll again, and the eggs in the vaults of Suryagarh have begun to stir, as if they know the final battle is near.',
    choices: [{ text: 'March on the Obsidian Citadel', nextNodeId: 'final_battle', hint: 'Final battle · Face Kaalrath' }],
    map: { x: 18, y: 70 },
    config: {
      camps: 4, soldiersPerCamp: [30, 40], rakshasRatio: 0.25, difficulty: 1.4,
      startArmy: 45, eagles: 3, dragons: 1, raidInterval: 70, raidSize: [10, 16], raidTarget: 'king',
      boss: false, seed: 5507, startEmber: 200,
    },
  },
  final_battle: {
    id: 'final_battle',
    numeral: 'IV',
    title: 'The Obsidian Citadel',
    region: 'Kaalgarh, at the rim of the Ashen Deep',
    mode: 'boss',
    narration: [
      'There it is, my King. Kaalgarh, the Obsidian Citadel, built on the lip of the Ashen Deep. Your brother waits inside with the heart of the crown.',
      'He is no longer the boy you raced along the river. The eclipse lives in him now. End it. End him, and bring the morning home.',
    ],
    objective: 'Storm the Obsidian Citadel and defeat Kaalrath, the Eclipse King.',
    victory: 'The Eclipse King is fallen.',
    choices: [],
    map: { x: 50, y: 14 },
    config: {
      camps: 3, soldiersPerCamp: [30, 40], rakshasRatio: 0.4, difficulty: 1.6,
      startArmy: 55, eagles: 4, dragons: 1, raidInterval: 75, raidSize: [12, 18], raidTarget: 'king',
      boss: true, seed: 6661, startEmber: 240,
    },
  },
};

export const CHAPTER_ORDER = ['start', 'invasion_1', 'diplomacy_1', 'defense_1', 'defense_2', 'final_battle'];

export const LORD_NAMES = [
  'Ghorak the Flayer',
  'Vashti of the Red Veil',
  'Durjan Ironjaw',
  'Malang the Hollow',
  'Surtaq Emberbane',
  'Rudrak the Unbroken',
  'Nishachar the Night-Walker',
];

export const BOSS_NAME = 'Kaalrath, the Eclipse King';

/** How much of the eclipse has been pushed back by campaign progress (0 = crimson night, 1 = sunrise). */
export const dawnForProgress = (completed: number) => [0, 0.2, 0.38, 0.55, 0.7][Math.min(completed, 4)];

export interface CodexEntry {
  id: string;
  kind: 'Person' | 'Place' | 'Lore' | 'Creature';
  title: string;
  epithet: string;
  text: string;
  glyph: string;
}

export const CODEX: CodexEntry[] = [
  {
    id: 'vikram', kind: 'Person', title: 'Vikram', epithet: 'The Last King', glyph: '☀',
    text: 'The youngest son of Suryagarh, crowned at nineteen over his elder brother. He rides the black war-horse Toofan and has never lost a duel. Until the Blood Eclipse he had never lost anything at all.',
  },
  {
    id: 'kaalrath', kind: 'Person', title: 'Kaalrath', epithet: 'The Eclipse King', glyph: '☾',
    text: 'The elder brother, passed over for the crown. He went down into the Ashen Deep and came back with an army and a blade forged from the dark side of the moon. He means to finish the Rite of Endless Night, and for that he needs his brother\'s blood.',
  },
  {
    id: 'devdutt', kind: 'Person', title: 'Devdutt', epithet: 'The Old Minister', glyph: '✦',
    text: 'He served three kings and buried two. He keeps the war-horn, and when it sounds he rides out at the head of the host, however old his bones get.',
  },
  {
    id: 'suparna', kind: 'Person', title: 'Suparna', epithet: 'Queen of the Garuda Heights', glyph: '⟁',
    text: 'The Eagle-Queen of the east. Her people ride eagles the size of horses, and their dives can break a shield wall. She owes Suryagarh nothing, and she knows it.',
  },
  {
    id: 'crown', kind: 'Lore', title: 'The Sun Crown', epithet: 'Forged from a fallen star', glyph: '♔',
    text: 'While the Crown is whole, the Sun-Dragon sleeps, the dawn comes, and the Rakshas stay underground. Kaalrath\'s blade broke it into seven great shards and a thousand splinters. Each traitor lord carries one.',
  },
  {
    id: 'aruna', kind: 'Creature', title: 'Aruna', epithet: 'The Sun-Dragon', glyph: '♨',
    text: 'The old songs say the dawn is Aruna breathing in her sleep. Her egg lies beneath the throne of Suryagarh. Only the reforged Crown can wake her fully, but her ember-kin will answer a king who has enough fire.',
  },
  {
    id: 'rakshas', kind: 'Creature', title: 'The Rakshas', epithet: 'Children of the Ashen Deep', glyph: '♆',
    text: 'Horned, fast, and hungry. They burn in true sunlight, which is why they love the eclipse. They serve the pact, not the lords, so when a lord dies his Rakshas crumble to ash.',
  },
  {
    id: 'ember', kind: 'Lore', title: 'The Ember Rite', epithet: 'Fire freed from the fallen', glyph: '✹',
    text: 'Every warrior carries a little sun-fire. When one falls it can be gathered. A king with enough ember can wake an ember-kin dragon from its stone egg, buy loyal swords, or sound the war-horn for the Minister\'s host.',
  },
  {
    id: 'suryagarh', kind: 'Place', title: 'Suryagarh', epithet: 'The Sun Fortress', glyph: '⛫',
    text: 'The white-walled capital on its hill above the rivers. Its Sun Court is where the Crown floated above the altar for a thousand years. The altar is empty now.',
  },
  {
    id: 'kaalgarh', kind: 'Place', title: 'Kaalgarh', epithet: 'The Obsidian Citadel', glyph: '⛬',
    text: 'Raised in a single night from black glass on the rim of the Ashen Deep. Nothing grows within a mile of its walls.',
  },
];

/** In-battle dialogue: the voices that drive suspense between the cinematics. */
export type Speaker = 'Devdutt' | 'Kaalrath' | 'Traitor Lord' | 'Suparna';

export const OPENING_LINES: Record<string, [Speaker, string][]> = {
  start: [['Devdutt', 'Three lords, my King. Take their shards, and pray Kaalrath is not watching.']],
  invasion_1: [['Devdutt', 'The smoke hides them. Listen for the war-horns and ride toward the fire.']],
  diplomacy_1: [['Suparna', 'My eagles fly for you, King of the Sun. Do not make me regret it.']],
  defense_1: [['Devdutt', 'They come for the walls. Hold the gate and the city holds with you.']],
  defense_2: [['Devdutt', 'Every ember we gather is a dragon we can wake. Gather them all.']],
  final_battle: [['Kaalrath', 'Come then, little brother. Let us finish what Father started.']],
};

export const TAUNTS: string[] = [
  'Every shard you take, I take back in blood.',
  'Do you feel it, Vikram? The dark is patient. It has already won.',
  'Father chose wrong. The Deep did not.',
  'Keep riding, brother. Every road leads to me.',
];

export const DYING_WORDS: string[] = [
  'He promised… the sun would never rise again…',
  'You are too late… the Deep is already awake…',
  'Kaalrath… forgive me…',
  'Look down, king… not up… the eclipse was only the door…',
  'The shard… burns… take it… take it away…',
];

export const CAPTURE_LINE = 'Bring him to me alive. The Rite needs a king\'s blood, and I need to see his face.';
export const BOSS_PHASE_LINE = 'You think the Deep serves ME? I serve IT. When the sun dies, brother, so do we all.';
export const BOSS_DEATH_LINE = 'Vikram… the eclipse… it was never mine…';
