'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
  isAuto?: boolean;
  onComplete?: () => void;
  /** 残りテキストを即時全表示させるトリガー */
  flush?: boolean;
}

const CHAR_MS = 40;
const CHAR_MS_AUTO = 20;
const SPACE_MS = 60;
const PUNCT_PAUSE_MS = 200;
const PUNCT = new Set(['。', '！', '？', '…', '.', '!', '?']);

export function TypewriterText({ text, isAuto = false, onComplete, flush }: Props) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeCalledRef = useRef(false);

  const finish = () => {
    setDisplayed(text);
    indexRef.current = text.length;
    if (!completeCalledRef.current) {
      completeCalledRef.current = true;
      onComplete?.();
    }
  };

  useEffect(() => {
    setDisplayed('');
    indexRef.current = 0;
    completeCalledRef.current = false;

    const tick = () => {
      const i = indexRef.current;
      if (i >= text.length) {
        if (!completeCalledRef.current) {
          completeCalledRef.current = true;
          onComplete?.();
        }
        return;
      }
      const char = text[i];
      setDisplayed(text.slice(0, i + 1));
      indexRef.current = i + 1;

      const base = isAuto ? CHAR_MS_AUTO : CHAR_MS;
      const extra = char === ' ' ? SPACE_MS - base : PUNCT.has(char) ? PUNCT_PAUSE_MS : 0;
      timerRef.current = setTimeout(tick, base + extra);
    };

    timerRef.current = setTimeout(tick, 0);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, isAuto]);

  useEffect(() => {
    if (flush && indexRef.current < text.length) {
      if (timerRef.current) clearTimeout(timerRef.current);
      finish();
    }
  }, [flush, text]);

  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>{displayed}</span>
  );
}
