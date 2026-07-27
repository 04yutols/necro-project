# API駆動Botテスト基盤 — 実装ロードマップ

> 作成日: 2026-07-27  
> 設計書: `docs/設計書/127_API駆動Botテスト基盤設計.md`

## 完成条件

- [x] ブラウザを使わず、外部スクリプトがHTTP APIだけで全試行を実行できる
- [x] 同一seed・同一シナリオの結果が再現する
- [x] 全戦闘ステージを列挙し、複数プロファイル・職業・方針を網羅できる
- [x] 難易度とドロップのJSON/CSVレポートを生成できる
- [x] プレイヤーDB、ランキング、世界ログへ副作用がない
- [x] 型チェックと対象Jestテストが通る

## Phase 1 — 決定的な戦闘基盤

- [x] `SeededRandom.ts`を追加
- [x] `BattleEngine`の全乱数を注入可能にする
- [x] 戦闘状態の読み取り専用スナップショットを追加
- [x] seed再現性テストを追加

## Phase 2 — ヘッドレスStage runner

- [x] 実マスターから主人公・軍団・WAVEを構築
- [x] `basic_only / skill_first / weakness_first`を実装
- [x] 魔神化・魔神技の自動方針を接続
- [x] 勝利・敗北・timeoutと戦闘メトリクスを集計
- [x] ステージ報酬・ネクロマンスを独立seedで試行
- [x] Wilson 95%信頼区間と分位点を実装

## Phase 3 — 管理者限定API

- [x] `GET /api/admin/bot-simulate`カタログAPI
- [x] `POST /api/admin/bot-simulate`チャンク実行API
- [x] development/productionガードとBearer token
- [x] 入力検証と試行上限
- [x] Routeテスト

## Phase 4 — 継続実行Botバッチ

- [x] ステージ・プロファイル・方針・職業の直積を生成
- [x] APIをチャンク単位で反復呼び出し
- [x] `report.json / summary.csv / drops.csv`を出力
- [x] クリア率・P95ターンの任意CIゲート
- [x] `npm run bot:test`コマンドを追加

## Phase 5 — 検証・運用引き渡し

- [x] `npx tsc --noEmit`
- [x] 対象Jestテスト
- [x] dev server + API Botスモーク
- [x] 設計書INDEXとDONEを更新
- [x] 本ロードマップの完了状態を更新

## 完了記録（2026-07-27）

- `npx tsc --noEmit`: passed
- `npm test -- --runInBand`: 96 suites / 832 tests passed
- `npm run build`: passed（`/api/admin/bot-simulate`をDynamic Routeとして生成）
- 実APIスモーク: 3チャンク / 5戦、`report.json / summary.csv / drops.csv`生成を確認

## Phase 6 — 黄泉ケース拡張

- [x] `chapter1 / yomi / all` スイートをカタログとCLIへ追加
- [x] `yomi_entry / yomi_deep` プロファイルを追加
- [x] B1〜B20と深度帯別のケースを実マスターから生成
- [x] B5/B10/B15/B20の初回確定報酬を検証

## Phase 7 — 共通BattleSession・ビルド感度分析

- [x] `BattleCanvas`とヘッドレス実行器でWAVE構築・標的規則を共有
- [x] 武器・軍団・残滓を上書きできるbuild入力を追加
- [x] 製品と同じStatSystemで装備・残滓能力を反映
- [x] 同一seed比較による感度分析APIを追加

## Phase 8 — 履歴・差分・管理画面

- [x] Redis/インメモリ両対応の履歴サービスを追加
- [x] 同一suiteの前回結果との差分・regressionを生成
- [x] `/admin/bot-tests` に履歴・SVGグラフ・差分を表示
- [x] 管理画面からchapter1/YOMI batchを投入可能にする

## Phase 9 — 分散ワーカー・定期実行

- [x] Redis LISTベースのbatch/jobキューを追加
- [x] enqueue/status/worker APIを追加
- [x] lease期限・failed job・batch完了を処理
- [x] schedule保存APIとcron enqueue APIを追加
- [x] CLIの分散実行・履歴登録を追加

## Phase 10 — 総合検証

- [x] BattleSession / YOMI / build / sensitivity unit test
- [x] history / queue / schedule unit test
- [x] 全API route test
- [x] `npx tsc --noEmit`
- [x] 全Jest、production build、YOMI APIスモーク

## 拡張完了条件

- [x] 黄泉B1〜B20が標準ケースに含まれる
- [x] 旧「将来候補」5項目がすべて実装済みになる
- [x] Redis設定時は複数worker、未設定dev時はローカルworkerで同じAPIが動く
- [x] 管理画面から履歴・差分・queue・scheduleを確認できる

詳細設計: `docs/設計書/128_API駆動Botテスト運用拡張設計.md`

## 拡張完了記録（2026-07-27）

- `npx tsc --noEmit`: passed
- `npm test -- --runInBand`: 99 suites / 846 tests passed
- `npm run build`: passed（管理画面1 route + Bot運用6 API route + cron route生成）
- HTTP分散スモーク: `yomi_b01 / b10 / b20`、6 simulations、enqueue → worker → history → JSON/CSVまで成功
- HTTP感度スモーク: `yomi_b10` + ATK残滓 + ATK ±10% variants成功
- `git diff --exit-code src/data/master`: passed（マスターデータ非破壊）
