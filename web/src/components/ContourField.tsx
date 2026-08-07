import { useEffect, useRef } from 'react';

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number): number {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; }
  return s;
}

const LEVELS = [0.31, 0.37, 0.43, 0.49, 0.55, 0.61, 0.67, 0.73];

export function ContourField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let W = 0, H = 0;
    const CELL = 15;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const paint = (t: number) => {
      const gc = Math.ceil(W / CELL), gr = Math.ceil(H / CELL);
      const g: number[][] = [];
      for (let j = 0; j <= gr; j++) {
        g[j] = [];
        for (let i = 0; i <= gc; i++) g[j][i] = fbm(i * 0.048 + t, j * 0.048 - t * 0.5);
      }
      ctx.clearRect(0, 0, W, H);
      LEVELS.forEach((L, li) => {
        const major = li % 4 === 0;
        ctx.beginPath();
        ctx.lineWidth = major ? 1.5 : 0.9;
        ctx.strokeStyle = major ? 'rgba(201,79,50,0.34)' : 'rgba(201,79,50,0.16)';
        for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) {
          const x = i * CELL, y = j * CELL;
          const v0 = g[j][i], v1 = g[j][i + 1], v2 = g[j + 1][i + 1], v3 = g[j + 1][i];
          const idx = (v0 > L ? 8 : 0) | (v1 > L ? 4 : 0) | (v2 > L ? 2 : 0) | (v3 > L ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const tp: [number, number] = [x + CELL * (L - v0) / (v1 - v0), y];
          const rp: [number, number] = [x + CELL, y + CELL * (L - v1) / (v2 - v1)];
          const bp: [number, number] = [x + CELL * (L - v3) / (v2 - v3), y + CELL];
          const lp: [number, number] = [x, y + CELL * (L - v0) / (v3 - v0)];
          const seg = (p: [number, number], q: [number, number]) => {
            ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
          };
          switch (idx) {
            case 1: case 14: seg(lp, bp); break;
            case 2: case 13: seg(bp, rp); break;
            case 3: case 12: seg(lp, rp); break;
            case 4: case 11: seg(tp, rp); break;
            case 6: case 9:  seg(tp, bp); break;
            case 7: case 8:  seg(tp, lp); break;
            case 5:  seg(tp, lp); seg(bp, rp); break;
            case 10: seg(tp, rp); seg(lp, bp); break;
          }
        }
        ctx.stroke();
      });
    };

    const t0 = performance.now();
    let last = 0;
    const loop = (now: number) => {
      if (now - last > 55) { last = now; paint((now - t0) / 30000); }
      raf = requestAnimationFrame(loop);
    };

    size();
    paint(0);
    if (!reduce) raf = requestAnimationFrame(loop);
    const onResize = () => { size(); paint(0); };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 w-full h-full" />;
}
