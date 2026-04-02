import jobs from '../data/master/jobs.json';
import monsters from '../data/master/monsters.json';
import items from '../data/master/items.json';
import stages from '../data/master/stages.json';
import skills from '../data/master/skills.json';

export class MasterDataService {
  private static instance: MasterDataService;

  private constructor() {}

  public static getInstance(): MasterDataService {
    if (!MasterDataService.instance) {
      MasterDataService.instance = new MasterDataService();
    }
    return MasterDataService.instance;
  }

  public getJob(id: string) {
    return (jobs as any)[id];
  }

  public getMonster(id: string) {
    return (monsters as any)[id];
  }

  public getItem(id: string) {
    return (items as any)[id];
  }

  public getStage(id: string) {
    return (stages as any)[id];
  }

  public getSkill(id: string) {
    return (skills as any)[id];
  }

  public getAllJobs() {
    return jobs;
  }

  public getAllMonsters() {
    return monsters;
  }

  public getAllItems() {
    return items;
  }

  public getAllStages() {
    return stages;
  }

  public getAllSkills() {
    return skills;
  }
}
