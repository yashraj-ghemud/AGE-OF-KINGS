import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CHAPTERS } from '../story/campaign';
import { audio } from '../audio/audio';
import { MenuItem } from './MainMenu';
import { SettingsPanel } from './Screens';

export function PauseMenu({ onResume }: { onResume: () => void }) {
  const { setPaused, setScreen, chapterId } = useGameStore();
  const [settings, setSettings] = useState(false);
  if (settings) return <SettingsPanel onBack={() => setSettings(false)} />;
  const ch = CHAPTERS[chapterId];
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 30, background: 'radial-gradient(ellipse at center, rgba(10,6,4,0.55), rgba(0,0,0,0.85))', backdropFilter: 'blur(4px)' }}>
      <div className="text-center" style={{ animation: 'fadeUp 0.6s ease both' }}>
        <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.5em', fontSize: 11, color: '#ff8a3a' }}>CHAPTER {ch.numeral}</div>
        <h2 className="gold-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 3.4rem)', letterSpacing: '0.14em', margin: '0.3rem 0 0.4rem' }}>THE KING RESTS</h2>
        <p className="narration" style={{ color: 'rgba(241,227,196,0.75)', fontSize: '1.1rem', maxWidth: 520, margin: '0 auto 2rem' }}>{ch.objective}</p>
        <div className="flex flex-col items-center gap-1">
          <MenuItem label="Resume" delay={0.05} onClick={() => { setPaused(false); onResume(); }} />
          <MenuItem label="Settings" delay={0.1} onClick={() => setSettings(true)} />
          <MenuItem label="Retreat to the War Map" delay={0.15} onClick={() => { audio.startMenuMusic(); setScreen('map'); }} />
          <MenuItem label="Main Menu" delay={0.2} onClick={() => { audio.startMenuMusic(); setScreen('menu'); }} />
        </div>
      </div>
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function Results() {
  const { results, setScreen, startChapter, selectChapter } = useGameStore();
  if (!results) return null;
  const ch = CHAPTERS[results.chapterId];
  const win = results.victory;
  const stats: [string, string][] = [
    ['Foes felled by your hand', String(results.stats.kills)],
    ['Traitor lords slain', String(results.stats.lords)],
    ['Soldiers sworn to you', String(results.stats.sworn)],
    ['Ember gathered', String(Math.round(results.stats.ember))],
    ['Dragons woken', String(results.stats.dragons)],
    ['Time in battle', fmt(results.stats.time)],
  ];
  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin" style={{ zIndex: 30, background: win ? 'radial-gradient(ellipse at 50% 30%, rgba(80,50,10,0.55), rgba(0,0,0,0.9))' : 'radial-gradient(ellipse at 50% 30%, rgba(90,10,18,0.55), rgba(0,0,0,0.92))' }}>
      <div className="min-h-full flex flex-col items-center justify-center p-8 text-center">
        <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.5em', fontSize: 11, color: win ? '#ffd98a' : '#ff8a8a', animation: 'fadeUp 0.8s ease both' }}>
          CHAPTER {ch.numeral} · {ch.title.toUpperCase()}
        </div>
        <h1
          className={win ? 'gold-text' : 'crimson-glow'}
          style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(3rem, 9vw, 7rem)', letterSpacing: '0.12em', margin: '0.3rem 0', color: win ? undefined : '#ffc0b8', animation: 'letterSlam 1.2s cubic-bezier(0.2,0.9,0.2,1) 0.1s both' }}
        >
          {win ? 'VICTORY' : 'DEFEAT'}
        </h1>
        <p className="narration" style={{ fontSize: 'clamp(1.1rem, 1.8vw, 1.5rem)', color: '#f1e3c4', maxWidth: 680, animation: 'fadeUp 1s ease 0.5s both' }}>{results.reason}</p>
        <div className="glass grid grid-cols-2 md:grid-cols-3 gap-x-10 gap-y-4 px-8 py-6 mt-8 rounded-sm" style={{ animation: 'fadeUp 1s ease 0.8s both' }}>
          {stats.map(([k, v], i) => (
            <div key={k} style={{ animation: `fadeUp 0.7s ease ${1 + i * 0.1}s both` }}>
              <div className="gold-text" style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 700 }}>{v}</div>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(241,227,196,0.6)', textTransform: 'uppercase' }}>{k}</div>
            </div>
          ))}
        </div>
        {win && ch.choices.length > 0 && (
          <div className="mt-10 w-full max-w-3xl" style={{ animation: 'fadeUp 1s ease 1.6s both' }}>
            <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.4em', fontSize: 11, color: 'rgba(255,217,138,0.7)', marginBottom: 12 }}>WHERE DOES THE KING RIDE NEXT?</div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(3, ch.choices.length)}, minmax(0, 1fr))` }}>
              {ch.choices.map((c) => (
                <button
                  key={c.nextNodeId}
                  className="glass text-left p-5 rounded-sm transition-all duration-300 hover:-translate-y-1 pointer-events-auto"
                  style={{ borderColor: 'rgba(245,184,61,0.3)' }}
                  onMouseEnter={() => audio.play('uiHover')}
                  onClick={() => {
                    audio.play('uiConfirm');
                    selectChapter(c.nextNodeId);
                    setScreen('briefing');
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.12em', color: '#ffe3a3' }}>{c.text}</div>
                  <div style={{ fontSize: 12, color: 'rgba(241,227,196,0.6)', marginTop: 6 }}>{c.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-4 mt-10" style={{ animation: 'fadeUp 1s ease 1.9s both' }}>
          {!win && (
            <button className="btn-ember px-10 py-4 rounded-sm" onClick={() => { audio.play('uiConfirm'); startChapter(); }}>
              Ride Again
            </button>
          )}
          <button className="btn-ghost px-8 py-4 rounded-sm text-xs" onClick={() => { audio.play('uiClick'); audio.startMenuMusic(); setScreen('map'); }}>
            War Map
          </button>
          <button className="btn-ghost px-8 py-4 rounded-sm text-xs" onClick={() => { audio.play('uiClick'); audio.startMenuMusic(); setScreen('menu'); }}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
