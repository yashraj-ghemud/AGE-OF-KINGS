import * as THREE from 'three';
import { rng } from '../lib/math';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

/** Ashlar stone blocks with mortar lines. Used as colour multiplier + bump. */
export function stoneTexture() {
  const key = 'stone';
  if (cache.has(key)) return cache.get(key)!;
  const S = 512;
  const [c, g] = canvas(S, S);
  const r = rng(77);
  g.fillStyle = '#6e6a64';
  g.fillRect(0, 0, S, S);
  const rows = 8;
  const rh = S / rows;
  for (let y = 0; y < rows; y++) {
    const cols = 4;
    const cw = S / cols;
    const off = (y % 2) * cw * 0.5;
    for (let x = -1; x <= cols; x++) {
      const tone = 180 + Math.floor(r() * 60);
      g.fillStyle = `rgb(${tone},${tone - 4},${tone - 10})`;
      const bx = x * cw + off + 3;
      const by = y * rh + 3;
      g.fillRect(bx, by, cw - 6, rh - 6);
      // chips and weathering
      for (let k = 0; k < 40; k++) {
        const t = tone - 30 + Math.floor(r() * 60);
        g.fillStyle = `rgba(${t},${t},${t - 6},0.35)`;
        g.fillRect(bx + r() * (cw - 8), by + r() * (rh - 8), 2 + r() * 6, 1 + r() * 4);
      }
      const grad = g.createLinearGradient(0, by, 0, by + rh);
      grad.addColorStop(0, 'rgba(255,255,255,0.08)');
      grad.addColorStop(1, 'rgba(0,0,0,0.18)');
      g.fillStyle = grad;
      g.fillRect(bx, by, cw - 6, rh - 6);
    }
  }
  // soot / moss streaks
  for (let k = 0; k < 90; k++) {
    g.fillStyle = `rgba(20,18,16,${0.04 + r() * 0.08})`;
    g.fillRect(r() * S, r() * S, 1 + r() * 3, 20 + r() * 80);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

export type BannerKind = 'royal' | 'traitor' | 'eclipse';

/** Swallow-tailed heraldic banner with emblem, drawn to canvas. */
export function bannerTexture(kind: BannerKind) {
  const key = 'banner-' + kind;
  if (cache.has(key)) return cache.get(key)!;
  const W = 256;
  const H = 512;
  const [c, g] = canvas(W, H);
  const field = kind === 'royal' ? ['#1d3f9e', '#12296b'] : kind === 'traitor' ? ['#8e1622', '#4a0a12'] : ['#1a1016', '#07050a'];
  const trimCol = kind === 'royal' ? '#f5c451' : kind === 'traitor' ? '#1a1012' : '#c0283a';

  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W, H);
  g.lineTo(W / 2, H * 0.84);
  g.lineTo(0, H);
  g.closePath();
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, field[0]);
  grad.addColorStop(1, field[1]);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = trimCol;
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = kind === 'royal' ? '#fff0c0' : '#c0283a';
  g.strokeRect(22, 22, W - 44, H * 0.62);

  const cx = W / 2;
  const cy = H * 0.36;
  if (kind === 'royal') {
    // the Sun of Suryagarh
    g.fillStyle = '#f5c451';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r0 = 46;
      const r1 = i % 2 ? 76 : 92;
      g.beginPath();
      g.moveTo(cx + Math.cos(a - 0.12) * r0, cy + Math.sin(a - 0.12) * r0);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a + 0.12) * r0, cy + Math.sin(a + 0.12) * r0);
      g.fill();
    }
    g.beginPath();
    g.arc(cx, cy, 44, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1d3f9e';
    g.beginPath();
    g.arc(cx, cy, 30, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f5c451';
    g.beginPath();
    g.arc(cx, cy, 20, 0, Math.PI * 2);
    g.fill();
  } else {
    // the black eclipse of Kaalrath
    g.fillStyle = kind === 'traitor' ? '#ffb070' : '#ff4a3a';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r1 = 70 + (i % 3) * 14;
      g.beginPath();
      g.moveTo(cx + Math.cos(a - 0.05) * 50, cy + Math.sin(a - 0.05) * 50);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a + 0.05) * 50, cy + Math.sin(a + 0.05) * 50);
      g.fill();
    }
    g.fillStyle = '#050305';
    g.beginPath();
    g.arc(cx, cy, 54, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = kind === 'traitor' ? '#ffb070' : '#ff4a3a';
    g.lineWidth = 4;
    g.stroke();
    // fangs
    g.fillStyle = '#050305';
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 34;
      g.beginPath();
      g.moveTo(x, H * 0.62);
      g.lineTo(x + 12, H * 0.72);
      g.lineTo(x + 24, H * 0.62);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/** Radial soft sprite for glows / clouds. */
export function softSprite(key = 'soft', inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  if (cache.has(key)) return cache.get(key)!;
  const S = 128;
  const [c, g] = canvas(S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  cache.set(key, tex);
  return tex;
}

/** Puffy cloud texture made of layered soft blobs. */
export function cloudTexture(seed = 3) {
  const key = 'cloud-' + seed;
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const [c, g] = canvas(S, S);
  const r = rng(seed);
  for (let i = 0; i < 38; i++) {
    const x = S * (0.2 + r() * 0.6);
    const y = S * (0.3 + r() * 0.45);
    const rad = S * (0.08 + r() * 0.16);
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.16 + r() * 0.2;
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  const tex = new THREE.CanvasTexture(c);
  cache.set(key, tex);
  return tex;
}

/** Glowing ember veins used for dragons / obsidian / the egg. */
export function veinTexture(seed = 9) {
  const key = 'vein-' + seed;
  if (cache.has(key)) return cache.get(key)!;
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const r = rng(seed);
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = r() * S;
    let y = r() * S;
    let a = r() * Math.PI * 2;
    g.strokeStyle = `rgba(255,${120 + Math.floor(r() * 90)},40,${0.5 + r() * 0.5})`;
    g.lineWidth = 1 + r() * 2.5;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      a += (r() - 0.5) * 1.3;
      x += Math.cos(a) * 9;
      y += Math.sin(a) * 9;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
