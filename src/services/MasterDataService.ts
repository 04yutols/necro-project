import jobs from '../data/master/jobs.json';
import monsters from '../data/master/monsters.json';
import enemies from '../data/master/enemies.json';
import items from '../data/master/items.json';
import materials from '../data/master/materials.json';
import stages from '../data/master/stages.json';
import skills from '../data/master/skills.json';
import demonForms from '../data/master/demonForms.json';
import type { ResidueMatData } from '../types/game';

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

  public getEnemy(id: string) {
    return (enemies as any)[id];
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

  public getDemonForm(jobId: string) {
    return (demonForms as any)[jobId];
  }

  public getAllJobs() {
    return jobs;
  }

  public getAllMonsters() {
    return monsters;
  }

  public getAllEnemies() {
    return enemies;
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

  public getAllDemonForms() {
    return demonForms;
  }

  public getMaterial(id: string): ResidueMatData | undefined {
    return (materials as Record<string, ResidueMatData>)[id];
  }

  public getAllMaterials(): Record<string, ResidueMatData> {
    return materials as Record<string, ResidueMatData>;
  }
}
