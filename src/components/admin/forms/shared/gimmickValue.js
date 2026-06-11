"use strict";
/**
 * R-6: gimmick.value の入出力正規化（純関数）。
 *
 * BossGimmick.value は number（game.ts）だが、フォームの行状態は入力都合で string。
 * 読込時に number → string、保存時に string → number へ正規化し、
 * 「入力欄を触ると string で保存される」既存フォームの仕様バグを解消する。
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gimmickValueToInput = gimmickValueToInput;
exports.gimmickRowsToJson = gimmickRowsToJson;
/** 読込: マスター上の value（number 想定）をフォーム入力用の string へ。 */
function gimmickValueToInput(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return String(v);
    if (typeof v === 'string')
        return v;
    return '';
}
/**
 * 保存: フォーム行を JSON へ。
 * - 空文字 → value フィールドを省略（BossGimmick.value は optional）
 * - 有限数値文字列 → number へ正規化
 * - 非数値文字列 → そのまま保持（データ消失防止。バリデータが警告する領域）
 */
function gimmickRowsToJson(rows) {
    return rows.map(function (g) {
        var trimmed = g.value.trim();
        var base = { trigger: g.trigger, effect: g.effect };
        if (trimmed === '')
            return base;
        var num = Number(trimmed);
        return Number.isFinite(num) ? __assign(__assign({}, base), { value: num }) : __assign(__assign({}, base), { value: g.value });
    });
}
