'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../../store/useGameStore';
import { BattleEngine } from '../../logic/BattleEngine';
import { BattleLog, MonsterData } from '../../types/game';
import { Sword, Sparkles, AlertTriangle } from 'lucide-react';
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
    id: 'target_1', name: 'UNDEAD SOLDIER', tribe: 'UNDEAD', cost: 4,
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
          width: 800, height: 450, backgroundColor: 0x000000, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true
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
      if (log.damage && log.targetName === target.name) {
        setTarget(prev => ({ ...prev, stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - (log.damage || 0)) } }));
      }
      if (log.playerMP !== undefined) updateMP(log.playerMP);
      if (log.playerHP !== undefined) updateHP(log.playerHP);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (mountedRef.current && target.stats.hp <= 0) {
      setBattleResult({ isVictory: true, expGained: 150, itemsGained: ['Rusty Sword'], monstersGained: ['Skeleton'] });
      setTimeout(() => { if (mountedRef.current) setShowResult(true); }, 500);
    }
    setIsProcessing(false);
  };

  if (showResult && battleResult) return <ResultScreen {...battleResult} onFinish={onEnd} />;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center relative bg-black overflow-hidden font-mono">
      {/* Target Info */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-full px-4 z-20 flex flex-col gap-1 items-center">
        <div className="flex justify-between w-full max-w-xs text-[9px] font-bold text-gray-500 uppercase tracking-tighter">
          <span>{target.name}</span>
          <span>LV.15</span>
        </div>
        <div className="w-full max-w-xs h-1 bg-[#1A1A1A] overflow-hidden">
          <motion.div 
            className="h-full bg-red-900" 
            animate={{ width: `${(target.stats.hp / target.stats.maxHp) * 100}%` }}
          />
        </div>
      </div>

      {/* Canvas Area */}
      <div ref={canvasRef} className="opacity-40 grayscale" />

      {/* Simple Command Buttons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 w-full max-w-xs px-4">
        <button 
          disabled={isProcessing}
          onClick={() => handleAction('PHYSICAL_ATTACK')}
          className="flex-1 h-10 border border-[#2C2C2C] bg-[#0D0D0D] flex flex-col items-center justify-center text-[10px] font-bold text-primary hover:bg-[#1A1A1A] transition-colors disabled:opacity-20 uppercase tracking-widest"
        >
          ATTACK
        </button>
        {availableSkills.slice(0, 2).map((skill: any) => {
          const isMpEnough = player && player.stats.mp >= skill.mpCost;
          const canUse = !isProcessing && isMpEnough;
          return (
            <button 
              key={skill.id}
              disabled={!canUse}
              onClick={() => handleAction('MAGIC_SKILL', skill.id)}
              className={`flex-1 h-10 border flex flex-col items-center justify-center text-[10px] font-bold transition-colors uppercase tracking-widest relative
                ${isMpEnough ? 'border-[#2C2C2C] bg-[#0D0D0D] text-secondary hover:bg-[#1A1A1A]' : 'border-[#1A1A1A] bg-black text-gray-700'}
                ${isProcessing ? 'opacity-20' : ''}
              `}
            >
              <span>{skill.name.split(' ')[0]}</span>
              <span className="absolute -top-1.5 -right-1 text-[7px] text-gray-600 bg-black px-0.5 border border-[#1A1A1A]">{skill.mpCost}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
