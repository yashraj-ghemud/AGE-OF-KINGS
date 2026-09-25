import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGameStore, type Screen } from './store/gameStore';
import { audio } from './audio/audio';
import { cine } from './cinematic/cine';
import { Gate } from './ui/Gate';
import { CineOverlay } from './ui/CineOverlay';
import { MainMenu } from './ui/MainMenu';
import { Chronicle, SettingsPanel, WarMap, Briefing } from './ui/Screens';
import { Cursor } from './ui/Cursor';
import { ErrorBoundary } from './ui/ErrorBoundary';

const CinematicWorld = lazy(() => import('./cinematic/CinematicWorld'));
const Game = lazy(() => import('./game/Game'));

const CINE_SCREENS: Screen[] = ['intro', 'menu', 'chronicle', 'settings', 'map', 'briefing', 'ending'];

function Loading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#040407', zIndex: 10 }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'radial-gradient(circle, #fff3cf, #ff8a3a 60%, transparent)', boxShadow: '0 0 30px #ff6a1f', animation: 'emberBreath 1.4s ease-in-out infinite' }} />
      <div style={{ marginTop: 22, fontFamily: 'var(--font-display)', letterSpacing: '0.45em', fontSize: '0.7rem', color: 'rgba(255,217,138,0.7)' }}>FORGING THE WORLD</div>
    </div>
  );
}

export default function App() {
  const { screen, setScreen, markIntroSeen, seenIntro, settings } = useGameStore();
  const [fromIntro, setFromIntro] = useState(false);
  const group = screen === 'playing' || screen === 'results' ? 'game' : screen === 'gate' ? 'gate' : 'cine';
  const [curtainKey, setCurtainKey] = useState(0);
  const lastGroup = useRef(group);

  // debug / deep-link hooks: ?screen=menu|map|game|ending&chapter=<id>
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const s = p.get('screen');
    const ch = p.get('chapter');
    if (ch) useGameStore.getState().selectChapter(ch);
    if (s === 'game') useGameStore.getState().startChapter();
    else if (s && ['intro', 'menu', 'map', 'briefing', 'chronicle', 'settings', 'ending'].includes(s)) setScreen(s as Screen);
  }, [setScreen]);

  useEffect(() => {
    audio.setVolumes(settings.masterVolume, settings.musicVolume);
  }, [settings.masterVolume, settings.musicVolume]);

  useEffect(() => {
    cine.dawn = useGameStore.getState().dawn();
    if (group !== lastGroup.current) {
      lastGroup.current = group;
      setCurtainKey((k) => k + 1);
    }
  }, [group, screen]);

  const program = screen === 'intro' ? 'intro' : screen === 'ending' ? 'ending' : 'menu';

  return (
    <ErrorBoundary>
      <div className="grain relative w-full h-full overflow-hidden" style={{ background: '#040407' }}>
        <Suspense fallback={<Loading />}>
          {CINE_SCREENS.includes(screen) && <CinematicWorld program={program} />}
          {group === 'game' && <Game />}
        </Suspense>

        {screen === 'gate' && (
          <Gate
            onAwaken={() => {
              if (seenIntro) {
                setFromIntro(false);
                setScreen('menu');
              } else setScreen('intro');
            }}
          />
        )}
        {screen === 'intro' && (
          <CineOverlay
            program="intro"
            onDone={() => {
              markIntroSeen();
              setFromIntro(true);
              setScreen('menu');
            }}
          />
        )}
        {screen === 'ending' && <CineOverlay program="ending" onDone={() => { setFromIntro(false); setScreen('menu'); }} />}
        {screen === 'menu' && <MainMenu fromIntro={fromIntro} />}
        {screen === 'chronicle' && <Chronicle />}
        {screen === 'settings' && <SettingsPanel />}
        {screen === 'map' && <WarMap />}
        {screen === 'briefing' && <Briefing />}

        {curtainKey > 0 && (
          <div key={curtainKey} className="absolute inset-0 pointer-events-none" style={{ background: '#000', zIndex: 60, animation: 'fadeIn 1.4s ease reverse both' }} />
        )}
        <Cursor />
      </div>
    </ErrorBoundary>
  );
}
