import { useEffect, useRef } from 'react';

/** Ember cursor with a lagging ring. Hidden while the pointer is locked (in battle). */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const pos = { x: -100, y: -100 };
    const lag = { x: -100, y: -100 };
    let big = 0;
    let target = 0;
    let raf = 0;
    const move = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      const el = e.target as HTMLElement | null;
      target = el && el.closest('button, a, [data-hover]') ? 1 : 0;
    };
    const loop = () => {
      lag.x += (pos.x - lag.x) * 0.18;
      lag.y += (pos.y - lag.y) * 0.18;
      big += (target - big) * 0.15;
      const hidden = !!document.pointerLockElement;
      if (dot.current) {
        dot.current.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
        dot.current.style.opacity = hidden ? '0' : '1';
      }
      if (ring.current) {
        const s = 1 + big * 0.9;
        ring.current.style.transform = `translate(${lag.x}px, ${lag.y}px) translate(-50%, -50%) scale(${s})`;
        ring.current.style.opacity = hidden ? '0' : String(0.55 + big * 0.4);
      }
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('pointermove', move);
    raf = requestAnimationFrame(loop);
    document.body.style.cursor = 'none';
    const style = document.createElement('style');
    style.textContent = '*{cursor:none !important}';
    document.head.appendChild(style);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      document.body.style.cursor = '';
      style.remove();
    };
  }, []);
  return (
    <>
      <div
        ref={ring}
        className="fixed left-0 top-0 pointer-events-none"
        style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,217,138,0.8)', zIndex: 1000, boxShadow: '0 0 12px rgba(255,160,60,0.35)' }}
      />
      <div
        ref={dot}
        className="fixed left-0 top-0 pointer-events-none"
        style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff1c6', zIndex: 1001, boxShadow: '0 0 10px #ff9a3a, 0 0 22px #ff6a1f' }}
      />
    </>
  );
}
