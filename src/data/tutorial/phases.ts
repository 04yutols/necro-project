export type TutorialPhase =
  | 'BATTLE_BASICS'
  | 'NECRO_LAB'
  | 'PARTY_FORMATION'
  | 'JOB_CHANGE'
  | 'ABYSSAL_RESIDUE'
  | 'DEMONIZATION';

export interface TutorialStep {
  id: string;
  targetId: string;
  title: string;
  body: string;
  position: 'above' | 'below' | 'left' | 'right';
  /** このステップを表示するタブ。'BATTLE'はisInBattle扱い */
  requiredTab?: string;
}

export const PHASE_STEPS: Record<TutorialPhase, TutorialStep[]> = {
  BATTLE_BASICS: [
    {
      id: 'TUT_B_01',
      targetId: 'tut-attack-btn',
      title: '攻撃',
      body: '「攻撃」をタップして敵を攻撃しよう。ターン制でお互いに行動する。',
      position: 'above',
      requiredTab: 'BATTLE',
    },
    {
      id: 'TUT_B_02',
      targetId: 'tut-soul-gauge',
      title: 'ソウルゲージ',
      body: '攻撃するたびに溜まる。MAXになると魔神化が発動できる。',
      position: 'above',
      requiredTab: 'BATTLE',
    },
    {
      id: 'TUT_B_03',
      targetId: 'tut-skill-btn',
      title: '術',
      body: '「術」をタップすると強力なスキルを選べる。ENを消費して使う。',
      position: 'above',
      requiredTab: 'BATTLE',
    },
  ],

  NECRO_LAB: [
    {
      id: 'TUT_N_01',
      targetId: 'tut-residue-slots',
      title: '残滓スロット',
      body: 'ここに「深淵の残滓」を装備してステータスを強化できる。3枠ある。',
      position: 'below',
      requiredTab: 'LAB',
    },
    {
      id: 'TUT_N_02',
      targetId: 'tut-residue-grid',
      title: '残滓一覧',
      body: '入手した残滓がここに並ぶ。タップして選択し、スロットにセットしよう。',
      position: 'above',
      requiredTab: 'LAB',
    },
    {
      id: 'TUT_N_03',
      targetId: 'tut-enhance-tab',
      title: '強化タブ',
      body: '素材を使って残滓をLv.20まで鍛えられる。メインステータスが大幅に上昇する。',
      position: 'below',
      requiredTab: 'LAB',
    },
  ],

  PARTY_FORMATION: [
    {
      id: 'TUT_L_01',
      targetId: 'tut-party-slot-0',
      title: '軍団編成',
      body: 'スロットをタップしてモンスターを選ぼう。最大3体まで編成できる。',
      position: 'below',
      requiredTab: 'EQUIP',
    },
    {
      id: 'TUT_L_02',
      targetId: 'tut-cost-display',
      title: 'コスト制限',
      body: '編成コストの合計がネクロランク上限を超えないよう注意しよう。',
      position: 'above',
      requiredTab: 'EQUIP',
    },
    {
      id: 'TUT_L_03',
      targetId: 'tut-synergy-banner',
      title: '種族シナジー',
      body: '同じ種族を揃えると強力なシナジー効果が発動する。積極的に狙おう！',
      position: 'below',
      requiredTab: 'EQUIP',
    },
  ],

  JOB_CHANGE: [
    {
      id: 'TUT_J_01',
      targetId: 'tut-job-rail',
      title: '職業選択',
      body: '横にスクロールして職業を選ぼう。それぞれ固有スキルとステータスを持つ。',
      position: 'below',
      requiredTab: 'JOB',
    },
    {
      id: 'TUT_J_02',
      targetId: 'tut-stat-change',
      title: 'ステータス変化',
      body: '青=上昇 / 赤=低下。転職後のステータスをここで事前確認できる。',
      position: 'above',
      requiredTab: 'JOB',
    },
    {
      id: 'TUT_J_03',
      targetId: 'tut-job-confirm',
      title: '転職',
      body: '「転職」ボタンで職業を変更。前職の経験は消えずに引き継がれる。',
      position: 'above',
      requiredTab: 'JOB',
    },
  ],

  ABYSSAL_RESIDUE: [
    {
      id: 'TUT_R_01',
      targetId: 'tut-residue-slots',
      title: '残滓を積極装備',
      body: '深淵ステージをクリアするほど強力な残滓が手に入る。全スロットを埋めよう。',
      position: 'below',
      requiredTab: 'LAB',
    },
    {
      id: 'TUT_R_02',
      targetId: 'tut-enhance-tab',
      title: '残滓を強化',
      body: '「強化」タブで素材を合成してレベルアップ。Lv.20でメインステータスが最大化する。',
      position: 'below',
      requiredTab: 'LAB',
    },
  ],

  DEMONIZATION: [
    {
      id: 'TUT_D_01',
      targetId: 'tut-soul-gauge',
      title: '魔神化ゲージ',
      body: '攻撃するたびに溜まる。MAXになると魔神化が使えるようになる！',
      position: 'above',
      requiredTab: 'BATTLE',
    },
    {
      id: 'TUT_D_02',
      targetId: 'tut-demon-btn',
      title: '魔神化発動！',
      body: '「魔神化」をタップして発動しよう。全ステータスが大幅強化される。',
      position: 'above',
      requiredTab: 'BATTLE',
    },
    {
      id: 'TUT_D_03',
      targetId: 'tut-demon-btn',
      title: '魔神技',
      body: '魔神化中は攻撃が「魔神技」に変化。3ターン間、圧倒的な力で戦え！',
      position: 'above',
      requiredTab: 'BATTLE',
    },
  ],
};

export const ALL_PHASES: TutorialPhase[] = [
  'BATTLE_BASICS',
  'NECRO_LAB',
  'PARTY_FORMATION',
  'JOB_CHANGE',
  'ABYSSAL_RESIDUE',
  'DEMONIZATION',
];

/** 新機能解放バナーのラベル */
export const BANNER_LABELS: Record<TutorialPhase, string> = {
  BATTLE_BASICS:   'バトル基礎が解放されました',
  NECRO_LAB:       'ネクロラボが解放されました',
  PARTY_FORMATION: '軍団編成が解放されました',
  JOB_CHANGE:      '職業転職が解放されました',
  ABYSSAL_RESIDUE: '深淵の残滓が解放されました',
  DEMONIZATION:    '魔神化システムが解放されました',
};
