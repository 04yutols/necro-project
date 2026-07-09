/**
 * ストーリーシーン草稿の決定論的「構造」バリデータ（LLM 不使用の純関数）。
 *
 * 設計書 104: ストーリーは「正しさ（構造・参照）」と「良さ（物語）」が分離する。
 * このバリデータは構造・参照のみを機械検証する（口調や物語の質は測らない＝人間が選ぶ）。
 * speaker/expression/trigger 参照、type別必須、id 一意などを PASS/WARN/FAIL で返す。
 */

export type StoryValidationLevel = 'PASS' | 'WARN' | 'FAIL';
export type StoryValidationFinding = { level: StoryValidationLevel; field: string; message: string };
export type StoryValidationResult = { ok: boolean; findings: StoryValidationFinding[] };

export type StoryCharacterLite = { id?: string; expressions?: string[] };

export type StoryValidationContext = {
  /** characters.json（speaker/expression 参照）。 */
  characters: Record<string, StoryCharacterLite>;
  /** stages.json のキー集合（trigger.stageId / bossStageId / navigateTo 参照）。 */
  stageIds: Set<string>;
  /** areas.json のキー集合（trigger.areaId / onComplete.unlockArea 参照）。 */
  areaIds: Set<string>;
  /** 既存シーンID集合（対象自身は除外して渡す）。 */
  existingSceneIds: Set<string>;
};

export const VALID_SCENE_TYPES = ['DIALOGUE', 'MONOLOGUE', 'ENVIRONMENT', 'CHAPTER_TITLE', 'CHOICE'] as const;
export const VALID_TRIGGER_TYPES = [
  'GAME_START', 'FLAG_SET', 'STAGE_CLEAR', 'STAGE_ENTER', 'AREA_UNLOCK', 'BOSS_CLEAR', 'DEMONIZE_FIRST', 'MANUAL',
] as const;
export const VALID_PORTRAIT_POSITIONS = ['LEFT', 'CENTER', 'RIGHT'] as const;
/** 会話系（lines が必須の type）。 */
const LINE_REQUIRED_TYPES = ['DIALOGUE', 'MONOLOGUE', 'ENVIRONMENT'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** trigger を検証し、参照切れを findings に積む。 */
function validateTrigger(
  trigger: unknown,
  ctx: StoryValidationContext,
  push: (level: StoryValidationLevel, field: string, msg: string) => void,
): void {
  if (!isRecord(trigger)) {
    push('FAIL', 'trigger', 'trigger が存在しません。');
    return;
  }
  const t = trigger.type;
  if (typeof t !== 'string' || !VALID_TRIGGER_TYPES.includes(t as (typeof VALID_TRIGGER_TYPES)[number])) {
    push('FAIL', 'trigger.type', `trigger.type は ${VALID_TRIGGER_TYPES.join(' / ')} のいずれかである必要があります（現在: ${String(t)}）。`);
    return;
  }
  // variant 別の必須フィールド + 参照
  const ref = (key: string, set: Set<string>, label: string) => {
    const v = trigger[key];
    if (typeof v !== 'string' || v.trim() === '') {
      push('FAIL', `trigger.${key}`, `${t} トリガーには ${key} が必要です。`);
    } else if (!set.has(v)) {
      push('FAIL', `trigger.${key}`, `${key} "${v}" が ${label} に存在しません。`);
    } else {
      push('PASS', `trigger.${key}`, `${key} 参照 "${v}" OK`);
    }
  };
  switch (t) {
    case 'STAGE_CLEAR':
    case 'STAGE_ENTER':
      ref('stageId', ctx.stageIds, 'stages.json');
      break;
    case 'BOSS_CLEAR':
      ref('bossStageId', ctx.stageIds, 'stages.json');
      break;
    case 'AREA_UNLOCK':
      ref('areaId', ctx.areaIds, 'areas.json');
      break;
    case 'FLAG_SET':
      if (typeof trigger.flagKey !== 'string' || trigger.flagKey.trim() === '') {
        push('FAIL', 'trigger.flagKey', 'FLAG_SET トリガーには flagKey が必要です。');
      }
      break;
    case 'MANUAL':
      if (typeof trigger.sceneId !== 'string' || trigger.sceneId.trim() === '') {
        push('FAIL', 'trigger.sceneId', 'MANUAL トリガーには sceneId が必要です。');
      }
      break;
    default:
      break; // GAME_START / DEMONIZE_FIRST は追加フィールド不要
  }
}

export function validateStoryScene(scene: unknown, ctx: StoryValidationContext): StoryValidationResult {
  const findings: StoryValidationFinding[] = [];
  const push = (level: StoryValidationLevel, field: string, message: string) => findings.push({ level, field, message });
  const fail = (f: string, m: string) => push('FAIL', f, m);
  const warn = (f: string, m: string) => push('WARN', f, m);
  const pass = (f: string, m: string) => push('PASS', f, m);

  if (!isRecord(scene)) {
    return { ok: false, findings: [{ level: 'FAIL', field: 'root', message: '草稿がオブジェクトではありません。' }] };
  }

  // --- id ---
  if (typeof scene.id !== 'string' || scene.id.trim() === '') {
    fail('id', 'id は非空の文字列である必要があります。');
  } else {
    if (!/^[A-Z0-9_]+$/.test(scene.id)) warn('id', `id "${scene.id}" は UPPER_SNAKE 慣習（例 CH1_OPEN）を推奨します。`);
    if (ctx.existingSceneIds.has(scene.id)) fail('id', `id "${scene.id}" は既存シーンと重複しています。`);
  }

  // --- type ---
  const type = scene.type;
  const typeValid = typeof type === 'string' && VALID_SCENE_TYPES.includes(type as (typeof VALID_SCENE_TYPES)[number]);
  if (!typeValid) {
    fail('type', `type は ${VALID_SCENE_TYPES.join(' / ')} のいずれかである必要があります（現在: ${String(type)}）。`);
  }

  // --- trigger ---
  validateTrigger(scene.trigger, ctx, push);

  // --- 共通必須 ---
  if (typeof scene.archiveTitle !== 'string' || scene.archiveTitle.trim() === '') {
    fail('archiveTitle', 'archiveTitle は非空の文字列である必要があります。');
  }
  if (!Number.isInteger(scene.archiveChapter)) {
    fail('archiveChapter', 'archiveChapter は整数である必要があります。');
  }
  if (typeof scene.isSkippable !== 'boolean') {
    fail('isSkippable', 'isSkippable は boolean である必要があります。');
  }

  // --- type 別必須 ---
  if (type === 'CHAPTER_TITLE') {
    if (typeof scene.title !== 'string' || scene.title.trim() === '') fail('title', 'CHAPTER_TITLE には title が必要です。');
    if (typeof scene.titleEn !== 'string' || scene.titleEn.trim() === '') warn('titleEn', 'CHAPTER_TITLE には titleEn を推奨します。');
  }

  // --- lines ---
  const lines = scene.lines;
  if (!Array.isArray(lines)) {
    fail('lines', 'lines は配列である必要があります（無ければ []）。');
  } else {
    if (typeof type === 'string' && LINE_REQUIRED_TYPES.includes(type) && lines.length === 0) {
      fail('lines', `${type} シーンには 1 つ以上の lines が必要です。`);
    }
    lines.forEach((ln, i) => {
      if (!isRecord(ln)) {
        fail(`lines[${i}]`, 'line がオブジェクトではありません。');
        return;
      }
      // speaker: null（ナレーション）or characters のキー
      const sp = ln.speaker;
      let speakerChar: StoryCharacterLite | undefined;
      if (sp !== null && sp !== undefined) {
        if (typeof sp !== 'string' || !(sp in ctx.characters)) {
          fail(`lines[${i}].speaker`, `speaker "${String(sp)}" が characters.json に存在しません（ナレーションは null）。`);
        } else {
          speakerChar = ctx.characters[sp];
          pass(`lines[${i}].speaker`, `speaker "${sp}" OK`);
        }
      }
      // text 必須
      if (typeof ln.text !== 'string' || ln.text.trim() === '') {
        fail(`lines[${i}].text`, 'text は非空の文字列である必要があります。');
      }
      // textEn は二言語慣習（WARN）
      if (ln.textEn !== undefined && typeof ln.textEn !== 'string') {
        fail(`lines[${i}].textEn`, 'textEn は文字列である必要があります。');
      } else if (ln.textEn === undefined && typeof ln.text === 'string' && ln.text.trim() !== '') {
        warn(`lines[${i}].textEn`, 'textEn（英語訳）がありません。二言語対応を推奨します。');
      }
      // expression: speaker の expressions に含まれること
      if (ln.expression !== undefined) {
        const exprs = speakerChar?.expressions ?? [];
        if (typeof ln.expression !== 'string') {
          fail(`lines[${i}].expression`, 'expression は文字列である必要があります。');
        } else if (speakerChar && exprs.length > 0 && !exprs.includes(ln.expression)) {
          fail(`lines[${i}].expression`, `expression "${ln.expression}" は speaker の表情（${exprs.join('/')}）に含まれません。`);
        }
      }
      // portraits
      if (ln.portraits !== undefined) {
        if (!Array.isArray(ln.portraits)) {
          fail(`lines[${i}].portraits`, 'portraits は配列である必要があります。');
        } else {
          ln.portraits.forEach((p, j) => {
            if (!isRecord(p)) {
              fail(`lines[${i}].portraits[${j}]`, 'portrait がオブジェクトではありません。');
              return;
            }
            const cid = p.characterId;
            if (typeof cid !== 'string' || !(cid in ctx.characters)) {
              fail(`lines[${i}].portraits[${j}].characterId`, `characterId "${String(cid)}" が characters.json に存在しません。`);
            }
            if (typeof p.position !== 'string' || !VALID_PORTRAIT_POSITIONS.includes(p.position as (typeof VALID_PORTRAIT_POSITIONS)[number])) {
              fail(`lines[${i}].portraits[${j}].position`, `position は ${VALID_PORTRAIT_POSITIONS.join('/')} のいずれかである必要があります。`);
            }
            if (typeof p.expression === 'string' && typeof cid === 'string') {
              const exprs = ctx.characters[cid]?.expressions ?? [];
              if (exprs.length > 0 && !exprs.includes(p.expression)) {
                fail(`lines[${i}].portraits[${j}].expression`, `expression "${p.expression}" が "${cid}" の表情に含まれません。`);
              }
            }
          });
        }
      }
    });
  }

  // --- onComplete 参照 ---
  if (scene.onComplete !== undefined) {
    if (!isRecord(scene.onComplete)) {
      fail('onComplete', 'onComplete はオブジェクトである必要があります。');
    } else {
      const oc = scene.onComplete;
      if (oc.unlockArea !== undefined) {
        if (typeof oc.unlockArea !== 'string' || !ctx.areaIds.has(oc.unlockArea)) {
          fail('onComplete.unlockArea', `unlockArea "${String(oc.unlockArea)}" が areas.json に存在しません。`);
        }
      }
      if (oc.navigateTo !== undefined) {
        if (typeof oc.navigateTo !== 'string' || !ctx.stageIds.has(oc.navigateTo)) {
          fail('onComplete.navigateTo', `navigateTo "${String(oc.navigateTo)}" が stages.json に存在しません。`);
        }
      }
      if (oc.setFlag !== undefined && (typeof oc.setFlag !== 'string' || oc.setFlag.trim() === '')) {
        fail('onComplete.setFlag', 'setFlag は非空の文字列である必要があります。');
      }
    }
  }

  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・参照すべて問題ありません。');
  }
  return { ok, findings };
}

export function storyFindingsToFeedback(findings: StoryValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
