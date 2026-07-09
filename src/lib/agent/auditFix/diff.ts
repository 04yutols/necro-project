/**
 * 監査修正パッチの before/after deep diff（LLM 不使用の純関数）。
 * 変更されたフィールドパスのみを列挙し、UI で「最小変更か」を可視化する。
 */

export type FieldDiff = {
  path: string;
  before: unknown;
  after: unknown;
  kind: 'added' | 'removed' | 'changed';
};

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** プリミティブ/配列は JSON 比較、オブジェクトは再帰。 */
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isObj(a) && isObj(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => equal(a[k], b[k]));
  }
  // 配列・その他は JSON 文字列で比較
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * before → after の差分を FieldDiff[] で返す。ネストしたオブジェクトはドット記法で辿る。
 * 配列は「丸ごと変更」として 1 エントリにする（要素単位の差分は出さない）。
 */
export function deepDiff(before: unknown, after: unknown, basePath = ''): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  if (isObj(before) && isObj(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const path = basePath ? `${basePath}.${key}` : key;
      const inB = key in before;
      const inA = key in after;
      if (inB && !inA) {
        diffs.push({ path, before: before[key], after: undefined, kind: 'removed' });
      } else if (!inB && inA) {
        diffs.push({ path, before: undefined, after: after[key], kind: 'added' });
      } else if (isObj(before[key]) && isObj(after[key])) {
        diffs.push(...deepDiff(before[key], after[key], path));
      } else if (!equal(before[key], after[key])) {
        diffs.push({ path, before: before[key], after: after[key], kind: 'changed' });
      }
    }
    return diffs;
  }

  if (!equal(before, after)) {
    diffs.push({ path: basePath || '(root)', before, after, kind: 'changed' });
  }
  return diffs;
}

/** finding の指摘フィールド集合（message からは取れないので scope 別 field 由来は呼び出し側で渡す）。 */
export function diffTouchesOnly(diffs: FieldDiff[], allowedTopLevel: Set<string>): boolean {
  return diffs.every((d) => allowedTopLevel.has(d.path.split('.')[0]));
}
