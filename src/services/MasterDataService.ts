import jobs from '../data/master/jobs.json';
import monsters from '../data/master/monsters.json';
import enemies from '../data/master/enemies.json';
import items from '../data/master/items.json';
import materials from '../data/master/materials.json';
import stages from '../data/master/stages.json';
import skills from '../data/master/skills.json';
import demonForms from '../data/master/demonForms.json';
import type {
  DemonFormData,
  EnemyData,
  ItemData,
  JobData,
  MonsterData,
  ResidueMatData,
  SkillData,
  StageData,
} from '../types/game';

type MasterRecord<T> = Record<string, T>;
type MonsterMasterEntry = Omit<MonsterData, 'id'> & Partial<Pick<MonsterData, 'id'>>;

const JOBS = jobs as unknown as MasterRecord<JobData>;
const MONSTERS = monsters as unknown as MasterRecord<MonsterMasterEntry>;
const ENEMIES = enemies as unknown as MasterRecord<EnemyData>;
const ITEMS = items as unknown as MasterRecord<ItemData>;
const MATERIALS = materials as unknown as MasterRecord<ResidueMatData>;
const STAGES = stages as unknown as MasterRecord<StageData>;
const SKILLS = skills as unknown as MasterRecord<SkillData>;
const DEMON_FORMS = demonForms as unknown as MasterRecord<DemonFormData>;

function withMonsterId(id: string, monster: MonsterMasterEntry): MonsterData {
  return { ...monster, id: monster.id ?? id };
}

export class MasterDataService {
  private static instance: MasterDataService;

  private constructor() {}

  public static getInstance(): MasterDataService {
    if (!MasterDataService.instance) {
      MasterDataService.instance = new MasterDataService();
    }
    return MasterDataService.instance;
  }

  public getJob(id: string): JobData | undefined {
    return JOBS[id];
  }

  public getMonster(id: string): MonsterData | undefined {
    const monster = MONSTERS[id];
    return monster ? withMonsterId(id, monster) : undefined;
  }

  public getEnemy(id: string): EnemyData | undefined {
    return ENEMIES[id];
  }

  public getItem(id: string): ItemData | undefined {
    return ITEMS[id];
  }

  public getStage(id: string): StageData | undefined {
    return STAGES[id];
  }

  public getSkill(id: string): SkillData | undefined {
    return SKILLS[id];
  }

  public getDemonForm(jobId: string): DemonFormData | undefined {
    return DEMON_FORMS[jobId];
  }

  public getAllJobs(): MasterRecord<JobData> {
    return JOBS;
  }

  public getAllMonsters(): MasterRecord<MonsterData> {
    return Object.fromEntries(
      Object.entries(MONSTERS).map(([id, monster]) => [id, withMonsterId(id, monster)])
    ) as MasterRecord<MonsterData>;
  }

  public getAllEnemies(): MasterRecord<EnemyData> {
    return ENEMIES;
  }

  public getAllItems(): MasterRecord<ItemData> {
    return ITEMS;
  }

  public getAllStages(): MasterRecord<StageData> {
    return STAGES;
  }

  public getAllSkills(): MasterRecord<SkillData> {
    return SKILLS;
  }

  public getAllDemonForms(): MasterRecord<DemonFormData> {
    return DEMON_FORMS;
  }

  public getMaterial(id: string): ResidueMatData | undefined {
    return MATERIALS[id];
  }

  public getAllMaterials(): MasterRecord<ResidueMatData> {
    return MATERIALS;
  }
}
