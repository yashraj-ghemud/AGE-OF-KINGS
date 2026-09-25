import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/audio';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
}

/** The first screen: a single breathing ember. Touching it unlocks audio and begins the saga. */
export function Gate({ onAwaken }: { onAwaken: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [burst, setBurst] = useState(false);
  const burstRef = useRef(0);
  const target = useRef({ x: 0, y: 0 });
  const hover = useRef(0);

  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext('2d')!;
    let raf = 0;
    const sparks: Spark[] = [];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    const ember = { x: window.innerWidth / 2, y: window.innerHeight * 0.56 };
    target.current = { ...ember };
    let t = 0;
    let last = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const W = window.innerWidth;
      const H = window.innerHeight;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = 'rgba(4,4,7,0.35)';
      g.fillRect(0, 0, W, H);

      const home = { x: W / 2, y: H * 0.56 };
      const tx = home.x + (target.current.x - home.x) * 0.08;
      const ty = home.y + (target.current.y - home.y) * 0.08;
      ember.x += (tx - ember.x) * dt * 3;
      ember.y += (ty - ember.y) * dt * 3;
      const dist = Math.hypot(target.current.x - ember.x, target.current.y - ember.y);
      hover.current += ((dist < 90 ? 1 : 0) - hover.current) * dt * 5;

      const b = burstRef.current;
      const breath = 1 + Math.sin(t * 1.7) * 0.12 + hover.current * 0.25;
      const r = 14 * breath * (1 + b * 6);
      const alpha = 1 - Math.min(1, b * 1.4);

      // halo
      const halo = g.createRadialGradient(ember.x, ember.y, 0, ember.x, ember.y, r * 9);
      halo.addColorStop(0, `rgba(255,150,60,${0.28 * alpha + b * 0.3})`);
      halo.addColorStop(0.4, `rgba(200,50,20,${0.08 * alpha})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = halo;
      g.fillRect(ember.x - r * 9, ember.y - r * 9, r * 18, r * 18);
      // core
      const core = g.createRadialGradient(ember.x, ember.y, 0, ember.x, ember.y, r);
      core.addColorStop(0, `rgba(255,250,230,${alpha})`);
      core.addColorStop(0.35, `rgba(255,200,110,${alpha})`);
      core.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = core;
      g.beginPath();
      g.arc(ember.x, ember.y, r, 0, Math.PI * 2);
      g.fill();

      // rising sparks
      if (b === 0 && Math.random() < 0.5 + hover.current) {
        sparks.push({
          x: ember.x + (Math.random() - 0.5) * 10, y: ember.y, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 50,
          life: 0, max: 1.5 + Math.random() * 2, size: 0.8 + Math.random() * 1.8, hue: 20 + Math.random() * 25,
        });
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life > s.max) {
          sparks.splice(i, 1);
          continue;
        }
        s.vx += Math.sin(t * 3 + i) * 8 * dt;
        s.vy += (b > 0 ? 30 : -6) * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const a = 1 - s.life / s.max;
        g.fillStyle = `hsla(${s.hue}, 100%, ${60 + a * 25}%, ${a})`;
        g.beginPath();
        g.arc(s.x, s.y, s.size * (0.5 + a), 0, Math.PI * 2);
        g.fill();
      }
      if (b > 0) burstRef.current = Math.min(2, b + dt * 1.2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const move = (e: PointerEvent) => (target.current = { x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', move);

    (c as unknown as { __burst: () => void }).__burst = () => {
      for (let i = 0; i < 380; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 520;
        sparks.push({
          x: ember.x, y: ember.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: 0.8 + Math.random() * 1.8,
          size: 0.8 + Math.random() * 2.6, hue: 15 + Math.random() * 35,
        });
      }
      burstRef.current = 0.001;
    };
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  const awaken = () => {
    if (burst) return;
    setBurst(true);
    audio.unlock();
    audio.play('emberBurst');
    (canvas.current as unknown as { __burst: () => void }).__burst();
    setTimeout(onAwaken, 1400);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') awaken();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  return (
    <div className="absolute inset-0 cursor-pointer" style={{ background: '#040407', zIndex: 40 }} onClick={awaken}>
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      <div
        className="absolute left-0 right-0 text-center pointer-events-none"
        style={{ top: '22%', transition: 'opacity 0.8s ease', opacity: burst ? 0 : 1 }}
      >
        <div className="gold-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.7em', fontSize: 'clamp(0.9rem, 1.6vw, 1.3rem)', paddingLeft: '0.7em', animation: 'fadeIn 3s ease 0.5s both' }}>
          AGE OF KINGS
        </div>
        <div className="narration" style={{ marginTop: '1rem', fontSize: 'clamp(1rem, 1.8vw, 1.4rem)', color: 'rgba(240,225,200,0.65)', animation: 'fadeIn 3s ease 1.6s both' }}>
          The sun has been stolen.
        </div>
      </div>
      <div
        className="absolute left-0 right-0 text-center pointer-events-none"
        style={{ bottom: '14%', transition: 'opacity 0.6s ease', opacity: burst ? 0 : 1, animation: 'fadeIn 2s ease 2.6s both' }}
      >
        <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.45em', fontSize: '0.78rem', color: '#ffd9a8' }} className="anim-flicker">
          TOUCH THE EMBER TO AWAKEN
        </div>
        <div style={{ marginTop: '0.8rem', fontSize: '0.7rem', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.35)' }}>HEADPHONES RECOMMENDED</div>
        <div style={{ marginTop: '2.2rem', fontSize: '0.62rem', letterSpacing: '0.45em', color: 'rgba(255,217,138,0.45)' }}>A GAME BY YASHRAJ GHEMUD</div>
      </div>
    </div>
  );
}
