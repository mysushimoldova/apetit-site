"use client";
// Макет картинки для соцсетей 1200×630 (Open Graph / Twitter): кремовый фон,
// фирменные контурные линии, крупно APETIT, под ним город, снизу жёлтая
// полоса. Только для разработки: scripts/og-images.mjs снимает его
// в public/og/*.png. Линии — та же формула, что в шейдере
// src/motion/layers/contours.ts, посчитанная на CPU для одного кадра
// (t = 0) с настройками из src/config/motion.json.
import { useEffect, useRef } from "react";
import type { BackgroundSettings } from "@/motion/config-schema";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const RGB = {
  ash: [167, 158, 149],
  smoke: [122, 113, 106],
  sand: [234, 226, 213],
};

const WAVES: [number, number, number, number][] = [
  [1, 0, 0.7, 0.95],
  [0, 1, 2.1, 0.8],
  [1, 1, 4.0, 0.55],
  [2, -1, 1.2, 0.4],
  [-1, 2, 5.4, 0.36],
  [2, 2, 3.3, 0.26],
  [3, -1, 0.4, 0.2],
  [-2, 3, 2.7, 0.18],
  [3, 2, 5.9, 0.14],
  [-3, 1, 1.8, 0.13],
];

function field(x: number, y: number): number {
  let v = 0;
  for (const [nx, ny, ph, a] of WAVES) {
    v += a * Math.sin(6.2831853 * (nx * x + ny * y) + ph);
  }
  return v * 3.2;
}

/** Рисует контурные линии на холсте — как шейдер, пиксель за пикселем. */
export function drawContours(
  ctx: CanvasRenderingContext2D,
  settings: BackgroundSettings,
): void {
  const { width, height } = ctx.canvas;
  const image = ctx.createImageData(width, height);
  const [r, g, b] = RGB[settings.color];
  const scale = settings.scale;
  const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  for (let py = 0; py < height; py++) {
    // gl_FragCoord.y считается снизу
    const y = (height - py) / scale;
    for (let px = 0; px < width; px++) {
      const x = px / scale;
      const v = field(x, y);
      const gx = Math.abs(field(x + 1 / scale, y) - v);
      const gy = Math.abs(field(x, y + 1 / scale) - v);
      const w = gx + gy;
      const gap = Math.abs(v - Math.floor(v) - 0.5);
      const line = 1 - smooth(gap / (settings.width * w));
      const i = (py * width + px) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = Math.round(255 * line * settings.opacity);
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function OgCard({
  city,
  settings,
}: {
  /** Название города; без него — общая картинка */
  city?: string;
  settings: BackgroundSettings;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    drawContours(ctx, settings);
    canvas.current?.setAttribute("data-ready", "");
  }, [settings]);

  return (
    <div
      className="og-card"
      style={{ width: OG_WIDTH, height: OG_HEIGHT }}
      data-og-card
    >
      <canvas
        ref={canvas}
        width={OG_WIDTH}
        height={OG_HEIGHT}
        className="og-card-lines"
        aria-hidden="true"
      />
      <div className="og-card-text" translate="no">
        <span className="og-card-brand">APETIT</span>
        {city && <span className="og-card-city">{city}</span>}
      </div>
      <div className="og-card-bar" aria-hidden="true" />
    </div>
  );
}
