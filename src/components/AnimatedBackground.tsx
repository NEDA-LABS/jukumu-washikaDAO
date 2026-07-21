'use client';

import { useEffect, useRef } from 'react';

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
}

/**
 * Theme-aware animated gradient field. Warm gold/terracotta orbs drift across a
 * base that matches the active theme, so the hero looks distinct in light vs dark.
 */
export default function AnimatedBackground({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let w = 0;
    let h = 0;
    let orbs: Orb[] = [];
    const isDark = () => document.documentElement.classList.contains('dark');

    const resize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      init();
    };

    const init = () => {
      orbs = Array.from({ length: 6 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.min(w, h) * (0.28 + Math.random() * 0.22),
        opacity: 0.16 + Math.random() * 0.14,
      }));
    };

    // Warm brand palette (orange / gold / terracotta)
    const COLORS = [
      [228, 162, 51],  // gold
      [209, 98, 43],   // terracotta
      [246, 192, 72],  // light gold
      [201, 126, 34],  // deep gold
      [184, 83, 31],   // burnt orange
      [124, 63, 20],   // brown
    ];

    const draw = () => {
      if (w === 0 || h === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const dark = isDark();

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = dark ? '#141210' : '#f5f1ea';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = dark ? 'lighter' : 'multiply';
      orbs.forEach((orb, i) => {
        const [r, g, b] = COLORS[i % COLORS.length];
        const op = dark ? orb.opacity : orb.opacity * 0.55;
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        grad.addColorStop(0, `rgba(${r},${g},${b},${op})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -orb.r) orb.x = w + orb.r;
        if (orb.x > w + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = h + orb.r;
        if (orb.y > h + orb.r) orb.y = -orb.r;
      });
      ctx.globalCompositeOperation = 'source-over';

      // Fine mesh grid
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.028)' : 'rgba(31,27,22,0.045)';
      ctx.lineWidth = 1;
      const step = Math.round(Math.min(w, h) / 12);
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Vignette
      const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, dark ? 'rgba(0,0,0,0.5)' : 'rgba(120,80,30,0.10)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ display: 'block' }}
    />
  );
}
