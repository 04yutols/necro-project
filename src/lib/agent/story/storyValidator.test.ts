import { validateStoryScene, storyFindingsToFeedback, type StoryValidationContext } from './storyValidator';

const CTX: StoryValidationContext = {
  characters: {
    aldo: { id: 'aldo', expressions: ['default', 'sad', 'determined'] },
    narrator: { id: 'narrator', expressions: [] },
  },
  stageIds: new Set(['area1_node1', 'area1_boss']),
  areaIds: new Set(['ch1_area1']),
  existingSceneIds: new Set(['CH1_OPEN']),
};

function validScene(): Record<string, unknown> {
  return {
    id: 'CH1_NEW',
    type: 'DIALOGUE',
    trigger: { type: 'STAGE_CLEAR', stageId: 'area1_node1' },
    isSkippable: true,
    archiveTitle: '王都の再会',
    archiveChapter: 1,
    lines: [
      { speaker: 'aldo', text: '…懐かしいな。', textEn: '...How nostalgic.', expression: 'sad' },
      { speaker: null, text: '風が吹き抜けた。', textEn: 'The wind blew through.' },
    ],
  };
}

describe('validateStoryScene - valid', () => {
  it('passes a well-formed dialogue scene', () => {
    const res = validateStoryScene(validScene(), CTX);
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
});

describe('validateStoryScene - speaker / expression', () => {
  it('FAILs when speaker is not a known character', () => {
    const d = validScene();
    (d.lines as Record<string, unknown>[])[0].speaker = 'ghost';
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });

  it('allows null speaker (narration)', () => {
    const d = validScene();
    d.lines = [{ speaker: null, text: 'ナレーション。', textEn: 'Narration.' }];
    expect(validateStoryScene(d, CTX).ok).toBe(true);
  });

  it("FAILs when expression is not in the speaker's expressions", () => {
    const d = validScene();
    (d.lines as Record<string, unknown>[])[0].expression = 'laughing';
    const res = validateStoryScene(d, CTX);
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => /expression/.test(f.field))).toBe(true);
  });
});

describe('validateStoryScene - trigger references', () => {
  it('FAILs when STAGE_CLEAR stageId does not exist', () => {
    const d = validScene();
    d.trigger = { type: 'STAGE_CLEAR', stageId: 'area9_x' };
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });

  it('FAILs on invalid trigger type', () => {
    const d = validScene();
    d.trigger = { type: 'ON_LOGIN' };
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });

  it('FAILs when AREA_UNLOCK areaId is missing', () => {
    const d = validScene();
    d.trigger = { type: 'AREA_UNLOCK' };
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });

  it('GAME_START needs no extra field', () => {
    const d = validScene();
    d.trigger = { type: 'GAME_START' };
    expect(validateStoryScene(d, CTX).ok).toBe(true);
  });
});

describe('validateStoryScene - type-specific & structure', () => {
  it('FAILs when CHAPTER_TITLE lacks title', () => {
    const d = {
      id: 'CH2_TITLE', type: 'CHAPTER_TITLE', trigger: { type: 'GAME_START' },
      isSkippable: true, archiveTitle: 'x', archiveChapter: 2, lines: [],
    };
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });

  it('FAILs when a DIALOGUE scene has no lines', () => {
    const d = validScene();
    d.lines = [];
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });

  it('FAILs on id collision (existing scene)', () => {
    const d = validScene();
    d.id = 'CH1_OPEN';
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });

  it('WARNs on missing textEn', () => {
    const d = validScene();
    d.lines = [{ speaker: 'aldo', text: '日本語だけ。' }];
    const res = validateStoryScene(d, CTX);
    expect(res.findings.some((f) => /textEn/.test(f.field) && f.level === 'WARN')).toBe(true);
  });

  it('FAILs when line text is empty', () => {
    const d = validScene();
    (d.lines as Record<string, unknown>[])[0].text = '';
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });
});

describe('validateStoryScene - onComplete & portraits', () => {
  it('FAILs when onComplete.unlockArea does not exist', () => {
    const d = validScene();
    d.onComplete = { unlockArea: 'ch9_area9' };
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });

  it('FAILs on invalid portrait position', () => {
    const d = validScene();
    (d.lines as Record<string, unknown>[])[0].portraits = [{ characterId: 'aldo', position: 'TOP', expression: 'sad' }];
    expect(validateStoryScene(d, CTX).ok).toBe(false);
  });
});

describe('storyFindingsToFeedback', () => {
  it('formats only non-PASS findings', () => {
    const d = validScene();
    d.trigger = { type: 'STAGE_CLEAR', stageId: 'nope' };
    const fb = storyFindingsToFeedback(validateStoryScene(d, CTX).findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).not.toContain('[PASS]');
  });
});
