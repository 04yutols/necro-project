'use client';

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../../store/useGameStore';
import { BattleEngine } from '../../logic/BattleEngine';
import { BattleLog, MonsterData } from '../../types/game';
import { Sword, Sparkles } from 'lucide-react';
import ResultScreen from './ResultScreen';
import { BloodButton } from '../ui/BloodButton';
import { GameFrame } from '../ui/GameFrame';
import { MasterDataService } from '../../services/MasterDataService';

interface BattleCanvasProps {
  onEnd: () => void;
}

export default function BattleCanvas({ onEnd }: BattleCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { player, party, updateMP, updateHP, actionTrigger, setActionTrigger } = useGameStore();
  const appRef = useRef<PIXI.Application | null>(null);
  const engineRef = useRef<BattleEngine | null>(null);
  const mountedRef = useRef(true);
  const masterData = MasterDataService.getInstance();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [battleLogs, setBattleLogs] = useState<string[]>(['戦闘開始...']);
  const [showResult, setShowResult] = useState(false);
  const [battleResult, setBattleResult] = useState<{
    isVictory: boolean;
    expGained: number;
    itemsGained: string[];
    monstersGained: string[];
  } | null>(null);
  
  // モックターゲット（ステートで管理して撃破判定なども可能に）
  const [target, setTarget] = useState<MonsterData & { stats: { maxHp: number } }>({
    id: 'target_1',
    name: 'スケルトン兵',
    tribe: 'UNDEAD',
    cost: 4,
    stats: { hp: 150, maxHp: 150, mp: 0, atk: 15, def: 5, matk: 0, mdef: 2, agi: 5, luck: 0, tec: 5 },
    resistances: { LIGHT: -50, DARK: 50 }, // 弱点と耐性
  });

  // 使用可能なスキルの取得
  const currentJob = player?.jobs.find(j => j.jobId === player?.currentJobId);
  const availableSkills = currentJob && player
    ? (masterData.getJob(player.currentJobId)?.skills || [])
        .filter((s: any) => s.level <= currentJob.level)
        .map((s: any) => masterData.getSkill(s.skillId))
        .filter(Boolean)
    : [];

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

        if (app.canvas) {
          app.canvas.style.width = '100%';
          app.canvas.style.height = 'auto';
          app.canvas.style.maxWidth = '800px';
        }

        appRef.current = app;
        canvasRef.current?.appendChild(app.canvas);

        // バトルエンジン初期化
        engineRef.current = new BattleEngine(player, party);
      } catch (e) {
        console.error("BattleCanvas PixiJS init error:", e);
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
  }, [player, party]);

  useEffect(() => {
    if (actionTrigger && !isProcessing) {
      handleAction(actionTrigger.type, actionTrigger.skillId);
      setActionTrigger(null); // Reset trigger
    }
  }, [actionTrigger]);

  const handleAction = async (type: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', skillId?: string) => {
    if (isProcessing || !engineRef.current || !appRef.current || !mountedRef.current) return;

    setIsProcessing(true);
    const logs = engineRef.current.simulateAction(type, target, skillId);
    
    // ログの再生
    for (const log of logs) {
      if (!mountedRef.current) break;
      setBattleLogs(prev => [...prev, `> ${log.description}`].slice(-10));
      await showLogAnimation(appRef.current, log);
      
      // ステータス更新の反映（簡易版）
      if (log.damage && log.targetName === target.name) {
        setTarget(prev => ({
          ...prev,
          stats: { ...prev.stats, hp: Math.max(0, prev.stats.hp - (log.damage || 0)) }
        }));
      }
      if (log.playerMP !== undefined) updateMP(log.playerMP);
      if (log.playerHP !== undefined) updateHP(log.playerHP);

      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    if (mountedRef.current && target.stats.hp <= 0) {
      setBattleLogs(prev => [...prev, `> ${target.name}を撃破した！`]);
      setBattleResult({
        isVictory: true,
        expGained: 150,
        itemsGained: ['Iron Sword'],
        monstersGained: ['Skeleton']
      });
      setTimeout(() => {
        if (mountedRef.current) {
          // ResultScreenへ切り替える前に、現在のPixiJSアプリを完全に破棄する
          if (appRef.current) {
            appRef.current.destroy(true, { children: true });
            appRef.current = null;
          }
          setShowResult(true);
        }
      }, 1000);
    }

    setIsProcessing(false);
  };

  if (showResult && battleResult) {
    return (
      <ResultScreen 
        {...battleResult} 
        onFinish={onFinishBattle} 
      />
    );
  }

  function onFinishBattle() {
    onEnd();
  }

  const showLogAnimation = async (app: PIXI.Application, log: BattleLog) => {
    if (!mountedRef.current || !app.stage) return;
    const container = new PIXI.Container();
    app.stage.addChild(container);

    const style = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 20,
      fill: log.action.includes('ATTACK') ? '#ff4444' : '#00ccff',
      fontWeight: 'bold',
    });

    const text = new PIXI.Text({ text: log.description, style });
    text.x = 50;
    text.y = 150;
    container.addChild(text);

    if (log.damage !== undefined) {
      const damageText = new PIXI.Text({
        text: log.damage.toString(),
        style: { ...style, fontSize: 40, fill: log.isCritical ? '#ffff00' : '#ff0000' }
      });
      damageText.x = 400;
      damageText.y = 100;
      container.addChild(damageText);

      if (log.isWeakness) {
        const weakText = new PIXI.Text({
          text: 'WEAK!',
          style: { ...style, fontSize: 32, fill: '#ffaa00', fontStyle: 'italic', dropShadow: { color: '#000', blur: 4, distance: 2 } }
        });
        weakText.x = 400;
        weakText.y = 60;
        container.addChild(weakText);
      } else if (log.isResisted) {
        const resistText = new PIXI.Text({
          text: 'RESIST',
          style: { ...style, fontSize: 24, fill: '#aaaaaa', fontStyle: 'italic' }
        });
        resistText.x = 400;
        resistText.y = 70;
        container.addChild(resistText);
      }

      // シェイク演出
      const originalX = app.stage.x;
      for (let i = 0; i < 4; i++) {
        if (!mountedRef.current || !app.stage) break;
        app.stage.x += (Math.random() - 0.5) * 15;
        await new Promise(r => setTimeout(r, 30));
        if (app.stage) app.stage.x = originalX;
      }
    }

    // フェードアウト
    let alpha = 1.0;
    const ticker = (delta: PIXI.Ticker) => {
      if (!mountedRef.current || container.destroyed) {
        app.ticker.remove(ticker);
        return;
      }
      alpha -= 0.04 * delta.deltaTime;
      container.alpha = alpha;
      if (alpha <= 0) {
        if (app.stage) app.stage.removeChild(container);
        container.destroy({ children: true });
        app.ticker.remove(ticker);
      }
    };
    app.ticker.add(ticker);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* ターゲット情報 */}
      <div className="absolute top-4 left-4 z-20 bg-dark/80 backdrop-blur-md p-4 rounded-xl border-2 border-blood shadow-[0_0_20px_rgba(136,8,8,0.5)] min-w-[250px]">
        <div className="text-[10px] text-gray-400 font-cinzel font-bold tracking-widest uppercase mb-1">Target Identified</div>
        <div className="text-xl font-bold font-noto text-white">{target.name}</div>
        <div className="text-sm font-bold text-blood font-mono mt-2">HP: {target.stats.hp}</div>
        <div className="w-full bg-gray-900 h-2 rounded-full mt-1 border border-blood/30 overflow-hidden">
          <div 
            className="bg-red-500 h-full transition-all duration-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" 
            style={{ width: `${(target.stats.hp / 150) * 100}%` }}
          />
        </div>
      </div>

      {/* 16:9 Canvas Container */}
      <div className="relative w-full max-w-5xl aspect-video border-4 border-secondary/50 shadow-[0_0_30px_rgba(0,255,171,0.2)] rounded-2xl overflow-hidden bg-black hologram-scan">
        <div ref={canvasRef} className="absolute inset-0 [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:object-cover" />
      </div>

      {/* 円形コマンドボタン（Stich デザイン） */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-6">
        <button 
          disabled={isProcessing}
          onClick={() => handleAction('PHYSICAL_ATTACK')}
          className="puni-puni relative w-20 h-20 rounded-full border-4 border-secondary bg-black/80 flex flex-col items-center justify-center text-secondary hover:bg-secondary/20 hover:shadow-[0_0_20px_rgba(0,255,171,0.8)] transition-all disabled:opacity-50 disabled:grayscale group focus:outline-none"
        >
          <Sword size={24} className="group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold font-space mt-1">ATTACK</span>
        </button>
        
        {availableSkills.map((skill: any) => {
          const isMpEnough = player && player.stats.mp >= skill.mpCost;
          return (
            <button 
              key={skill.id}
              disabled={isProcessing || !isMpEnough}
              onClick={() => handleAction('MAGIC_SKILL', skill.id)}
              className={`puni-puni relative w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center transition-all group focus:outline-none
                ${isMpEnough ? 'border-primary bg-black/80 text-primary hover:bg-primary/20 hover:shadow-[0_0_20px_rgba(224,141,255,0.8)]' : 'border-gray-700 bg-gray-900 text-gray-600 grayscale'}
              `}
            >
              <Sparkles size={24} className={isMpEnough ? "group-hover:scale-110 transition-transform" : ""} />
              <span className="text-[10px] font-bold font-space mt-1 uppercase truncate w-full px-1 text-center leading-none leading-tight" title={skill.name}>
                {skill.name}
              </span>
              <span className="absolute -top-2 -right-2 bg-black border border-primary text-primary text-[8px] px-1.5 py-0.5 rounded-full font-mono">
                {skill.mpCost}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
