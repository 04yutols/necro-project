'use client';

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Trophy, ArrowRight, Package, User } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

interface ResultScreenProps {
  isVictory: boolean;
  expGained: number;
  itemsGained: string[];
  monstersGained: string[];
  onFinish: () => void;
}

export default function ResultScreen({ isVictory, expGained, itemsGained, monstersGained, onFinish }: ResultScreenProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [showButton, setShowButton] = useState(false);
  const { player, addExp } = useGameStore();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!canvasRef.current || !player) return;

    const initPixi = async () => {
      const app = new PIXI.Application();
      try {
        await app.init({
          width: 800,
          height: 400,
          backgroundColor: 0x050505,
          antialias: true,
        });
        
        if (!mountedRef.current) {
          app.destroy(true, { children: true });
          return;
        }

        appRef.current = app;
        canvasRef.current?.appendChild(app.canvas);

        await playAnimations(app);
      } catch (e) {
        console.error("PixiJS init error:", e);
      }
    };

    initPixi();

    return () => {
      mountedRef.current = false;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  const playAnimations = async (app: PIXI.Application) => {
    if (!mountedRef.current || !app.stage) return;

    // 1. Victory/Defeat Banner
    await showBanner(app);
    
    // 2. EXP Bar Animation
    if (mountedRef.current) await animateExpBar(app);

    // 3. Drop Items Popups
    if (mountedRef.current) await showDrops(app);

    // 4. Show Finish Button
    if (mountedRef.current) {
      setShowButton(true);
      addExp(expGained);
    }
  };

  const showBanner = async (app: PIXI.Application) => {
    if (!mountedRef.current || !app.stage || app.renderer === null) return;
    const container = new PIXI.Container();
    app.stage.addChild(container);

    const style = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 64,
      fill: isVictory ? '#ffd700' : '#FF00FF',
      fontWeight: 'bold',
      dropShadow: { color: '#000000', blur: 4, distance: 4 },
    });

    const text = new PIXI.Text({ text: isVictory ? 'VICTORY' : 'DEFEAT', style });
    text.anchor.set(0.5);
    text.x = 400;
    text.y = -100;
    container.addChild(text);

    // Slide down animation
    let y = -100;
    while (y < 100 && mountedRef.current && !text.destroyed) {
      y += 10;
      text.y = y;
      await new Promise(r => setTimeout(r, 16));
    }

    if (!mountedRef.current || !app.stage || app.renderer === null) return;

    // Flash effect
    const graphics = new PIXI.Graphics();
    graphics.rect(0, 0, 800, 400);
    graphics.fill({ color: 0xffffff, alpha: 0.5 });
    app.stage.addChild(graphics);
    
    let alpha = 0.5;
    while (alpha > 0 && mountedRef.current && !graphics.destroyed) {
      alpha -= 0.05;
      graphics.alpha = alpha;
      await new Promise(r => setTimeout(r, 16));
    }
    
    if (mountedRef.current && !graphics.destroyed && !app.renderer === null) {
      app.stage.removeChild(graphics);
      graphics.destroy();
    }
  };

  const animateExpBar = async (app: PIXI.Application) => {
    if (!mountedRef.current || !app.stage || app.renderer === null) return;
    const currentJob = player?.jobs.find(j => j.jobId === player.currentJobId);
    if (!currentJob) return;

    const container = new PIXI.Container();
    container.y = 200;
    app.stage.addChild(container);

    const label = new PIXI.Text({ 
      text: `EXP GAINED: +${expGained}`, 
      style: { fontFamily: 'monospace', fontSize: 20, fill: '#ffffff' } 
    });
    label.x = 100;
    container.addChild(label);

    const bgBar = new PIXI.Graphics();
    bgBar.rect(100, 40, 600, 20);
    bgBar.fill({ color: 0x333333 });
    container.addChild(bgBar);

    const fillBar = new PIXI.Graphics();
    container.addChild(fillBar);

    const duration = 1000; 
    const startTime = Date.now();

    return new Promise<void>((resolve) => {
      const ticker = () => {
        if (!mountedRef.current || fillBar.destroyed || !app.renderer) {
          app.ticker.remove(ticker);
          resolve();
          return;
        }

        const now = Date.now();
        const progress = Math.min(1, (now - startTime) / duration);
        
        try {
          fillBar.clear();
          fillBar.rect(100, 40, 600 * progress, 20);
          fillBar.fill({ color: 0x00ff00 });
        } catch (e) {
          console.error("EXP Bar animation error:", e);
          app.ticker.remove(ticker);
          resolve();
          return;
        }

        if (progress >= 1) {
          app.ticker.remove(ticker);
          resolve();
        }
      };
      app.ticker.add(ticker);
    });
  };

  const showDrops = async (app: PIXI.Application) => {
    if (!mountedRef.current || !app.stage || app.renderer === null) return;
    const allDrops = [...itemsGained, ...monstersGained];
    for (let i = 0; i < allDrops.length; i++) {
      if (!mountedRef.current || !app.stage || app.renderer === null) break;
      
      const dropText = new PIXI.Text({ 
        text: `GET: ${allDrops[i]}`, 
        style: { fontFamily: 'monospace', fontSize: 18, fill: '#ffd700' } 
      });
      dropText.x = 100 + (i % 3) * 200;
      dropText.y = 300 + Math.floor(i / 3) * 30;
      dropText.alpha = 0;
      dropText.scale.set(2);
      app.stage.addChild(dropText);

      let alpha = 0;
      let scale = 2;
      while (alpha < 1 && mountedRef.current && !dropText.destroyed) {
        alpha += 0.1;
        scale -= 0.1;
        dropText.alpha = alpha;
        dropText.scale.set(Math.max(1, scale));
        await new Promise(r => setTimeout(r, 16));
      }
    }
  };

  return (
    <div className="flex flex-col items-center bg-black/90 p-8 rounded-xl border-2 border-fuchsia shadow-2xl animate-in fade-in zoom-in duration-500">
      <div ref={canvasRef} className="rounded border border-gray-800 overflow-hidden" />
      
      {showButton && (
        <div className="mt-8 w-full flex justify-center animate-in slide-in-from-bottom-4 duration-500">
          <button 
            onClick={onFinish}
            className="flex items-center gap-3 px-12 py-4 bg-fuchsia hover:bg-fuchsia/80 text-white font-bold text-xl rounded-full border-2 border-fuchsia shadow-[0_0_20px_rgba(255,0,255,0.5)] transition-all active:scale-95"
          >
            <ArrowRight size={24} /> 拠点へ戻る
          </button>
        </div>
      )}
    </div>
  );
}
