# 51_BUG3_EXPレベル計算統一設計

## 目的

`docs/progress/BUGS_AND_SECURITY.md` の `BUG-3: EXP→レベル計算式がクライアントとサーバーで異なる` を解消する。

旧実装では、オンライン保存の正規経路 `src/app/actions.ts` は累積EXP式を使っていた一方、Zustand のローカル更新と旧 `GameManager` は `Math.floor(exp / 100) + 1` を使っていた。

EXP=500 の例:

| 経路 | 旧計算結果 |
|---|---|
| Server Actions | Lv.2 |
| Zustand / GameManager | Lv.6 |

この差により、ログイン済みクラウドセーブのDB値と、ローカル表示・Vite fallback・旧経路の値が乖離する。

## 正典

職業レベルは「総EXP」から導出する。レベル自体は保存してよいが、計算式は常に同じ関数を使う。

```text
expForLevel(level) = 50 * (level - 1) * (level + 8)
levelFromTotalExp(totalExp):
  Lv1  = 0
  Lv2  = 500
  Lv3  = 1100
  Lv4  = 1800
  Lv5  = 2600
  ...
  Max  = 99
```

## 実装方針

### 共通モジュール

`src/logic/ExperienceSystem.ts` を追加する。

| 関数 | 用途 |
|---|---|
| `expForLevel(level)` | 任意レベル到達に必要な累積EXP |
| `levelFromTotalExp(totalExp)` | 総EXPから職業レベルを算出 |
| `normalizeTotalExp(totalExp)` | 負値・NaN・小数を安全に丸める |
| `getJobLevelProgress(totalExp)` | UI用の現在レベル帯進捗 |

### 呼び出し側

| ファイル | 変更 |
|---|---|
| `src/app/actions.ts` | ローカル `expForLevel` / `levelFromTotalExp` を削除し、共通関数を import |
| `src/store/useGameStore.ts` | `addExp()` の簡易式を共通 `levelFromTotalExp()` に差し替え |
| `src/logic/GameManager.ts` | 旧 `processStageResult()` の簡易式を共通 `levelFromTotalExp()` に差し替え |

## レガシーデータ方針

職業レベルは総EXPから再計算する。過去の簡易式で過剰に上がった `UserJob.level` は、次回EXP更新時に正典式へ正規化される。

ステータス成長値は過去に増加済みの値を巻き戻さない。今回の目的は「以後のレベル計算と表示を一致させる」ことであり、既存キャラクターの基礎ステータス再計算は別タスクとする。

## テスト方針

| テスト | 検証 |
|---|---|
| `ExperienceSystem.test.ts` | Lv2=500, Lv3=1100 などの閾値、無効EXPの正規化、Lv99 cap |
| `useGameStore.party.test.ts` | `addExp(499)` では Lv1、追加1EXPで Lv2 になること |
| `account-progression.integration.test.ts` | ステージクリア後のDB由来 `UserJob.level` が `levelFromTotalExp(exp)` と一致すること |

## 非対象

- EXP獲得量そのもののバランス調整
- レベルアップ時の永続パッシブ付与漏れ
- 過去データの基礎ステータス巻き戻し
- ResultScreen と BattleCanvas が両方 `addExp()` を呼ぶ可能性の整理
