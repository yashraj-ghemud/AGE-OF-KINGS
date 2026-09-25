import { create } from 'zustand';
import { CHAPTERS, dawnForProgress } from '../story/campaign';

export type Screen =
  | 'gate'
  | 'intro'
  | 'menu'
  | 'chronicle'
  | 'settings'
  | 'map'
  | 'briefing'
  | 'playing'
  | 'results'
  | 'ending';

export type Quality = 'cinematic' | 'balanced' | 'performance';
export type WeaponType = 'sword' | 'spear' | 'bow';
export type ArmyOrder = 'hold' | 'attack' | 'guard';
export type CaptureState = 'free' | 'trapping' | 'trapped' | 'carried' | 'jailed';

export interface Settings {
  quality: Quality;
  masterVolume: number;
  musicVolume: number;
  sensitivity: number;
  invertY: boolean;
  shake: boolean;
}

export interface Progress {
  completed: string[];
  available: string[];
  lastPlayed: string | null;
}

export interface HudState {
  health: number;
  maxHealth: number;
  stamina: number;
  ember: number;
  army: number;
  enemies: number;
  lordsLeft: number;
  lordsTotal: number;
  order: ArmyOrder;
  weapon: WeaponType;
  cd: { cry: number; charge: number; slam: number; horn: number };
  capture: CaptureState;
  jailTime: number;
  boss: { name: string; hp: number; max: number } | null;
  riding: boolean;
  nearDragon: boolean;
  bowDraw: number;
  combo: number;
  dawn: number;
  firstPerson: boolean;
  aiming: boolean;
  rally: boolean;
  summoning: boolean;
}

export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  tone: 'gold' | 'crimson' | 'ember' | 'blue';
}

export interface Dialogue {
  id: number;
  speaker: string;
  text: string;
}

export interface ResultStats {
  kills: number;
  lords: number;
  sworn: number;
  time: number;
  ember: number;
  dragons: number;
}

export interface Results {
  victory: boolean;
  reason: string;
  stats: ResultStats;
  chapterId: string;
}

const SETTINGS_KEY = 'aok.settings.v2';
const PROGRESS_KEY = 'aok.progress.v2';
const SEEN_KEY = 'aok.seenIntro.v2';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — progress lives for this session only */
  }
}

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

const DEFAULT_SETTINGS: Settings = {
  quality: isTouch ? 'performance' : 'balanced',
  masterVolume: 0.85,
  musicVolume: 0.7,
  sensitivity: 1,
  invertY: false,
  shake: true,
};

const FRESH_PROGRESS: Progress = { completed: [], available: ['start'], lastPlayed: null };

export const EMPTY_HUD: HudState = {
  health: 1, maxHealth: 1, stamina: 1, ember: 0, army: 0, enemies: 0, lordsLeft: 0, lordsTotal: 0,
  order: 'hold', weapon: 'sword', cd: { cry: 0, charge: 0, slam: 0, horn: 0 },
  capture: 'free', jailTime: 0, boss: null, riding: false, nearDragon: false, bowDraw: 0, combo: 0,
  dawn: 0, firstPerson: false, aiming: false, rally: false, summoning: false,
};

interface GameState {
  screen: Screen;
  prevScreen: Screen;
  settings: Settings;
  progress: Progress;
  seenIntro: boolean;
  chapterId: string;
  /** increments every time a battle starts, so retries build a fresh world */
  runId: number;
  paused: boolean;
  hud: HudState;
  banners: Banner[];
  dialogue: Dialogue | null;
  results: Results | null;
  showHelp: boolean;

  setScreen: (s: Screen) => void;
  back: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  markIntroSeen: () => void;
  newCampaign: () => void;
  selectChapter: (id: string) => void;
  startChapter: () => void;
  completeChapter: (id: string) => void;
  setPaused: (p: boolean) => void;
  setHud: (h: HudState) => void;
  pushBanner: (b: Omit<Banner, 'id'>) => void;
  dropBanner: (id: number) => void;
  speak: (speaker: string, text: string) => void;
  finish: (r: Results) => void;
  toggleHelp: () => void;
  dawn: () => number;
}

let bannerId = 1;

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'gate',
  prevScreen: 'gate',
  settings: load(SETTINGS_KEY, DEFAULT_SETTINGS),
  progress: load(PROGRESS_KEY, FRESH_PROGRESS),
  seenIntro: (() => {
    try {
      return localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      return false;
    }
  })(),
  chapterId: 'start',
  runId: 0,
  paused: false,
  hud: EMPTY_HUD,
  banners: [],
  dialogue: null,
  results: null,
  showHelp: true,

  setScreen: (screen) => set({ prevScreen: get().screen, screen, paused: false }),
  back: () => set({ screen: get().prevScreen === get().screen ? 'menu' : get().prevScreen }),
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    save(SETTINGS_KEY, settings);
    set({ settings });
  },
  markIntroSeen: () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    set({ seenIntro: true });
  },
  newCampaign: () => {
    save(PROGRESS_KEY, FRESH_PROGRESS);
    set({ progress: FRESH_PROGRESS, chapterId: 'start' });
  },
  selectChapter: (id) => set({ chapterId: CHAPTERS[id] ? id : 'start' }),
  startChapter: () => {
    const progress = { ...get().progress, lastPlayed: get().chapterId };
    save(PROGRESS_KEY, progress);
    set({ progress, screen: 'playing', prevScreen: 'briefing', paused: false, banners: [], dialogue: null, results: null, runId: get().runId + 1 });
  },
  completeChapter: (id) => {
    const p = get().progress;
    const completed = p.completed.includes(id) ? p.completed : [...p.completed, id];
    const next = (CHAPTERS[id]?.choices ?? []).map((c) => c.nextNodeId).filter((n) => !completed.includes(n));
    const progress: Progress = { completed, available: next, lastPlayed: id };
    save(PROGRESS_KEY, progress);
    set({ progress });
  },
  setPaused: (paused) => set({ paused }),
  setHud: (hud) => set({ hud }),
  pushBanner: (b) => {
    const banner = { ...b, id: bannerId++ };
    set({ banners: [...get().banners.slice(-2), banner] });
  },
  dropBanner: (id) => set({ banners: get().banners.filter((b) => b.id !== id) }),
  speak: (speaker, text) => set({ dialogue: { id: bannerId++, speaker, text } }),
  finish: (results) => {
    if (results.victory) get().completeChapter(results.chapterId);
    set({ results, screen: results.victory && results.chapterId === 'final_battle' ? 'ending' : 'results' });
  },
  toggleHelp: () => set({ showHelp: !get().showHelp }),
  dawn: () => dawnForProgress(get().progress.completed.length),
}));
