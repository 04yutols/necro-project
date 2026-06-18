import type {
  NecroStatus,
  PassiveBonuses,
  ResidueMatData,
  UserJobState,
  WeaponMaterialData,
} from './game';

export const PLAYER_SAVE_SCHEMA_VERSION = 1 as const;

export interface PlayerSaveV1 {
  schemaVersion: typeof PLAYER_SAVE_SCHEMA_VERSION;
  player: {
    name: string;
    currentJobId: string;
    gold: number;
    clearedStages: string[];
    jobs: UserJobState[];
    passives: PassiveBonuses;
    necroStatus: NecroStatus;
    equipmentIds: {
      weapon: string | null;
      sub: string | null;
      head: string | null;
      body: string | null;
      arms: string | null;
      legs: string | null;
      acc1: string | null;
      acc2: string | null;
    };
    partyMonsterIds: [string | null, string | null, string | null];
    equippedResidueIds: [string | null, string | null, string | null, string | null, string | null];
  };
  weaponMaterials: WeaponMaterialData[];
  residueMaterials: ResidueMatData[];
  transmutationPoints: number;
}

export type PlayerSaveData = PlayerSaveV1;
