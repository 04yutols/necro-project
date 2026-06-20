import type {
  NecroStatus,
  PassiveBonuses,
  ResidueMatData,
  UserJobState,
  WeaponMaterialData,
} from './game';

export const PLAYER_SAVE_SCHEMA_VERSION = 2 as const;
export const MIN_SUPPORTED_PLAYER_SAVE_SCHEMA_VERSION = 1 as const;
export type PlayerSaveSchemaVersion =
  typeof MIN_SUPPORTED_PLAYER_SAVE_SCHEMA_VERSION
  | typeof PLAYER_SAVE_SCHEMA_VERSION;

export interface PlayerSaveData {
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

// Historical name retained for existing imports. The active payload version is PlayerSaveData.
export type PlayerSaveV1 = PlayerSaveData;
