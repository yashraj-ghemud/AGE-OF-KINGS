import { useEffect, useMemo, useRef, useState } from 'react';
import { cine } from '../cinematic/cine';
import { cineLayout } from '../cinematic/layout';
import { endingProgram, ENDING_END, INTRO_END, introProgram, TITLE_T } from '../cinematic/programs';
import { TitleBlock, type TitleStage } from './TitleBlock';
import { audio } from '../audio/audio';

function Subtitle({ text, style }: { text: string; style?: 'narration' | 'name' | 'card' | 'presents' }) {
  if (style === 'presents') {
    const [who, what] = text.split('|');
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="gold-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.3rem, 3vw, 2.6rem)', letterSpacing: '0.55em', paddingLeft: '0.55em', animation: 'bannerIn 2.2s cubic-bezier(0.2,0.8,0.2,1) both' }}>
          {who.toUpperCase()}
        </div>
        <div className="narration" style={{ fontSize: 'clamp(1rem, 1.6vw, 1.4rem)', color: 'rgba(240,225,200,0.75)', letterSpacing: '0.4em', marginTop: '0.8rem', animation: 'fadeIn 1.5s ease 0.9s both' }}>
          {what}
        </div>
      </div>
    );
  }
  if (style === 'card') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ animation: 'shake 0.4s ease-out both' }}>
          <div
            className="gold-text"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2.4rem, 8vw, 7rem)', letterSpacing: '0.3em', paddingLeft: '0.3em', filter: 'drop-shadow(0 0 30px rgba(255,120,40,0.6)) drop-shadow(0 4px 16px #000)', animation: 'letterSlam 0.8s cubic-bezier(0.2,0.9,0.2,1) both' }}
          >
            {text}
          </div>
        </div>
      </div>
    );
  }
  if (style === 'name') {
    const [name, epithet] = text.split('|');
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '17vh', textAlign: 'center' }}>
        <div
          className="crimson-glow"
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2.4rem, 7vw, 6.5rem)', letterSpacing: '0.35em',
            color: '#ffd7cf', paddingLeft: '0.35em', animation: 'bannerIn 1.6s cubic-bezier(0.2,0.8,0.2,1) both',
          }}
        >
          {name.toUpperCase()}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(1rem, 2vw, 1.6rem)', color: '#e6b3aa',
            letterSpacing: '0.2em', marginTop: '0.4rem', animation: 'fadeUp 1.2s ease 0.7s both',
          }}
        >
          {epithet}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', left: '8vw', right: '8vw', bottom: '15vh', textAlign: 'center' }}>
      <p className="narration" style={{ fontSize: 'clamp(1.15rem, 2.3vw, 2.1rem)', color: '#f5ead2', margin: 0, lineHeight: 1.35 }}>
        {text.split('').map((ch, i) => (
          <span key={i} style={{ animation: `fadeIn 0.5s ease ${i * 0.022}s both`, whiteSpace: 'pre' }}>
            {ch}
          </span>
        ))}
      </p>
    </div>
  );
}

/** HTML layer for the intro & ending cinematics. */
export function CineOverlay({ program, onDone }: { program: 'intro' | 'ending'; onDone: () => void }) {
  const prog = useMemo(() => (program === 'intro' ? introProgram(cineLayout()) : endingProgram(cineLayout())), [program]);
  const topBar = useRef<HTMLDivElement>(null);
  const botBar = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const skipRing = useRef<SVGCircleElement>(null);
  const [sub, setSub] = useState(-1);
  const [title, setTitle] = useState<TitleStage>('hidden');
  const [credits, setCredits] = useState(false);
  const holding = useRef(0);
  const held = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const t = cine.t;
      const barH = Math.max(0, (window.innerHeight - window.innerWidth / 2.39) / 2);
      const lb = cine.letterbox * Math.max(barH, window.innerHeight * 0.085);
      if (topBar.current) topBar.current.style.height = `${lb}px`;
      if (botBar.current) botBar.current.style.height = `${lb}px`;
      if (fadeRef.current) fadeRef.current.style.opacity = String(cine.fade);
      if (flashRef.current) {
        flashRef.current.style.opacity = String(Math.min(1, cine.flash));
        flashRef.current.style.background = `rgb(${cine.flashColor})`;
      }
      const idx = prog.subtitles.findIndex((s) => t >= s.start && t < s.end);
      setSub((p) => (p === idx ? p : idx));

      if (program === 'intro') {
        const stage: TitleStage = t >= INTRO_END - 1.9 ? 'lifted' : t >= TITLE_T + 0.05 ? 'slam' : 'hidden';
        setTitle((p) => (p === stage ? p : stage));
      } else if (t >= ENDING_END - 6) setCredits(true);

      // hold-to-skip
      if (held.current) holding.current = Math.min(1, holding.current + dt / 0.9);
      else holding.current = Math.max(0, holding.current - dt * 2);
      if (skipRing.current) skipRing.current.style.strokeDashoffset = String(113 * (1 - holding.current));
      if (holding.current >= 1) {
        holding.current = 0;
        held.current = false;
        if (program === 'intro' && t < TITLE_T - 1) {
          audio.resetMusicBus();
          cine.seek = TITLE_T - 0.7;
        } else if (program === 'ending' && t < ENDING_END - 7) {
          audio.resetMusicBus();
          audio.cue('dawn');
          cine.seek = ENDING_END - 7;
        } else if (program === 'intro') cine.done = true;
      }
      if (cine.done && !doneRef.current && program === 'intro') {
        doneRef.current = true;
        onDone();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        held.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') held.current = false;
    };
    const md = () => (held.current = true);
    const mu = () => (held.current = false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('pointerdown', md);
    window.addEventListener('pointerup', mu);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('pointerdown', md);
      window.removeEventListener('pointerup', mu);
    };
  }, [prog, program, onDone]);

  const s = sub >= 0 ? prog.subtitles[sub] : null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 20 }}>
      <div ref={fadeRef} className="absolute inset-0" style={{ background: '#000', opacity: 1 }} />
      <div ref={flashRef} className="absolute inset-0" style={{ opacity: 0, mixBlendMode: 'screen' }} />
      <div ref={topBar} className="absolute left-0 right-0 top-0" style={{ background: '#000', height: 0 }} />
      <div ref={botBar} className="absolute left-0 right-0 bottom-0" style={{ background: '#000', height: 0 }} />
      <div className="vignette" />
      {s && <Subtitle key={sub} text={s.text} style={s.style} />}
      {program === 'intro' && <TitleBlock stage={title} />}

      {program === 'ending' && credits && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ background: 'radial-gradient(ellipse at center, rgba(40,24,6,0.35), rgba(0,0,0,0.75))', animation: 'fadeIn 3s ease both' }}>
          <p className="narration" style={{ fontSize: 'clamp(1.3rem, 2.8vw, 2.4rem)', color: '#fff1d0', animation: 'fadeUp 2s ease 0.4s both' }}>
            The Endless Eclipse is over.
          </p>
          <h2 className="gold-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem, 6vw, 5rem)', letterSpacing: '0.12em', margin: '0.6rem 0 2rem', animation: 'letterSlam 1.6s cubic-bezier(0.2,0.9,0.2,1) 1.6s both' }}>
            THE AGE OF KINGS BEGINS
          </h2>
          <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.3em', fontSize: '0.8rem', color: 'rgba(245,230,200,0.7)', lineHeight: 2.2, animation: 'fadeUp 2s ease 3.2s both' }}>
            <div style={{ color: '#ffd98a', fontSize: '1rem', letterSpacing: '0.4em', marginBottom: '0.6rem' }}>DEVELOPED BY YASHRAJ GHEMUD</div>
            <div>A REMASTER OF AGE OF KINGS</div>
            <div>STORY · CINEMATICS · SCORE — ALL PROCEDURAL, ALL REAL-TIME</div>
            <div style={{ marginTop: '1rem', color: '#ffd98a' }}>THANK YOU FOR PLAYING, YOUR MAJESTY</div>
          </div>
          <button
            className="btn-ember pointer-events-auto mt-10 px-10 py-4 rounded-sm text-sm"
            style={{ animation: 'fadeUp 1.5s ease 4.5s both' }}
            onClick={() => {
              audio.play('uiConfirm');
              onDone();
            }}
          >
            Return to Suryagarh
          </button>
        </div>
      )}

      {!(program === 'ending' && credits) && (
        <div className="absolute right-8 bottom-8 flex items-center gap-3" style={{ opacity: 0.75, fontFamily: 'var(--font-display)', letterSpacing: '0.25em', fontSize: '0.7rem', color: '#e9dcc0' }}>
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
            <circle ref={skipRing} cx="20" cy="20" r="18" fill="none" stroke="#ffd98a" strokeWidth="2" strokeDasharray="113" strokeDashoffset="113" transform="rotate(-90 20 20)" />
          </svg>
          HOLD <kbd>SPACE</kbd> OR CLICK TO SKIP
        </div>
      )}
    </div>
  );
}
