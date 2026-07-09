export type TutorialPhase =
  | 'BATTLE_BASICS'
  | 'PARTY_FORMATION'
  | 'WEAPON_EQUIP'
  | 'DEMONIZATION'
  | 'ABYSSAL_RESIDUE';

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
      title: 'スキル',
      body: '「スキル」をタップすると強力な技を選べる。MPを消費して使う。',
      position: 'above',
      requiredTab: 'BATTLE',
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

  WEAPON_EQUIP: [
    {
      id: 'TUT_W_01',
      targetId: 'tut-weapon-slot',
      title: '武器',
      body: 'ステージで得た武器はここから確認できる。装備するとアルドの攻撃力が伸びる。',
      position: 'below',
      requiredTab: 'EQUIP',
    },
    {
      id: 'TUT_W_02',
      targetId: 'tut-weapon-equip-btn',
      title: '装備',
      body: '新しい武器を選んで「装備」。性能差を見て、今の戦い方に合う刃を持とう。',
      position: 'above',
      requiredTab: 'EQUIP',
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
  'PARTY_FORMATION',
  'WEAPON_EQUIP',
  'DEMONIZATION',
  'ABYSSAL_RESIDUE',
];

/** 新機能解放バナーのラベル */
export const BANNER_LABELS: Record<TutorialPhase, string> = {
  BATTLE_BASICS:   'バトル基礎が解放されました',
  PARTY_FORMATION: '軍団編成が解放されました',
  WEAPON_EQUIP:    '武器の装備が解放されました',
  ABYSSAL_RESIDUE: '深淵の残滓が解放されました',
  DEMONIZATION:    '魔神化システムが解放されました',
};
