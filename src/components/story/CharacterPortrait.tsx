'use client';

import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import charactersData from '../../data/story/characters.json';
import type { CharacterPortrait as PortraitState, StoryCharacter } from '../../types/story';

const CHARACTERS = charactersData as Record<string, StoryCharacter>;

const POSITION_STYLE: Record<PortraitState['position'], CSSProperties> = {
  LEFT: { left: '7%', transform: 'translateX(0)' },
  CENTER: { left: '50%', transform: 'translateX(-50%)' },
  RIGHT: { right: '7%', transform: 'translateX(0)' },
};

const SYMBOL_BY_CHARACTER: Record<string, string> = {
  aldo: 'A',
  line: 'L',
  demon_king: '魔',
  narrator: '',
};

const EXPRESSION_TINT: Record<string, string> = {
  default: 'rgba(176,159,248,0.18)',
  determined: 'rgba(139,0,255,0.28)',
  sad: 'rgba(56,189,248,0.2)',
  shocked: 'rgba(250,204,21,0.2)',
  smile: 'rgba(212,175,55,0.2)',
  dying: 'rgba(239,68,68,0.28)',
  contempt: 'rgba(239,68,68,0.24)',
};

interface Props {
  portrait: PortraitState;
  isSpeaker: boolean;
}

export function CharacterPortrait({ portrait, isSpeaker }: Props) {
  const character = CHARACTERS[portrait.characterId];
  if (!character) return null;

  const dimmed = portrait.isDimmed || !isSpeaker;
  const tint = EXPRESSION_TINT[portrait.expression] ?? EXPRESSION_TINT.default;
  const symbol = SYMBOL_BY_CHARACTER[portrait.characterId] ?? character.nameEn.slice(0, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 34, scale: 0.96 }}
      animate={{
        opacity: dimmed ? 0.52 : 1,
        y: isSpeaker ? -6 : 0,
        scale: isSpeaker ? 1.025 : 0.96,
        filter: dimmed ? 'brightness(0.58) saturate(0.64)' : 'brightness(1.08) saturate(1.05)',
      }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        bottom: 0,
        width: 'clamp(116px, 34vw, 210px)',
        height: 'clamp(210px, 48dvh, 410px)',
        pointerEvents: 'none',
        ...POSITION_STYLE[portrait.position],
      }}
    >
      <div style={{
        position: 'absolute',
        inset: '0 10% 8%',
        borderRadius: '48% 48% 24% 24%',
        background: `radial-gradient(circle at 50% 22%, ${character.glow}, transparent 34%),
          linear-gradient(180deg, ${tint}, rgba(5,2,16,0.95) 62%, rgba(0,0,0,0.98))`,
        border: `1px solid ${character.color}66`,
        boxShadow: isSpeaker ? `0 0 34px ${character.glow}` : `0 0 14px ${character.glow}`,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '13%',
          left: '50%',
          width: '52%',
          aspectRatio: '1',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 42%, #f0eaff, ${character.color} 68%, rgba(5,2,16,0.92) 69%)`,
          boxShadow: `0 0 22px ${character.glow}`,
        }} />
        <div style={{
          position: 'absolute',
          top: '22%',
          left: '50%',
          transform: 'translateX(-50%)',
          color: portrait.characterId === 'demon_king' ? '#1a0008' : '#0a0612',
          fontFamily: "'Cinzel Decorative', serif",
          fontSize: 'clamp(22px, 7vw, 42px)',
          fontWeight: 900,
          textShadow: '0 1px 0 rgba(255,255,255,0.24)',
        }}>
          {symbol}
        </div>
        <div style={{
          position: 'absolute',
          left: '18%',
          right: '18%',
          bottom: '11%',
          height: '44%',
          borderRadius: '42% 42% 10% 10%',
          background: `linear-gradient(180deg, ${character.color}2b, rgba(7,3,18,0.98))`,
          border: `1px solid ${character.color}42`,
        }} />
        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: '4%',
          width: '72%',
          height: 18,
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: character.glow,
          filter: 'blur(12px)',
          opacity: 0.75,
        }} />
      </div>
      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: '3%',
        transform: 'translateX(-50%)',
        minWidth: 84,
        padding: '4px 9px',
        borderRadius: 999,
        color: character.color,
        background: 'rgba(5,2,16,0.78)',
        border: `1px solid ${character.color}44`,
        fontFamily: "'Noto Sans JP', sans-serif",
        fontSize: 10,
        fontWeight: 900,
        textAlign: 'center',
        boxShadow: `0 0 12px ${character.glow}`,
      }}>
        {character.nameJa}
      </div>
    </motion.div>
  );
}

export function getStoryCharacter(characterId: string | null | undefined): StoryCharacter | null {
  if (!characterId || characterId === 'narrator') return null;
  return CHARACTERS[characterId] ?? null;
}
