import { MasterDataService } from './src/services/MasterDataService';

const masterData = MasterDataService.getInstance();
const job = masterData.getJob('warrior');
console.log('Job:', job);

const skills = job?.skills;
console.log('Skills array:', skills);

const skillData = masterData.getSkill('skill_warrior_1');
console.log('Skill data:', skillData);
