import {
  calculateContentReviewItemHash,
  getRequiredContentReviewRefs,
  parseContentReviewRef,
  type ActorType,
  type ContentPackage,
  type ContentReviewAuditAction,
  type ContentReviewAuditEvent,
  type ContentReviewItem,
  type ContentReviewItemState,
} from './contentPackage';

export type ContentReviewReadiness = {
  ref: string;
  ready: boolean;
  reasons: string[];
};

export type ContentReviewSummary = {
  total: number;
  approved: number;
  pending: number;
  changesRequested: number;
  stale: number;
  ready: number;
  complete: boolean;
};

export type ReviewDecisionOptions = {
  ref: string;
  status: Extract<ContentReviewItemState, 'APPROVED' | 'CHANGES_REQUESTED'>;
  actor: string;
  actorType: ActorType;
  comment: string;
  at?: string;
};

export type ReviewDecisionResult =
  | { ok: true; package: ContentPackage }
  | { ok: false; message: string };

function clonePackage(pkg: ContentPackage): ContentPackage {
  return JSON.parse(JSON.stringify(pkg)) as ContentPackage;
}

function eventId(pkg: ContentPackage, at: string): string {
  const stamp = at.replace(/\D/g, '').slice(0, 17);
  return `review_event_${stamp}_${(pkg.review.audit?.length ?? 0) + 1}`;
}

export function appendContentReviewAudit(
  pkg: ContentPackage,
  event: Omit<ContentReviewAuditEvent, 'id'>,
): ContentReviewAuditEvent {
  const auditEvent: ContentReviewAuditEvent = { id: eventId(pkg, event.at), ...event };
  pkg.review.audit = [...(pkg.review.audit ?? []), auditEvent];
  return auditEvent;
}

export function getContentReviewReadiness(pkg: ContentPackage, ref: string): ContentReviewReadiness {
  const parsed = parseContentReviewRef(ref);
  if (!parsed) return { ref, ready: false, reasons: ['レビュー参照の形式が不正です。'] };
  const reasons: string[] = [];

  if (parsed.kind === 'target') {
    const target = pkg.targets.find(item => item.id === parsed.id);
    if (!target) reasons.push('対象が存在しません。');
    for (const deliverable of pkg.deliverables.filter(item => item.ownerId === parsed.id && item.required)) {
      if (deliverable.state !== 'READY') reasons.push(`${deliverable.scope}/${deliverable.kind} が ${deliverable.state} です。`);
    }
    for (const evidence of pkg.evidence.filter(item => item.ownerId === parsed.id)) {
      if (evidence.status !== 'PASS' && evidence.status !== 'WARN') reasons.push(`${evidence.kind} 証跡が ${evidence.status} です。`);
    }
  } else if (parsed.kind === 'change') {
    const separator = parsed.id.indexOf(':');
    const scope = separator > 0 ? parsed.id.slice(0, separator) : '';
    const id = separator > 0 ? parsed.id.slice(separator + 1) : '';
    if (!pkg.changes.some(item => item.scope === scope && item.id === id)) reasons.push('マスターデータ差分が存在しません。');
  } else if (parsed.kind === 'asset') {
    const asset = pkg.assets.find(item => item.id === parsed.id);
    if (!asset) reasons.push('画像・音声アセットが存在しません。');
    else if (asset.state !== 'READY') reasons.push(`アセットが ${asset.state} です。`);
  } else if (parsed.kind === 'presentation') {
    const presentation = pkg.presentation.find(item => item.id === parsed.id);
    if (!presentation) reasons.push('演出定義が存在しません。');
    else if (presentation.state !== 'READY') reasons.push(`演出が ${presentation.state} です。`);
  } else {
    const evidence = pkg.evidence.find(item => item.id === parsed.id);
    if (!evidence) reasons.push('検証証跡が存在しません。');
    else if (evidence.status !== 'PASS' && evidence.status !== 'WARN') reasons.push(`証跡が ${evidence.status} です。`);
  }

  return { ref, ready: reasons.length === 0, reasons };
}

export function syncContentReviewItems(
  pkg: ContentPackage,
  options?: { actor?: string; actorType?: ActorType; at?: string; comment?: string },
): { package: ContentPackage; resetRefs: string[]; initialized: boolean } {
  const next = clonePackage(pkg);
  const previous = new Map((next.review.items ?? []).map(item => [item.ref, item]));
  const refs = getRequiredContentReviewRefs(next);
  const resetRefs: string[] = [];
  const initialized = next.review.items === undefined;
  next.review.items = refs.map(ref => {
    const contentHash = calculateContentReviewItemHash(next, ref);
    if (!contentHash) throw new Error(`レビュー対象が見つかりません: ${ref}`);
    const prior = previous.get(ref);
    if (prior?.contentHash === contentHash) return prior;
    if (prior && prior.status !== 'PENDING') resetRefs.push(ref);
    return { ref, status: 'PENDING', contentHash };
  });

  const at = options?.at ?? new Date().toISOString();
  if (initialized && options?.actor) {
    appendContentReviewAudit(next, {
      action: 'REVIEW_INITIALIZED',
      actor: options.actor,
      actorType: options.actorType ?? 'human',
      at,
      comment: options.comment ?? `${refs.length}件のレビュー項目を初期化しました。`,
      details: { itemCount: refs.length },
    });
  }
  if (resetRefs.length > 0 && options?.actor) {
    for (const ref of resetRefs) {
      appendContentReviewAudit(next, {
        action: 'ITEM_RESET',
        actor: options.actor,
        actorType: options.actorType ?? 'automation',
        at,
        comment: '内容ハッシュの変更により承認を失効しました。',
        subjectRef: ref,
      });
    }
  }
  return { package: next, resetRefs, initialized };
}

export function reviewContentItem(pkg: ContentPackage, options: ReviewDecisionOptions): ReviewDecisionResult {
  if (!['DRAFT', 'VALIDATED'].includes(pkg.status)) return { ok: false, message: '項目レビューはDRAFTまたはVALIDATEDで実行してください。' };
  if (options.actorType !== 'human' || !options.actor.trim()) return { ok: false, message: '項目の承認・差し戻しは人間のレビュー担当者だけが実行できます。' };
  if (!options.comment.trim()) return { ok: false, message: '監査記録へ残すコメントを入力してください。' };

  const synced = syncContentReviewItems(pkg, { actor: options.actor, actorType: 'human', at: options.at });
  const item = synced.package.review.items?.find(candidate => candidate.ref === options.ref);
  if (!item) return { ok: false, message: `レビュー対象が見つかりません: ${options.ref}` };
  const readiness = getContentReviewReadiness(synced.package, options.ref);
  if (options.status === 'APPROVED' && !readiness.ready) return { ok: false, message: readiness.reasons.join(' ') };

  const at = options.at ?? new Date().toISOString();
  item.status = options.status;
  item.reviewer = options.actor;
  item.reviewedAt = at;
  item.comment = options.comment.trim();
  appendContentReviewAudit(synced.package, {
    action: options.status === 'APPROVED' ? 'ITEM_APPROVED' : 'CHANGES_REQUESTED',
    actor: options.actor,
    actorType: 'human',
    at,
    comment: options.comment.trim(),
    subjectRef: options.ref,
    details: { contentHash: item.contentHash },
  });
  return { ok: true, package: synced.package };
}

export function getContentReviewSummary(pkg: ContentPackage): ContentReviewSummary {
  const refs = getRequiredContentReviewRefs(pkg);
  const items = new Map((pkg.review.items ?? []).map(item => [item.ref, item]));
  let approved = 0;
  let pending = 0;
  let changesRequested = 0;
  let stale = 0;
  let ready = 0;
  for (const ref of refs) {
    const item = items.get(ref);
    const currentHash = calculateContentReviewItemHash(pkg, ref);
    if (getContentReviewReadiness(pkg, ref).ready) ready += 1;
    if (!item || item.contentHash !== currentHash) {
      stale += 1;
      pending += 1;
    } else if (item.status === 'APPROVED') approved += 1;
    else if (item.status === 'CHANGES_REQUESTED') changesRequested += 1;
    else pending += 1;
  }
  return { total: refs.length, approved, pending, changesRequested, stale, ready, complete: refs.length > 0 && approved === refs.length };
}

export function recordStageRegenerationAudit(
  pkg: ContentPackage,
  options: { stage: string; actor: string; reason: string; at?: string; attempt?: number },
): ContentPackage {
  const synced = syncContentReviewItems(pkg, { actor: 'content-review-sync', actorType: 'automation', at: options.at });
  appendContentReviewAudit(synced.package, {
    action: 'STAGE_REGENERATED',
    actor: options.actor,
    actorType: 'human',
    at: options.at ?? new Date().toISOString(),
    comment: options.reason,
    subjectRef: `stage:${options.stage}`,
    details: { stage: options.stage, ...(options.attempt !== undefined ? { attempt: options.attempt } : {}) },
  });
  return synced.package;
}
