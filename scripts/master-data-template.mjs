#!/usr/bin/env node

import process from 'node:process';

const type = getArgValue('--type=') ?? 'enemy';
const id = getArgValue('--id=') ?? defaultId(type);
const tier = getArgValue('--tier=') ?? 'MINION';
const tribe = getArgValue('--tribe=') ?? 'UNDEAD';
const element = getArgValue('--element=') ?? 'DARK';
const nameJa = getArgValue('--nameJa=') ?? japanesePlaceholder(type);
const nameEn = getArgValue('--nameEn=') ?? toDisplayName(id);

function getArgValue(prefix) {
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function defaultId(templateType) {
  return ({
    enemy: 'new_enemy_id',
    stage: 'area1_node_new',
    weapon: 'new_weapon_id',
    material: 'new_material_id',
    monster: 'new_monster_id',
    skill: 'new_skill_id',
    drop: 'drop_entry',
  })[templateType] ?? 'new_entry_id';
}

function japanesePlaceholder(templateType) {
  return ({
    enemy: '新しい敵',
    stage: '新しい迷宮ノード',
    weapon: '新しい武器',
    material: '新しい素材',
    monster: '新しい魔物',
    skill: '新しいスキル',
    drop: '新しいドロップ',
  })[templateType] ?? '新しいデータ';
}

function toDisplayName(value) {
  return value.replace(/_/g, ' ').toUpperCase();
}

function statsForEnemy(enemyTier) {
  if (enemyTier === 'BOSS') {
    return { hp: 1200, atk: 160, def: 85, spd: 70, critRate: 8, critDmg: 165, effectHit: 20, effectRes: 35 };
  }
  if (enemyTier === 'ELITE') {
    return { hp: 650, atk: 110, def: 65, spd: 75, critRate: 5, critDmg: 150, effectHit: 10, effectRes: 20 };
  }
  return { hp: 260, atk: 55, def: 28, spd: 80, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 };
}

function templateEnemy() {
  const enemy = {
    id,
    name: toTitleCase(id),
    nameJa,
    nameEn,
    tier,
    tribe,
    stats: statsForEnemy(tier),
    resistances: { [element]: 20, LIGHT: -20 },
    weaknesses: ['LIGHT'],
    dropTable: [
      { type: 'MATERIAL', itemId: 'bone_chip', rarity: 'COMMON', rate: 0.75 },
    ],
    battle: {
      color: tier === 'BOSS' ? '#8A2BE2' : '#9ca3af',
      sprite: tier === 'BOSS' ? 'WYRM' : tier === 'ELITE' ? 'GIANT' : 'WRAITH',
      size: tier === 'BOSS' ? 1.05 : tier === 'ELITE' ? 0.9 : 0.72,
    },
    description: '設計意図: ここに役割、弱点、想定WAVEを記述する。',
  };
  if (tier === 'ELITE' || tier === 'BOSS') {
    enemy.shieldHp = tier === 'BOSS' ? 300 : 180;
    enemy.maxShieldHp = enemy.shieldHp;
  }
  if (tier === 'BOSS') {
    enemy.gimmicks = [
      { trigger: 'HP_BELOW_50', effect: 'ENRAGE', value: 1.35 },
      { trigger: 'ON_SHIELD_BREAK', effect: 'SUMMON_MINIONS', value: 2 },
    ];
  }
  return { [id]: enemy };
}

function templateStage() {
  return {
    [id]: {
      id,
      name: toTitleCase(id),
      nameJa,
      nameEn,
      chapter: 1,
      chapterName: '亡国の王都',
      area: 1,
      nodeType: 'DUNGEON',
      element,
      difficulty: 3,
      description: 'このノードで体験させたい戦闘テーマを1文で書く。',
      waveCount: 3,
      areaGimmick: 'NONE',
      unlockRequires: ['area1_node1'],
      waves: [
        { label: 'WAVE 1', role: 'WARMUP', enemyIds: ['grave_soldier', 'rot_hound'], intent: '導入。弱点属性と通常攻撃のテンポ確認。' },
        { label: 'WAVE 2', role: 'SHIELD', enemyIds: ['abyss_warden'], intent: '霊的防壁を割る判断を促す。' },
        { label: 'WAVE 3', role: 'BOSS', enemyIds: ['ossuary_wyrm_lord'], intent: 'ノードの主題ギミックを決着として出す。' },
      ],
      rewards: {
        baseExp: 1000,
        baseGold: 2200,
        dropTable: [
          { type: 'WEAPON', itemId: 'bleed_reaver', rarity: 'SR', rate: 0.16 },
          { type: 'RESIDUE', rarity: 'EPIC', rate: 0.45 },
        ],
      },
      position: { x: 500, y: 300 },
    },
  };
}

function templateWeapon() {
  return {
    [id]: {
      id,
      name: nameJa,
      type: 'WEAPON',
      rarity: 'SR',
      weaponRarity: 'SR',
      archetype: 'MID',
      rank: 1,
      ilv: 1,
      isUnique: false,
      stats: {},
      subOptions: [{ type: 'ATK%', value: 8 }],
      passiveA: {
        nameJa: '未命名パッシブ',
        descTemplate: '与ダメージが{value}%上昇する。',
        values: [6, 7, 8, 9, 10],
      },
      passiveB: {
        nameJa: '未命名共鳴',
        descTemplate: '条件達成時、攻撃力が{value}%上昇する。',
        values: [4, 5, 6, 7, 8],
      },
      flavor: '武器の由来や怨念を短く書く。',
    },
  };
}

function templateMaterial() {
  return {
    [id]: {
      id,
      name: nameJa,
      quantity: 1,
      expValue: 160,
      rarity: 'COMMON',
    },
  };
}

function templateMonster() {
  return {
    [id]: {
      name: toTitleCase(id),
      tribe,
      cost: 2,
      stats: { hp: 70, atk: 16, def: 10, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 10 },
      resistances: { [element]: 20, LIGHT: -20 },
    },
  };
}

function templateSkill() {
  return {
    [id]: {
      id,
      name: nameJa,
      mpCost: 10,
      power: 1.5,
      type: 'PHYSICAL',
      element,
      attackType: 'SLASH',
      targetType: 'SINGLE',
      effectKey: `${element.toLowerCase()}_slash`,
      description: '敵単体に属性ダメージを与える。',
    },
  };
}

function templateDrop() {
  return [
    { type: 'WEAPON', itemId: 'bleed_reaver', rarity: 'SR', rate: 0.12 },
    { type: 'RESIDUE', rarity: 'RARE', rate: 0.8 },
    { type: 'MATERIAL', itemId: 'bone_chip', rarity: 'COMMON', rate: 0.75 },
  ];
}

function toTitleCase(value) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function main() {
  const templates = {
    enemy: templateEnemy,
    stage: templateStage,
    weapon: templateWeapon,
    material: templateMaterial,
    monster: templateMonster,
    skill: templateSkill,
    drop: templateDrop,
  };
  const build = templates[type];
  if (!build) {
    console.error('Unknown --type. Use enemy, stage, weapon, material, monster, skill, or drop.');
    process.exit(1);
  }

  console.log(JSON.stringify(build(), null, 2));
}

main();
