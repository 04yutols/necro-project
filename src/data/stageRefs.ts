import { ABYSSAL_RESIDUE_UNLOCK_STAGE_ID } from '../logic/AbyssalResidueUnlockSystem';
import {
  TUTORIAL_BATTLE_STAGE_IDS,
  TUTORIAL_CHAIN_STAGE_IDS,
  TUTORIAL_VIRTUAL_STAGE_IDS,
} from './tutorial/triggers';

export type CodeReferencedStageId = {
  id: string;
  referencedBy: string;
};

export type StageReferenceFinding = {
  level: 'PASS' | 'FAIL';
  id: string;
  referencedBy: string;
  message: string;
};

const VIRTUAL_STAGE_ID_SET = new Set<string>(TUTORIAL_VIRTUAL_STAGE_IDS);

const tutorialBattleStageRefs: CodeReferencedStageId[] = TUTORIAL_BATTLE_STAGE_IDS
  .filter(stageId => !VIRTUAL_STAGE_ID_SET.has(stageId))
  .map(stageId => ({
    id: stageId,
    referencedBy: 'data/tutorial/triggers.TUTORIAL_BATTLE_STAGE_IDS',
  }));

const tutorialChainStageRefs: CodeReferencedStageId[] = Object.entries(TUTORIAL_CHAIN_STAGE_IDS)
  .map(([phase, stageId]) => ({
    id: stageId,
    referencedBy: `data/tutorial/triggers.TUTORIAL_CHAIN_STAGE_IDS.${phase}`,
  }));

export const CODE_REFERENCED_STAGE_IDS: CodeReferencedStageId[] = [
  {
    id: ABYSSAL_RESIDUE_UNLOCK_STAGE_ID,
    referencedBy: 'logic/AbyssalResidueUnlockSystem.ABYSSAL_RESIDUE_UNLOCK_STAGE_ID',
  },
  ...tutorialBattleStageRefs,
  ...tutorialChainStageRefs,
];

export function validateCodeReferencedStageIds(
  stageIds: ReadonlySet<string>,
): StageReferenceFinding[] {
  return CODE_REFERENCED_STAGE_IDS.map(ref => {
    if (stageIds.has(ref.id)) {
      return {
        level: 'PASS' as const,
        id: ref.id,
        referencedBy: ref.referencedBy,
        message: `コード参照 stage ID "${ref.id}" OK（${ref.referencedBy}）`,
      };
    }

    return {
      level: 'FAIL' as const,
      id: ref.id,
      referencedBy: ref.referencedBy,
      message: `コード参照 stage ID "${ref.id}" が stages.json に存在しません（${ref.referencedBy}）。`,
    };
  });
}
