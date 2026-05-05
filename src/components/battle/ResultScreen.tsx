'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Package, Share2, Sparkles } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { ItemData } from '../../types/game';
import AppraisalCertificate from './AppraisalCertificate';

type ResultDrop = Partial<ItemData> & {
  name: string;
  icon?: string;
  passive?: string;
  flavor?: string;
  quantity?: number;
};

interface ResultScreenProps {
  isVictory: boolean;
  expGained: number;
  goldGained?: number;
  itemsGained: ResultDrop[] | string[];
  monstersGained: string[];
  isPurplePillar?: boolean;
  clearTime?: number;
  wavesCleared?: number;
  totalWaves?: number;
  onFinish: () => void;
}

const DEFAULT_HIDDEN_UNIQUE: ResultDrop = {
  id: 'hidden-unique-necro-edge',
  name: '冥王の黒刃',
  type: 'WEAPON',
  rarity: 'HIDDEN_UNIQUE',
  icon: '⚔',
  stats: { atk: 88, matk: 42, luck: 12, tec: 16 },
  isUnique: true,
  discovererName: 'Aldo',
  serialNo: 1,
  passive: '魔神化中、与えるダメージが上昇し、撃破時に魂ゲージを追加回復する。',
  flavor: '紫の柱が沈黙したあと、刃だけが夜を覚えていた。',
};

const rarityLabel: Record<string, string> = {
  COMMON: 'COMMON',
  UNIQUE: 'UNIQUE',
  HIDDEN_UNIQUE: 'HIDDEN UNIQUE',
};

function haptic(pattern: VibratePattern) {
  if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern);
}

export default function ResultScreen({
  isVictory,
  expGained,
  goldGained = 0,
  itemsGained,
  monstersGained,
  isPurplePillar,
  clearTime = 74,
  wavesCleared = 3,
  totalWaves = 3,
  onFinish,
}: ResultScreenProps) {
  const [showContent, setShowContent] = useState(false);
  const [phase, setPhase] = useState<'summary' | 'loot' | 'revealed'>('summary');
  const [showCertificate, setShowCertificate] = useState(false);
  const { addExp } = useGameStore();

  const particles = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    left: 6 + ((i * 37) % 88),
    top: 6 + ((i * 53) % 86),
    size: 1.5 + (i % 4) * 0.7,
    delay: (i % 9) * 0.42,
    duration: 3.2 + (i % 5) * 0.55,
    color: i % 4 === 0 ? '#8A2BE2' : i % 4 === 1 ? '#fbbf24' : i % 4 === 2 ? '#c084fc' : '#4a3a6a',
  })), []);

  const normalizedDrops = useMemo<ResultDrop[]>(() => {
    const drops = itemsGained.map((drop, index) => (
      typeof drop === 'string'
        ? { id: `drop-${index}`, name: drop, rarity: 'COMMON' as const, isUnique: false, quantity: 1 }
        : drop
    ));
    return drops.length > 0 ? drops : [{ id: 'bone-chip', name: '骨の欠片', rarity: 'COMMON', isUnique: false, quantity: 2 }];
  }, [itemsGained]);

  const hiddenUnique = normalizedDrops.find(drop => drop.rarity === 'HIDDEN_UNIQUE');
  const featuredDrop = hiddenUnique ?? normalizedDrops.find(drop => drop.rarity === 'UNIQUE') ?? DEFAULT_HIDDEN_UNIQUE;
  const hasPurplePillar = isPurplePillar ?? Boolean(hiddenUnique);
  const certificateItem = {
    ...DEFAULT_HIDDEN_UNIQUE,
    ...featuredDrop,
    type: featuredDrop.type ?? 'WEAPON',
    rarity: featuredDrop.rarity ?? 'HIDDEN_UNIQUE',
    stats: featuredDrop.stats ?? DEFAULT_HIDDEN_UNIQUE.stats,
    isUnique: true,
  } as ItemData;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowContent(true);
      addExp(expGained);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [addExp, expGained]);

  const mins = String(Math.floor(clearTime / 60)).padStart(2, '0');
  const secs = String(clearTime % 60).padStart(2, '0');

  const openLoot = () => {
    haptic([18, 24, 35]);
    setPhase('loot');
  };

  const revealLoot = () => {
    haptic([20, 30, 45]);
    setPhase('revealed');
  };

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: hasPurplePillar
          ? 'radial-gradient(ellipse at 50% 44%, rgba(138,43,226,0.22), #07020f 58%, #03010a 100%)'
          : 'linear-gradient(180deg,#08041a 0%,#05020f 100%)',
        color: '#F0EAFF',
        fontFamily: "'Noto Sans JP', system-ui, sans-serif",
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              opacity: 0.45,
              animation: `particleRise ${p.duration}s ease-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {hasPurplePillar && (
        <>
          <div
            className="absolute top-[-8%] bottom-[-8%] left-1/2 pointer-events-none"
            style={{
              width: 'min(28vw, 112px)',
              background: 'linear-gradient(90deg, transparent, rgba(188,0,251,0.28), rgba(255,255,255,0.9), rgba(188,0,251,0.34), transparent)',
              transformOrigin: 'center',
              animation: 'purplePillar 1.2s cubic-bezier(0.2, 0.9, 0.2, 1) both',
              boxShadow: '0 0 38px rgba(188,0,251,0.72), 0 0 120px rgba(138,43,226,0.48)',
              zIndex: 1,
            }}
          />
          <div
            className="absolute left-1/2 top-[44%] pointer-events-none rounded-full"
            style={{
              width: 'min(78vw, 320px)',
              height: 'min(78vw, 320px)',
              background: 'radial-gradient(circle, rgba(188,0,251,0.28), rgba(138,43,226,0.08) 48%, transparent 68%)',
              animation: 'pillarHalo 2.4s ease-in-out infinite',
              zIndex: 1,
            }}
          />
        </>
      )}

      {!showContent ? (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-[11px] animate-pulse tracking-[0.34em] uppercase" style={{ color: '#8A2BE2', fontFamily: 'monospace' }}>
            CALCULATING
          </div>
        </div>
      ) : phase === 'summary' ? (
        <div
          className="relative z-10 h-full flex flex-col"
          style={{ padding: 'max(18px, env(safe-area-inset-top, 18px)) 16px max(18px, env(safe-area-inset-bottom, 18px))' }}
        >
          <div style={{ textAlign: 'center', animation: 'resultSlideIn 0.45s ease-out both' }}>
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 9, color: '#8A2BE2', letterSpacing: '0.25em', marginBottom: 5 }}>
              BATTLE COMPLETE
            </div>
            <div style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 30,
              fontWeight: 900,
              color: isVictory ? '#fbbf24' : '#ef4444',
              letterSpacing: '0.06em',
              textShadow: isVictory ? '0 0 26px rgba(251,191,36,0.65)' : '0 0 22px rgba(239,68,68,0.58)',
            }}>
              {isVictory ? 'VICTORY' : 'DEFEAT'}
            </div>
          </div>

          <div className="flex justify-center" style={{ padding: '16px 0 10px', animation: 'rankPop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.18s both' }}>
            <div style={{
              width: 82,
              height: 82,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(251,191,36,0.28), #130b02)',
              border: '2.5px solid #fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 26px rgba(251,191,36,0.55)',
            }}>
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 42, fontWeight: 900, color: '#fbbf24' }}>S</span>
            </div>
          </div>

          <div className="grid grid-cols-3 overflow-hidden" style={{
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            animation: 'resultSlideIn 0.45s ease-out 0.12s both',
          }}>
            {[
              { label: 'クリアタイム', value: `${mins}:${secs}`, color: '#c084fc' },
              { label: 'WAVE', value: `${wavesCleared}/${totalWaves}`, color: '#f59e0b' },
              { label: '生存', value: '3/3', color: '#34d399' },
            ].map((s, i) => (
              <div key={s.label} style={{ padding: '12px 6px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#6b5f7a', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 12,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            animation: 'resultSlideIn 0.45s ease-out 0.22s both',
          }}>
            <div className="flex justify-between items-baseline mb-2">
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 700, color: '#8A2BE2', letterSpacing: '0.12em' }}>EXPERIENCE</span>
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 15, fontWeight: 700, color: '#34d399' }}>+{expGained.toLocaleString()}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{
                '--exp-width': '74%',
                width: '74%',
                height: '100%',
                borderRadius: 4,
                background: 'linear-gradient(90deg,#4a0e8a,#8A2BE2,#34d399)',
                animation: 'expGrow 1s cubic-bezier(0.34,1.2,0.64,1) 0.35s both',
                boxShadow: '0 0 10px rgba(52,211,153,0.55)',
              } as CSSProperties} />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto safe-scroll" style={{ marginTop: 12, animation: 'resultSlideIn 0.45s ease-out 0.32s both' }}>
            <div style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div className="flex items-center gap-2 mb-3" style={{ color: '#fbbf24' }}>
                <Package size={15} />
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em' }}>REWARDS</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>ゴールド</span>
                  <span style={{ color: '#fbbf24', fontFamily: "'Cinzel', serif", fontWeight: 700 }}>+{goldGained.toLocaleString()}G</span>
                </div>
                {normalizedDrops.map((drop) => (
                  <div key={drop.id ?? drop.name} className="flex items-center justify-between" style={{ gap: 10 }}>
                    <span style={{ color: drop.rarity === 'HIDDEN_UNIQUE' ? '#fde68a' : '#9ca3af', fontSize: 11 }}>{drop.name}</span>
                    <span style={{ color: drop.rarity === 'HIDDEN_UNIQUE' ? '#fbbf24' : '#8A2BE2', fontFamily: 'monospace', fontSize: 10 }}>
                      {rarityLabel[drop.rarity ?? 'COMMON'] ?? drop.rarity ?? 'DROP'}
                    </span>
                  </div>
                ))}
                {monstersGained.map(monster => (
                  <div key={monster} className="flex items-center justify-between">
                    <span style={{ color: '#9ca3af', fontSize: 11 }}>{monster}</span>
                    <span style={{ color: '#c084fc', fontFamily: 'monospace', fontSize: 10 }}>CORE</span>
                  </div>
                ))}
              </div>
            </div>

            {hasPurplePillar && (
              <div style={{
                marginTop: 10,
                padding: '13px 14px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(138,43,226,0.22), rgba(251,191,36,0.08))',
                border: '1px solid rgba(251,191,36,0.55)',
                boxShadow: '0 0 28px rgba(188,0,251,0.28)',
              }}>
                <div className="flex items-center gap-3">
                  <Sparkles size={20} color="#fbbf24" />
                  <div className="flex-1">
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.14em' }}>
                      PURPLE PILLAR DETECTED
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fde68a', marginTop: 2 }}>
                      隠しユニーク反応あり
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={hasPurplePillar ? openLoot : onFinish}
            style={{
              marginTop: 12,
              width: '100%',
              minHeight: 54,
              borderRadius: 14,
              border: `1.5px solid ${hasPurplePillar ? '#fbbf24' : 'rgba(138,43,226,0.65)'}`,
              background: hasPurplePillar
                ? 'linear-gradient(135deg, #7c2d12, #8A2BE2, #4c1d95)'
                : 'linear-gradient(135deg, rgba(138,43,226,0.34), rgba(88,28,135,0.24))',
              color: '#fff',
              fontFamily: "'Cinzel', serif",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.08em',
              boxShadow: hasPurplePillar ? '0 0 30px rgba(251,191,36,0.32)' : '0 0 20px rgba(138,43,226,0.25)',
            }}
          >
            {hasPurplePillar ? '紫の柱を鑑定' : 'マップへ戻る'}
          </button>
        </div>
      ) : (
        <div
          className="relative z-10 h-full flex flex-col items-center"
          style={{ padding: 'max(18px, env(safe-area-inset-top, 18px)) 18px max(18px, env(safe-area-inset-bottom, 18px))' }}
        >
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 9, color: '#8A2BE2', letterSpacing: '0.22em' }}>ITEM DROP</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 19, fontWeight: 900, color: '#fde68a', marginTop: 6, textShadow: '0 0 16px rgba(251,191,36,0.55)' }}>
              {featuredDrop.name}
            </div>
            <div style={{
              display: 'inline-flex',
              marginTop: 8,
              padding: '3px 12px',
              borderRadius: 4,
              background: 'linear-gradient(90deg, #8A2BE2, #fbbf24, #8A2BE2)',
              color: '#fff',
              fontFamily: "'Cinzel', serif",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.16em',
            }}>
              {rarityLabel[featuredDrop.rarity ?? 'HIDDEN_UNIQUE']}
            </div>
          </div>

          {phase === 'loot' ? (
            <button
              type="button"
              onClick={revealLoot}
              className="flex flex-col items-center justify-center"
              style={{
                marginTop: 'auto',
                marginBottom: 'auto',
                width: 178,
                height: 178,
                borderRadius: '50%',
                border: '2px solid rgba(251,191,36,0.65)',
                background: 'radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(251,191,36,0.42) 18%, rgba(188,0,251,0.52) 48%, rgba(7,2,20,0.94) 72%)',
                color: '#fff',
                animation: 'lootOrbPulse 1.9s ease-in-out infinite',
              }}
            >
              <Sparkles size={34} />
              <span style={{ marginTop: 12, fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.16em' }}>
                TAP TO OPEN
              </span>
            </button>
          ) : (
            <div style={{
              marginTop: 'auto',
              marginBottom: 'auto',
              width: 'min(320px, 100%)',
              borderRadius: 20,
              overflow: 'hidden',
              border: '1.5px solid rgba(251,191,36,0.72)',
              background: 'linear-gradient(180deg, rgba(38,20,4,0.92), rgba(13,8,2,0.96))',
              boxShadow: '0 0 40px rgba(251,191,36,0.3), 0 0 80px rgba(138,43,226,0.24)',
              animation: 'cardReveal 0.65s cubic-bezier(0.34,1.3,0.64,1) both',
            }}>
              <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #fbbf24, #BC00FB, #fbbf24, transparent)' }} />
              <div style={{ padding: '16px 18px 18px', textAlign: 'center' }}>
                <div style={{
                  width: 86,
                  height: 86,
                  margin: '0 auto 12px',
                  borderRadius: '50%',
                  border: '2px solid rgba(251,191,36,0.75)',
                  background: 'radial-gradient(circle, rgba(251,191,36,0.22), rgba(138,43,226,0.18), transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 38,
                  boxShadow: '0 0 24px rgba(251,191,36,0.45)',
                }}>
                  {featuredDrop.icon ?? '✦'}
                </div>
                <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 9, color: '#fbbf24', letterSpacing: '0.2em' }}>
                  HIDDEN UNIQUE
                </div>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 21, fontWeight: 900, color: '#fde68a', lineHeight: 1.18, marginTop: 5 }}>
                  {featuredDrop.name}
                </div>
                <div style={{ marginTop: 14, display: 'grid', gap: 7 }}>
                  {Object.entries(featuredDrop.stats ?? {}).slice(0, 4).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                      <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{key.toUpperCase()}</span>
                      <span style={{ color: '#fbbf24', fontFamily: "'Cinzel', serif", fontWeight: 700 }}>+{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 13, padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(251,191,36,0.18)', color: '#a5a9b4', fontSize: 10, lineHeight: 1.6 }}>
                  {featuredDrop.passive ?? DEFAULT_HIDDEN_UNIQUE.passive}
                </div>
              </div>
            </div>
          )}

          {phase === 'revealed' && (
            <div className="w-full" style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCertificate(true)}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 12,
                  border: '1px solid rgba(251,191,36,0.55)',
                  background: 'rgba(251,191,36,0.12)',
                  color: '#fbbf24',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Share2 size={15} />
                鑑定証
              </button>
              <button
                type="button"
                onClick={onFinish}
                style={{
                  flex: 1.4,
                  minHeight: 50,
                  borderRadius: 12,
                  border: '1px solid rgba(138,43,226,0.65)',
                  background: 'linear-gradient(135deg, rgba(138,43,226,0.45), rgba(88,28,135,0.28))',
                  color: '#fff',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                獲得して戻る
              </button>
            </div>
          )}
        </div>
      )}

      {showCertificate && (
        <AppraisalCertificate item={certificateItem} onClose={() => setShowCertificate(false)} />
      )}
    </div>
  );
}
