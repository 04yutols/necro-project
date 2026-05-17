import type {
  AbyssalResidueData,
  CharacterData,
  ItemData,
  MonsterData,
  NecroStatus,
  SoulShardData,
} from './game';

export interface ServerGameData {
  player: CharacterData;
  necroStatus: NecroStatus;
  party: (MonsterData | null)[];
  inventoryMonsters: MonsterData[];
  soulShards: SoulShardData[];
  inventoryItems: ItemData[];
  abyssalResidues: AbyssalResidueData[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
}

export interface ServerGameUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

export type LoadCharacterResult =
  | { success: false; status: 'UNAUTHENTICATED' | 'ERROR'; error: string }
  | { success: true; status: 'NO_CHARACTER'; user: ServerGameUser }
  | { success: true; status: 'READY'; user: ServerGameUser; data: ServerGameData };

export type CreateCharacterResult =
  | { success: false; error: string }
  | { success: true; data: ServerGameData };
