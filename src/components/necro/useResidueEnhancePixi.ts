'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';

interface EnhancePixiOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export interface EnhancePixiHandle {
  setFill: (current: number, preview: number) => void; // 0–1
  triggerInfusion: () => void;
}

interface Bubble {
  g: PIXI.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  maxAlpha: number;
}

export function useResidueEnhancePixi({ containerRef }: EnhancePixiOptions) {
  const appRef = useRef<PIXI.Application | null>(null);
  const handleRef = useRef<EnhancePixiHandle | null>(null);
  const mountedRef = useRef(true);
  const fillRef = useRef({ current: 0, preview: 0 });

  useEffect(() => {
    mountedRef.current = true;
    if (!containerRef.current) return;

    const GAUGE_H = 56;
    const PAD = 3;
    const RADIUS = 10;

    const init = async () => {
      const W = containerRef.current!.clientWidth || 320;

      const app = new PIXI.Application();
      try {
        await app.init({
          width: W,
          height: GAUGE_H,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        if (!mountedRef.current) { app.destroy(true, { children: true }); return; }
        appRef.current = app;
        containerRef.current!.appendChild(app.canvas);

        const resize = () => {
          if (!containerRef.current || !appRef.current) return;
          appRef.current.renderer.resize(containerRef.current.clientWidth, GAUGE_H);
        };
        const ro = new ResizeObserver(resize);
        ro.observe(containerRef.current!);

        const getW = () => appRef.current?.renderer.width ?? W;

        // Layers (back to front)
        const previewLayer = new PIXI.Graphics();
        const fillLayer = new PIXI.Graphics();
        const waveLayer = new PIXI.Graphics();
        const bubbleLayer = new PIXI.Container();
        const glassLayer = new PIXI.Graphics();
        const burstLayer = new PIXI.Container();

        app.stage.addChild(previewLayer);
        app.stage.addChild(fillLayer);
        app.stage.addChild(waveLayer);
        app.stage.addChild(bubbleLayer);
        app.stage.addChild(glassLayer);
        app.stage.addChild(burstLayer);

        // Tick-driven animated values
        let animCurrent = 0;
        let animPreview = 0;
        let wavePhase = 0;

        // Bubbles
        const bubbles: Bubble[] = Array.from({ length: 20 }, () => {
          const g = new PIXI.Graphics();
          bubbleLayer.addChild(g);
          return {
            g,
            x: Math.random() * getW(),
            y: GAUGE_H - PAD - Math.random() * (GAUGE_H - PAD * 2) * 0.6,
            vx: (Math.random() - 0.5) * 0.35,
            vy: -(Math.random() * 0.5 + 0.15),
            r: Math.random() * 2.5 + 1,
            alpha: 0,
            maxAlpha: Math.random() * 0.45 + 0.1,
          };
        });

        const drawFillPath = (
          g: PIXI.Graphics,
          fillRatio: number,
          color: number,
          alpha: number,
          withWave: boolean,
        ) => {
          const w = getW();
          if (fillRatio <= 0.005) return;
          const innerW = w - PAD * 2;
          const innerH = GAUGE_H - PAD * 2;
          const fillX = PAD + innerW * Math.min(1, fillRatio);

          g.clear();

          if (!withWave || fillRatio >= 0.99) {
            g.roundRect(PAD, PAD, fillX - PAD, innerH, RADIUS)
              .fill({ color, alpha });
            return;
          }

          // Build fill with sine-wave right edge
          const waveAmp = 4 * Math.min(1, fillRatio * 6); // ramps up from near-empty
          g.moveTo(PAD, PAD);
          g.lineTo(fillX, PAD);
          for (let y = PAD; y <= PAD + innerH; y += 2) {
            const wx = fillX + Math.sin((y * 0.38) + wavePhase) * waveAmp;
            g.lineTo(wx, y);
          }
          g.lineTo(PAD, PAD + innerH);
          g.closePath();
          g.fill({ color, alpha });
        };

        const drawWaveHighlight = (fillRatio: number) => {
          const w = getW();
          if (fillRatio <= 0.01 || fillRatio >= 0.99) { waveLayer.clear(); return; }
          const innerW = w - PAD * 2;
          const innerH = GAUGE_H - PAD * 2;
          const fillX = PAD + innerW * fillRatio;
          const waveAmp = 4 * Math.min(1, fillRatio * 6);

          waveLayer.clear();
          waveLayer.moveTo(fillX + Math.sin(PAD * 0.38 + wavePhase) * waveAmp, PAD);
          for (let y = PAD; y <= PAD + innerH; y += 2) {
            const wx = fillX + Math.sin((y * 0.38) + wavePhase) * waveAmp;
            waveLayer.lineTo(wx, y);
          }
          waveLayer.stroke({ color: 0xFF99FF, alpha: 0.75, width: 1.5 });
        };

        const drawGlass = () => {
          const w = getW();
          glassLayer.clear();
          // Outer neon ring
          glassLayer.roundRect(PAD - 1, PAD - 1, w - (PAD - 1) * 2, GAUGE_H - (PAD - 1) * 2, RADIUS + 1)
            .stroke({ color: 0x8B00FF, alpha: 0.65, width: 1.5 });
          // Inner border
          glassLayer.roundRect(PAD, PAD, w - PAD * 2, GAUGE_H - PAD * 2, RADIUS)
            .stroke({ color: 0xCC88FF, alpha: 0.2, width: 0.8 });
          // Top specular strip
          glassLayer.roundRect(PAD + 5, PAD + 3, (w - PAD * 2) * 0.4, 5, 3)
            .fill({ color: 0xFFFFFF, alpha: 0.05 });
          // Tick marks (10%)
          for (let i = 1; i <= 9; i++) {
            const x = PAD + (w - PAD * 2) * i / 10;
            glassLayer.moveTo(x, GAUGE_H - PAD - 6).lineTo(x, GAUGE_H - PAD)
              .stroke({ color: 0xCC88FF, alpha: 0.18, width: 0.5 });
          }
        };

        drawGlass();

        // Burst particles
        const burstParticles: { g: PIXI.Graphics; x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: number }[] = [];
        let burstTicker: (() => void) | null = null;

        const ensureBurstTicker = () => {
          if (burstTicker) return;
          const fn = () => {
            for (let i = burstParticles.length - 1; i >= 0; i--) {
              const p = burstParticles[i];
              p.life--;
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.05; // gravity
              p.g.clear();
              if (p.life <= 0) {
                burstLayer.removeChild(p.g);
                burstParticles.splice(i, 1);
              } else {
                const a = (p.life / p.maxLife) * 0.9;
                p.g.circle(p.x, p.y, 2.5).fill({ color: p.color, alpha: a });
              }
            }
            if (burstParticles.length === 0 && burstTicker) {
              app.ticker.remove(burstTicker);
              burstTicker = null;
            }
          };
          burstTicker = fn;
          app.ticker.add(fn);
        };

        // Main ticker
        app.ticker.add(() => {
          wavePhase += 0.045;

          // Smooth lerp toward targets
          animCurrent += (fillRef.current.current - animCurrent) * 0.07;
          animPreview += (fillRef.current.preview - animPreview) * 0.07;

          // Preview fill (lighter, behind)
          previewLayer.clear();
          drawFillPath(previewLayer, animPreview, 0x5500AA, 0.28, false);

          // Main liquid fill
          fillLayer.clear();
          drawFillPath(fillLayer, animCurrent, 0x7700CC, 0.82, true);

          // Bright inner gradient (top half of fill)
          if (animCurrent > 0.01) {
            const w = getW();
            const fillX = PAD + (w - PAD * 2) * Math.min(1, animCurrent);
            fillLayer.roundRect(PAD, PAD, fillX - PAD, (GAUGE_H - PAD * 2) * 0.45, RADIUS)
              .fill({ color: 0xBB44FF, alpha: 0.25 });
          }

          drawWaveHighlight(animCurrent);
          drawGlass();

          // Bubbles
          const fillX = PAD + (getW() - PAD * 2) * animCurrent;
          bubbles.forEach(b => {
            const insideFill = b.x < fillX - b.r && b.y > PAD + 2 && b.y < GAUGE_H - PAD;
            b.alpha = insideFill
              ? Math.min(b.maxAlpha, b.alpha + 0.03)
              : Math.max(0, b.alpha - 0.06);
            b.y += b.vy;
            b.x += b.vx;
            if (b.y < PAD + 2 || !insideFill) {
              b.y = GAUGE_H - PAD - Math.random() * (GAUGE_H - PAD * 2) * 0.5 * animCurrent;
              b.x = PAD + Math.random() * fillX * 0.9;
            }
            b.g.clear();
            if (b.alpha > 0.01) {
              b.g.circle(b.x, b.y, b.r).fill({ color: 0xDD99FF, alpha: b.alpha });
              b.g.circle(b.x, b.y, b.r).stroke({ color: 0xFFFFFF, alpha: b.alpha * 0.4, width: 0.5 });
            }
          });
        });

        handleRef.current = {
          setFill: (current, preview) => {
            fillRef.current = { current: Math.max(0, Math.min(1, current)), preview: Math.max(0, Math.min(1, preview)) };
          },
          triggerInfusion: () => {
            const w = getW();
            const centerX = PAD + (w - PAD * 2) * animCurrent;
            const colors = [0xBC00FB, 0xFF88FF, 0xFFFFFF, 0x8800DD];
            for (let i = 0; i < 28; i++) {
              const g = new PIXI.Graphics();
              burstLayer.addChild(g);
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 3 + 1;
              burstParticles.push({
                g,
                x: centerX + (Math.random() - 0.5) * 20,
                y: GAUGE_H / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                life: Math.floor(Math.random() * 25 + 20),
                maxLife: 45,
                color: colors[Math.floor(Math.random() * colors.length)],
              });
            }
            ensureBurstTicker();
          },
        };

        return () => ro.disconnect();
      } catch (e) {
        console.error('EnhancePixi init error:', e);
      }
    };

    const cleanups: (() => void)[] = [];
    init().then(fn => { if (fn) cleanups.push(fn); });

    return () => {
      mountedRef.current = false;
      cleanups.forEach(f => f());
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      handleRef.current = null;
    };
  }, [containerRef]);

  const getHandle = useCallback(() => handleRef.current, []);
  return { getHandle };
}
