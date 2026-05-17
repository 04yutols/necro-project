'use client';

import { BookOpen, Lock, Play } from 'lucide-react';
import { STORY_SCENES } from '../../data/story';
import { useStoryStore } from '../../store/useStoryStore';

export function StoryArchive() {
  const viewedScenes = useStoryStore(state => state.viewedScenes);
  const playScene = useStoryStore(state => state.playScene);
  const viewed = new Set(viewedScenes);

  return (
    <div className="safe-scroll" style={{
      height: '100%',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      padding: 12,
      display: 'grid',
      gap: 10,
      alignContent: 'start',
      background: 'linear-gradient(180deg, rgba(5,2,16,0.96), rgba(2,1,8,0.98))',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        color: '#8B00FF',
        fontFamily: "'Cinzel Decorative', serif",
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.14em',
        textShadow: '0 0 14px rgba(139,0,255,0.58)',
      }}>
        <BookOpen size={15} />
        STORY ARCHIVE
      </div>

      {STORY_SCENES.map(scene => {
        const isViewed = viewed.has(scene.id);
        return (
          <div key={scene.id} style={{
            minHeight: 92,
            borderRadius: 8,
            padding: 12,
            display: 'grid',
            gap: 9,
            background: isViewed
              ? 'linear-gradient(135deg, rgba(139,0,255,0.14), rgba(5,2,16,0.9))'
              : 'rgba(255,255,255,0.035)',
            border: `1px solid ${isViewed ? 'rgba(139,0,255,0.32)' : 'rgba(255,255,255,0.08)'}`,
            boxShadow: isViewed ? '0 0 18px rgba(139,0,255,0.12)' : 'none',
            opacity: isViewed ? 1 : 0.55,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  color: isViewed ? '#D4AF37' : '#6b5f7a',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 8,
                  fontWeight: 900,
                  letterSpacing: '0.13em',
                }}>
                  CH.{scene.archiveChapter} / {scene.type}
                </div>
                <div style={{
                  marginTop: 4,
                  color: '#f0eaff',
                  fontFamily: "'Noto Sans JP', sans-serif",
                  fontSize: 14,
                  fontWeight: 900,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {scene.archiveTitle}
                </div>
                {scene.titleEn && (
                  <div style={{
                    marginTop: 2,
                    color: 'rgba(160,145,200,0.58)',
                    fontFamily: "'IM Fell English', serif",
                    fontSize: 10,
                    fontStyle: 'italic',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {scene.titleEn}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={!isViewed}
                onClick={() => playScene(scene.id)}
                aria-label={`${scene.archiveTitle}を再生`}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  border: `1px solid ${isViewed ? 'rgba(212,175,55,0.45)' : 'rgba(255,255,255,0.08)'}`,
                  background: isViewed ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.035)',
                  color: isViewed ? '#D4AF37' : '#4a3a5a',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {isViewed ? <Play size={16} /> : <Lock size={15} />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
