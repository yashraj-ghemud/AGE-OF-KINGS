import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGameStore, type Quality } from '../store/gameStore';
import { CHAPTERS, CHAPTER_ORDER, CODEX, type Chapter } from '../story/campaign';
import { audio } from '../audio/audio';
import { DawnMeter } from './MainMenu';
import { rng } from '../lib/math';

function Panel({ title, kicker, children, onBack, wide }: { title: string; kicker?: string; children: ReactNode; onBack: () => void; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.code === 'Escape' && onBack();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onBack]);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 md:p-10" style={{ zIndex: 20, background: 'radial-gradient(ellipse at center, rgba(5,4,8,0.45), rgba(0,0,0,0.85))', backdropFilter: 'blur(3px)' }}>
      <div className={`glass frame-corners w-full ${wide ? 'max-w-6xl' : 'max-w-3xl'} max-h-full flex flex-col rounded-sm`} style={{ animation: 'fadeUp 0.9s cubic-bezier(0.2,0.8,0.2,1) both' }}>
        <div className="px-6 md:px-10 pt-7 pb-4 flex items-end justify-between gap-4">
          <div>
            {kicker && <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.4em', fontSize: '0.65rem', color: 'rgba(255,217,138,0.7)' }}>{kicker}</div>}
            <h2 className="gold-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.6rem, 3.2vw, 2.6rem)', letterSpacing: '0.12em', margin: '0.2rem 0 0' }}>{title}</h2>
          </div>
          <button className="btn-ghost px-5 py-2 text-xs rounded-sm" onMouseEnter={() => audio.play('uiHover')} onClick={() => { audio.play('uiClick'); onBack(); }}>
            ← Back
          </button>
        </div>
        <div className="filigree mx-6 md:mx-10" />
        <div className="px-6 md:px-10 py-6 overflow-y-auto scroll-thin">{children}</div>
      </div>
    </div>
  );
}

// ───────────────────────── Chronicle ─────────────────────────

export function Chronicle() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel title="The Chronicle" kicker="AS RECORDED BY DEVDUTT, MINISTER OF SURYAGARH" onBack={() => setScreen('menu')} wide>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {CODEX.map((c, i) => (
          <button
            key={c.id}
            data-hover
            onMouseEnter={() => audio.play('uiHover')}
            onClick={() => setOpen(open === c.id ? null : c.id)}
            className="text-left p-5 rounded-sm transition-all duration-500"
            style={{
              background: open === c.id ? 'linear-gradient(160deg, rgba(245,184,61,0.14), rgba(0,0,0,0.3))' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${open === c.id ? 'rgba(245,184,61,0.6)' : 'rgba(245,184,61,0.14)'}`,
              animation: `fadeUp 0.8s cubic-bezier(0.2,0.8,0.2,1) ${0.1 + i * 0.05}s both`,
            }}
          >
            <div className="flex items-center gap-3">
              <span className="gold-text" style={{ fontSize: '1.9rem', lineHeight: 1 }}>{c.glyph}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.18em', fontSize: '1rem', color: '#f5e7c8' }}>{c.title}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'rgba(255,217,138,0.75)', fontSize: '0.95rem' }}>{c.epithet}</div>
              </div>
              <span className="ml-auto" style={{ fontSize: '0.6rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.35)' }}>{c.kind.toUpperCase()}</span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-serif)', fontSize: '1.05rem', lineHeight: 1.5, color: 'rgba(240,230,210,0.85)',
                maxHeight: open === c.id ? 400 : 0, overflow: 'hidden', transition: 'max-height 0.7s cubic-bezier(0.2,0.8,0.2,1), margin 0.5s',
                marginTop: open === c.id ? '0.9rem' : 0,
              }}
            >
              {c.text}
            </p>
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ───────────────────────── Settings ─────────────────────────

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4" style={{ borderBottom: '1px solid rgba(245,184,61,0.1)' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.2em', fontSize: '0.85rem', color: '#f1e3c4' }}>{label}</div>
        {hint && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range" className="royal w-44" min={min} max={max} step={step} value={value}
      style={{ ['--fill' as string]: `${fill}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => { audio.play('uiClick'); onChange(!on); }}
      className="relative rounded-full transition-colors"
      style={{ width: 52, height: 26, background: on ? 'rgba(245,184,61,0.8)' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(245,184,61,0.4)' }}
    >
      <span className="absolute top-0.5 rounded-full transition-all" style={{ left: on ? 27 : 3, width: 20, height: 20, background: on ? '#fff3cf' : '#888' }} />
    </button>
  );
}

export function SettingsPanel({ onBack }: { onBack?: () => void }) {
  const { settings, updateSettings, setScreen, newCampaign } = useGameStore();
  const [confirm, setConfirm] = useState(false);
  const back = onBack ?? (() => setScreen('menu'));
  const q: { id: Quality; label: string; hint: string }[] = [
    { id: 'cinematic', label: 'Cinematic', hint: 'Max resolution, MSAA, dense grass, 4K shadows' },
    { id: 'balanced', label: 'Balanced', hint: 'Bloom, grain and shadows' },
    { id: 'performance', label: 'Performance', hint: 'No post-processing, no shadows' },
  ];
  return (
    <Panel title="Settings" kicker="THE KING'S PREFERENCES" onBack={back}>
      <Row label="Visual Quality" hint={q.find((x) => x.id === settings.quality)?.hint}>
        <div className="flex gap-1">
          {q.map((x) => (
            <button
              key={x.id}
              onClick={() => { audio.play('uiClick'); updateSettings({ quality: x.id }); }}
              className="px-3 py-2 text-xs rounded-sm transition-all"
              style={{
                fontFamily: 'var(--font-display)', letterSpacing: '0.15em',
                background: settings.quality === x.id ? 'rgba(245,184,61,0.85)' : 'rgba(255,255,255,0.05)',
                color: settings.quality === x.id ? '#1a0c02' : '#e9dcc0', border: '1px solid rgba(245,184,61,0.3)',
              }}
            >
              {x.label}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Master Volume"><Slider value={settings.masterVolume} min={0} max={1} step={0.01} onChange={(v) => updateSettings({ masterVolume: v })} /></Row>
      <Row label="Music Volume"><Slider value={settings.musicVolume} min={0} max={1} step={0.01} onChange={(v) => updateSettings({ musicVolume: v })} /></Row>
      <Row label="Mouse Sensitivity"><Slider value={settings.sensitivity} min={0.3} max={2.5} step={0.05} onChange={(v) => updateSettings({ sensitivity: v })} /></Row>
      <Row label="Invert Look"><Toggle on={settings.invertY} onChange={(v) => updateSettings({ invertY: v })} /></Row>
      <Row label="Camera Shake" hint="Impacts, charges and dragon roars"><Toggle on={settings.shake} onChange={(v) => updateSettings({ shake: v })} /></Row>
      <Row label="Erase the Chronicle" hint="Reset campaign progress">
        <button
          className="btn-ghost px-4 py-2 text-xs rounded-sm"
          style={{ borderColor: confirm ? '#c0283a' : undefined, color: confirm ? '#ff9a9a' : undefined }}
          onClick={() => {
            if (!confirm) return setConfirm(true);
            newCampaign();
            setConfirm(false);
            audio.play('uiConfirm');
          }}
        >
          {confirm ? 'Click again to erase' : 'Reset'}
        </button>
      </Row>
    </Panel>
  );
}

// ───────────────────────── War Map ─────────────────────────

const MODE_LABEL: Record<Chapter['mode'], string> = {
  reclaim: 'Reclamation', invasion: 'Invasion', alliance: 'Alliance', siege: 'Siege', escort: 'Escort', boss: 'Final Battle',
};

export function WarMap() {
  const { progress, setScreen, selectChapter, dawn } = useGameStore();
  const [hover, setHover] = useState<string | null>(null);
  const decor = useMemo(() => {
    const r = rng(4);
    const mountains = Array.from({ length: 46 }, () => ({ x: r() * 100, y: r() * 70, s: 1 + r() * 2.2 }));
    const trees = Array.from({ length: 90 }, () => ({ x: r() * 100, y: 20 + r() * 50, s: 0.5 + r() * 0.6 }));
    return { mountains, trees };
  }, []);

  const state = (id: string) => (progress.completed.includes(id) ? 'done' : progress.available.includes(id) ? 'open' : 'locked');
  const pos = (id: string) => ({ x: CHAPTERS[id].map.x, y: CHAPTERS[id].map.y * 0.7 });

  const choose = (id: string) => {
    if (state(id) === 'locked') {
      audio.play('uiHover');
      return;
    }
    audio.play('uiConfirm');
    selectChapter(id);
    setScreen('briefing');
  };

  const hv = hover ? CHAPTERS[hover] : null;

  return (
    <Panel title="The War Map" kicker="SURYAVARTA UNDER THE ENDLESS ECLIPSE" onBack={() => setScreen('menu')} wide>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="relative flex-1 rounded-sm overflow-hidden" style={{ border: '1px solid rgba(245,184,61,0.25)' }}>
          <svg viewBox="0 0 100 70" className="w-full block" style={{ background: 'radial-gradient(ellipse at 50% 50%, #3a2c1c 0%, #1f160d 70%, #0e0a06 100%)' }}>
            <defs>
              <filter id="parch">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3" />
                <feColorMatrix values="0 0 0 0 0.6  0 0 0 0 0.45  0 0 0 0 0.25  0 0 0 0.18 0" />
              </filter>
              <radialGradient id="deep">
                <stop offset="0" stopColor="#000" />
                <stop offset="0.6" stopColor="#3a0710" />
                <stop offset="1" stopColor="#3a0710" stopOpacity="0" />
              </radialGradient>
              <filter id="glow"><feGaussianBlur stdDeviation="0.6" /></filter>
            </defs>
            <rect width="100" height="70" filter="url(#parch)" />
            <ellipse cx="50" cy="4" rx="22" ry="8" fill="url(#deep)" />
            <text x="50" y="3.2" textAnchor="middle" fontSize="1.6" fill="#c0283a" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.3em' }}>THE ASHEN DEEP</text>
            <path d="M -2 52 C 15 48, 22 58, 38 54 S 62 44, 70 50 S 90 60, 104 55" fill="none" stroke="#5b7a8c" strokeWidth="0.7" opacity="0.6" />
            {decor.mountains.map((m, i) => (
              <path key={i} d={`M ${m.x - m.s} ${m.y + m.s * 0.6} L ${m.x} ${m.y - m.s * 0.6} L ${m.x + m.s} ${m.y + m.s * 0.6}`} fill="none" stroke="#8a6a44" strokeWidth="0.25" opacity="0.55" />
            ))}
            {decor.trees.map((t, i) => (
              <circle key={i} cx={t.x} cy={t.y} r={t.s * 0.45} fill="#3f4a2a" opacity="0.5" />
            ))}
            {/* compass */}
            <g transform="translate(90 60)" opacity="0.7">
              <circle r="5" fill="none" stroke="#c9a462" strokeWidth="0.2" />
              <path d="M 0 -6 L 1 0 L 0 6 L -1 0 Z" fill="#c9a462" />
              <path d="M -6 0 L 0 1 L 6 0 L 0 -1 Z" fill="#8a6a44" />
              <text y="-6.8" textAnchor="middle" fontSize="1.4" fill="#c9a462">N</text>
            </g>
            {/* routes */}
            {CHAPTER_ORDER.flatMap((id) =>
              CHAPTERS[id].choices.map((c) => {
                const a = pos(id);
                const b = pos(c.nextNodeId);
                const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18;
                const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12;
                const sa = state(id);
                const sb = state(c.nextNodeId);
                const live = sa === 'done' && sb !== 'locked';
                const walked = sa === 'done' && sb === 'done';
                return (
                  <g key={id + c.nextNodeId}>
                    {live && <path d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} fill="none" stroke="#ffb040" strokeWidth="0.9" opacity="0.5" filter="url(#glow)" />}
                    <path
                      d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                      fill="none"
                      stroke={walked ? '#f5b83d' : live ? '#ffd98a' : '#6b5334'}
                      strokeWidth={live || walked ? 0.45 : 0.3}
                      strokeDasharray={walked ? undefined : live ? '1.2 0.8' : '0.4 0.9'}
                      style={live ? { animation: 'dash 1.2s linear infinite', strokeDashoffset: 4 } : undefined}
                    />
                  </g>
                );
              }),
            )}
            {/* nodes */}
            {CHAPTER_ORDER.map((id) => {
              const p = pos(id);
              const st = state(id);
              const ch = CHAPTERS[id];
              return (
                <g
                  key={id}
                  transform={`translate(${p.x} ${p.y})`}
                  style={{ cursor: st === 'locked' ? 'default' : 'pointer' }}
                  onMouseEnter={() => { setHover(id); audio.play('uiHover'); }}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => choose(id)}
                  data-hover
                >
                  {st === 'open' && (
                    <circle r="4" fill="none" stroke="#ff8a3a" strokeWidth="0.3">
                      <animate attributeName="r" values="2.6;5.5" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.9;0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle r={ch.mode === 'boss' ? 3.4 : 2.6} fill={st === 'done' ? '#f5b83d' : st === 'open' ? '#2a0c0e' : '#1a140e'} stroke={st === 'locked' ? '#5a4630' : '#ffd98a'} strokeWidth={hover === id ? 0.5 : 0.3} />
                  {st === 'done' ? (
                    <g>
                      {Array.from({ length: 8 }).map((_, k) => (
                        <line key={k} x1="0" y1="-1.1" x2="0" y2="-1.9" stroke="#3a2008" strokeWidth="0.25" transform={`rotate(${k * 45})`} />
                      ))}
                      <circle r="0.9" fill="#3a2008" />
                    </g>
                  ) : (
                    <text y="0.8" textAnchor="middle" fontSize="2" fill={st === 'locked' ? '#6b5334' : '#ffd98a'} style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                      {ch.numeral}
                    </text>
                  )}
                  <text y={ch.mode === 'boss' ? 6 : 5} textAnchor="middle" fontSize="1.5" fill={st === 'locked' ? '#6b5334' : '#f1e3c4'} style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>
                    {ch.title.toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="lg:w-72 flex flex-col gap-5">
          <DawnMeter dawn={dawn()} />
          <div className="glass p-5 rounded-sm min-h-48" style={{ transition: 'all 0.4s' }}>
            {hv ? (
              <div key={hv.id} style={{ animation: 'fadeUp 0.5s ease both' }}>
                <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.35em', fontSize: '0.6rem', color: '#ff8a3a' }}>
                  CHAPTER {hv.numeral} · {MODE_LABEL[hv.mode].toUpperCase()}
                </div>
                <div className="gold-text" style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '0.08em', marginTop: 6 }}>{hv.title}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'rgba(255,217,138,0.7)' }}>{hv.region}</div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', marginTop: 10, color: 'rgba(240,230,210,0.85)', lineHeight: 1.45 }}>{hv.objective}</p>
                <div style={{ marginTop: 10, fontSize: '0.7rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)' }}>
                  {state(hv.id) === 'done' ? 'RECLAIMED — REPLAY' : state(hv.id) === 'open' ? 'CLICK TO RIDE' : 'NOT YET REACHABLE'}
                </div>
              </div>
            ) : (
              <p className="narration" style={{ color: 'rgba(240,230,210,0.7)', fontSize: '1.05rem' }}>
                “Every road on this map ends at Kaalgarh, my King. Choose which one we walk first.”
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ───────────────────────── Briefing ─────────────────────────

function Typewriter({ text, delay = 0, speed = 24 }: { text: string; delay?: number; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    let iv = 0;
    const start = window.setTimeout(() => {
      iv = window.setInterval(() => {
        i += 1;
        setN(i);
        if (i % 3 === 0) audio.play('uiHover', 0.3);
        if (i >= text.length) window.clearInterval(iv);
      }, 1000 / speed);
    }, delay * 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(iv);
    };
  }, [text, delay, speed]);
  return (
    <span>
      {text.slice(0, n)}
      {n < text.length && <span style={{ animation: 'caret 0.8s infinite', color: '#ffd98a' }}>▍</span>}
    </span>
  );
}

export function Briefing() {
  const { chapterId, setScreen, startChapter } = useGameStore();
  const ch = CHAPTERS[chapterId];
  const c = ch.config;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1400);
    return () => clearTimeout(t);
  }, []);
  const facts = [
    ['Traitor lords', String(c.camps) + (c.boss ? ' + Kaalrath' : '')],
    ['Your host', `${c.startArmy} soldiers`],
    ['Eagles', String(c.eagles)],
    ['Dragons', String(c.dragons)],
    ['Starting ember', String(c.startEmber)],
    ['War-horn raids', c.raidInterval ? `every ~${c.raidInterval}s` : 'none'],
  ];
  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin" style={{ zIndex: 20, background: 'linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.2) 100%)' }}>
      <div className="min-h-full flex flex-col justify-center px-6 md:px-16 py-12 max-w-4xl">
        <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.5em', fontSize: '0.7rem', color: '#ff8a3a', animation: 'fadeUp 0.8s ease both' }}>
          CHAPTER {ch.numeral} · {MODE_LABEL[ch.mode].toUpperCase()}
        </div>
        <div className="flex items-end gap-6 mt-2">
          <span className="gold-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(4rem, 12vw, 9rem)', lineHeight: 0.85, animation: 'letterSlam 1.2s cubic-bezier(0.2,0.9,0.2,1) 0.1s both' }}>
            {ch.numeral}
          </span>
          <div style={{ animation: 'fadeUp 1s ease 0.4s both' }}>
            <h2 className="gold-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 3.4rem)', letterSpacing: '0.08em', margin: 0, lineHeight: 1.05 }}>{ch.title}</h2>
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.3rem', color: 'rgba(255,217,138,0.75)' }}>{ch.region}</div>
          </div>
        </div>
        <div className="filigree my-6" style={{ maxWidth: 520, animation: 'fadeIn 1s ease 0.6s both' }} />
        <div className="narration" style={{ fontSize: 'clamp(1.1rem, 1.6vw, 1.45rem)', color: '#f3e7cc', lineHeight: 1.55, minHeight: '9em' }}>
          {ch.narration.map((p, i) => (
            <p key={i} style={{ margin: '0 0 0.9em' }}>
              <Typewriter text={p} delay={0.9 + i * (ch.narration[0].length / 34 + 0.6)} speed={34} />
            </p>
          ))}
          <div style={{ fontSize: '0.95rem', color: 'rgba(255,217,138,0.6)', fontStyle: 'normal', fontFamily: 'var(--font-display)', letterSpacing: '0.3em' }}>— DEVDUTT</div>
        </div>
        <div className="glass mt-6 p-5 rounded-sm" style={{ animation: 'fadeUp 1s ease 1.2s both' }}>
          <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.35em', fontSize: '0.65rem', color: 'rgba(255,217,138,0.7)' }}>OBJECTIVE</div>
          <div style={{ fontSize: '1.05rem', marginTop: 6, color: '#f5ead6' }}>{ch.objective}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-4">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3" style={{ fontSize: '0.8rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{k}</span>
                <span style={{ color: '#ffd98a', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-8" style={{ animation: 'fadeUp 1s ease 1.5s both' }}>
          <button
            className="btn-ember px-12 py-4 rounded-sm text-base"
            disabled={!ready}
            style={{ opacity: ready ? 1 : 0.5 }}
            onMouseEnter={() => audio.play('uiHover')}
            onClick={() => { audio.play('uiConfirm'); audio.play('horn'); startChapter(); }}
          >
            Ride Out
          </button>
          <button className="btn-ghost px-6 py-4 rounded-sm text-xs" onClick={() => { audio.play('uiClick'); setScreen('map'); }}>
            War Map
          </button>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
            Mouse + keyboard · press <kbd>H</kbd> in battle for all controls
          </span>
        </div>
      </div>
    </div>
  );
}
