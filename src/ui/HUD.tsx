import { useEffect, useRef, useState, type ReactNode } from 'react';
import { audio } from '../audio/audio';
import { useGameStore, type Banner } from '../store/gameStore';
import type { World } from '../game/types';
import { COOLDOWNS, COSTS } from '../game/player';

function BannerView({ b }: { b: Banner }) {
  const drop = useGameStore((s) => s.dropBanner);
  useEffect(() => {
    const t = setTimeout(() => drop(b.id), 3800);
    return () => clearTimeout(t);
  }, [b.id, drop]);
  const col = { gold: '#ffd98a', crimson: '#ff8a8a', ember: '#ffb070', blue: '#9cc0ff' }[b.tone];
  const glow = { gold: 'rgba(245,184,61,0.6)', crimson: 'rgba(192,40,58,0.8)', ember: 'rgba(255,106,31,0.6)', blue: 'rgba(80,130,255,0.6)' }[b.tone];
  return (
    <div className="text-center" style={{ animation: 'bannerIn 0.9s cubic-bezier(0.2,0.8,0.2,1) both, bannerOut 0.6s ease 3.2s forwards' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.1rem, 2.2vw, 1.9rem)', letterSpacing: '0.28em', color: col, textShadow: `0 0 24px ${glow}, 0 2px 8px #000` }}>
        {b.title}
      </div>
      {b.subtitle && (
        <div className="narration" style={{ fontSize: 'clamp(0.95rem, 1.3vw, 1.2rem)', color: '#f1e3c4', marginTop: 2 }}>
          {b.subtitle}
        </div>
      )}
    </div>
  );
}

function Bar({ value, max, color, height = 8, glow }: { value: number; max: number; color: string; height?: number; glow?: string }) {
  const k = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ height, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(245,184,61,0.25)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${k * 100}%`, height: '100%', background: color, boxShadow: glow ? `0 0 12px ${glow}` : undefined, transition: 'width 0.25s ease' }} />
    </div>
  );
}

function Slot({ keyName, label, cd, max, active, cost, children, dim }: { keyName: string; label: string; cd?: number; max?: number; active?: boolean; cost?: number; children: ReactNode; dim?: boolean }) {
  const k = cd && max ? cd / max : 0;
  return (
    <div className="relative flex flex-col items-center" style={{ opacity: dim ? 0.45 : 1 }}>
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 52, height: 52, borderRadius: 6,
          background: active ? 'linear-gradient(160deg, rgba(245,184,61,0.35), rgba(60,30,5,0.6))' : 'rgba(8,8,14,0.7)',
          border: `1px solid ${active ? '#ffd98a' : 'rgba(245,184,61,0.3)'}`,
          boxShadow: active ? '0 0 18px rgba(245,184,61,0.45)' : undefined,
          transform: active ? 'translateY(-3px)' : undefined, transition: 'all 0.25s',
        }}
      >
        <span style={{ fontSize: 22, filter: k > 0 ? 'grayscale(1) brightness(0.6)' : undefined }}>{children}</span>
        {k > 0 && (
          <>
            <div className="absolute inset-0" style={{ borderRadius: 6, background: `conic-gradient(rgba(0,0,0,0.72) ${k * 360}deg, transparent 0deg)` }} />
            <span className="absolute" style={{ fontWeight: 700, color: '#fff', fontSize: 15, textShadow: '0 1px 4px #000' }}>{Math.ceil(cd!)}</span>
          </>
        )}
        <kbd className="absolute" style={{ top: -8, left: -6, fontSize: 10 }}>{keyName}</kbd>
        {cost !== undefined && <span className="absolute" style={{ bottom: -7, right: -6, fontSize: 9, padding: '0 4px', borderRadius: 3, background: '#2a1204', color: '#ffb070', border: '1px solid rgba(255,106,31,0.5)' }}>{cost}</span>}
      </div>
      <span style={{ fontSize: 9, letterSpacing: '0.18em', marginTop: 6, color: 'rgba(241,227,196,0.75)', fontFamily: 'var(--font-display)' }}>{label}</span>
    </div>
  );
}

const HELP: [string, string][] = [
  ['WASD', 'Ride'], ['Shift', 'Gallop'], ['Space', 'Leap'], ['LMB', 'Attack / draw bow'], ['RMB', 'Aim'], ['1 2 3', 'Sword · Spear · Bow'],
  ['Q', 'War Cry'], ['E', 'Sun Charge'], ['R', 'Solar Slam'], ['Z X C', 'Attack · Guard · Hold'], ['F', 'Rally point'],
  ['G', `Recruit (${COSTS.recruit})`], ['B', `War-horn (${COSTS.horn})`], ['O', `Ember Rite (${COSTS.rite})`], ['P', 'Mount dragon'],
  ['V', '1st / 3rd person'], ['Wheel', 'Zoom'], ['H', 'Hide help'], ['Esc', 'Pause'],
];

function Minimap({ world }: { world: World }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const compass = useRef<HTMLDivElement>(null);
  const vignette = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const S = 168;
    const c = canvas.current!;
    c.width = S * 2;
    c.height = S * 2;
    const g = c.getContext('2d')!;
    const loop = () => {
      const k = world.king;
      const ku = k.unit;
      const yaw = k.camYaw;
      const range = 260;
      const scale = (S * 0.5) / range;
      g.setTransform(2, 0, 0, 2, 0, 0);
      g.clearRect(0, 0, S, S);
      g.save();
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = 'rgba(12,8,10,0.72)';
      g.fillRect(0, 0, S, S);
      // map-space → screen: rotate so camera forward is up
      const proj = (x: number, z: number) => {
        const dx = x - ku.x;
        const dz = z - ku.z;
        const rx = -(dx * Math.cos(yaw) - dz * Math.sin(yaw));
        const rz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
        return [S / 2 + rx * scale, S / 2 - rz * scale];
      };
      for (const camp of world.camps) {
        const [x, y] = proj(camp.x, camp.z);
        g.fillStyle = camp.royal ? 'rgba(90,140,255,0.35)' : camp.fallen ? 'rgba(245,184,61,0.25)' : 'rgba(200,40,50,0.35)';
        g.beginPath();
        g.rect(x - 80 * scale * 0.5, y - 80 * scale * 0.5, 80 * scale, 80 * scale);
        g.fill();
      }
      for (const u of world.units) {
        if (!u.alive || u === ku) continue;
        const [x, y] = proj(u.x, u.z);
        if (x < 0 || y < 0 || x > S || y > S) continue;
        g.fillStyle = u.team === 0 ? (u.type === 'dragon' ? '#ffb070' : '#7fa8ff') : u.type === 'lord' || u.type === 'boss' ? '#ffd98a' : '#ff5a5a';
        const r = u.type === 'lord' || u.type === 'boss' || u.type === 'dragon' ? 3 : 1.2;
        g.fillRect(x - r / 2, y - r / 2, r, r);
      }
      if (world.rally) {
        const [x, y] = proj(world.rally.x, world.rally.z);
        g.strokeStyle = '#9cc0ff';
        g.beginPath();
        g.arc(x, y, 4, 0, Math.PI * 2);
        g.stroke();
      }
      if (k.capture !== 'free' && k.capture !== 'trapping') {
        const [x, y] = proj(k.cage.x, k.cage.z);
        g.strokeStyle = '#ff5a5a';
        g.strokeRect(x - 4, y - 4, 8, 8);
      }
      g.restore();
      // king arrow
      g.fillStyle = '#ffe3a3';
      g.beginPath();
      const ay = -(ku.yaw - yaw);
      g.translate(S / 2, S / 2);
      g.rotate(ay);
      g.moveTo(0, -6);
      g.lineTo(4, 5);
      g.lineTo(0, 3);
      g.lineTo(-4, 5);
      g.closePath();
      g.fill();
      g.setTransform(2, 0, 0, 2, 0, 0);
      g.strokeStyle = 'rgba(245,184,61,0.6)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
      g.stroke();

      // compass strip
      const cmp = compass.current;
      if (cmp) {
        const W = cmp.clientWidth;
        const items = cmp.children;
        let idx = 0;
        const place = (bearing: number, el: Element | undefined) => {
          if (!el) return;
          let d = bearing - yaw;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const x = W / 2 - (d / (Math.PI / 2)) * (W / 2);
          const h = el as HTMLElement;
          h.style.transform = `translateX(${x}px) translateX(-50%)`;
          h.style.opacity = Math.abs(d) < Math.PI / 2 ? String(1 - Math.abs(d) / (Math.PI / 2) * 0.6) : '0';
        };
        const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        for (const b of dirs) place(b, items[idx++]);
        for (const camp of world.camps) {
          place(Math.atan2(camp.x - ku.x, camp.z - ku.z), items[idx++]);
        }
        const raid = items[idx++] as HTMLElement | undefined;
        if (raid) {
          if (world.raidMarker) place(Math.atan2(world.raidMarker.x - ku.x, world.raidMarker.z - ku.z), raid);
          else raid.style.opacity = '0';
        }
      }
      if (vignette.current) {
        const low = ku.hp / ku.maxHp < 0.3 ? 0.35 + Math.sin(performance.now() / 180) * 0.15 : 0;
        vignette.current.style.opacity = String(Math.min(1, k.hurtFlash * 0.9 + low));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world]);

  return (
    <>
      <div ref={vignette} className="absolute inset-0 pointer-events-none" style={{ opacity: 0, background: 'radial-gradient(ellipse at center, transparent 45%, rgba(170,10,20,0.75) 100%)' }} />
      <div className="absolute left-1/2 -translate-x-1/2 top-4 pointer-events-none" style={{ width: 'min(560px, 60vw)' }}>
        <div ref={compass} className="relative h-7 overflow-hidden" style={{ borderTop: '1px solid rgba(245,184,61,0.35)', borderBottom: '1px solid rgba(245,184,61,0.35)', background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.45), transparent)' }}>
          {['N', 'E', 'S', 'W'].map((d) => (
            <span key={d} className="absolute top-1" style={{ left: 0, fontFamily: 'var(--font-display)', fontSize: 12, color: '#f1e3c4' }}>{d}</span>
          ))}
          {world.camps.map((c) => (
            <span key={c.id} className="absolute top-0.5" style={{ left: 0, fontSize: 15, color: c.royal ? '#7fa8ff' : '#ff5a5a', textShadow: '0 0 8px currentColor' }}>
              {c.royal ? '⛫' : c.kind === 'obsidian' ? '☾' : '♜'}
            </span>
          ))}
          <span className="absolute top-0.5" style={{ left: 0, fontSize: 15, color: '#ff8a3a', textShadow: '0 0 10px #ff3a1a' }}>📯</span>
        </div>
      </div>
      <canvas ref={canvas} className="absolute right-5 top-5 pointer-events-none" style={{ width: 168, height: 168 }} />
    </>
  );
}

function DialogueLine() {
  const d = useGameStore((s) => s.dialogue);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!d) return;
    setShown(d.id);
    audio.play('uiHover', 0.6);
    const t = setTimeout(() => setShown(null), 3000 + d.text.length * 55);
    return () => clearTimeout(t);
  }, [d]);
  if (!d || shown !== d.id) return null;
  const villain = d.speaker === 'Kaalrath';
  const lord = d.speaker !== 'Kaalrath' && d.speaker !== 'Devdutt' && d.speaker !== 'Suparna';
  const col = villain ? '#ff8a7a' : lord ? '#ffb070' : '#ffd98a';
  return (
    <div key={d.id} className="absolute left-1/2 -translate-x-1/2 text-center" style={{ bottom: 104, width: 'min(760px, 86vw)', animation: 'fadeUp 0.6s cubic-bezier(0.2,0.8,0.2,1) both' }}>
      <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.4em', fontSize: 11, color: col, textShadow: villain ? '0 0 14px rgba(192,40,58,0.9)' : undefined }}>
        {villain ? '☾ ' : '☀ '}{d.speaker.toUpperCase()}
      </div>
      <div className="narration" style={{ fontSize: 'clamp(1.05rem, 1.6vw, 1.45rem)', color: '#f5ead6', marginTop: 4 }}>
        “{d.text.split('').map((ch, i) => (
          <span key={i} style={{ animation: `fadeIn 0.3s ease ${i * 0.018}s both` }}>{ch}</span>
        ))}”
      </div>
    </div>
  );
}

export function HUD({ world }: { world: World }) {
  const hud = useGameStore((s) => s.hud);
  const banners = useGameStore((s) => s.banners);
  const showHelp = useGameStore((s) => s.showHelp);
  const locked = typeof document !== 'undefined' && !!document.pointerLockElement;
  const hpK = hud.health / hud.maxHealth;
  const captured = hud.capture === 'trapped' || hud.capture === 'carried' || hud.capture === 'jailed';

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 10, fontFamily: 'var(--font-sans)' }}>
      <Minimap world={world} />

      {/* crest + vitals */}
      <div className="absolute left-5 top-5 flex items-start gap-3" style={{ width: 300 }}>
        <div className="relative flex items-center justify-center shrink-0" style={{ width: 58, height: 58, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #3a2a10, #0c0a08)', border: '2px solid #f5b83d', boxShadow: '0 0 18px rgba(245,184,61,0.45)' }}>
          <span className="gold-text" style={{ fontSize: 26 }}>☀</span>
          {hud.combo > 2 && (
            <span key={hud.combo} className="absolute -bottom-2 -right-3 ember-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, animation: 'comboPop 0.35s ease both' }}>×{hud.combo}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-baseline">
            <span className="gold-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.2em', fontSize: 14 }}>VIKRAM</span>
            <span style={{ fontSize: 11, color: 'rgba(241,227,196,0.7)' }}>{Math.ceil(hud.health)} / {hud.maxHealth}</span>
          </div>
          <div className="mt-1">
            <Bar value={hud.health} max={hud.maxHealth} height={10} color={hpK < 0.3 ? 'linear-gradient(90deg,#8e1622,#ff4a4a)' : 'linear-gradient(90deg,#b8862a,#ffd98a)'} glow={hpK < 0.3 ? '#ff2a2a' : '#f5b83d'} />
          </div>
          <div className="mt-1.5" style={{ width: '70%' }}>
            <Bar value={hud.stamina} max={1} height={4} color="linear-gradient(90deg,#3a6ab0,#9cc0ff)" />
          </div>
          <div className="flex items-center gap-2 mt-2" style={{ fontSize: 12 }}>
            <span className="ember-text" style={{ fontWeight: 700, fontSize: 16 }}>✹ {hud.ember}</span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: '0.15em' }}>EMBER</span>
            <span className="ml-auto" style={{ color: '#ffd98a', fontSize: 10, letterSpacing: '0.15em' }}>DAWN {Math.round(hud.dawn * 100)}%</span>
          </div>
        </div>
      </div>

      {/* objective + boss */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center" style={{ top: 48 }}>
        <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.3em', fontSize: 11, color: '#f1e3c4', textShadow: '0 1px 6px #000' }}>
          TRAITOR LORDS <span style={{ color: '#ffd98a', fontSize: 14 }}>{hud.lordsTotal - hud.lordsLeft}</span> / {hud.lordsTotal}
        </div>
        {hud.boss && (
          <div className="mt-3" style={{ width: 'min(520px, 70vw)', animation: 'fadeUp 0.5s ease both' }}>
            <div className="crimson-glow" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.25em', fontSize: 14, color: '#ffd0c8' }}>{hud.boss.name.toUpperCase()}</div>
            <div className="mt-1">
              <Bar value={hud.boss.hp} max={hud.boss.max} height={9} color="linear-gradient(90deg,#5a0a12,#c0283a,#ff6a4a)" glow="#c0283a" />
            </div>
          </div>
        )}
      </div>

      {/* army */}
      <div className="absolute right-5 text-right" style={{ top: 184, fontSize: 12 }}>
        <div style={{ color: '#9cc0ff' }}>
          <b style={{ fontSize: 18 }}>{hud.army}</b> <span style={{ letterSpacing: '0.18em', fontSize: 10 }}>YOUR HOST</span>
        </div>
        <div style={{ color: '#ff8a8a' }}>
          <b style={{ fontSize: 18 }}>{hud.enemies}</b> <span style={{ letterSpacing: '0.18em', fontSize: 10 }}>TRAITORS</span>
        </div>
        <div className="mt-2 inline-block px-3 py-1" style={{ border: '1px solid rgba(156,192,255,0.5)', background: 'rgba(20,30,60,0.55)', color: '#cfe0ff', fontFamily: 'var(--font-display)', letterSpacing: '0.2em', fontSize: 10 }}>
          {hud.rally ? 'RALLY' : hud.order === 'attack' ? 'ATTACK' : hud.order === 'guard' ? 'GUARD' : 'HOLD'}
        </div>
      </div>

      {/* banners */}
      <div className="absolute left-0 right-0 flex flex-col items-center gap-3" style={{ top: '24%' }}>
        {banners.map((b) => (
          <BannerView key={b.id} b={b} />
        ))}
      </div>

      <DialogueLine />

      {/* crosshair */}
      {!captured && (
        <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)' }}>
          {hud.weapon === 'bow' ? (
            <svg width="54" height="54" viewBox="0 0 54 54">
              <circle cx="27" cy="27" r={22 - hud.bowDraw * 12} fill="none" stroke="rgba(255,227,163,0.85)" strokeWidth="1.2" />
              <circle cx="27" cy="27" r="1.6" fill="#ffe3a3" />
            </svg>
          ) : hud.weapon === 'spear' ? (
            <svg width="30" height="30" viewBox="0 0 30 30">
              <path d="M15 4 L15 11 M15 19 L15 26 M4 15 L11 15 M19 15 L26 15" stroke="rgba(255,227,163,0.9)" strokeWidth="1.4" />
            </svg>
          ) : (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,241,198,0.85)', boxShadow: '0 0 8px #f5b83d' }} />
          )}
        </div>
      )}

      {/* capture */}
      {captured && (
        <div className="absolute left-1/2 -translate-x-1/2 text-center" style={{ top: '58%' }}>
          <div className="crimson-glow" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2.6rem)', letterSpacing: '0.25em', color: '#ffc0b8' }}>
            {hud.capture === 'jailed' ? 'JAILED' : hud.capture === 'carried' ? 'DRAGGED IN CHAINS' : 'CAGED'}
          </div>
          {hud.capture === 'jailed' && (
            <div className="ember-text" style={{ fontSize: 40, fontWeight: 800, marginTop: 4 }}>{Math.max(0, Math.ceil(hud.jailTime))}s</div>
          )}
          <div className="narration mt-2" style={{ fontSize: '1.15rem', color: '#f1e3c4' }}>
            <kbd>B</kbd> war-horn host · <kbd>O</kbd> call a dragon · your army will come for you
          </div>
        </div>
      )}
      {hud.capture === 'trapping' && (
        <div className="absolute left-1/2 -translate-x-1/2 crimson-glow" style={{ top: '64%', fontFamily: 'var(--font-display)', letterSpacing: '0.3em', color: '#ffb0a8', animation: 'flicker 0.6s infinite' }}>
          THEY ARE SURROUNDING YOU — BREAK AWAY
        </div>
      )}

      {/* weapons + abilities */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-5 flex items-end gap-6">
        <div className="flex gap-2">
          <Slot keyName="1" label="SWORD" active={hud.weapon === 'sword'}>⚔</Slot>
          <Slot keyName="2" label="SPEAR" active={hud.weapon === 'spear'}>🗡</Slot>
          <Slot keyName="3" label="BOW" active={hud.weapon === 'bow'}>🏹</Slot>
        </div>
        <div className="flex gap-2">
          <Slot keyName="Q" label="WAR CRY" cd={hud.cd.cry} max={COOLDOWNS.cry}>📣</Slot>
          <Slot keyName="E" label="CHARGE" cd={hud.cd.charge} max={COOLDOWNS.charge}>☄</Slot>
          <Slot keyName="R" label="SLAM" cd={hud.cd.slam} max={COOLDOWNS.slam}>✺</Slot>
        </div>
        <div className="flex gap-2">
          <Slot keyName="G" label="RECRUIT" cost={COSTS.recruit} dim={hud.ember < COSTS.recruit}>🛡</Slot>
          <Slot keyName="B" label="WAR-HORN" cost={COSTS.horn} cd={hud.cd.horn} max={COOLDOWNS.horn} dim={hud.ember < COSTS.horn}>📯</Slot>
          <Slot keyName="O" label="EMBER RITE" cost={COSTS.rite} dim={hud.ember < COSTS.rite} active={hud.summoning}>🐉</Slot>
        </div>
      </div>

      {hud.riding && (
        <div className="absolute left-1/2 -translate-x-1/2 narration" style={{ bottom: 110, color: '#ffd9a8', fontSize: '1.05rem' }}>
          <kbd>W</kbd> fly · <kbd>Shift</kbd> dive-speed · <kbd>Space</kbd>/<kbd>Ctrl</kbd> climb/descend · <kbd>LMB</kbd> dragonfire · <kbd>P</kbd> dismount
        </div>
      )}

      {showHelp && (
        <div className="absolute left-5 bottom-5 glass p-4 rounded-sm" style={{ width: 250, animation: 'fadeUp 0.6s ease both' }}>
          <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.3em', fontSize: 10, color: '#ffd98a', marginBottom: 8 }}>COMMANDS</div>
          <div className="grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: 'auto 1fr', fontSize: 11, color: 'rgba(241,227,196,0.85)' }}>
            {HELP.map(([k, v]) => (
              <div key={k} className="contents">
                <kbd style={{ justifySelf: 'start' }}>{k}</kbd>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!locked && !captured && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '38%', fontFamily: 'var(--font-display)', letterSpacing: '0.35em', fontSize: 12, color: 'rgba(255,227,163,0.8)', animation: 'flicker 2s infinite' }}>
          CLICK TO TAKE COMMAND
        </div>
      )}
    </div>
  );
}
