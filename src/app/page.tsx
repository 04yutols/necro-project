'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { StoryOrchestrator } from '../components/story/StoryOrchestrator';
import { StoryArchive } from '../components/story/StoryArchive';
import { useStoryTrigger } from '../hooks/useStoryTrigger';
import { useStoryStore } from '../store/useStoryStore';
import { TutorialOrchestrator } from '../components/tutorial/TutorialOrchestrator';
import { useBGM } from '../hooks/useBGM';
import { useAuthFlow } from '../hooks/useAuthFlow';

const BattleCanvas = dynamic(() => import('../components/battle/BattleCanvas').then((mod) => mod.default), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center bg-[#050505] text-primary font-mono animate-pulse text-[10px] tracking-widest uppercase">Initializing...</div>
});

import NecroLab from '../components/necro/NecroLab';
import LegionHub from '../components/legion/LegionHub';
import JobChangeScreen from '../components/job/JobChangeScreen';
import AreaMap from '../components/map/AreaMap';
import ShardEquipModal from '../components/necro/ShardEquipModal';
import { HomeHero } from '../components/home/HomeHero';
import { ResponsiveFrame } from '../components/layout/ResponsiveFrame';
import { NecroLog } from '../components/ui/NecroLog';
import { WorldLogPanel } from '../components/social/WorldLogPanel';
import { AuthGate } from '../components/auth/AuthGate';
import { CharacterCreation } from '../components/auth/CharacterCreation';
import { LoadingScreen } from '../components/auth/LoadingScreen';
import { ReloginModal } from '../components/auth/ReloginModal';
import { Home as HomeIcon } from 'lucide-react';

function GameContent() {
  const {
    player, party, equippingMonsterId, inventoryMonsters,
    setEquippingMonsterId, addClearedStage, battleLogs,
    currentTab, setCurrentTab
  } = useGameStore();
  const authFlow = useAuthFlow();

  const { triggerStageEnter } = useStoryTrigger();
  const activeStoryScene = useStoryStore(s => s.activeScene);
  const storyQueueLength = useStoryStore(s => s.sceneQueue.length);

  const [isInBattle, setIsInBattle] = useState(false);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [logPanel, setLogPanel] = useState<'STORY' | 'BATTLE' | 'WORLD'>('STORY');
  const { unlockAudio } = useBGM({
    currentTab,
    isInBattle,
    activeStageId,
    storyActive: Boolean(activeStoryScene || storyQueueLength > 0),
  });

  const equippingMonster = equippingMonsterId ? inventoryMonsters.find(m => m.id === equippingMonsterId) : null;

  const startStageNow = useCallback((stageId: string) => {
    setActiveStageId(stageId);
    setIsInBattle(true);
    setCurrentTab('BATTLE');
  }, [setCurrentTab]);

  const requestStageStart = useCallback((stageId: string) => {
    if (triggerStageEnter(stageId)) {
      setPendingStageId(stageId);
      return;
    }
    startStageNow(stageId);
  }, [startStageNow, triggerStageEnter]);

  useEffect(() => {
    if (!pendingStageId || activeStoryScene || storyQueueLength > 0) return;
    const stageId = pendingStageId;
    setPendingStageId(null);
    startStageNow(stageId);
  }, [activeStoryScene, pendingStageId, startStageNow, storyQueueLength]);

  if (authFlow.status === 'authRequired') {
    return <AuthGate onAuthenticated={authFlow.reload} />;
  }

  if (authFlow.status === 'characterRequired') {
    return <CharacterCreation initialName={authFlow.user?.name ?? authFlow.user?.email ?? null} onCreated={authFlow.reload} />;
  }

  if (authFlow.status === 'error') {
    return (
      <div className="h-[100dvh] w-full bg-[#050505] flex items-center justify-center p-5 text-center">
        <div style={{
          width: 'min(420px, 100%)',
          borderRadius: 18,
          border: '1px solid rgba(139,0,0,0.35)',
          background: 'rgba(16,4,12,0.92)',
          padding: 18,
          color: '#F0EAFF',
          boxShadow: '0 24px 70px rgba(0,0,0,0.65)',
        }}>
          <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>SYNC ERROR</div>
          <p style={{ margin: '0 0 14px', color: '#A5A9B4', fontSize: 12, lineHeight: 1.7 }}>{authFlow.error}</p>
          <button
            type="button"
            onClick={authFlow.retry}
            style={{
              minHeight: 44,
              width: '100%',
              borderRadius: 13,
              border: '1px solid rgba(139,0,255,0.48)',
              background: 'rgba(139,0,255,0.16)',
              color: '#F0EAFF',
              fontWeight: 900,
              letterSpacing: '0.12em',
            }}
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  const isCloudLoading = authFlow.status === 'checking' || authFlow.status === 'loadingCharacter';
  if (!player && isCloudLoading) {
    return (
      <LoadingScreen
        label={authFlow.status === 'loadingCharacter' ? 'Loading Character' : 'Cloud Save Sync'}
        detail={authFlow.status === 'loadingCharacter' ? '契約者データを復元しています' : 'セッションを確認しています'}
      />
    );
  }

  if (!player) {
    return <LoadingScreen />;
  }

  // タブに応じたメインコンテンツのレンダリング (除外: BattleCanvas)
  const renderMainContent = () => {
    switch (currentTab) {
      case 'HOME':
        return (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
            <HomeHero />
          </motion.div>
        );
      case 'MAP':
        return (
          <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
            <AreaMap onStartStage={(stageId) => {
              requestStageStart(stageId);
            }} />
          </motion.div>
        );
      case 'BATTLE':
        return (
          <motion.div key="no-battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col items-center justify-center bg-[#050505] text-[#A5A9B4]">
            <div className="text-center">
              <p className="mb-4 font-mono text-sm tracking-widest uppercase">No Active Battle</p>
              <button
                onClick={() => setCurrentTab('MAP')}
                className="px-6 py-2 bg-[#1A1A1A] border border-[#2C2C2C] text-secondary hover:bg-[#2C2C2C] transition-colors font-bold tracking-widest text-xs uppercase"
              >
                Deploy to Map
              </button>
            </div>
          </motion.div>
        );
      case 'EQUIP':
        return (
          <motion.div key="equip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
            <LegionHub />
          </motion.div>
        );
      case 'JOB':
        return (
          <motion.div key="job" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
            <JobChangeScreen />
          </motion.div>
        );
      case 'LAB':
        return (
          <motion.div key="lab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
            <NecroLab />
          </motion.div>
        );
      case 'LOGS':
        return (
          <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col p-2 pt-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <button
                onClick={() => setCurrentTab('HOME')}
                className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-[10px] font-black tracking-widest uppercase bg-black/40 border border-[#1A1A1A] px-3 py-1.5 rounded-md backdrop-blur-sm shadow-md"
              >
                <HomeIcon size={14} />
                <span>RETURN TO HUB</span>
              </button>
              <div className="flex rounded-md overflow-hidden border border-[#2C2C2C] bg-black/40">
                {(['STORY', 'BATTLE', 'WORLD'] as const).map(panel => (
                  <button
                    key={panel}
                    type="button"
                    onClick={() => setLogPanel(panel)}
                    className="px-3 py-1.5 text-[9px] font-black tracking-widest uppercase transition-colors"
                    style={{
                      color: logPanel === panel ? '#F0EAFF' : '#6b5f7a',
                      background: logPanel === panel ? 'rgba(139,0,255,0.22)' : 'transparent',
                    }}
                  >
                    {panel === 'STORY' ? '物語' : panel === 'BATTLE' ? '戦歴' : '世界'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 border border-[#1A1A1A] bg-[#0D0D0D] overflow-hidden p-2">
              {logPanel === 'STORY' ? <StoryArchive /> : logPanel === 'BATTLE' ? <NecroLog logs={battleLogs} /> : <WorldLogPanel />}
            </div>
          </motion.div>
        );
      default:
        return (
          <motion.div key="home-default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full">
            <HomeHero />
          </motion.div>
        );
    }
  };

  const emptySidebar = <div className="hidden" />;

  // MAP と BATTLE は全画面（ナビバーなし）でレンダリング
  const isFullscreen = isInBattle || currentTab === 'MAP';

  return (
    <>
      <TutorialOrchestrator />
      <StoryOrchestrator>
      <div
        className="h-[100dvh] w-full bg-[#050505] selection:bg-secondary/30 overflow-hidden"
        onPointerDownCapture={unlockAudio}
        onTouchStartCapture={unlockAudio}
      >
        <AnimatePresence mode="wait">
          {isInBattle ? (
            <motion.div
              key="battle-active"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden' }}
            >
              <BattleCanvas stageId={activeStageId ?? undefined} onEnd={() => {
                setIsInBattle(false);
                if (activeStageId) addClearedStage(activeStageId);
                setCurrentTab('MAP');
              }} />
            </motion.div>
          ) : currentTab === 'MAP' ? (
            <motion.div
              key="map-fullscreen"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, zIndex: 9999 }}
            >
              <AreaMap onStartStage={(stageId) => {
                requestStageStart(stageId);
              }} />
            </motion.div>
          ) : (
            <ResponsiveFrame
              leftSidebar={emptySidebar}
              mainMonitor={
                <AnimatePresence mode="wait">
                  {renderMainContent()}
                </AnimatePresence>
              }
              rightSidebar={emptySidebar}
            />
          )}
        </AnimatePresence>

        {equippingMonster && (
          <ShardEquipModal
            monster={equippingMonster}
            onClose={() => setEquippingMonsterId(null)}
          />
        )}
        <ReloginModal open={authFlow.status === 'sessionExpired'} onRecovered={authFlow.reload} />
      </div>
      </StoryOrchestrator>
    </>
  );
}

export default function Home() {
  return <GameContent />;
}
