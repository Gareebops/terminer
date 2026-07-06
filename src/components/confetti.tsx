"use client";

import { useEffect, useRef } from "react";

// Jednokratni rafal konfeta preko celog ekrana (canvas, bez zavisnosti).
// Renderuje se pri montiranju; poštuje prefers-reduced-motion.

const COLORS = ["#A6F5A6", "#B7A9F2", "#17181A", "#7BE07B", "#9C8BEA"];

export function ConfettiBurst({ duration = 2800 }: { duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const parts = Array.from({ length: 160 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.35,
      y: h * 0.55,
      vx: (Math.random() - 0.5) * 11,
      vy: -(6 + Math.random() * 10),
      size: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
    }));

    let raf = 0;
    const start = performance.now();
    function tick(t: number) {
      const elapsed = t - start;
      ctx!.clearRect(0, 0, w, h);
      const fade = Math.max(0, 1 - elapsed / duration);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.rot += p.vr;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.globalAlpha = fade;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
        ctx!.restore();
      }
      if (elapsed < duration) raf = requestAnimationFrame(tick);
      else ctx!.clearRect(0, 0, w, h);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100]"
    />
  );
}
