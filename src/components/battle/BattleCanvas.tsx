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
import { motion } from 'framer-motion';

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
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-dark">
      {/* ターゲット情報 */}
      <div className="absolute top-6 left-6 z-20 bg-black/90 backdrop-blur-xl p-6 rounded-3xl border-4 border-white/5 shadow-2xl min-w-[300px] overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern opacity-10 pointer-events-none" />
        <div className="relative z-10">
          <div className="text-[10px] text-primary font-black font-space tracking-[0.3em] uppercase mb-1 opacity-80">Enemy Encountered</div>
          <div className="text-2xl font-black font-space text-white tracking-wider">{target.name.toUpperCase()}</div>
          <div className="text-sm font-black text-blood font-space mt-3 flex justify-between items-center bg-black/40 px-3 py-1.5 rounded-full border-2 border-white/5">
            <span>HP STATUS</span>
            <span>{target.stats.hp} / {target.stats.maxHp}</span>
          </div>
          <div className="w-full bg-black/60 h-4 rounded-full mt-3 border-2 border-white/5 overflow-hidden shadow-inner p-0.5">
            <motion.div 
              className="bg-blood h-full rounded-full shadow-[0_0_20px_#ff2e2e]" 
              initial={{ width: '100%' }}
              animate={{ width: `${(target.stats.hp / target.stats.maxHp) * 100}%` }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            />
          </div>
        </div>
      </div>

      {/* 16:9 Canvas Container */}
      <div className="relative w-[95%] max-w-6xl aspect-video border-4 border-white/5 shadow-2xl rounded-[2.5rem] overflow-hidden bg-black hologram-scan">
        <div ref={canvasRef} className="absolute inset-0 [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:object-cover" />
      </div>

      {/* 円形コマンドボタン（Pop デザイン） */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-8">
        <motion.button 
          whileHover={!isProcessing ? { scale: 1.1, y: -8 } : {}}
          whileTap={!isProcessing ? { scale: 0.9, y: 4 } : {}}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          disabled={isProcessing}
          onClick={() => handleAction('PHYSICAL_ATTACK')}
          className="relative w-24 h-24 rounded-3xl border-4 border-emerald-800 bg-secondary flex flex-col items-center justify-center text-dark hover:shadow-[0_0_40px_#00ffab] transition-all disabled:opacity-30 disabled:grayscale group focus:outline-none shadow-2xl border-b-8 active:border-b-0 active:translate-y-2"
        >
          <Sword size={28} className="group-hover:scale-110 transition-transform mb-1" />
          <span className="text-[10px] font-black font-space">ATTACK</span>
        </motion.button>
        
        {availableSkills.map((skill: any) => {
          const isMpEnough = player && player.stats.mp >= skill.mpCost;
          const canUse = !isProcessing && isMpEnough;
          return (
            <motion.button 
              key={skill.id}
              whileHover={canUse ? { scale: 1.1, y: -8 } : {}}
              whileTap={canUse ? { scale: 0.9, y: 4 } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              disabled={!canUse}
              onClick={() => handleAction('MAGIC_SKILL', skill.id)}
              className={`relative w-24 h-24 rounded-3xl border-4 flex flex-col items-center justify-center transition-all group focus:outline-none shadow-2xl border-b-8 active:border-b-0 active:translate-y-2
                ${isMpEnough ? 'border-purple-800 bg-primary text-dark hover:shadow-[0_0_40px_#e08dff]' : 'border-gray-800 bg-gray-900 text-gray-600 grayscale'}
                ${isProcessing ? 'opacity-30' : ''}
              `}
            >
              <Sparkles size={28} className={isMpEnough ? "group-hover:scale-110 transition-transform mb-1" : ""} />
              <span className="text-[10px] font-black font-space uppercase truncate w-full px-2 text-center leading-none" title={skill.name}>
                {skill.name}
              </span>
              <span className="absolute -top-4 -right-4 bg-black border-2 border-primary text-primary text-[10px] px-2.5 py-1 rounded-full font-black font-space shadow-xl">
                {skill.mpCost}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
