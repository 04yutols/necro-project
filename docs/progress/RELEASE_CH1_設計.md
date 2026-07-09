# 第1章リリース設計（〜Ch1）

更新: 2026-06-28 / ブランチ: `feature/2026062102`
位置づけ: **Ch1 リリースに「何が入るか」の統合ビュー**。詳細は各リファレンスへ。
対になる文書: [`RELEASE_CH2_PLUS_設計.md`](./RELEASE_CH2_PLUS_設計.md)（Ch2以降）

---

## 0. Ch1 リリースの定義（境界線）

第1章「亡国の王都」を **標準ソシャゲ章（~12ノード）** に拡張した版を 1 本のリリースとする。

**🔑 Ch1 の鉄則: エンジン改修ゼロ。データ作業＋既存システムへの配線のみで閉じる。**
新しい戦闘プリミティブ（バフ/デバフ/ヒーラー等）は **一切入れない**（→ すべて Ch2）。これによりリリースを確実化し、二重戦闘経路（BattleEngine＋BattleCanvas）の改修リスクを負わない。

理由づけの経緯: 難易度別ロードマップで「🟢データのみ＝Ch1 / 🟡🟠🔴エンジン改修＝Ch2」で線引き（2026-06-28 決定）。

---

## 1. 含むもの

### 1-A. 基盤システム（実装済み）
`docs/progress/CH1_TODO.md` の Phase A〜D で実装済み:
- バトル（BattleEngine / BattleCanvas / ヘイト分散 / ボスギミック ENRAGE・AV_DELAY・REVIVE・SUMMON_MINIONS）
- 魔神化（DemonizationSystem・Tier1フォーム4職業）
- 状態異常（StatusAilmentSystem＝**デバフは既存**。ただし Ch1 では新規デバッファー役は足さない）
- ストーリー / チュートリアル / LegionHub編成 / 武器・残滓 / Audio / DB・NextAuth

### 1-B. ステージ拡張リデザイン（進行中）
詳細: [`CH1_REDESIGN_実装計画.md`](./CH1_REDESIGN_実装計画.md) ＋ [`CH1_REDESIGN_ステージ拡張仕様.md`](./CH1_REDESIGN_ステージ拡張仕様.md)

| マイルストーン | 状態 |
|---|---|
| A 検証ゲート（G1グラフ / G2コード参照） | ✅ 完了 |
| C 設計判断＋基盤（C1物語 / C2残滓 / C3ノード数 / C4 `statScale` / C6 ch2波及） | ✅ 完了 |
| B ステージ背骨（B0順序機構 / B1新ノード / B2再結線） | ✅ 完了 |
| **Phase 2 新規敵（データ）** | ⬜ 残 |
| **Phase 3 チュート再配線** | ⬜ 残 |
| **Phase 4 物語（1-3/1-8＋導入/締め）** | ⬜ 残 |
| **Phase 5 最終監査** | ⬜ 残 |

### 1-C. Ch1 の残作業（ここから）
1. **Phase 2 新規敵** — `gravewarden_colossus` / `wandering_guard_wraith` / `cursed_head_maid` / `dragonbone_spawn`。**役割はデータで成立する範囲のみ**: タンク壁（BOSS tier化で召喚ギミック可）/ DRAGON種族メレー（捕獲content）/ シールド / 耐性・弱点プロファイル / ステ形状。`enemyBalance`＋simulator＋`/admin/audit` を関所に B の placeholder を差し替え。
   - ⚠️ **デバッファー/バッファー/ヒーラー役は Ch1 では作らない**（エンジン改修が要るため Ch2）。
2. **Phase 3 チュート再配線** — `triggers.ts`/`phases.ts` を新ノードID対応・`DEMONIZATION` を 1-4 前倒し・`JOB_CHANGE`/`WEAPON_ENHANCE` を BubbleHint化・`WEAPON_EQUIP` 統合。
3. **Phase 4 物語** — C1 方針（STORY型なし・`STAGE_ENTER`/`STAGE_CLEAR` トリガー）で 1-3/1-8＋章導入・締め。
4. **Phase 5 最終監査** — `/admin/audit` FAIL=0 / simulator 全ノード / tsc・jest・Playwright / 実機通しプレイ。

---

## 2. 含まないもの（→ Ch2 設計書）

バフ/デバフ基盤、味方/敵のバッファー・デバッファー役、敵ヒーラー、アビス、area2（幽霊都市）、残滓本格運用、UR / Tier2魔神化 / 打ち直し / 錬成ポイント / 設定画面。
→ すべて [`RELEASE_CH2_PLUS_設計.md`](./RELEASE_CH2_PLUS_設計.md) に集約。

---

## 3. Ch1 完了の定義（リリース判定）
- Phase 2〜5 完了
- `/admin/audit` FAIL=0（G1グラフ到達性・G2コード参照・参照整合）
- `npx tsc --noEmit` / 全 jest green / Playwright green
- 実機で 野営→1-1→…→1-12→残滓ノード を通しクリア、チュート/物語が新フローで正しく発火
