'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../../store/useGameStore';
import { BattleEngine } from '../../logic/BattleEngine';
import { MonsterData } from '../../types/game';
import {
  Sword, Ghost, Skull, ShieldAlert, Sparkles,
  ChevronRight, FastForward, Settings, Crosshair, RotateCw
} from 'lucide-react';
import ResultScreen from './ResultScreen';
import { MasterDataService } from '../../services/MasterDataService';
import { motion, AnimatePresence } from 'framer-motion';
import { GrimoireLog } from '../ui/GrimoireLog';

interface BattleCanvasProps {
  onEnd: () => void;
}

/* ─── PixiJS Ripple helper ─── */
function spawnRipple(app: PIXI.Application, x: number, y: number, color: number = 0x8B00FF) {
  const g = new PIXI.Graphics();
  app.stage.addChild(g);
  let radius = 0;
  let alpha = 0.7;
  // Store callback ref so we can remove it
  const onTick = () => {
    radius += 8;
    alpha -= 0.045;
    g.clear();
    if (alpha <= 0) {
      app.ticker.remove(onTick);
      app.stage.removeChild(g);
      return;
    }
    g.circle(x, y, radius).stroke({ color, alpha, width: 2.5 });
  };
  app.ticker.add(onTick);
}

/* ─── Sin-wave HP Bar ─── */
interface SinBarProps {
  percent: number;    // 0-100
  isHP: boolean;
  width?: number;
  height?: number;
}
function SinBar({ percent, isHP, width = 56, height = 8 }: SinBarProps) {
  const cls = isHP ? 'sin-bar-hp' : 'sin-bar';
  const fill = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="relative overflow-hidden rounded-[3px]"
      style={{ width, height, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(139,0,255,0.25)' }}
    >
      <div
        className={`absolute inset-y-0 left-0 rounded-[3px] bar-shimmer ${cls}`}
        style={{ width: `${fill}%`, transition: 'width 0.35s ease' }}
      />
      {/* Wave shimmer thin overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent ${fill - 8}%, rgba(255,255,255,0.12) ${fill}%, transparent ${fill + 4}%)`,
          transition: 'background 0.35s ease',
        }}
      />
    </div>
  );
}

/* ─── Floating Damage Number ─── */
interface DmgNumber { id: number; value: number; isCrit: boolean; x: number }
function DamageNumber({ value, isCrit }: { value: number; isCrit: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: isCrit ? 0.5 : 0.8 }}
      animate={{
        opacity: 0,
        y: -52,
        scale: isCrit ? 1.6 : 1.1,
      }}
      transition={{ duration: isCrit ? 0.7 : 0.6, ease: 'easeOut' }}
      className={`absolute pointer-events-none select-none font-cinzel ${isCrit ? 'anim-crit' : ''}`}
      style={{
        fontFamily: "'Cinzel Decorative', serif",
        fontSize: isCrit ? '22px' : '16px',
        fontWeight: 900,
        color: isCrit ? '#FF00FF' : '#FF5555',
        textShadow: isCrit
          ? '0 0 14px rgba(255,0,255,0.9), 0 0 30px rgba(139,0,255,0.7)'
          : '0 0 8px rgba(255,50,50,0.6)',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        whiteSpace: 'nowrap',
        letterSpacing: '0.05em',
      }}
    >
      {isCrit ? `⚡${value}!!` : `-${value}`}
    </motion.div>
  );
}

/* ─── Timeline Orb ─── */
interface TimelineOrbProps { label: string; isPlayer: boolean; isFirst: boolean }
function TimelineOrb({ label, isPlayer, isFirst }: TimelineOrbProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <div
        className={`px-2.5 py-0.5 flex items-center justify-center rounded-lg text-[9px] font-black tracking-wider min-w-[30px] transition-all ${
          isFirst ? 'scale-110' : 'scale-100'
        }`}
        style={
          isPlayer
            ? {
                background: 'linear-gradient(135deg, rgba(139,0,255,0.35), rgba(80,0,180,0.2))',
                border: `1px solid ${isFirst ? 'rgba(188,0,251,0.9)' : 'rgba(188,0,251,0.45)'}`,
                color: '#E0B0FF',
                boxShadow: isFirst
                  ? '0 0 12px rgba(188,0,251,0.6), inset 0 0 8px rgba(0,0,0,0.4)'
                  : '0 0 5px rgba(188,0,251,0.2)',
              }
            : {
                background: 'linear-gradient(135deg, rgba(139,0,0,0.3), rgba(80,0,0,0.2))',
                border: `1px solid ${isFirst ? 'rgba(255,50,50,0.9)' : 'rgba(139,0,0,0.5)'}`,
                color: '#FF8888',
                boxShadow: isFirst ? '0 0 10px rgba(255,50,50,0.5)' : 'none',
              }
        }
      >
        {label}
      </div>
      <ChevronRight size={9} style={{ color: 'rgba(139,0,255,0.35)' }} className="shrink-0" />
    </div>
  );
}

/* ─── Main Component ─── */
export default function BattleCanvas({ onEnd }: BattleCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const { player, party, updateMP, updateHP, actionTrigger, setActionTrigger, battleLogs, addBattleLog } = useGameStore();
  const appRef       = useRef<PIXI.Application | null>(null);
  const engineRef    = useRef<BattleEngine | null>(null);
  const mountedRef   = useRef(true);
  const masterData   = MasterDataService.getInstance();

  const [isProcessing, setIsProcessing] = useState(false);
  type CommandState = 'IDLE' | 'SKILL_SELECT';
  const [commandState, setCommandState] = useState<CommandState>('IDLE');
  const [demonTurns, setDemonTurns] = useState(0);
  const isDemonMode = demonTurns > 0;

  const [dmgNumbers, setDmgNumbers] = useState<DmgNumber[]>([]);
  const dmgIdRef = useRef(0);

  const [showResult, setShowResult] = useState(false);
  const [battleResult, setBattleResult] = useState<{
    isVictory: boolean; expGained: number; itemsGained: string[]; monstersGained: string[];
  } | null>(null);

  const [enemies, setEnemies] = useState<(MonsterData & { stats: { maxHp: number } })[]>([
    {
      id: 'target_1', name: 'ゴブリン', tribe: 'UNDEAD', cost: 4,
      stats: { hp: 120, maxHp: 120, mp: 0, atk: 15, def: 5, matk: 0, mdef: 2, agi: 8, luck: 0, tec: 5 },
      resistances: { LIGHT: -50, DARK: 50 },
    },
    {
      id: 'target_2', name: 'ゾンビ', tribe: 'UNDEAD', cost: 5,
      stats: { hp: 180, maxHp: 180, mp: 0, atk: 20, def: 10, matk: 0, mdef: 0, agi: 2, luck: 0, tec: 3 },
      resistances: { LIGHT: -50, DARK: 50 },
    },
  ]);

  const target = enemies.find(e => e.stats.hp > 0) || enemies[0];
  const timeline = ['自', '敵A', '自', '自', '敵B'];

  const currentJob = player?.jobs.find(j => j.jobId === player?.currentJobId);
  const availableSkills = currentJob && player
    ? (masterData.getJob(player.currentJobId)?.skills || [])
        .filter((s: any) => s.level <= currentJob.level)
        .map((s: any) => masterData.getSkill(s.skillId))
        .filter(Boolean)
    : [];

  const battleSkills = useMemo(() => {
    if (isDemonMode) {
      return [
        { id: 'demon_rend',  name: '魔神裂断',   description: '破滅的ダメージ', mpCost: 0, power: 400 },
        { id: 'demon_roar',  name: '終末の咆哮',  description: '全体ダメージ',   mpCost: 0, power: 250 },
        { id: 'demon_drain', name: 'ソウルドレイン', description: 'HP吸収',       mpCost: 0, power: 150 },
      ];
    }
    return availableSkills;
  }, [availableSkills, isDemonMode]);

  const performTactileFeedback = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
  };

  /* ── PixiJS resize ── */
  const resize = useCallback(() => {
    if (!appRef.current || !containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    let w = clientWidth, h = clientWidth * (9 / 16);
    if (h > clientHeight) { h = clientHeight; w = clientHeight * (16 / 9); }
    appRef.current.renderer.resize(w, h);
    appRef.current.stage.scale.set(w / 800);
  }, []);

  /* ── PixiJS init ── */
  useEffect(() => {
    mountedRef.current = true;
    if (!canvasRef.current || !player) return;
    const initPixi = async () => {
      const app = new PIXI.Application();
      try {
        await app.init({
          width: 800, height: 450,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        if (!mountedRef.current) { app.destroy(true, { children: true }); return; }
        appRef.current = app;
        canvasRef.current?.appendChild(app.canvas);
        engineRef.current = new BattleEngine(player, party);

        // Void nebula BG
        const bg = new PIXI.Graphics();
        bg.rect(0, 0, 800, 450).fill({ color: 0x060310 });
        app.stage.addChild(bg);

        // Floating particle system
        const particles: { g: PIXI.Graphics; vx: number; vy: number; alpha: number; r: number }[] = [];
        for (let i = 0; i < 35; i++) {
          const g = new PIXI.Graphics();
          const r = Math.random() * 1.5 + 0.5;
          g.circle(0, 0, r).fill({ color: 0x8B00FF, alpha: Math.random() * 0.6 + 0.2 });
          g.x = Math.random() * 800;
          g.y = Math.random() * 450;
          app.stage.addChild(g);
          particles.push({ g, vx: (Math.random() - 0.5) * 0.3, vy: -Math.random() * 0.4 - 0.1, alpha: g.alpha, r });
        }

        app.ticker.add(() => {
          particles.forEach(p => {
            p.g.x += p.vx;
            p.g.y += p.vy;
            if (p.g.y < -5) p.g.y = 455;
            if (p.g.x < -5) p.g.x = 805;
            if (p.g.x > 805) p.g.x = -5;
          });
        });

        resize();
        window.addEventListener('resize', resize);
      } catch (e) { console.error('PixiJS init error:', e); }
    };
    initPixi();
    return () => {
      mountedRef.current = false;
      window.removeEventListener('resize', resize);
      if (appRef.current) { appRef.current.destroy(true, { children: true }); appRef.current = null; }
    };
  }, [player, party, resize]);

  /* ── Action trigger ── */
  useEffect(() => {
    if (actionTrigger && !isProcessing) {
      handleAction(actionTrigger.type, actionTrigger.skillId);
      setActionTrigger(null);
    }
  }, [actionTrigger, isProcessing, setActionTrigger]);

  /* ── Spawn ripple at canvas center ── */
  const triggerRipple = useCallback((isCrit = false) => {
    if (!appRef.current) return;
    const cx = 400, cy = 225;
    const color = isCrit ? 0xFF00FF : (isDemonMode ? 0xFF0000 : 0x8B00FF);
    spawnRipple(appRef.current, cx, cy, color);
    if (isCrit) {
      setTimeout(() => spawnRipple(appRef.current!, cx, cy, 0xBC00FB), 120);
      setTimeout(() => spawnRipple(appRef.current!, cx, cy, 0x8B00FF), 240);
    }
  }, [isDemonMode]);

  /* ── Handle action ── */
  const handleAction = async (type: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', skillId?: string) => {
    if (isProcessing || !engineRef.current || !appRef.current || !mountedRef.current) return;
    setIsProcessing(true);

    const logs = engineRef.current.simulateAction(type, target, skillId);
    for (const log of logs) {
      if (!mountedRef.current) break;
      const isCrit = Math.random() < 0.25;

      let logStr = `${log.actorName}の`;
      if (log.action === 'PHYSICAL_ATTACK') logStr += isDemonMode ? '殲滅斬！' : '通常攻撃！';
      if (log.action === 'MAGIC_SKILL')    logStr += isDemonMode ? '魔神技発動！' : 'スキル発動！';
      if (log.action === 'MONSTER_ATTACK') logStr += '追撃！';
      addBattleLog(logStr);

      if (log.damage && log.targetName === target.name) {
        triggerRipple(isCrit);
        // spawn floating damage number
        const id = ++dmgIdRef.current;
        setDmgNumbers(prev => [...prev, { id, value: log.damage!, isCrit, x: 50 }]);
        setTimeout(() => setDmgNumbers(prev => prev.filter(d => d.id !== id)), 900);

        setEnemies(prev => prev.map(e => {
          if (e.id === target.id) return { ...e, stats: { ...e.stats, hp: Math.max(0, e.stats.hp - (log.damage || 0)) } };
          return e;
        }));
        addBattleLog(`${target.name}に ${isCrit ? '⚡' : ''}${log.damage}${isCrit ? '!!(CRITICAL)' : ''} のダメージ！`);

        if (target.stats.hp - (log.damage || 0) <= 0) {
          addBattleLog(`${target.name}を撃破！魂石を1個抽出した…`);
        }
      }

      if (log.playerMP !== undefined) updateMP(log.playerMP);
      if (log.playerHP !== undefined) updateHP(log.playerHP);
      await new Promise(r => setTimeout(r, 450));
    }

    const aliveEnemies = enemies.filter(e => e.id !== target.id || e.stats.hp - (logs[0]?.damage || 0) > 0);
    if (mountedRef.current && aliveEnemies.length === 0) {
      setBattleResult({ isVictory: true, expGained: 150, itemsGained: ['錆びたショートソード'], monstersGained: ['コウモリ'] });
      setTimeout(() => { if (mountedRef.current) setShowResult(true); }, 800);
    }
    setIsProcessing(false);
  };

  /* ── Button tap handler (triggers ripple + action) ── */
  const onBtnTap = useCallback((e: React.MouseEvent, action: () => void) => {
    performTactileFeedback();
    // Ripple at pointer position within canvas
    if (appRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = 800 / rect.width;
      const scaleY = 450 / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top)  * scaleY;
      spawnRipple(appRef.current, x, y, isDemonMode ? 0xFF0000 : 0x8B00FF);
    }
    action();
  }, [isDemonMode]);

  if (showResult && battleResult) return <ResultScreen {...battleResult} onFinish={onEnd} />;
  if (!player) return null;

  // Precompute derived values (maxHp/maxMp not in BaseStats type, use cast fallback)
  const playerMaxHp = (player.stats as any).maxHp ?? 100;
  const playerMaxMp = (player.stats as any).maxMp ?? 20;
  const playerHpPct = (player.stats.hp / playerMaxHp) * 100;
  const playerMpPct = (player.stats.mp / playerMaxMp) * 100;

  /* ───────────────────────────────
     RENDER
  ─────────────────────────────── */
  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060310 0%, #0A0420 50%, #04020E 100%)' }}
    >
      {/* PixiJS Backdrop (particles + ripples) */}
      <div className="absolute inset-0 z-0 opacity-60">
        <div ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Void corner ornaments */}
      <div className="absolute top-0 left-0 w-20 h-20 pointer-events-none z-10"
        style={{ background: 'radial-gradient(circle at 0% 0%, rgba(139,0,255,0.25) 0%, transparent 70%)' }} />
      <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none z-10"
        style={{ background: 'radial-gradient(circle at 100% 0%, rgba(139,0,255,0.15) 0%, transparent 70%)' }} />

      {/* ─────────────────────────────────────────
          MAIN UI OVERLAY
      ───────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col h-full w-full max-w-md mx-auto pointer-events-none">

        {/* ══════════════════════════════════
            TIER 1: BATTLEFIELD (35%)
        ══════════════════════════════════ */}
        <div className="h-[35%] w-full flex flex-col pointer-events-auto relative">

          {/* ── Timeline ── */}
          <div
            className="h-10 w-full flex items-center shrink-0 px-2 gap-0.5 z-20 gothic-panel"
            style={{ borderBottom: '1px solid rgba(139,0,255,0.3)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}
          >
            <span className="text-[8px] font-black tracking-[0.2em] text-[rgba(139,0,255,0.6)] shrink-0 pr-2">
              ⚡ACT
            </span>
            <div className="flex flex-1 items-center overflow-x-auto custom-scrollbar gap-0.5">
              {timeline.map((act, i) => (
                <TimelineOrb key={i} label={act} isPlayer={act === '自'} isFirst={i === 0} />
              ))}
            </div>
            {isDemonMode && (
              <div
                className="shrink-0 flex items-center gap-1 text-[8px] font-black tracking-widest anim-demon px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(139,0,0,0.35)', border: '1px solid rgba(255,0,0,0.7)', color: '#FF6B6B' }}
              >
                ⚡{demonTurns}T
              </div>
            )}
          </div>

          {/* ── Battlefield ── */}
          <div
            className="flex-1 flex flex-col justify-evenly items-center relative overflow-hidden px-3 py-1"
            style={{ background: 'linear-gradient(180deg, rgba(6,3,16,0.85) 0%, rgba(10,4,26,0.9) 100%)' }}
          >
            {/* Enemy Row */}
            <div className="flex justify-center gap-8 w-full shrink-0">
              {enemies.map((enemy, idx) => {
                const hpPct = Math.max(0, Math.min(100, (enemy.stats.hp / enemy.stats.maxHp) * 100));
                const alive = enemy.stats.hp > 0;
                return (
                  <div
                    key={idx}
                    className={`flex flex-col items-center gap-1 transition-all duration-500 ${!alive ? 'opacity-20 grayscale' : ''}`}
                  >
                    <span className="text-[9px] font-black tracking-wider" style={{ color: '#FF6B6B', textShadow: '0 0 8px rgba(255,50,50,0.5)' }}>
                      {enemy.name}
                    </span>
                    {/* Enemy sprite */}
                    <div
                      className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-3xl overflow-hidden`}
                      style={{
                        background: 'radial-gradient(circle at 40% 30%, rgba(80,0,0,0.5), rgba(0,0,0,0.8))',
                        border: `1px solid ${isDemonMode ? 'rgba(255,0,0,0.5)' : 'rgba(139,0,0,0.4)'}`,
                        boxShadow: '0 6px 20px rgba(0,0,0,0.7), inset 0 0 15px rgba(0,0,0,0.5)',
                      }}
                    >
                      {/* Floating damage numbers */}
                      <AnimatePresence>
                        {dmgNumbers.map(d => idx === 0 && <DamageNumber key={d.id} value={d.value} isCrit={d.isCrit} />)}
                      </AnimatePresence>
                      <span style={{ filter: alive ? 'drop-shadow(0 0 6px rgba(255,50,50,0.5))' : 'none' }}>
                        {idx === 0 ? '🧟' : '👻'}
                      </span>
                      {/* Scan line effect */}
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,0,0,0.03) 4px)', mixBlendMode: 'overlay' }} />
                    </div>
                    {/* HP Bar */}
                    <div className="flex flex-col items-center gap-0.5">
                      <SinBar percent={hpPct} isHP={true} width={56} height={6} />
                      <span className="text-[7px] font-black" style={{ color: 'rgba(255,80,80,0.6)' }}>
                        {enemy.stats.hp}/{enemy.stats.maxHp}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Player Legion Row */}
            <div className="flex justify-center gap-5 w-full shrink-0">
              {[0, 1, 2].map(idx => {
                const member = party[idx] || { name: `使役魔${idx + 1}`, isMock: true };
                const isMock = (member as any).isMock;
                return (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    {/* Magic circle under feet */}
                    <div className="relative">
                      {!isMock && (
                        <div
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-3 rounded-full anim-spin-slow pointer-events-none"
                          style={{
                            background: 'radial-gradient(ellipse, rgba(139,0,255,0.35) 0%, transparent 70%)',
                            filter: 'blur(2px)',
                          }}
                        />
                      )}
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl relative overflow-hidden"
                        style={{
                          background: isMock
                            ? 'rgba(0,0,0,0.4)'
                            : 'radial-gradient(circle at 40% 30%, rgba(60,0,120,0.6), rgba(0,0,0,0.8))',
                          border: `1px solid ${isMock ? 'rgba(60,60,80,0.4)' : 'rgba(139,0,255,0.45)'}`,
                          boxShadow: isMock
                            ? 'none'
                            : '0 4px 14px rgba(0,0,0,0.6), 0 0 10px rgba(139,0,255,0.2)',
                        }}
                      >
                        {!isMock ? '🧟' : <span className="opacity-30 text-base">💀</span>}
                      </div>
                    </div>
                    <span className="text-[7px] font-black tracking-wider" style={{ color: isMock ? '#333' : '#9988BB' }}>
                      {member.name}
                    </span>
                    <SinBar percent={isMock ? 0 : 75} isHP={true} width={44} height={4} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════
            TIER 2: GRIMOIRE LOG (15%)
        ══════════════════════════════════ */}
        <div
          className="h-[15%] w-full relative pointer-events-auto flex flex-col gothic-panel"
          style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}
        >
          {/* Log header */}
          <div
            className="px-3 py-[3px] flex justify-between items-center shrink-0"
            style={{ borderBottom: '1px solid rgba(139,0,255,0.2)' }}
          >
            <span className="text-[7px] font-black tracking-[0.25em] uppercase" style={{ color: 'rgba(139,0,255,0.55)', fontFamily: 'monospace' }}>
              📜 魔導書ログ
            </span>
            <div className="flex items-center gap-3">
              {/* HP/MP compact display with sin bars */}
              <div className="flex flex-col items-end gap-[2px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] font-black" style={{ color: '#FF5555' }}>HP</span>
                  <SinBar percent={playerHpPct} isHP={true} width={40} height={4} />
                  <span className="text-[7px] font-bold" style={{ color: 'rgba(255,85,85,0.6)', fontFamily: 'monospace' }}>
                    {player.stats.hp}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] font-black" style={{ color: '#6699FF' }}>MP</span>
                  <SinBar percent={playerMpPct} isHP={false} width={40} height={4} />
                  <span className="text-[7px] font-bold" style={{ color: 'rgba(100,150,255,0.6)', fontFamily: 'monospace' }}>
                    {player.stats.mp}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* Grimoire entries */}
          <div className="flex-1 overflow-hidden relative z-10">
            <GrimoireLog logs={battleLogs} />
          </div>
        </div>

        {/* ══════════════════════════════════
            TIER 3: COMMAND CONSOLE (50%)
        ══════════════════════════════════ */}
        <div
          className={`h-[50%] w-full pointer-events-auto flex flex-col relative transition-colors duration-500`}
          style={{
            background: isDemonMode
              ? 'linear-gradient(180deg, #120005 0%, #1E0008 100%)'
              : 'linear-gradient(180deg, #070315 0%, #0C0520 100%)',
          }}
        >
          {/* Demon Mode Vignette */}
          <AnimatePresence>
            {isDemonMode && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none z-0"
              >
                <div className="absolute inset-0"
                  style={{ background: 'radial-gradient(ellipse at 50% 110%, rgba(200,0,0,0.35) 0%, transparent 70%)' }} />
                {/* Crimson lightning border */}
                <div className="absolute inset-0" style={{ border: '1px solid rgba(255,0,0,0.3)', boxShadow: 'inset 0 0 40px rgba(200,0,0,0.2)' }} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── RING MENU ── */}
          <div className="relative flex-1 flex items-center justify-center z-10 w-full px-4">
            <AnimatePresence mode="wait">
              {commandState !== 'SKILL_SELECT' && (
                <motion.div
                  key="idle-ring"
                  initial={{ scale: 0.75, opacity: 0, rotateY: -15 }}
                  animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                  exit={{ scale: 1.4, opacity: 0, filter: 'blur(10px)', rotateY: 15 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                  style={{ perspective: '600px' }}
                  className="grid grid-cols-3 grid-rows-3 gap-2 w-[220px] h-[220px] place-items-center"
                >
                  {/* Demon Mode button (top) */}
                  <div />
                  <button
                    onClick={e => onBtnTap(e, () => {
                      if (isDemonMode) return;
                      setDemonTurns(3);
                      addBattleLog('<<魔神化>> 深淵の力が解き放たれた！');
                    })}
                    disabled={isProcessing || isDemonMode}
                    className="flex flex-col items-center justify-center gap-1 void-btn w-[68px] h-[68px] relative"
                    style={isDemonMode
                      ? { background: 'rgba(120,0,0,0.5)', border: '1px solid rgba(255,0,0,0.7)', boxShadow: '0 0 20px rgba(255,0,0,0.5)', borderRadius: 16 }
                      : { background: 'linear-gradient(135deg, rgba(80,0,0,0.6), rgba(30,0,0,0.8))', border: '1px solid rgba(200,0,80,0.55)', borderRadius: 16, boxShadow: '0 0 12px rgba(180,0,60,0.3), inset 0 0 20px rgba(0,0,0,0.5)' }
                    }
                  >
                    <Skull size={18} style={{ color: isDemonMode ? '#FF4444' : '#FF6B9B' }} strokeWidth={2.5} />
                    <span className="text-[9px] font-black leading-none" style={{ color: isDemonMode ? '#FF4444' : '#FF6B9B', fontFamily: 'monospace' }}>
                      {isDemonMode ? `解放${demonTurns}T` : '魔神化'}
                    </span>
                    {!isDemonMode && (
                      <div className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{ background: 'radial-gradient(circle at 35% 25%, rgba(255,80,120,0.12), transparent 60%)' }} />
                    )}
                  </button>
                  <div />

                  {/* Row 2: 道具 (center orb) 術 */}
                  <button
                    disabled={true}
                    className="flex flex-col items-center justify-center gap-1 w-[68px] h-[68px] opacity-40 cursor-not-allowed"
                    style={{ background: 'rgba(20,15,35,0.6)', border: '1px solid rgba(80,60,100,0.4)', borderRadius: 16 }}
                  >
                    <ShieldAlert size={16} style={{ color: '#6B7280' }} strokeWidth={2} />
                    <span className="text-[9px] font-black" style={{ color: '#6B7280', fontFamily: 'monospace' }}>道具</span>
                  </button>

                  {/* Center Orb */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isDemonMode ? 'anim-demon' : 'anim-void-pulse'}`}
                    style={{
                      background: isDemonMode
                        ? 'radial-gradient(circle, rgba(180,0,0,0.7), rgba(80,0,0,0.4))'
                        : 'radial-gradient(circle, rgba(139,0,255,0.5), rgba(60,0,150,0.3))',
                      border: `1px solid ${isDemonMode ? 'rgba(255,0,0,0.6)' : 'rgba(188,0,251,0.5)'}`,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        background: isDemonMode
                          ? 'radial-gradient(circle, #FF3333, #990000)'
                          : 'radial-gradient(circle, #D580FF, #8B00FF)',
                        boxShadow: isDemonMode ? '0 0 10px rgba(255,0,0,0.8)' : '0 0 10px rgba(188,0,251,0.8)',
                      }}
                    />
                  </div>

                  <button
                    onClick={e => onBtnTap(e, () => setCommandState('SKILL_SELECT'))}
                    disabled={isProcessing || battleSkills.length === 0}
                    className="flex flex-col items-center justify-center gap-1 void-btn w-[68px] h-[68px] relative"
                    style={isDemonMode
                      ? { background: 'linear-gradient(135deg, rgba(100,0,0,0.6), rgba(40,0,0,0.8))', border: '1px solid rgba(255,0,0,0.55)', borderRadius: 16, boxShadow: '0 0 14px rgba(255,0,0,0.3)' }
                      : { background: 'linear-gradient(135deg, rgba(60,0,130,0.6), rgba(20,0,60,0.8))', border: '1px solid rgba(188,0,251,0.55)', borderRadius: 16, boxShadow: '0 0 14px rgba(139,0,255,0.35)' }
                    }
                  >
                    <Sparkles size={18} style={{ color: isDemonMode ? '#FF6B6B' : '#D580FF' }} strokeWidth={2.5} />
                    <span className="text-[9px] font-black leading-none" style={{ color: isDemonMode ? '#FF6B6B' : '#D580FF', fontFamily: 'monospace' }}>
                      {isDemonMode ? '魔神技' : '術'}
                    </span>
                  </button>

                  {/* Row 3: Attack */}
                  <div />
                  <button
                    onClick={e => onBtnTap(e, () => handleAction('PHYSICAL_ATTACK'))}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center gap-1 void-btn w-[68px] h-[68px] relative"
                    style={isDemonMode
                      ? { background: 'linear-gradient(135deg, rgba(120,0,0,0.65), rgba(50,0,0,0.85))', border: '1px solid rgba(255,30,30,0.6)', borderRadius: 16, boxShadow: '0 0 18px rgba(255,0,0,0.4)' }
                      : { background: 'linear-gradient(135deg, rgba(0,40,80,0.65), rgba(0,15,40,0.85))', border: '1px solid rgba(0,200,255,0.45)', borderRadius: 16, boxShadow: '0 0 14px rgba(0,200,255,0.25)' }
                    }
                  >
                    <Sword size={18} style={{ color: isDemonMode ? '#FF5555' : '#00DDFF' }} strokeWidth={2.5} />
                    <span className="text-[9px] font-black leading-none" style={{ color: isDemonMode ? '#FF5555' : '#00DDFF', fontFamily: 'monospace' }}>
                      {isDemonMode ? '殲滅' : '攻撃'}
                    </span>
                    {isProcessing && (
                      <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.6)' }}>
                        <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                          style={{ borderColor: isDemonMode ? '#FF5555' : '#00DDFF', borderTopColor: 'transparent' }} />
                      </div>
                    )}
                  </button>
                  <div />
                </motion.div>
              )}

              {/* ── SKILL SELECT ARC ── */}
              {commandState === 'SKILL_SELECT' && (
                <motion.div
                  key="skill-ring"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                >
                  <div className="absolute inset-0 backdrop-blur-md pointer-events-none"
                    style={{ background: 'rgba(4,2,14,0.75)' }} />

                  {/* Cancel */}
                  <motion.button
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    onClick={e => onBtnTap(e, () => setCommandState('IDLE'))}
                    className="absolute z-20 w-12 h-12 rounded-2xl flex flex-col items-center justify-center pointer-events-auto active:scale-90 transition-transform"
                    style={{ background: 'rgba(20,10,40,0.8)', border: '1px solid rgba(80,60,100,0.6)', boxShadow: '0 0 10px rgba(0,0,0,0.6)' }}
                  >
                    <span className="text-[9px] font-black" style={{ color: '#9888BB', fontFamily: 'monospace' }}>戻る</span>
                  </motion.button>

                  {/* Arc skills */}
                  {battleSkills.map((skill: any, idx: number) => {
                    const total = battleSkills.length;
                    const totalArc = Math.min(160, total * 52);
                    const angleStep = total > 1 ? totalArc / (total - 1) : 0;
                    const startAngle = 270 - totalArc / 2;
                    const angleDeg = startAngle + angleStep * idx;
                    const angleRad = (angleDeg * Math.PI) / 180;
                    const radius = 88;
                    const x = Math.cos(angleRad) * radius;
                    const y = Math.sin(angleRad) * radius;
                    return (
                      <motion.button
                        key={skill.id}
                        initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                        animate={{ opacity: 1, x, y, scale: 1 }}
                        exit={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                        transition={{ type: 'spring', stiffness: 240, damping: 20, delay: idx * 0.045 }}
                        onClick={e => onBtnTap(e, () => { handleAction('MAGIC_SKILL', skill.id); setCommandState('IDLE'); })}
                        className="absolute z-20 w-[64px] h-[64px] rounded-2xl flex flex-col items-center justify-center gap-0.5 pointer-events-auto active:scale-90 transition-transform"
                        style={isDemonMode
                          ? { background: 'linear-gradient(135deg, rgba(110,0,0,0.7), rgba(50,0,0,0.9))', border: '1px solid rgba(255,0,0,0.55)', boxShadow: '0 0 18px rgba(255,0,0,0.45)' }
                          : { background: 'linear-gradient(135deg, rgba(60,0,130,0.7), rgba(20,0,60,0.9))', border: '1px solid rgba(188,0,251,0.55)', boxShadow: '0 0 16px rgba(139,0,255,0.45)' }
                        }
                      >
                        <Sparkles size={13} style={{ color: isDemonMode ? '#FF6B6B' : '#D580FF' }} />
                        <span className="text-[8px] font-black truncate max-w-[54px] px-0.5 text-center leading-tight"
                          style={{ color: '#FFF', fontFamily: 'monospace' }}>
                          {skill.name}
                        </span>
                        <span className="text-[7px] font-bold" style={{ color: 'rgba(139,0,255,0.7)' }}>
                          MP{skill.mpCost}
                        </span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── UTILITY FOOTER ── */}
          <div
            className="w-full grid grid-cols-4 gap-1.5 relative z-10 shrink-0 px-2"
            style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
          >
            {[
              { label: 'AUTO', icon: <RotateCw size={10} /> },
              { label: 'SPEEDx2', icon: <FastForward size={10} /> },
              { label: 'TARGET', icon: <Crosshair size={10} /> },
            ].map(({ label, icon }) => (
              <button
                key={label}
                className="flex items-center justify-center gap-1 h-8 rounded-lg transition-all active:scale-95"
                style={{
                  background: 'rgba(10,5,20,0.7)',
                  border: '1px solid rgba(139,0,255,0.22)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                }}
              >
                <span style={{ color: 'rgba(139,0,255,0.5)' }}>{icon}</span>
                <span className="text-[7px] font-black tracking-[0.12em]" style={{ color: 'rgba(139,0,255,0.55)', fontFamily: 'monospace' }}>
                  {label}
                </span>
              </button>
            ))}
            <button
              onClick={() => setBattleResult({ isVictory: false, expGained: 0, itemsGained: [], monstersGained: [] })}
              className="flex items-center justify-center h-8 rounded-lg transition-all active:scale-95"
              style={{
                background: 'rgba(10,5,20,0.7)',
                border: '1px solid rgba(139,0,255,0.22)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}
            >
              <span className="text-[7px] font-black tracking-[0.12em]" style={{ color: 'rgba(139,0,255,0.55)', fontFamily: 'monospace' }}>MENU</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
