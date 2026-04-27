'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';

interface LabPixiOptions {
  canvasContainer: React.RefObject<HTMLDivElement | null>;
  enabled?: boolean;
}

interface Bubble {
  g: PIXI.Graphics;
  x: number;
  y: number;
  vy: number;
  radius: number;
  alpha: number;
  wobble: number;
  wobbleSpeed: number;
  phase: number;
}

interface Particle {
  g: PIXI.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: number;
}

export interface LabPixiHandle {
  spawnSmokeDissolve: (cx: number, cy: number) => void;
  spawnSmokeReform: (cx: number, cy: number, onDone?: () => void) => void;
  spawnSoulChain: (fromX: number, fromY: number, toX: number, toY: number, onDone?: () => void) => void;
}

export function useNecroLabPixi({ canvasContainer, enabled = true }: LabPixiOptions) {
  const appRef = useRef<PIXI.Application | null>(null);
  const handleRef = useRef<LabPixiHandle | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!canvasContainer.current || !enabled) return;

    const init = async () => {
      const app = new PIXI.Application();
      try {
        await app.init({
          width: 400,
          height: 600,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        if (!mountedRef.current) { app.destroy(true, { children: true }); return; }

        appRef.current = app;
        canvasContainer.current!.appendChild(app.canvas);

        // ── Resize to fit container ──
        const resize = () => {
          if (!canvasContainer.current || !appRef.current) return;
          const { clientWidth, clientHeight } = canvasContainer.current;
          appRef.current.renderer.resize(clientWidth, clientHeight);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvasContainer.current!);

        // ── Magic circle layer ──
        const magicContainer = new PIXI.Container();
        app.stage.addChild(magicContainer);

        const drawMagicCircle = (container: PIXI.Container, cx: number, cy: number) => {
          container.removeChildren();
          const g = new PIXI.Graphics();

          // Outer ring
          g.circle(cx, cy, 110).stroke({ color: 0x5500CC, alpha: 0.35, width: 1.5 });

          // Inner ring
          g.circle(cx, cy, 80).stroke({ color: 0x8B00FF, alpha: 0.25, width: 1 });

          // Hexagram
          const hexPoints = Array.from({ length: 6 }, (_, i) => {
            const a = (i * Math.PI * 2) / 6 - Math.PI / 2;
            return { x: cx + Math.cos(a) * 100, y: cy + Math.sin(a) * 100 };
          });
          // Two overlapping triangles
          [0, 1].forEach(offset => {
            g.moveTo(hexPoints[offset * 2].x, hexPoints[offset * 2].y);
            g.lineTo(hexPoints[offset * 2 + 2].x, hexPoints[offset * 2 + 2].y);
            g.lineTo(hexPoints[offset * 2 + 4].x, hexPoints[offset * 2 + 4].y);
            g.lineTo(hexPoints[offset * 2].x, hexPoints[offset * 2].y);
            g.stroke({ color: 0x8B00FF, alpha: 0.2, width: 1 });
          });

          // Rune dots
          for (let i = 0; i < 12; i++) {
            const a = (i * Math.PI * 2) / 12;
            g.circle(cx + Math.cos(a) * 107, cy + Math.sin(a) * 107, 2).fill({ color: 0xBC00FB, alpha: 0.5 });
          }

          container.addChild(g);
          container.pivot.set(cx, cy);
          container.x = cx;
          container.y = cy;
        };

        // ── Bubbles layer ──
        const bubbleContainer = new PIXI.Container();
        app.stage.addChild(bubbleContainer);

        const W = 400, H = 600;
        const CIRCLE_CX = W / 2, CIRCLE_CY = H * 0.38;
        drawMagicCircle(magicContainer, CIRCLE_CX, CIRCLE_CY);

        const bubbles: Bubble[] = [];
        for (let i = 0; i < 22; i++) {
          const r = Math.random() * 6 + 3;
          const g = new PIXI.Graphics();
          bubbleContainer.addChild(g);
          bubbles.push({
            g,
            x: Math.random() * W,
            y: H + Math.random() * H,
            vy: Math.random() * 0.6 + 0.2,
            radius: r,
            alpha: Math.random() * 0.35 + 0.1,
            wobble: Math.random() * 20 + 5,
            wobbleSpeed: Math.random() * 0.03 + 0.01,
            phase: Math.random() * Math.PI * 2,
          });
        }

        // ── Effects layer (on top) ──
        const effectContainer = new PIXI.Container();
        app.stage.addChild(effectContainer);

        // ── Ticker ──
        let tick = 0;
        app.ticker.add(() => {
          tick++;

          // Rotate magic circle slowly
          magicContainer.rotation += 0.002;

          // Update bubbles
          bubbles.forEach(b => {
            b.phase += b.wobbleSpeed;
            b.y -= b.vy;
            b.x += Math.sin(b.phase) * 0.4;
            if (b.y < -20) {
              b.y = H + 10;
              b.x = Math.random() * W;
            }
            b.g.clear();
            b.g.circle(b.x, b.y, b.radius).fill({ color: 0x8B00FF, alpha: b.alpha * 0.6 });
            b.g.circle(b.x, b.y, b.radius).stroke({ color: 0xCC88FF, alpha: b.alpha, width: 0.8 });
          });
        });

        // ── Effects API ──

        const activeParticles: Particle[] = [];
        let particleTicker: (() => void) | null = null;

        const ensureParticleTicker = () => {
          if (particleTicker) return;
          const fn = () => {
            for (let i = activeParticles.length - 1; i >= 0; i--) {
              const p = activeParticles[i];
              p.life--;
              p.y += p.vy;
              p.x += p.vx;
              p.alpha = (p.life / p.maxLife) * 0.8;
              p.g.clear();
              if (p.life <= 0) {
                effectContainer.removeChild(p.g);
                activeParticles.splice(i, 1);
              } else {
                p.g.circle(p.x, p.y, 3).fill({ color: p.color, alpha: p.alpha });
              }
            }
            if (activeParticles.length === 0 && particleTicker) {
              app.ticker.remove(particleTicker);
              particleTicker = null;
            }
          };
          particleTicker = fn;
          app.ticker.add(fn);
        };

        const spawnParticle = (x: number, y: number, vx: number, vy: number, life: number, color: number) => {
          const g = new PIXI.Graphics();
          effectContainer.addChild(g);
          const p: Particle = { g, x, y, vx, vy, alpha: 0.8, life, maxLife: life, color };
          activeParticles.push(p);
          ensureParticleTicker();
        };

        const spawnSmokeDissolve = (cx: number, cy: number) => {
          const count = 28;
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = Math.random() * 2.5 + 0.8;
            const col = [0x8B00FF, 0xBC00FB, 0xCC88FF, 0x5500CC][Math.floor(Math.random() * 4)];
            spawnParticle(
              cx + (Math.random() - 0.5) * 30,
              cy + (Math.random() - 0.5) * 30,
              Math.cos(angle) * speed,
              Math.sin(angle) * speed - 0.5,
              Math.floor(Math.random() * 25 + 20),
              col
            );
          }
        };

        const spawnSmokeReform = (cx: number, cy: number, onDone?: () => void) => {
          const count = 24;
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 80 + 30;
            const speed = 2.2;
            spawnParticle(
              cx + Math.cos(angle) * dist,
              cy + Math.sin(angle) * dist,
              -Math.cos(angle) * speed,
              -Math.sin(angle) * speed,
              Math.floor(Math.random() * 18 + 15),
              [0x8B00FF, 0xBC00FB, 0xFFFFFF][Math.floor(Math.random() * 3)]
            );
          }
          if (onDone) setTimeout(onDone, 400);
        };

        // Soul chain: draw a glowing line that grows from fromX,fromY to toX,toY
        const spawnSoulChain = (fromX: number, fromY: number, toX: number, toY: number, onDone?: () => void) => {
          const chainG = new PIXI.Graphics();
          effectContainer.addChild(chainG);
          let progress = 0;
          const onTick = () => {
            progress += 0.06;
            if (progress >= 1) {
              progress = 1;
              app.ticker.remove(onTick);
              // Flash then fade
              let fade = 1;
              const fadeTick = () => {
                fade -= 0.05;
                if (fade <= 0) {
                  app.ticker.remove(fadeTick);
                  effectContainer.removeChild(chainG);
                  onDone?.();
                  return;
                }
                chainG.clear();
                const mx = fromX + (toX - fromX) * progress;
                const my = fromY + (toY - fromY) * progress;
                chainG.moveTo(fromX, fromY).lineTo(mx, my)
                  .stroke({ color: 0xBC00FB, alpha: fade * 0.9, width: 2.5 });
                chainG.moveTo(fromX, fromY).lineTo(mx, my)
                  .stroke({ color: 0xFFFFFF, alpha: fade * 0.4, width: 0.8 });
                // End orb
                chainG.circle(mx, my, 5 * fade).fill({ color: 0xBC00FB, alpha: fade });
              };
              app.ticker.add(fadeTick);
              return;
            }
            const mx = fromX + (toX - fromX) * progress;
            const my = fromY + (toY - fromY) * progress;
            chainG.clear();
            chainG.moveTo(fromX, fromY).lineTo(mx, my)
              .stroke({ color: 0xBC00FB, alpha: 0.85, width: 2.5 });
            chainG.moveTo(fromX, fromY).lineTo(mx, my)
              .stroke({ color: 0xFFFFFF, alpha: 0.35, width: 0.8 });
            // Leading orb
            chainG.circle(mx, my, 5).fill({ color: 0xFFFFFF, alpha: 0.9 });
          };
          app.ticker.add(onTick);
        };

        handleRef.current = { spawnSmokeDissolve, spawnSmokeReform, spawnSoulChain };

        // Cleanup
        return () => {
          ro.disconnect();
        };
      } catch (e) {
        console.error('PixiJS Lab init error:', e);
      }
    };

    const cleanupFn: (() => void)[] = [];
    init().then(fn => { if (fn) cleanupFn.push(fn); });

    return () => {
      mountedRef.current = false;
      cleanupFn.forEach(f => f());
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      handleRef.current = null;
    };
  }, [canvasContainer, enabled]);

  const getHandle = useCallback(() => handleRef.current, []);
  return { getHandle };
}
