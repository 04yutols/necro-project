'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../../store/useGameStore';
import { BattleEngine } from '../../logic/BattleEngine';
import { BattleLog, MonsterData } from '../../types/game';
import { Sword, Sparkles } from 'lucide-react';
import ResultScreen from './ResultScreen';
import { MasterDataService } from '../../services/MasterDataService';
import { motion } from 'framer-motion';

interface BattleCanvasProps {
  onEnd: () => void;
}

export default function BattleCanvas({ onEnd }: BattleCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { player, party, updateMP, updateHP, actionTrigger, setActionTrigger } = useGameStore();
  const appRef = useRef<PIXI.Application | null>(null);
  const engineRef = useRef<BattleEngine | null>(null);
  const mountedRef = useRef(true);
  const masterData = MasterDataService.getInstance();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [battleResult, setBattleResult] = useState<{
    isVictory: boolean; expGained: number; itemsGained: string[]; monstersGained: string[];
  } | null>(null);
  
  const [target, setTarget] = useState<MonsterData & { stats: { maxHp: number } }>({
    id: 'target_1', name: 'スケルトン兵', tribe: 'UNDEAD', cost: 4,
    stats: { hp: 150, maxHp: 150, mp: 0, atk: 15, def: 5, matk: 0, mdef: 2, agi: 5, luck: 0, tec: 5 },
    resistances: { LIGHT: -50, DARK: 50 },
  });

  const currentJob = player?.jobs.find(j => j.jobId === player?.currentJobId);
  const availableSkills = currentJob && player
    ? (masterData.getJob(player.currentJobId)?.skills || [])
        .filter((s: any) => s.level <= currentJob.level)
        .map((s: any) => masterData.getSkill(s.skillId))
        .filter(Boolean)
    : [];

  const resize = useCallback(() => {
    if (!appRef.current || !containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    
    // Maintain 16:9 aspect ratio
    let w = clientWidth;
    let h = clientWidth * (9 / 16);
    if (h > clientHeight) {
      h = clientHeight;
      w = clientHeight * (16 / 9);
    }

    appRef.current.renderer.resize(w, h);
    appRef.current.stage.scale.set(w / 800);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!canvasRef.current || !player) return;

    const initPixi = async () => {
      const app = new PIXI.Application();
      try {
        await app.init({
          width: 800, height: 450, backgroundColor: 0x050505, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true
        });
        if (!mountedRef.current) { app.destroy(true, { children: true }); return; }
        appRef.current = app;
        canvasRef.current?.appendChild(app.canvas);
        engineRef.current = new BattleEngine(player, party);
        resize();
        window.addEventListener('resize', resize);
      } catch (e) { console.error("BattleCanvas init error:", e); }
    };
    initPixi();
    return () => {
      mountedRef.current = false;
      window.removeEventListener('resize', resize);
      if (appRef.current) { appRef.current.destroy(true, { children: true }); appRef.current = null; }
    };
  }, [player, party, resize]);

  useEffect(() => {
    if (actionTrigger && !isProcessing) {
      handleAction(actionTrigger.type, actionTrigger.skillId);
      setActionTrigger(null);
    }
  }, [actionTrigger, isProcessing, setActionTrigger]);

  const handleAction = async (type: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', skillId?: string) => {
    if (isProcessing || !engineRef.current || !appRef.current || !mountedRef.current) return;
    setIsProcessing(true);
    const logs = engineRef.current.simulateAction(type, target, skillId);
    for (const log of logs) {
      if (!mountedRef.current) break;
      await showLogAnimation(appRef.current, log);
      if (log.damage && log.targetName === target.name) {
        setTarget(prev => ({ ...prev, stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - (log.damage || 0)) } }));
      }
      if (log.playerMP !== undefined) updateMP(log.playerMP);
      if (log.playerHP !== undefined) updateHP(log.playerHP);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    if (mountedRef.current && target.stats.hp <= 0) {
      setBattleResult({ isVictory: true, expGained: 150, itemsGained: ['Iron Sword'], monstersGained: ['Skeleton'] });
      setTimeout(() => { if (mountedRef.current) setShowResult(true); }, 1000);
    }
    setIsProcessing(false);
  };

  const showLogAnimation = async (app: PIXI.Application, log: BattleLog) => {
    if (!mountedRef.current || !app.stage) return;
    const container = new PIXI.Container();
    app.stage.addChild(container);
    const style = new PIXI.TextStyle({ fontFamily: 'monospace', fontSize: 24, fill: log.action.includes('ATTACK') ? '#BF00FF' : '#00FFFF', fontWeight: 'bold' });
    const text = new PIXI.Text({ text: log.description, style });
    text.x = 50; text.y = 200; container.addChild(text);

    if (log.damage !== undefined) {
      const damageText = new PIXI.Text({ text: log.damage.toString(), style: { ...style, fontSize: 48, fill: log.isCritical ? '#FFD700' : '#FF00FF' } });
      damageText.x = 400; damageText.y = 150; container.addChild(damageText);
      const originalX = app.stage.x;
      for (let i = 0; i < 4; i++) {
        if (!mountedRef.current || !app.stage) break;
        app.stage.x += (Math.random() - 0.5) * 15;
        await new Promise(r => setTimeout(r, 30));
        if (app.stage) app.stage.x = originalX;
      }
    }
    let alpha = 1.0;
    const ticker = (delta: PIXI.Ticker) => {
      if (!mountedRef.current || container.destroyed) { app.ticker.remove(ticker); return; }
      alpha -= 0.04 * delta.deltaTime;
      container.alpha = alpha;
      if (alpha <= 0) { container.destroy({ children: true }); app.ticker.remove(ticker); }
    };
    app.ticker.add(ticker);
  };

  if (showResult && battleResult) return <ResultScreen {...battleResult} onFinish={onEnd} />;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center relative bg-dark overflow-hidden">
      {/* HP Bar */}
      <div className="absolute top-4 lg:top-8 left-1/2 -translate-x-1/2 w-[80%] max-w-md z-20 flex flex-col gap-1 items-center">
        <span className="font-headline text-[8px] lg:text-[10px] tracking-widest font-black text-secondary uppercase drop-shadow-md">
          {target.name} [LVL 99]
        </span>
        <div className="w-full h-2 lg:h-4 bg-black/60 backdrop-blur rounded-full border border-secondary/30 relative overflow-hidden">
          <motion.div 
            className="absolute inset-0 bg-secondary shadow-[0_0_15px_rgba(0,255,171,0.5)]" 
            initial={{ width: '100%' }}
            animate={{ width: `${(target.stats.hp / target.stats.maxHp) * 100}%` }}
          />
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className="rounded-lg lg:rounded-3xl overflow-hidden border border-white/5 shadow-2xl bg-black" />

      {/* Controls */}
      <div className="absolute bottom-6 lg:bottom-12 left-1/2 -translate-x-1/2 z-20 flex gap-4 lg:gap-8">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          disabled={isProcessing}
          onClick={() => handleAction('PHYSICAL_ATTACK')}
          className="w-16 h-16 lg:w-24 lg:h-24 rounded-full border-2 border-secondary/50 bg-secondary/10 flex flex-col items-center justify-center text-secondary hover:bg-secondary/20 transition-all disabled:opacity-30 shadow-[0_0_20px_rgba(0,255,171,0.2)]"
        >
          <Sword size={24} />
          <span className="text-[8px] lg:text-[10px] font-black mt-1 uppercase tracking-tighter">Attack</span>
        </motion.button>
        {availableSkills.map((skill: any) => {
          const isMpEnough = player && player.stats.mp >= skill.mpCost;
          const canUse = !isProcessing && isMpEnough;
          return (
            <motion.button 
              key={skill.id}
              whileTap={canUse ? { scale: 0.9 } : {}}
              disabled={!canUse}
              onClick={() => handleAction('MAGIC_SKILL', skill.id)}
              className={`w-16 h-16 lg:w-24 lg:h-24 rounded-full border-2 flex flex-col items-center justify-center transition-all shadow-xl relative
                ${isMpEnough ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20' : 'border-gray-800 bg-gray-900 text-gray-600 grayscale'}
                ${isProcessing ? 'opacity-30' : ''}
              `}
            >
              <Sparkles size={24} />
              <span className="text-[8px] lg:text-[10px] font-black mt-1 uppercase truncate w-full px-1 text-center tracking-tighter">{skill.name}</span>
              <span className="absolute -top-1 -right-1 lg:-top-2 lg:-right-2 bg-black border border-primary text-primary text-[8px] lg:text-[10px] px-1.5 lg:px-2 py-0.5 rounded-full font-black">
                {skill.mpCost}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
