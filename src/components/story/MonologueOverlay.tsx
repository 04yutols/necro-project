'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FastForward } from 'lucide-react';
import type { StoryScene } from '../../types/story';
import { useStoryStore } from '../../store/useStoryStore';
import { TypewriterText } from './TypewriterText';

interface Props {
  scene: StoryScene;
  onDone: () => void;
}

export function MonologueOverlay({ scene, onDone }: Props) {
  const isViewed = useStoryStore(state => state.isViewed);
  const [lineIndex, setLineIndex] = useState(0);
  const [lineComplete, setLineComplete] = useState(false);
  const [flush, setFlush] = useState(false);

  const current = scene.lines[lineIndex];
  const isLast = lineIndex >= scene.lines.length - 1;
  const canSkip = scene.isSkippable || isViewed(scene.id);

  const handleTap = () => {
    if (!lineComplete) {
      setFlush(true);
      return;
    }
    if (isLast) {
      onDone();
    } else {
      setLineIndex(i => i + 1);
      setLineComplete(false);
      setFlush(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onClick={handleTap}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(2,1,10,0.94)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 10vw',
        cursor: 'pointer',
      }}
    >
      {canSkip && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDone();
          }}
          aria-label="スキップ"
          style={{
            position: 'absolute',
            top: 'max(16px, env(safe-area-inset-top, 16px))',
            right: 16,
            minWidth: 74,
            height: 34,
            borderRadius: 10,
            border: '1px solid rgba(212,175,55,0.38)',
            background: 'rgba(5,2,16,0.78)',
            color: '#D4AF37',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: "'Cinzel', serif",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '0.08em',
          }}
        >
          <FastForward size={14} />
          SKIP
        </button>
      )}

      {/* ✦ アクセント */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{
          marginBottom: 32,
          fontSize: 14,
          color: '#8B00FF',
          textShadow: '0 0 12px rgba(139,0,255,0.8)',
          letterSpacing: '1em',
        }}
      >
        ✦
      </motion.div>

      {/* テキスト */}
      <motion.div
        key={lineIndex}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 16,
          lineHeight: 2.0,
          color: '#F0EAFF',
          textAlign: 'center',
          letterSpacing: '0.04em',
          maxWidth: 480,
        }}
      >
        <TypewriterText
          text={current?.text ?? ''}
          flush={flush}
          onComplete={() => setLineComplete(true)}
        />
      </motion.div>

      {/* 英語サブタイトル */}
      {current?.textEn && lineComplete && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            fontFamily: "'IM Fell English', serif",
            fontSize: 11,
            fontStyle: 'italic',
            color: 'rgba(160,145,200,0.5)',
            textAlign: 'center',
            marginTop: 12,
            lineHeight: 1.6,
            maxWidth: 460,
          }}
        >
          {current.textEn}
        </motion.p>
      )}

      {/* Void Purple アクセントライン */}
      {lineComplete && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 60, opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            marginTop: 28,
            height: 1,
            background: '#8B00FF',
            boxShadow: '0 0 8px rgba(139,0,255,0.8)',
          }}
        />
      )}

      {/* 進行インジケータ */}
      {lineComplete && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          style={{
            position: 'absolute', bottom: 32, right: 32,
            fontFamily: "'Cinzel', serif",
            fontSize: 9,
            color: '#8B8370',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          {isLast ? 'Tap to close' : 'Tap to continue'}
        </motion.p>
      )}
    </motion.div>
  );
}
