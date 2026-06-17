import type { ResidueMatData } from './game';

export const PLAYER_SAVE_SCHEMA_VERSION = 1 as const;

export interface PlayerSaveV1 {
  schemaVersion: typeof PLAYER_SAVE_SCHEMA_VERSION;
  residueMaterials: ResidueMatData[];
  transmutationPoints: number;
}

export type PlayerSaveData = PlayerSaveV1;
