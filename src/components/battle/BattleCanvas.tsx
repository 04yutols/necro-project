'use client';

import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../../store/useGameStore';
import { BattleEngine } from '../../logic/BattleEngine';
import { BattleLog } from '../../types/game';

interface BattleCanvasProps {
  onEnd: () => void;
}

export default function BattleCanvas({ onEnd }: BattleCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { player, party } = useGameStore();
  const appRef = useRef<PIXI.Application | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !player) return;

    const initPixi = async () => {
      const app = new PIXI.Application();
      await app.init({
        width: 800,
        height: 600,
        backgroundColor: 0x050505,
        antialias: true,
      });
      appRef.current = app;
      canvasRef.current?.appendChild(app.canvas);

      // モックターゲット
      const target = {
        name: 'スケルトン兵',
        stats: { hp: 50, mp: 0, atk: 15, def: 5, matk: 0, mdef: 2, agi: 5, luck: 0, tec: 5 },
      };

      // バトルエンジン起動
      const engine = new BattleEngine(player, party);
      const logs = engine.simulateAction('PHYSICAL_ATTACK', target);

      // ログプレイヤーの開始
      playLogs(app, logs);
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [player, party]);

  const playLogs = async (app: PIXI.Application, logs: BattleLog[]) => {
    for (const log of logs) {
      await showLogAnimation(app, log);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  };

  const showLogAnimation = async (app: PIXI.Application, log: BattleLog) => {
    const container = new PIXI.Container();
    app.stage.addChild(container);

    // テキスト表示
    const style = new PIXI.TextStyle({
      fontFamily: 'monospace',
      fontSize: 24,
      fill: log.action.includes('ATTACK') ? '#ff0000' : '#ffffff',
      fontWeight: 'bold',
      dropShadow: {
        alpha: 0.5,
        angle: 4.7,
        blur: 4,
        color: '#000000',
        distance: 2,
      },
    });

    const text = new PIXI.Text({ text: `${log.actorName}: ${log.description}`, style });
    text.x = 100;
    text.y = 250;
    container.addChild(text);

    // ダメージポップアップ
    if (log.damage !== undefined) {
      const damageText = new PIXI.Text({
        text: log.damage.toString(),
        style: { ...style, fontSize: 48, fill: log.isCritical ? '#ffff00' : '#ff0000' }
      });
      damageText.x = 500;
      damageText.y = 200;
      container.addChild(damageText);

      // シェイク演出
      const originalX = app.stage.x;
      for (let i = 0; i < 6; i++) {
        app.stage.x += (Math.random() - 0.5) * 20;
        await new Promise(r => setTimeout(r, 20));
        app.stage.x = originalX;
      }
    }

    // フェードアウト
    let alpha = 1.0;
    const fadeOut = () => {
      alpha -= 0.05;
      container.alpha = alpha;
      if (alpha <= 0) {
        app.stage.removeChild(container);
        app.ticker.remove(fadeOut);
      }
    };
    app.ticker.add(fadeOut);
  };

  return (
    <div className="flex flex-col items-center">
      <div ref={canvasRef} className="border-4 border-blood/50 shadow-2xl rounded" />
      <div className="mt-4 p-4 bg-black/80 border border-blood w-[800px] text-sm text-green-500 font-mono overflow-y-auto h-32">
        {/* ここにリアルタイムログを表示 */}
        {"> "} 戦闘開始...
      </div>
    </div>
  );
}
