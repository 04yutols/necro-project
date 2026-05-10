'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { StoryScene } from '../../types/story';

interface Props {
  scene: StoryScene;
  onDone: () => void;
}

export function ChapterTitleCard({ scene, onDone }: Props) {
  const titleChars = (scene.title ?? '').split('');

  useEffect(() => {
    const AUTO_DISMISS_MS = 4200;
    const timer = setTimeout(onDone, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [scene.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onClick={onDone}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(2,1,10,0.96)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '0 8vw',
        cursor: 'pointer',
      }}
    >
      {/* 章番号 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        style={{
          fontFamily: "'Cinzel', serif",
          fontSize: 11,
          color: 'rgba(160,145,200,0.7)',
          letterSpacing: '0.2em',
          marginBottom: 10,
          textTransform: 'uppercase',
        }}
      >
        Chapter {scene.archiveChapter}
      </motion.p>

      {/* Void Purple ライン */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: '85%', opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{
          height: 1,
          background: 'linear-gradient(90deg, #8B00FF, transparent)',
          boxShadow: '0 0 10px rgba(139,0,255,0.6)',
          marginBottom: 18,
        }}
      />

      {/* 章タイトル */}
      <div
        style={{
          fontFamily: "'Cinzel Decorative', serif",
          fontSize: 28,
          color: '#F0EAFF',
          letterSpacing: '0.4em',
          textShadow: '0 0 20px rgba(139,0,255,0.4)',
          marginBottom: 12,
        }}
      >
        {titleChars.map((char, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 1.0 + i * 0.08 }}
            style={{ display: 'inline-block' }}
          >
            {char}
          </motion.span>
        ))}
      </div>

      {/* 英語サブタイトル */}
      {scene.titleEn && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.6 }}
          style={{
            fontFamily: "'IM Fell English', serif",
            fontSize: 12,
            fontStyle: 'italic',
            color: 'rgba(160,145,200,0.6)',
            letterSpacing: '0.1em',
            marginBottom: 20,
          }}
        >
          {scene.titleEn}
        </motion.p>
      )}

      {/* 説明テキスト */}
      {scene.description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.8 }}
          style={{
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: 12,
            color: 'rgba(200,190,230,0.75)',
            lineHeight: 1.9,
            maxWidth: 360,
          }}
        >
          {scene.description}
        </motion.p>
      )}

      {/* タップヒント */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 0.4, delay: 2.8 }}
        style={{
          position: 'absolute', bottom: 32, right: 32,
          fontFamily: "'Cinzel', serif",
          fontSize: 9,
          color: '#8B8370',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        Tap to continue
      </motion.p>
    </motion.div>
  );
}
