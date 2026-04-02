'use client';

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../../store/useGameStore';
import { BattleEngine } from '../../logic/BattleEngine';
import { BattleLog } from '../../types/game';
import { Sword, Sparkles } from 'lucide-react';
import ResultScreen from './ResultScreen';

import { MasterDataService } from '../../services/MasterDataService';

interface BattleCanvasProps {
  onEnd: () => void;
}

export default function BattleCanvas({ onEnd }: BattleCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { player, party, updateMP, updateHP } = useGameStore();
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
    <div className="flex flex-col items-center gap-4">
      {/* ターゲット情報 */}
      <div className="w-[800px] flex justify-between items-end px-4 mb-2">
        <div className="text-left">
          <div className="text-sm text-gray-400">TARGET</div>
          <div className="text-xl font-bold">{target.name}</div>
          <div className="w-64 bg-gray-800 h-3 rounded-full mt-1 border border-blood/30">
            <div 
              className="bg-blood h-full transition-all duration-500" 
              style={{ width: `${(target.stats.hp / 150) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-right text-blood font-bold text-2xl">
          HP: {target.stats.hp}
        </div>
      </div>

      <div ref={canvasRef} className="border-4 border-blood/50 shadow-2xl rounded overflow-hidden bg-black" />
      
      <div className="flex gap-4 w-[800px]">
        {/* アクションボタン */}
        <div className="flex flex-col gap-2 w-1/3">
          <button 
            disabled={isProcessing}
            onClick={() => handleAction('PHYSICAL_ATTACK')}
            className="flex items-center justify-center gap-2 py-3 bg-blood/80 hover:bg-blood disabled:opacity-50 transition-all font-bold rounded border border-red-500"
          >
            <Sword size={20} /> 物理攻撃
          </button>
          
          {availableSkills.map((skill: any) => {
            const isMpEnough = player && player.stats.mp >= skill.mpCost;
            return (
              <button 
                key={skill.id}
                disabled={isProcessing || !isMpEnough}
                onClick={() => handleAction('MAGIC_SKILL', skill.id)}
                className={`flex items-center justify-center gap-2 py-3 transition-all font-bold rounded border 
                  ${isMpEnough ? 'bg-blue-900/80 hover:bg-blue-800 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-500 grayscale'}`}
              >
                <Sparkles size={20} /> {skill.name} (MP {skill.mpCost})
              </button>
            );
          })}
        </div>

        {/* リアルタイムログ */}
        <div className="w-2/3 p-3 bg-black/80 border border-blood text-xs text-green-500 font-mono h-24 overflow-y-auto rounded">
          {battleLogs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
