import { MasterDataService } from './MasterDataService';
import type {
  AreaData,
  DemonFormData,
  EnemyData,
  ItemData,
  JobData,
  MonsterData,
  ResidueMatData,
  SkillData,
  StageData,
} from '../types/game';

type IsAny<T> = 0 extends (1 & T) ? true : false;
type AssertFalse<T extends false> = T;

type _MasterDataGetterReturnTypesAreNotAny = [
  AssertFalse<IsAny<ReturnType<MasterDataService['getJob']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getMonster']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getEnemy']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getItem']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getStage']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getArea']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getSkill']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getDemonForm']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getAllJobs']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getAllMonsters']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getAllEnemies']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getAllItems']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getAllStages']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getAllAreas']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getAllSkills']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getAllDemonForms']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getMaterial']>>>,
  AssertFalse<IsAny<ReturnType<MasterDataService['getAllMaterials']>>>,
];

const svc = MasterDataService.getInstance();

describe('MasterDataService typed accessors', () => {
  test('single getters return typed master data or undefined', () => {
    const job: JobData | undefined = svc.getJob('warrior');
    const monster: MonsterData | undefined = svc.getMonster('goblin');
    const enemy: EnemyData | undefined = svc.getEnemy('grave_soldier');
    const item: ItemData | undefined = svc.getItem('bone_cleaver');
    const stage: StageData | undefined = svc.getStage('area1_node1');
    const area: AreaData | undefined = svc.getArea('ch1_area1');
    const skill: SkillData | undefined = svc.getSkill('skill_warrior_1');
    const demonForm: DemonFormData | undefined = svc.getDemonForm('warrior');
    const material: ResidueMatData | undefined = svc.getMaterial('bone_chip');

    expect(job?.category).toBe('PHYSICAL');
    expect(monster?.id).toBe('goblin');
    expect(monster?.tribe).toBe('HUMANOID');
    expect(enemy?.id).toBe('grave_soldier');
    expect(item?.type).toBe('WEAPON');
    expect(stage?.id).toBe('area1_node1');
    expect(area?.nameJa).toBe('亡国の王都');
    expect(skill?.id).toBe('skill_warrior_1');
    expect(demonForm?.jobId).toBe('warrior');
    expect(material?.expValue).toBe(120);
    expect(svc.getJob('missing_job')).toBeUndefined();
  });

  test('all getters expose typed records', () => {
    const jobs: Record<string, JobData> = svc.getAllJobs();
    const monsters: Record<string, MonsterData> = svc.getAllMonsters();
    const enemies: Record<string, EnemyData> = svc.getAllEnemies();
    const items: Record<string, ItemData> = svc.getAllItems();
    const stages: Record<string, StageData> = svc.getAllStages();
    const areas: Record<string, AreaData> = svc.getAllAreas();
    const skills: Record<string, SkillData> = svc.getAllSkills();
    const demonForms: Record<string, DemonFormData> = svc.getAllDemonForms();
    const materials: Record<string, ResidueMatData> = svc.getAllMaterials();

    expect(jobs.warrior.displayName).toBe('剣士');
    expect(monsters.goblin.id).toBe('goblin');
    expect(enemies.grave_soldier.tier).toBe('MINION');
    expect(items.bone_cleaver.name).toBe('骨砕きの短剣');
    expect(stages.area1_node1.waveCount).toBeGreaterThan(0);
    expect(areas.ch2_area2.nameEn).toBe('PHANTOM CITY');
    expect(skills.skill_warrior_1.mpCost).toBe(5);
    expect(demonForms.warrior.formName).toBe('黒翼の剣聖');
    expect(materials.bone_chip.rarity).toBe('COMMON');
  });

  test('all jobs expose a matching ultimate skill in master data', () => {
    const jobs = svc.getAllJobs();
    const skills = svc.getAllSkills();

    Object.entries(jobs).forEach(([jobId, job]) => {
      const ultimateId = `ult_${jobId}`;
      expect(job.skills.some((entry) => entry.skillId === ultimateId)).toBe(true);
      expect(skills[ultimateId]).toMatchObject({
        id: ultimateId,
        isUltimate: true,
        mpCost: job.energyCurve.ultimateCost,
      });
    });
  });
});
