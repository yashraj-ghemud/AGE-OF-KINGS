import { useEffect } from 'react';
import { TitleBlock } from './TitleBlock';
import { cine } from '../cinematic/cine';
import { useGameStore } from '../store/gameStore';
import { CHAPTERS } from '../story/campaign';
import { audio } from '../audio/audio';

export function MenuItem({ label, sub, onClick, delay, disabled }: { label: string; sub?: string; onClick: () => void; delay: number; disabled?: boolean }) {
  return (
    <button
      className="menu-item pointer-events-auto"
      style={{ animation: `fadeUp 0.9s cubic-bezier(0.2,0.8,0.2,1) ${delay}s both`, fontSize: 'clamp(0.85rem, 1.25vw, 1.05rem)' }}
      onMouseEnter={() => audio.play('uiHover')}
      onClick={() => {
        audio.play('uiClick');
        onClick();
      }}
      disabled={disabled}
    >
      <span className="menu-rule" />
      <span>{label}</span>
      {sub && <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', textTransform: 'none', letterSpacing: '0.04em', fontSize: '0.95em', color: 'rgba(255,217,138,0.7)' }}>{sub}</span>}
    </button>
  );
}

export function DawnMeter({ dawn }: { dawn: number }) {
  const pct = Math.round(dawn * 100);
  return (
    <div className="flex items-center gap-4" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.3em', fontSize: '0.68rem', color: 'rgba(245,230,200,0.75)' }}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <defs>
          <radialGradient id="dm-sun">
            <stop offset="0" stopColor="#fff3cf" />
            <stop offset="0.6" stopColor="#f5b83d" />
            <stop offset="1" stopColor="#c0283a" />
          </radialGradient>
        </defs>
        <circle cx="22" cy="22" r="14" fill="url(#dm-sun)" />
        <circle cx={22 + dawn * 26} cy={22 - dawn * 8} r="14.6" fill="#07070b" />
        <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(245,184,61,0.25)" />
      </svg>
      <div>
        <div>THE DAWN RESTORED</div>
        <div className="gold-text" style={{ fontSize: '1.3rem', letterSpacing: '0.12em', marginTop: 2 }}>{pct}%</div>
      </div>
    </div>
  );
}

export function MainMenu({ fromIntro }: { fromIntro: boolean }) {
  const { progress, setScreen, newCampaign, dawn } = useGameStore();
  const hasSave = progress.completed.length > 0 || !!progress.lastPlayed;
  const base = fromIntro ? 0.6 : 0.9;

  useEffect(() => {
    audio.startMenuMusic();
    const move = (e: PointerEvent) => {
      cine.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  const next = progress.available.map((id) => CHAPTERS[id]?.title).filter(Boolean)[0];
  const items = [
    ...(hasSave ? [{ label: 'Continue', sub: next ? `— ${next}` : undefined, onClick: () => setScreen('map') }] : []),
    {
      label: hasSave ? 'New Campaign' : 'Begin the Reclamation',
      onClick: () => {
        newCampaign();
        setScreen('map');
      },
    },
    { label: 'The Chronicle', onClick: () => setScreen('chronicle') },
    { label: 'Settings', onClick: () => setScreen('settings') },
    { label: 'Replay the Prologue', onClick: () => setScreen('intro') },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 60%, transparent 30%, rgba(0,0,0,0.55) 100%), linear-gradient(180deg, rgba(0,0,0,0.35), transparent 30%, transparent 60%, rgba(0,0,0,0.6))' }} />
      <TitleBlock stage={fromIntro ? 'lifted' : 'static'} />
      <nav className="absolute left-1/2 flex flex-col items-start" style={{ top: '40%', transform: 'translateX(-50%)', gap: '0.35rem' }}>
        {items.map((it, i) => (
          <MenuItem key={it.label} label={it.label} sub={it.sub} onClick={it.onClick} delay={base + i * 0.09} />
        ))}
      </nav>
      <div className="absolute left-8 bottom-8" style={{ animation: `fadeUp 1s ease ${base + 0.8}s both` }}>
        <DawnMeter dawn={dawn()} />
      </div>
      <div
        className="absolute right-8 bottom-8 text-right"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.3em', fontSize: '0.62rem', color: 'rgba(245,230,200,0.45)', lineHeight: 2, animation: `fadeUp 1s ease ${base + 1}s both` }}
      >
        <div style={{ color: 'rgba(255,217,138,0.75)' }}>DEVELOPED BY YASHRAJ GHEMUD</div>
        <div>REMASTERED EDITION</div>
        <div>MOUSE + KEYBOARD RECOMMENDED</div>
      </div>
    </div>
  );
}
