'use server';

import path from 'path';
import { spawnSync } from 'child_process';
import { revalidatePath } from 'next/cache';
import { assertDev } from '../adminGuard';
import {
  CONTENT_PACKAGE_STATES,
  CONTENT_PIPELINE_STAGES,
  transitionContentPackage,
  type ContentPackageState,
  type ContentPipelineStageId,
  type ContentReviewItemState,
} from '@/lib/content/contentPackage';
import {
  appendContentReviewAudit,
  recordStageRegenerationAudit,
  reviewContentItem,
  syncContentReviewItems,
} from '@/lib/content/contentReviewWorkflow';
import {
  buildContentPackageWorkspaceContext,
  findContentPackageFile,
  writeContentPackageFile,
} from '@/lib/content/contentWorkspace';
import { inspectFileTransaction, undoFileTransaction } from '@/lib/content/contentTransaction';

export type ReviewStudioActionResult = {
  ok: boolean;
  message: string;
  output?: string;
  conflicts?: Array<{ targetPath: string; currentHash?: string; expectedAppliedHash: string }>;
};

function cleanText(value: string, label: string, maxLength: number): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`${label}を入力してください。`);
  if (cleaned.length > maxLength) throw new Error(`${label}は${maxLength}文字以内で入力してください。`);
  return cleaned;
}

function actionError(error: unknown): ReviewStudioActionResult {
  return { ok: false, message: error instanceof Error ? error.message : String(error) };
}

function outputTail(value: string | null | undefined, lines = 20): string | undefined {
  if (!value) return undefined;
  return value.trim().split('\n').slice(-lines).join('\n');
}

export async function reviewPackageItemAction(input: {
  packageId: string;
  ref: string;
  status: Extract<ContentReviewItemState, 'APPROVED' | 'CHANGES_REQUESTED'>;
  actor: string;
  comment: string;
}): Promise<ReviewStudioActionResult> {
  try {
    assertDev();
    const actor = cleanText(input.actor, 'レビュー担当者', 80);
    const comment = cleanText(input.comment, 'レビューコメント', 500);
    const file = findContentPackageFile(input.packageId);
    const result = reviewContentItem(file.package, { ref: input.ref, status: input.status, actor, actorType: 'human', comment });
    if (!result.ok) return { ok: false, message: result.message };
    writeContentPackageFile(file, result.package);
    revalidatePath('/admin/content-packages');
    return { ok: true, message: input.status === 'APPROVED' ? `${input.ref} を承認しました。` : `${input.ref} を差し戻しました。` };
  } catch (error) {
    return actionError(error);
  }
}

export async function transitionPackageAction(input: {
  packageId: string;
  to: ContentPackageState;
  actor: string;
  comment: string;
}): Promise<ReviewStudioActionResult> {
  try {
    assertDev();
    if (!(CONTENT_PACKAGE_STATES as readonly string[]).includes(input.to) || input.to === 'APPLIED') throw new Error('この状態遷移はReview Studioから実行できません。');
    const actor = cleanText(input.actor, '担当者', 80);
    const comment = cleanText(input.comment, '遷移理由・判断コメント', 500);
    const file = findContentPackageFile(input.packageId);
    const synced = syncContentReviewItems(file.package, { actor: 'content-review-sync', actorType: 'automation' }).package;
    const result = transitionContentPackage(synced, input.to, {
      actor: input.to === 'VALIDATED' ? 'content-validator' : actor,
      actorType: input.to === 'VALIDATED' ? 'automation' : 'human',
      comment: input.to === 'VALIDATED' ? `${actor}の依頼により検証。${comment}` : comment,
    }, buildContentPackageWorkspaceContext(synced));
    if (!result.ok) {
      const messages = result.findings.filter(item => item.level === 'FAIL').slice(0, 8).map(item => item.message);
      return { ok: false, message: messages.join(' / ') || '状態遷移に失敗しました。' };
    }
    writeContentPackageFile(file, result.package);
    revalidatePath('/admin/content-packages');
    return { ok: true, message: `${file.package.status} → ${result.package.status} へ更新しました。` };
  } catch (error) {
    return actionError(error);
  }
}

export async function regeneratePackageStageAction(input: {
  packageId: string;
  stage: ContentPipelineStageId;
  actor: string;
  reason: string;
}): Promise<ReviewStudioActionResult> {
  try {
    assertDev();
    if (!(CONTENT_PIPELINE_STAGES as readonly string[]).includes(input.stage)) throw new Error('再生成工程が不正です。');
    const actor = cleanText(input.actor, '再生成依頼者', 80);
    const reason = cleanText(input.reason, '再生成理由', 500);
    const file = findContentPackageFile(input.packageId);
    if (file.package.status !== 'DRAFT') throw new Error('再生成前にpackageをDRAFTへ戻してください。');
    if (!file.package.orchestration) throw new Error('このpackageには再生成パイプラインがありません。');
    const result = spawnSync('npm', ['run', 'content:orchestrate', '--', file.relativePath, `--regenerate=${input.stage}`], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      env: process.env,
    });
    const current = findContentPackageFile(input.packageId);
    const stage = current.package.orchestration?.stages.find(item => item.id === input.stage);
    const audited = recordStageRegenerationAudit(current.package, { stage: input.stage, actor, reason, attempt: stage?.attempt });
    writeContentPackageFile(current, audited);
    revalidatePath('/admin/content-packages');
    const output = outputTail(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
    if (result.status !== 0) return { ok: false, message: `${input.stage} の再生成が完了しませんでした。監査履歴と工程結果を確認してください。`, output };
    return { ok: true, message: `${input.stage} を再生成しました。変更された項目の承認は自動的に失効しています。`, output };
  } catch (error) {
    return actionError(error);
  }
}

export async function applyPackageAction(input: {
  packageId: string;
  actor: string;
  confirmation: string;
}): Promise<ReviewStudioActionResult> {
  try {
    assertDev();
    const actor = cleanText(input.actor, '承認者', 80);
    const file = findContentPackageFile(input.packageId);
    if (input.confirmation.trim() !== `APPLY ${file.package.id}`) throw new Error(`確認欄へ「APPLY ${file.package.id}」と入力してください。`);
    if (file.package.status !== 'APPROVED') throw new Error(`適用にはAPPROVEDが必要です。現在: ${file.package.status}`);
    const recordedApprover = [...file.package.review.history].reverse().find(item => item.to === 'APPROVED' && item.actorType === 'human')?.actor;
    if (recordedApprover !== actor) throw new Error(`承認者はAPPROVED履歴の「${String(recordedApprover)}」と一致させてください。`);
    const result = spawnSync('npm', ['run', 'content:apply', '--', file.relativePath, `--approved-by=${actor}`], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      env: process.env,
    });
    revalidatePath('/admin/content-packages');
    const output = outputTail(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
    if (result.status !== 0) return { ok: false, message: '適用または適用後QAが完了しませんでした。出力を確認してください。', output };
    return { ok: true, message: 'packageを適用し、復旧snapshotと適用後QAを記録しました。', output };
  } catch (error) {
    return actionError(error);
  }
}

export async function undoPackageAction(input: {
  packageId: string;
  actor: string;
  comment: string;
  confirmation: string;
  force?: boolean;
}): Promise<ReviewStudioActionResult> {
  try {
    assertDev();
    const actor = cleanText(input.actor, '巻き戻し担当者', 80);
    const comment = cleanText(input.comment, '巻き戻し理由', 500);
    const file = findContentPackageFile(input.packageId);
    if (file.package.status !== 'APPLIED' || !file.package.review.snapshot) throw new Error('APPLIED packageの復旧snapshotがありません。');
    const expected = input.force ? `FORCE UNDO ${file.package.id}` : `UNDO ${file.package.id}`;
    if (input.confirmation.trim() !== expected) throw new Error(`確認欄へ「${expected}」と入力してください。`);
    const snapshotRootDir = path.join(process.cwd(), '.content-snapshots');
    const snapshotPath = path.join(process.cwd(), file.package.review.snapshot);
    const inspection = inspectFileTransaction({ rootDir: process.cwd(), snapshotRootDir, snapshotPath });
    if (inspection.hasConflicts && !input.force) {
      return {
        ok: false,
        message: '適用後に変更されたファイルがあります。差分確認後、強制巻き戻しを明示してください。',
        conflicts: inspection.files.filter(item => item.conflict).map(item => ({ targetPath: item.targetPath, currentHash: item.currentHash, expectedAppliedHash: item.expectedAppliedHash })),
      };
    }
    const manifest = undoFileTransaction({ rootDir: process.cwd(), snapshotRootDir, snapshotPath, force: input.force });
    const restored = findContentPackageFile(input.packageId);
    appendContentReviewAudit(restored.package, {
      action: 'UNDO_COMPLETED',
      actor,
      actorType: 'human',
      at: new Date().toISOString(),
      comment,
      details: { snapshot: file.package.review.snapshot, fileCount: manifest.files.length, force: Boolean(input.force) },
    });
    writeContentPackageFile(restored, restored.package);
    revalidatePath('/admin/content-packages');
    return { ok: true, message: `${manifest.files.length}ファイルをsnapshotから復旧しました。` };
  } catch (error) {
    return actionError(error);
  }
}
