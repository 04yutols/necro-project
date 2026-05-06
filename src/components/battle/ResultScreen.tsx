'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronRight, Eye, FastForward, Package, Share2, Skull, Sparkles } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import type { ItemData } from '../../types/game';
import AppraisalCertificate from './AppraisalCertificate';

type DropRarity = 'COMMON' | 'RARE' | 'SR' | 'SSR' | 'LR' | 'UR' | 'UNIQUE' | 'HIDDEN_UNIQUE';

type ResultDrop = Omit<Partial<ItemData>, 'rarity'> & {
  name: string;
  rarity?: DropRarity;
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

const DEFAULT_DROPS: ResultDrop[] = [
  { id: 'bone-chip', name: '骨の欠片', rarity: 'COMMON', icon: '▣', isUnique: false, quantity: 3 },
  { id: 'rusted-bone-sword', name: '朽ちた骨剣', type: 'WEAPON', rarity: 'COMMON', icon: '⚔', stats: { atk: 12 }, isUnique: false },
  { id: 'spirit-silver-saber', name: '霊銀の斬骨刀', type: 'WEAPON', rarity: 'RARE', icon: '⚔', stats: { atk: 28, tec: 4 }, isUnique: false },
];

const DEFAULT_UNIQUE: ResultDrop = {
  id: 'hidden-unique-necro-edge',
  name: '冥王の黒刃',
  type: 'WEAPON',
  rarity: 'UR',
  icon: '☠',
  stats: { atk: 88, matk: 42, luck: 12, tec: 16 },
  isUnique: true,
  discovererName: 'Aldo',
  serialNo: 1,
  passive: '魔神化中、与えるダメージが上昇し、撃破時に魂ゲージを追加回復する。',
  flavor: '幾つもの魔物の怨念が刃の奥で重なり、持ち主の魂を試すように震えている。',
};

const CURSE_WORDS = ['怨', '呪', '哭', '喰', '縛', '滅'];

const RARITY_STYLE: Record<DropRarity, {
  label: string;
  name: string;
  color: string;
  glow: string;
  background: string;
  tier: 'normal' | 'rare' | 'premium' | 'cursed';
}> = {
  COMMON: {
    label: 'N',
    name: 'NORMAL',
    color: '#A5A9B4',
    glow: 'rgba(165,169,180,0.24)',
    background: 'linear-gradient(160deg, rgba(165,169,180,0.14), rgba(7,5,14,0.94))',
    tier: 'normal',
  },
  RARE: {
    label: 'R',
    name: 'RARE',
    color: '#55AAFF',
    glow: 'rgba(85,170,255,0.36)',
    background: 'linear-gradient(160deg, rgba(85,170,255,0.20), rgba(7,5,18,0.94))',
    tier: 'rare',
  },
  SR: {
    label: 'SR',
    name: 'SUPER RARE',
    color: '#C084FC',
    glow: 'rgba(192,132,252,0.40)',
    background: 'linear-gradient(160deg, rgba(192,132,252,0.24), rgba(10,5,24,0.94))',
    tier: 'rare',
  },
  SSR: {
    label: 'SSR',
    name: 'SPECIAL SUPER RARE',
    color: '#FBBF24',
    glow: 'rgba(251,191,36,0.50)',
    background: 'linear-gradient(160deg, rgba(251,191,36,0.26), rgba(30,14,4,0.96))',
    tier: 'premium',
  },
  LR: {
    label: 'LR',
    name: 'LEGEND RARE',
    color: '#FDE68A',
    glow: 'rgba(253,230,138,0.58)',
    background: 'linear-gradient(160deg, rgba(253,230,138,0.28), rgba(50,28,6,0.96))',
    tier: 'premium',
  },
  UNIQUE: {
    label: 'LR',
    name: 'UNIQUE',
    color: '#FBBF24',
    glow: 'rgba(251,191,36,0.52)',
    background: 'linear-gradient(160deg, rgba(251,191,36,0.28), rgba(24,10,4,0.96))',
    tier: 'premium',
  },
  HIDDEN_UNIQUE: {
    label: 'UR',
    name: 'UNIQUE RARE',
    color: '#BC00FB',
    glow: 'rgba(188,0,251,0.72)',
    background: 'linear-gradient(160deg, rgba(139,0,255,0.30), rgba(80,0,18,0.34), rgba(3,1,8,0.98))',
    tier: 'cursed',
  },
  UR: {
    label: 'UR',
    name: 'UNIQUE RARE',
    color: '#BC00FB',
    glow: 'rgba(188,0,251,0.72)',
    background: 'linear-gradient(160deg, rgba(139,0,255,0.30), rgba(80,0,18,0.34), rgba(3,1,8,0.98))',
    tier: 'cursed',
  },
};

const STAT_LABEL: Record<string, string> = {
  hp: 'HP',
  mp: 'MP',
  atk: 'ATK',
  def: 'DEF',
  matk: 'MATK',
  mdef: 'MDEF',
  agi: 'AGI',
  luck: 'LUCK',
  tec: 'TEC',
};

function normalizeRarity(rarity?: string): DropRarity {
  if (!rarity) return 'COMMON';
  const upper = rarity.toUpperCase();
  if (upper === 'HIDDEN_UNIQUE') return 'HIDDEN_UNIQUE';
  if (upper in RARITY_STYLE) return upper as DropRarity;
  return 'COMMON';
}

function isCursedDrop(drop: ResultDrop) {
  const rarity = normalizeRarity(drop.rarity);
  return rarity === 'UR' || rarity === 'HIDDEN_UNIQUE';
}

function isPremiumDrop(drop: ResultDrop) {
  const tier = RARITY_STYLE[normalizeRarity(drop.rarity)].tier;
  return tier === 'premium' || tier === 'cursed';
}

function haptic(pattern: VibratePattern) {
  if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern);
}

function normalizeDrop(drop: ResultDrop | string, index: number): ResultDrop {
  if (typeof drop === 'string') {
    return {
      id: `drop-${index}`,
      name: drop,
      rarity: 'COMMON',
      icon: '▣',
      isUnique: false,
      quantity: 1,
    };
  }

  return {
    id: drop.id ?? `drop-${index}`,
    icon: drop.icon ?? (drop.type === 'WEAPON' ? '⚔' : '▣'),
    rarity: normalizeRarity(drop.rarity),
    isUnique: false,
    quantity: 1,
    ...drop,
  };
}

function RarityBadge({ drop, compact = false }: { drop: ResultDrop; compact?: boolean }) {
  const rarity = normalizeRarity(drop.rarity);
  const style = RARITY_STYLE[rarity];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: compact ? 28 : 42,
        height: compact ? 18 : 24,
        padding: compact ? '0 6px' : '0 10px',
        borderRadius: 5,
        background: `${style.color}18`,
        border: `1px solid ${style.color}70`,
        color: style.color,
        fontFamily: "'Cinzel', serif",
        fontSize: compact ? 8 : 10,
        fontWeight: 900,
        letterSpacing: '0.08em',
        boxShadow: style.tier === 'normal' ? 'none' : `0 0 12px ${style.glow}`,
      }}
    >
      {style.label}
    </span>
  );
}

function AppraisalField({ drop, stage, onReveal }: { drop: ResultDrop; stage: 'sealed' | 'revealing' | 'revealed'; onReveal: () => void }) {
  const rarity = normalizeRarity(drop.rarity);
  const style = RARITY_STYLE[rarity];
  const cursed = style.tier === 'cursed';
  const premium = style.tier === 'premium';
  const revealed = stage === 'revealed';

  return (
    <div className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: cursed
            ? 'radial-gradient(ellipse at 50% 42%, rgba(188,0,251,0.24), rgba(70,0,18,0.28) 38%, transparent 70%)'
            : premium
              ? `radial-gradient(ellipse at 50% 42%, ${style.glow}, transparent 62%)`
              : `radial-gradient(ellipse at 50% 48%, ${style.glow}, transparent 58%)`,
        }}
      />

      {premium && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              width: 'min(92vw, 360px)',
              height: 'min(92vw, 360px)',
              borderRadius: '50%',
              border: `1px solid ${style.color}55`,
              animation: 'rareRuneSpin 9s linear infinite',
              boxShadow: `0 0 32px ${style.glow}`,
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              width: 'min(74vw, 292px)',
              height: 'min(74vw, 292px)',
              borderRadius: '50%',
              border: `1px dashed ${style.color}55`,
              animation: 'premiumRingPulse 2.8s ease-in-out infinite',
            }}
          />
          {Array.from({ length: 18 }, (_, i) => (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: `${6 + ((i * 29) % 88)}%`,
                top: `${8 + ((i * 41) % 70)}%`,
                width: 2 + (i % 3),
                height: 2 + (i % 3),
                borderRadius: '50%',
                background: i % 2 === 0 ? style.color : '#F0EAFF',
                boxShadow: `0 0 10px ${style.color}`,
                animation: `premiumSparkFall ${2.2 + (i % 5) * 0.22}s ease-in-out infinite`,
                animationDelay: `${i * 0.11}s`,
              }}
            />
          ))}
        </>
      )}

      {cursed && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(90deg, transparent, rgba(188,0,251,0.05), transparent), repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 6px)',
              mixBlendMode: 'screen',
              animation: 'curseStatic 0.72s steps(2, end) infinite',
            }}
          />
          <div
            className="absolute top-[-14%] bottom-[-14%] left-1/2 pointer-events-none"
            style={{
              width: 'min(30vw, 120px)',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(90deg, transparent, rgba(14,0,8,0.92), rgba(72,0,24,0.74), rgba(188,0,251,0.64), rgba(3,0,5,0.96), transparent)',
              boxShadow: '0 0 60px rgba(188,0,251,0.66), 0 0 130px rgba(127,29,29,0.48), inset 0 0 24px rgba(0,0,0,0.95)',
              animation: 'cursedPillarBreath 1.7s ease-in-out infinite',
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              width: 'min(92vw, 360px)',
              height: 'min(92vw, 360px)',
              borderRadius: '50%',
              border: '1px solid rgba(188,0,251,0.36)',
              boxShadow: '0 0 34px rgba(188,0,251,0.34), inset 0 0 46px rgba(0,0,0,0.72)',
              background: 'conic-gradient(from 20deg, transparent, rgba(188,0,251,0.12), transparent, rgba(127,29,29,0.18), transparent)',
              animation: 'cursedSigilSpin 11s linear infinite',
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              width: 'min(68vw, 268px)',
              height: 'min(68vw, 268px)',
              borderRadius: '50%',
              border: '1px dashed rgba(127,29,29,0.55)',
              animation: 'cursedSigilSpin 7s linear reverse infinite',
            }}
          />
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: `${8 + ((i * 23) % 82)}%`,
                bottom: `${8 + ((i * 31) % 62)}%`,
                width: 2 + (i % 3),
                height: 18 + (i % 4) * 8,
                borderRadius: 99,
                background: i % 2 === 0 ? 'rgba(188,0,251,0.58)' : 'rgba(127,29,29,0.58)',
                filter: 'blur(0.5px)',
                animation: `vengeanceWisp ${2.2 + (i % 5) * 0.28}s ease-in-out infinite`,
                animationDelay: `${i * 0.13}s`,
              }}
            />
          ))}
          {CURSE_WORDS.map((word, i) => (
            <div
              key={word}
              className="absolute pointer-events-none"
              style={{
                left: `${12 + ((i * 17) % 76)}%`,
                top: `${18 + ((i * 23) % 58)}%`,
                color: i % 2 === 0 ? 'rgba(188,0,251,0.38)' : 'rgba(127,29,29,0.42)',
                fontFamily: "'Noto Sans JP', serif",
                fontSize: 22 + (i % 3) * 7,
                fontWeight: 900,
                textShadow: '0 0 16px rgba(188,0,251,0.8)',
                transform: `rotate(${(i - 2) * 12}deg)`,
                animation: `curseWordFloat ${3.4 + i * 0.22}s ease-in-out infinite`,
                animationDelay: `${i * 0.18}s`,
              }}
            >
              {word}
            </div>
          ))}
        </>
      )}

      {!revealed ? (
        <button
          type="button"
          onClick={stage === 'sealed' ? onReveal : undefined}
          className="relative flex flex-col items-center justify-center"
          style={{
            width: cursed ? 184 : premium ? 174 : 150,
            height: cursed ? 184 : premium ? 174 : 150,
            borderRadius: '50%',
            border: `2px solid ${style.color}88`,
            background: cursed
              ? 'radial-gradient(circle, rgba(188,0,251,0.76) 0%, rgba(60,0,26,0.86) 38%, rgba(2,1,8,0.98) 72%)'
              : premium
                ? `radial-gradient(circle, rgba(255,255,255,0.88) 0%, ${style.glow} 24%, rgba(10,5,18,0.96) 74%)`
                : `radial-gradient(circle, rgba(255,255,255,0.20) 0%, ${style.glow} 44%, rgba(8,5,16,0.96) 76%)`,
            color: style.color,
            boxShadow: cursed
              ? '0 0 48px rgba(188,0,251,0.72), inset 0 0 34px rgba(0,0,0,0.62)'
              : premium
                ? `0 0 42px ${style.glow}, inset 0 0 28px rgba(255,255,255,0.08)`
                : `0 0 20px ${style.glow}, inset 0 0 18px rgba(255,255,255,0.04)`,
            animation: stage === 'revealing'
              ? (cursed ? 'cursedDropShatter 1.15s ease-out both' : premium ? 'premiumDropBurst 0.82s ease-out both' : 'normalDropSettle 0.5s ease-out both')
              : (cursed ? 'cursedOrbEnter 0.72s cubic-bezier(0.2,1.2,0.18,1) both, cursedOrbPulse 1.15s ease-in-out 0.72s infinite' : premium ? 'premiumOrbEnter 0.62s cubic-bezier(0.2,1.2,0.18,1) both, premiumOrbPulse 1.55s ease-in-out 0.62s infinite' : 'dropOrbEnter 0.46s ease-out both, lootOrbPulse 2.2s ease-in-out 0.46s infinite'),
          }}
        >
          {cursed ? <Skull size={40} /> : premium ? <Sparkles size={38} /> : <Package size={32} />}
          <span
            style={{
              marginTop: 12,
              fontFamily: "'Cinzel', serif",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '0.16em',
              color: '#F0EAFF',
            }}
          >
            {stage === 'revealing' ? 'APPRAISING' : 'TAP TO APPRAISE'}
          </span>
          {cursed && (
            <span style={{ marginTop: 6, fontSize: 10, color: '#fca5a5', fontWeight: 700 }}>
              怨念反応
            </span>
          )}
        </button>
      ) : (
        <div
          className="relative"
          style={{
            width: 'min(330px, 100%)',
            borderRadius: 18,
            overflow: 'hidden',
            border: `1.5px solid ${style.color}AA`,
            background: style.background,
            boxShadow: cursed
              ? '0 0 42px rgba(188,0,251,0.50), 0 0 86px rgba(127,29,29,0.30), inset 0 0 34px rgba(0,0,0,0.62)'
              : premium
                ? `0 0 40px ${style.glow}, inset 0 0 30px rgba(0,0,0,0.42)`
                : `0 0 18px ${style.glow}, inset 0 0 20px rgba(0,0,0,0.44)`,
            animation: cursed ? 'cursedCardReveal 0.78s cubic-bezier(0.2,1,0.28,1) both' : 'cardReveal 0.58s cubic-bezier(0.34,1.3,0.64,1) both',
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
            style={{ background: cursed ? 'linear-gradient(90deg, #2b000d, #BC00FB, #7f1d1d, #BC00FB, #2b000d)' : `linear-gradient(90deg, transparent, ${style.color}, transparent)` }}
          />
          {isPremiumDrop(drop) && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(110deg, transparent 15%, rgba(255,255,255,0.18) 34%, transparent 54%)',
                animation: 'premiumLightSweep 1.35s ease-out 0.25s both',
              }}
            />
          )}
          {cursed && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 18% 28%, rgba(127,29,29,0.32), transparent 18%), radial-gradient(circle at 78% 18%, rgba(188,0,251,0.22), transparent 18%), linear-gradient(145deg, transparent, rgba(80,0,20,0.28))',
                mixBlendMode: 'screen',
                animation: 'cursedMiasma 2.2s ease-in-out infinite',
              }}
            />
          )}
          {cursed && (
            <>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(120deg, transparent 0 28%, rgba(188,0,251,0.18) 29%, transparent 31% 62%, rgba(127,29,29,0.18) 63%, transparent 65%), radial-gradient(circle at 50% -10%, rgba(0,0,0,0.84), transparent 46%)',
                  animation: 'cursedVeinCrawler 3.1s ease-in-out infinite',
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  left: 14,
                  right: 14,
                  top: 14,
                  bottom: 14,
                  border: '1px solid rgba(127,29,29,0.42)',
                  borderRadius: 14,
                  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.82), 0 0 18px rgba(127,29,29,0.24)',
                  animation: 'cursedFrameTwitch 1.45s steps(2, end) infinite',
                }}
              />
            </>
          )}

          <div style={{ padding: '16px 18px 18px', textAlign: 'center', position: 'relative' }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <RarityBadge drop={drop} />
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 900, color: style.color, letterSpacing: '0.14em' }}>
                {style.name}
              </span>
            </div>
            {cursed && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginBottom: 10,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(188,0,251,0.45)',
                  background: 'rgba(22,0,10,0.62)',
                  color: '#f3d1ff',
                  fontFamily: 'monospace',
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  boxShadow: '0 0 16px rgba(188,0,251,0.24)',
                }}
              >
                <Skull size={12} />
                怨念封入
              </div>
            )}
            <div
              style={{
                width: 82,
                height: 82,
                margin: '0 auto 12px',
                borderRadius: '50%',
                border: `2px solid ${style.color}80`,
                background: cursed
                  ? 'radial-gradient(circle, rgba(188,0,251,0.24), rgba(127,29,29,0.22), transparent 72%)'
                  : `radial-gradient(circle, ${style.glow}, transparent 72%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 38,
                boxShadow: cursed ? '0 0 28px rgba(188,0,251,0.72), inset 0 0 26px rgba(0,0,0,0.86)' : `0 0 24px ${style.glow}`,
                animation: cursed ? 'cursedIconPulse 1.18s ease-in-out infinite' : premium ? 'premiumIconFlare 1.6s ease-in-out infinite' : 'none',
              }}
            >
              {drop.icon ?? '✦'}
            </div>
            <div style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 21,
              fontWeight: 900,
              color: cursed ? '#fff2ff' : '#F0EAFF',
              lineHeight: 1.18,
              textShadow: cursed ? '0 0 10px rgba(188,0,251,0.9), 2px 0 0 rgba(127,29,29,0.44)' : 'none',
              animation: cursed ? 'cursedNameGlitch 1.9s steps(2, end) infinite' : 'none',
            }}>
              {drop.name}
            </div>
            <div style={{ marginTop: 5, color: '#8b7da8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
              {drop.type === 'WEAPON' ? 'WEAPON' : drop.quantity && drop.quantity > 1 ? `MATERIAL × ${drop.quantity}` : 'DROP'}
            </div>

            {drop.stats && Object.keys(drop.stats).length > 0 && (
              <div style={{ marginTop: 13, display: 'grid', gap: 7 }}>
                {Object.entries(drop.stats).slice(0, 5).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                    <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{STAT_LABEL[key] ?? key.toUpperCase()}</span>
                    <span style={{ color: style.color, fontFamily: "'Cinzel', serif", fontWeight: 900 }}>+{value}</span>
                  </div>
                ))}
              </div>
            )}

            {(drop.passive || drop.flavor || cursed) && (
              <div
                style={{
                  marginTop: 13,
                  padding: 10,
                  borderRadius: 8,
                  background: cursed ? 'rgba(30,0,12,0.42)' : 'rgba(0,0,0,0.25)',
                  border: `1px solid ${style.color}28`,
                  color: cursed ? '#f3d1ff' : '#a5a9b4',
                  fontSize: 10,
                  lineHeight: 1.6,
                  textAlign: 'left',
                }}
              >
                {cursed
                  ? (drop.flavor ?? '魔物たちの怨念が凝固した異質な武装。装備者の魂に干渉し、力を貸す代償を求める。')
                  : (drop.passive ?? drop.flavor)}
              </div>
            )}
            {cursed && drop.passive && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.34)',
                  border: '1px solid rgba(188,0,251,0.24)',
                  color: '#c9b6ff',
                  fontSize: 9,
                  lineHeight: 1.55,
                  textAlign: 'left',
                }}
              >
                呪能: {drop.passive}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
  const [screen, setScreen] = useState<'summary' | 'appraisal'>('summary');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dropStage, setDropStage] = useState<'sealed' | 'revealing' | 'revealed'>('sealed');
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [showCertificate, setShowCertificate] = useState(false);
  const [skipMode, setSkipMode] = useState(false);
  const revealTimerRef = useRef<number | null>(null);
  const skipTimersRef = useRef<number[]>([]);
  const { addExp } = useGameStore();

  const particles = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    left: 5 + ((i * 37) % 90),
    top: 5 + ((i * 53) % 88),
    size: 1.4 + (i % 4) * 0.7,
    delay: (i % 9) * 0.42,
    duration: 3.2 + (i % 5) * 0.55,
    color: i % 5 === 0 ? '#8A2BE2' : i % 5 === 1 ? '#fbbf24' : i % 5 === 2 ? '#c084fc' : i % 5 === 3 ? '#7f1d1d' : '#4a3a6a',
  })), []);

  const normalizedDrops = useMemo<ResultDrop[]>(() => {
    const drops = itemsGained.map((drop, index) => normalizeDrop(drop, index));
    return drops.length > 0 ? drops : DEFAULT_DROPS;
  }, [itemsGained]);

  const currentDrop = normalizedDrops[currentIndex] ?? normalizedDrops[0] ?? DEFAULT_UNIQUE;
  const currentRarity = normalizeRarity(currentDrop.rarity);
  const currentStyle = RARITY_STYLE[currentRarity];
  const hasCursedDrop = (isPurplePillar ?? false) || normalizedDrops.some(isCursedDrop);
  const rareSignalCount = normalizedDrops.filter(isPremiumDrop).length;
  const revealedSet = useMemo(() => new Set(revealedIds), [revealedIds]);
  const allRevealed = revealedIds.length >= normalizedDrops.length;
  const currentDropId = String(currentDrop.id ?? currentDrop.name);
  const currentIsCursed = isCursedDrop(currentDrop);
  const nextCursedIndex = normalizedDrops.findIndex((drop, index) => index >= currentIndex && isCursedDrop(drop));
  const skipDisabled = skipMode || dropStage === 'revealing' || currentIsCursed || allRevealed;
  const skipLabel = skipMode
    ? '高速鑑定中'
    : currentIsCursed
      ? (revealedSet.has(currentDropId) ? 'UR確認' : 'UR停止')
      : allRevealed
        ? '完了'
        : nextCursedIndex >= 0
          ? 'URまで'
          : '全開封';

  const certificateTarget = normalizedDrops.find(isCursedDrop) ?? currentDrop;
  const certificateItem = {
    ...DEFAULT_UNIQUE,
    ...certificateTarget,
    type: certificateTarget.type ?? 'WEAPON',
    rarity: 'HIDDEN_UNIQUE',
    stats: certificateTarget.stats ?? DEFAULT_UNIQUE.stats,
    isUnique: true,
  } as ItemData;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowContent(true);
      addExp(expGained);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [addExp, expGained]);

  const clearSkipTimers = () => {
    skipTimersRef.current.forEach(timer => window.clearTimeout(timer));
    skipTimersRef.current = [];
  };

  const markRevealed = (drop: ResultDrop) => {
    const id = String(drop.id ?? drop.name);
    setRevealedIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  useEffect(() => () => {
    clearSkipTimers();
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
  }, []);

  const mins = String(Math.floor(clearTime / 60)).padStart(2, '0');
  const secs = String(clearTime % 60).padStart(2, '0');

  const goToAppraisal = () => {
    haptic(hasCursedDrop ? [16, 24, 42] : [12, 18]);
    setScreen('appraisal');
  };

  const revealCurrentDrop = () => {
    if (dropStage !== 'sealed') return;
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    haptic(isCursedDrop(currentDrop) ? [18, 28, 45, 35, 70] : isPremiumDrop(currentDrop) ? [16, 26, 38] : [10, 16]);
    setDropStage('revealing');

    const revealDelay = isCursedDrop(currentDrop) ? 1180 : isPremiumDrop(currentDrop) ? 820 : 420;
    revealTimerRef.current = window.setTimeout(() => {
      markRevealed(currentDrop);
      setDropStage('revealed');
      revealTimerRef.current = null;
    }, revealDelay);
  };

  const skipToUnique = () => {
    if (skipDisabled) return;
    clearSkipTimers();
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    const stopIndex = normalizedDrops.findIndex((drop, index) => index >= currentIndex && isCursedDrop(drop));
    const revealUntil = stopIndex >= 0 ? stopIndex : normalizedDrops.length;
    const revealIndexes = normalizedDrops
      .map((drop, index) => ({ drop, index }))
      .filter(({ index }) => index >= currentIndex && index < revealUntil);

    setSkipMode(true);
    haptic([10, 14, 18]);

    if (revealIndexes.length === 0) {
      const timer = window.setTimeout(() => {
        if (stopIndex >= 0) {
          const stopDrop = normalizedDrops[stopIndex];
          const stopId = String(stopDrop.id ?? stopDrop.name);
          setCurrentIndex(stopIndex);
          setDropStage(revealedSet.has(stopId) ? 'revealed' : 'sealed');
          haptic([24, 36, 70]);
        }
        setSkipMode(false);
      }, 120);
      skipTimersRef.current.push(timer);
      return;
    }

    revealIndexes.forEach(({ drop, index }, step) => {
      const timer = window.setTimeout(() => {
        setCurrentIndex(index);
        markRevealed(drop);
        setDropStage('revealed');
      }, step * 110);
      skipTimersRef.current.push(timer);
    });

    const finishTimer = window.setTimeout(() => {
      if (stopIndex >= 0) {
        const stopDrop = normalizedDrops[stopIndex];
        const stopId = String(stopDrop.id ?? stopDrop.name);
        setCurrentIndex(stopIndex);
        setDropStage(revealedSet.has(stopId) ? 'revealed' : 'sealed');
        haptic([26, 42, 80]);
      } else {
        const lastIndex = Math.max(0, normalizedDrops.length - 1);
        setCurrentIndex(lastIndex);
        setDropStage('revealed');
      }
      setSkipMode(false);
      skipTimersRef.current = [];
    }, revealIndexes.length * 110 + 130);
    skipTimersRef.current.push(finishTimer);
  };

  const moveNext = () => {
    if (skipMode) return;
    if (currentIndex < normalizedDrops.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextDrop = normalizedDrops[nextIndex];
      const nextId = String(nextDrop.id ?? nextDrop.name);
      setCurrentIndex(nextIndex);
      setDropStage(revealedSet.has(nextId) ? 'revealed' : 'sealed');
      haptic([8, 12]);
      return;
    }
    onFinish();
  };

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        background: screen === 'appraisal'
          ? currentStyle.tier === 'cursed'
            ? 'radial-gradient(ellipse at 50% 42%, rgba(70,0,28,0.38), #07020f 58%, #03010a 100%)'
            : `radial-gradient(ellipse at 50% 42%, ${currentStyle.glow}, #07020f 56%, #03010a 100%)`
          : hasCursedDrop
            ? 'radial-gradient(ellipse at 50% 44%, rgba(138,43,226,0.18), #07020f 58%, #03010a 100%)'
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
              opacity: 0.44,
              animation: `particleRise ${p.duration}s ease-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {!showContent ? (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-[11px] animate-pulse tracking-[0.34em] uppercase" style={{ color: '#8A2BE2', fontFamily: 'monospace' }}>
            CALCULATING
          </div>
        </div>
      ) : screen === 'summary' ? (
        <div
          className="relative z-10 h-full flex flex-col"
          style={{ padding: 'max(18px, env(safe-area-inset-top, 18px)) 16px max(18px, env(safe-area-inset-bottom, 18px))' }}
        >
          <div style={{ textAlign: 'center', animation: 'resultSlideIn 0.45s ease-out both' }}>
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 9, color: '#8A2BE2', letterSpacing: '0.25em', marginBottom: 5 }}>
              BATTLE COMPLETE
            </div>
            <div
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 30,
                fontWeight: 900,
                color: isVictory ? '#fbbf24' : '#ef4444',
                letterSpacing: '0.06em',
                textShadow: isVictory ? '0 0 26px rgba(251,191,36,0.65)' : '0 0 22px rgba(239,68,68,0.58)',
              }}
            >
              {isVictory ? 'VICTORY' : 'DEFEAT'}
            </div>
          </div>

          <div className="flex justify-center" style={{ padding: '16px 0 10px', animation: 'rankPop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.18s both' }}>
            <div
              style={{
                width: 82,
                height: 82,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(251,191,36,0.28), #130b02)',
                border: '2.5px solid #fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 26px rgba(251,191,36,0.55)',
              }}
            >
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 42, fontWeight: 900, color: '#fbbf24' }}>S</span>
            </div>
          </div>

          <div
            className="grid grid-cols-3 overflow-hidden"
            style={{
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              animation: 'resultSlideIn 0.45s ease-out 0.12s both',
            }}
          >
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

          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              animation: 'resultSlideIn 0.45s ease-out 0.22s both',
            }}
          >
            <div className="flex justify-between items-baseline mb-2">
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 700, color: '#8A2BE2', letterSpacing: '0.12em' }}>EXPERIENCE</span>
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 15, fontWeight: 700, color: '#34d399' }}>+{expGained.toLocaleString()}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div
                style={{
                  '--exp-width': '74%',
                  width: '74%',
                  height: '100%',
                  borderRadius: 4,
                  background: 'linear-gradient(90deg,#4a0e8a,#8A2BE2,#34d399)',
                  animation: 'expGrow 1s cubic-bezier(0.34,1.2,0.64,1) 0.35s both',
                  boxShadow: '0 0 10px rgba(52,211,153,0.55)',
                } as CSSProperties}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto safe-scroll" style={{ marginTop: 12, animation: 'resultSlideIn 0.45s ease-out 0.32s both' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-2 mb-3" style={{ color: '#fbbf24' }}>
                <Package size={15} />
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em' }}>BATTLE REWARDS</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>ゴールド</span>
                  <span style={{ color: '#fbbf24', fontFamily: "'Cinzel', serif", fontWeight: 700 }}>+{goldGained.toLocaleString()}G</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>未鑑定戦利品</span>
                  <span style={{ color: '#8A2BE2', fontFamily: 'monospace', fontSize: 10 }}>{normalizedDrops.length} DROPS</span>
                </div>
                {rareSignalCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#fde68a', fontSize: 11 }}>高レア反応</span>
                    <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 10 }}>{rareSignalCount} SIGNALS</span>
                  </div>
                )}
                {monstersGained.map(monster => (
                  <div key={monster} className="flex items-center justify-between">
                    <span style={{ color: '#9ca3af', fontSize: 11 }}>{monster}</span>
                    <span style={{ color: '#c084fc', fontFamily: 'monospace', fontSize: 10 }}>CORE</span>
                  </div>
                ))}
              </div>
            </div>

            {hasCursedDrop && (
              <div
                style={{
                  marginTop: 10,
                  padding: '13px 14px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(80,0,18,0.34), rgba(138,43,226,0.18), rgba(3,1,8,0.82))',
                  border: '1px solid rgba(188,0,251,0.52)',
                  boxShadow: '0 0 28px rgba(188,0,251,0.28), inset 0 0 22px rgba(0,0,0,0.34)',
                }}
              >
                <div className="flex items-center gap-3">
                  <Skull size={20} color="#BC00FB" />
                  <div className="flex-1">
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700, color: '#BC00FB', letterSpacing: '0.14em' }}>
                      PURPLE PILLAR RESONANCE
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f3d1ff', marginTop: 2 }}>
                      怨念を含む異質な戦利品反応
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={goToAppraisal}
            style={{
              marginTop: 12,
              width: '100%',
              minHeight: 54,
              borderRadius: 14,
              border: `1.5px solid ${hasCursedDrop ? '#BC00FB' : 'rgba(138,43,226,0.65)'}`,
              background: hasCursedDrop
                ? 'linear-gradient(135deg, #2b0010, #8A2BE2, #4c0519)'
                : 'linear-gradient(135deg, rgba(138,43,226,0.34), rgba(88,28,135,0.24))',
              color: '#fff',
              fontFamily: "'Cinzel', serif",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.08em',
              boxShadow: hasCursedDrop ? '0 0 30px rgba(188,0,251,0.34)' : '0 0 20px rgba(138,43,226,0.25)',
            }}
          >
            鑑定へ進む
          </button>
        </div>
      ) : (
        <div
          className="relative z-10 h-full flex flex-col"
          style={{ padding: 'max(14px, env(safe-area-inset-top, 14px)) 14px max(14px, env(safe-area-inset-bottom, 14px))' }}
        >
          <div className="shrink-0 relative" style={{ textAlign: 'center', animation: 'resultSlideIn 0.32s ease-out both' }}>
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 9, color: currentStyle.color, letterSpacing: '0.24em' }}>
              APPRAISAL
            </div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 900, color: '#F0EAFF', marginTop: 5 }}>
              戦利品鑑定
            </div>
            <button
              type="button"
              onClick={skipToUnique}
              disabled={skipDisabled}
              aria-label="ユニークまでスキップ"
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                minHeight: 36,
                padding: '0 9px',
                borderRadius: 10,
                border: `1px solid ${skipDisabled ? 'rgba(255,255,255,0.10)' : 'rgba(188,0,251,0.45)'}`,
                background: skipDisabled ? 'rgba(255,255,255,0.035)' : 'rgba(80,0,28,0.28)',
                color: skipDisabled ? '#4a3a5a' : '#f3d1ff',
                fontFamily: 'monospace',
                fontSize: 9,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                opacity: skipDisabled ? 0.72 : 1,
                boxShadow: skipDisabled ? 'none' : '0 0 14px rgba(188,0,251,0.20)',
              }}
            >
              <FastForward size={13} />
              {skipLabel}
            </button>
          </div>

          <div className="shrink-0 safe-scroll" style={{ marginTop: 10, overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4 }}>
            {normalizedDrops.map((drop, index) => {
              const id = String(drop.id ?? drop.name);
              const revealed = revealedSet.has(id);
              const active = index === currentIndex;
              const rs = RARITY_STYLE[normalizeRarity(drop.rarity)];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(index);
                    setDropStage(revealed ? 'revealed' : 'sealed');
                  }}
                  style={{
                    flexShrink: 0,
                    minWidth: 92,
                    height: 52,
                    borderRadius: 10,
                    padding: '7px 9px',
                    border: `1px solid ${active ? rs.color + 'AA' : 'rgba(255,255,255,0.08)'}`,
                    background: active ? `${rs.color}1C` : 'rgba(255,255,255,0.035)',
                    boxShadow: active && rs.tier !== 'normal' ? `0 0 16px ${rs.glow}` : 'none',
                    textAlign: 'left',
                    animation: active && !revealed ? 'dropChipPulse 1.6s ease-in-out infinite' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <RarityBadge drop={drop} compact />
                    <span style={{ color: revealed ? '#34d399' : '#6b5f7a', fontFamily: 'monospace', fontSize: 9 }}>
                      {revealed ? 'OPEN' : '???'}
                    </span>
                  </div>
                  <div style={{ marginTop: 5, color: revealed ? '#F0EAFF' : '#6b5f7a', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {revealed ? drop.name : `未鑑定品 ${index + 1}`}
                  </div>
                </button>
              );
            })}
          </div>

          {skipMode && (
            <div
              className="shrink-0"
              style={{
                marginTop: 6,
                padding: '5px 10px',
                borderRadius: 999,
                border: '1px solid rgba(188,0,251,0.25)',
                background: 'rgba(80,0,28,0.18)',
                color: '#c084fc',
                fontFamily: 'monospace',
                fontSize: 9,
                fontWeight: 900,
                textAlign: 'center',
                letterSpacing: '0.08em',
                animation: 'skipScanPulse 0.72s ease-in-out infinite',
              }}
            >
              非ユニーク戦利品を高速鑑定中
            </div>
          )}

          <AppraisalField drop={currentDrop} stage={dropStage} onReveal={revealCurrentDrop} />

          <div className="shrink-0" style={{ display: 'flex', gap: 9, marginTop: 10 }}>
            {dropStage === 'revealed' && isCursedDrop(currentDrop) && (
              <button
                type="button"
                onClick={() => setShowCertificate(true)}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 12,
                  border: '1px solid rgba(188,0,251,0.60)',
                  background: 'rgba(80,0,28,0.28)',
                  color: '#f3d1ff',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 12,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Share2 size={15} />
                鑑定証
              </button>
            )}
            <button
              type="button"
              onClick={dropStage === 'sealed' ? revealCurrentDrop : dropStage === 'revealed' ? moveNext : undefined}
              disabled={dropStage === 'revealing' || skipMode}
              style={{
                flex: dropStage === 'revealed' && isCursedDrop(currentDrop) ? 1.35 : 1,
                minHeight: 50,
                borderRadius: 12,
                border: `1px solid ${currentStyle.color}88`,
                background: currentStyle.tier === 'cursed'
                  ? 'linear-gradient(135deg, rgba(80,0,28,0.72), rgba(139,0,255,0.52))'
                  : `linear-gradient(135deg, ${currentStyle.color}38, rgba(12,5,28,0.82))`,
                color: '#fff',
                fontFamily: "'Cinzel', serif",
                fontSize: 13,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                opacity: dropStage === 'revealing' || skipMode ? 0.65 : 1,
              }}
            >
              {skipMode && '高速鑑定中'}
              {!skipMode && dropStage === 'sealed' && (
                <>
                  <Eye size={15} />
                  鑑定する
                </>
              )}
              {!skipMode && dropStage === 'revealing' && '鑑定中'}
              {!skipMode && dropStage === 'revealed' && (
                <>
                  {allRevealed && currentIndex === normalizedDrops.length - 1 ? '獲得して戻る' : '次の戦利品'}
                  <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showCertificate && (
        <AppraisalCertificate item={certificateItem} onClose={() => setShowCertificate(false)} />
      )}
    </div>
  );
}
