import type { CSSProperties } from 'react';

export type TitleStage = 'hidden' | 'slam' | 'lifted' | 'static';

const TITLE = 'AGE OF KINGS';

/**
 * The game title. `slam` plays the trailer-style entrance, `lifted` moves it up into the menu
 * header position, `static` fades it straight into the header (returning visitors).
 */
export function TitleBlock({ stage }: { stage: TitleStage }) {
  const lifted = stage === 'lifted' || stage === 'static';
  const wrap: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: lifted ? '17%' : '45%',
    transform: `translate(-50%, -50%) scale(${lifted ? 0.58 : 1})`,
    transition: stage === 'static' ? 'none' : 'top 1.8s cubic-bezier(0.7,0,0.2,1), transform 1.8s cubic-bezier(0.7,0,0.2,1)',
    opacity: stage === 'hidden' ? 0 : 1,
    pointerEvents: 'none',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    zIndex: 30,
  };
  const animate = stage === 'slam';
  return (
    <div style={wrap}>
      <div className={stage === 'static' ? 'anim-fade-up' : undefined}>
      {animate && (
        <>
          <div
            style={{
              position: 'absolute', left: '50%', top: '50%', width: '40vw', height: '40vw', borderRadius: '50%',
              border: '10px solid rgba(255,220,160,0.9)', boxShadow: '0 0 60px rgba(255,180,80,0.8), inset 0 0 60px rgba(255,180,80,0.6)',
              animation: 'shockwave 1.6s cubic-bezier(0.1,0.7,0.2,1) 0.3s both',
            }}
          />
          <div
            style={{
              position: 'absolute', left: '50%', top: '50%', width: '26vw', height: '26vw', borderRadius: '50%',
              border: '3px solid rgba(255,120,60,0.9)', animation: 'shockwave 2.2s cubic-bezier(0.1,0.7,0.2,1) 0.45s both',
            }}
          />
        </>
      )}
      <div style={{ animation: animate ? 'shake 0.55s ease-out 0.62s both' : undefined }}>
        <h1
          className="gold-text"
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2.8rem, 9.5vw, 9.5rem)', lineHeight: 1,
            letterSpacing: '0.08em', margin: 0, filter: 'drop-shadow(0 0 28px rgba(255,170,60,0.45)) drop-shadow(0 6px 18px rgba(0,0,0,0.9))',
          }}
          aria-label={TITLE}
        >
          {TITLE.split('').map((ch, i) => (
            <span
              key={i}
              className="gold-text"
              style={{
                display: 'inline-block',
                minWidth: ch === ' ' ? '0.35em' : undefined,
                animation: animate ? `letterSlam 0.9s cubic-bezier(0.2,0.9,0.2,1) ${0.3 + Math.abs(i - 5.5) * 0.045}s both` : undefined,
              }}
            >
              {ch}
            </span>
          ))}
        </h1>
      </div>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', marginTop: '1.1rem',
          animation: animate ? 'fadeUp 1.4s cubic-bezier(0.2,0.8,0.2,1) 1.5s both' : undefined,
        }}
      >
        <span className="filigree" style={{ width: '14vw', maxWidth: 220 }} />
        <span style={{ position: 'relative', width: 26, height: 26 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, #fff3cf, #f5b83d 55%, #c0283a)', boxShadow: '0 0 18px #ff8a3a' }} />
          <span style={{ position: 'absolute', inset: 3, left: 7, borderRadius: '50%', background: '#050508' }} />
        </span>
        <span className="filigree" style={{ width: '14vw', maxWidth: 220 }} />
      </div>
      <div
        className="ember-text"
        style={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'clamp(0.9rem, 2.1vw, 1.9rem)', letterSpacing: '0.62em',
          marginTop: '0.9rem', paddingLeft: '0.62em',
          animation: animate ? 'bannerIn 1.8s cubic-bezier(0.2,0.8,0.2,1) 1.7s both' : undefined,
        }}
      >
        THE ENDLESS ECLIPSE
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(0.6rem, 1vw, 0.85rem)', letterSpacing: '0.5em', paddingLeft: '0.5em',
          marginTop: '1.1rem', color: '#ffe9c2', fontWeight: 700, textShadow: '0 0 6px #000, 0 0 14px #000, 0 2px 4px #000',
          animation: animate ? 'fadeIn 1.6s ease 3s both' : undefined,
        }}
      >
        A GAME BY YASHRAJ GHEMUD
      </div>
      </div>
    </div>
  );
}
