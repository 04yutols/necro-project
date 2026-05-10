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
}

export const PHASE_STEPS: Record<TutorialPhase, TutorialStep[]> = {
  BATTLE_BASICS: [
    {
      id: 'TUT_B_01',
      targetId: 'attack-button',
      title: '通常攻撃',
      body: 'タップして敵を攻撃しよう。通常攻撃はいつでも使える基本行動だ。',
      position: 'above',
    },
    {
      id: 'TUT_B_02',
      targetId: 'energy-gauge',
      title: 'エネルギーゲージ',
      body: '攻撃するとENが溜まる。ENが一定以上になるとスキルが使えるようになる。',
      position: 'above',
    },
    {
      id: 'TUT_B_03',
      targetId: 'skill-button',
      title: 'スキル',
      body: '強力なスキルを使ってみよう。通常攻撃より大きなダメージを与えられる。',
      position: 'above',
    },
    {
      id: 'TUT_B_04',
      targetId: 'damage-popup',
      title: 'ダメージ',
      body: 'スキルの威力が数字で表示される。会心が出ると黄色く光る！',
      position: 'below',
    },
    {
      id: 'TUT_B_05',
      targetId: 'result-exp-display',
      title: '経験値',
      body: '戦闘後に経験値を獲得。職業レベルが上がると強力なパッシブが開放される。',
      position: 'above',
    },
  ],

  NECRO_LAB: [
    {
      id: 'TUT_N_01',
      targetId: 'soul-shard-panel',
      title: 'ソウルシャード',
      body: '倒した敵の魂。死霊術の素材になる。集めるほど強力なモンスターを呼べる。',
      position: 'below',
    },
    {
      id: 'TUT_N_02',
      targetId: 'monster-inventory',
      title: 'モンスター召喚',
      body: 'リストをタップして召喚の儀式を行おう。',
      position: 'above',
    },
    {
      id: 'TUT_N_03',
      targetId: 'summon-button',
      title: '召喚',
      body: 'コストを消費してモンスターを仲間にする。コストは死霊術レベルで上限が上がる。',
      position: 'above',
    },
    {
      id: 'TUT_N_04',
      targetId: 'monster-inventory',
      title: 'インベントリ',
      body: '獲得したモンスターはここに並ぶ。EQUIPタブで戦闘パーティに組み込もう。',
      position: 'above',
    },
  ],

  PARTY_FORMATION: [
    {
      id: 'TUT_L_01',
      targetId: 'party-slot-0',
      title: '軍団編成',
      body: '3体のモンスターを編成できる。スロットをタップしてモンスターを選ぼう。',
      position: 'below',
    },
    {
      id: 'TUT_L_02',
      targetId: 'party-cost-display',
      title: 'コスト制限',
      body: 'コスト合計がネクロランクの上限を超えないよう編成しよう。',
      position: 'above',
    },
    {
      id: 'TUT_L_03',
      targetId: 'synergy-banner',
      title: '種族シナジー',
      body: '同じ種族を揃えると強力なシナジー効果が発動する。積極的に狙おう。',
      position: 'above',
    },
    {
      id: 'TUT_L_04',
      targetId: 'party-slot-0',
      title: '編成完了',
      body: '3体セットが完了した。この編成で次のステージに挑もう！',
      position: 'below',
    },
  ],

  JOB_CHANGE: [
    {
      id: 'TUT_J_01',
      targetId: 'job-change-button',
      title: '職業転職',
      body: '新しい職業が解放された。職業を変えるとスキルとステータスが変わる。',
      position: 'below',
    },
    {
      id: 'TUT_J_02',
      targetId: 'job-change-button',
      title: '転職ボタン',
      body: 'タップして利用可能な職業を確認しよう。',
      position: 'below',
    },
    {
      id: 'TUT_J_03',
      targetId: 'job-stat-diff',
      title: 'ステータス変化',
      body: '青=上昇 / 赤=低下。自分のプレイスタイルに合った職業を選ぼう。',
      position: 'above',
    },
    {
      id: 'TUT_J_04',
      targetId: 'passive-bonus-panel',
      title: '転職パッシブ',
      body: '前の職業の経験は消えない。複数の職業を極めるほど強くなれる。',
      position: 'above',
    },
  ],

  ABYSSAL_RESIDUE: [
    {
      id: 'TUT_R_01',
      targetId: 'residue-slot-0',
      title: '深淵の残滓',
      body: '強力な残滓をスロットに嵌めてステータスを伸ばす。5部位それぞれに装着できる。',
      position: 'below',
    },
    {
      id: 'TUT_R_02',
      targetId: 'residue-main-stat',
      title: 'メインステート',
      body: 'スロットごとに強化できるステータスが異なる。厳選して最強の組み合わせを狙え。',
      position: 'above',
    },
    {
      id: 'TUT_R_03',
      targetId: 'residue-score',
      title: '残滓スコア',
      body: 'この数値が装備の総合力指標。高スコアを目指して周回しよう。',
      position: 'above',
    },
  ],

  DEMONIZATION: [
    {
      id: 'TUT_D_01',
      targetId: 'demon-gauge',
      title: '魔神化ゲージ',
      body: 'ゲージが満タンになると魔神化が発動できる。攻撃するたびに溜まっていく。',
      position: 'above',
    },
    {
      id: 'TUT_D_02',
      targetId: 'demon-button',
      title: '魔神化発動！',
      body: 'タップして魔神化を発動しよう。全ステータスが大幅に強化される。',
      position: 'above',
    },
    {
      id: 'TUT_D_03',
      targetId: 'demon-gauge',
      title: '魔神化持続',
      body: '3ターン間、強化された状態で戦える。魔族の血が解放された証だ。',
      position: 'above',
    },
    {
      id: 'TUT_D_04',
      targetId: 'skill-button',
      title: '魔神技',
      body: '魔神化中、奥義が強力な「魔神技」に変化していた。次回は積極的に使おう。',
      position: 'above',
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
