# API駆動Botテスト 運用手順

> 最終更新: 2026-07-30  
> 対象: 第1章、黄泉の階層B1〜B20、難易度・ドロップ率・任意ビルド感度分析  
> 設計: [127_API駆動Botテスト基盤設計](../設計書/127_API駆動Botテスト基盤設計.md) / [128_API駆動Botテスト運用拡張設計](../設計書/128_API駆動Botテスト運用拡張設計.md)

## 1. このBotでできること

ブラウザや画面操作を使わず、HTTP APIから実マスター・`BattleEngine`・`RewardService`を反復実行する。

- `chapter1 / yomi / all` のステージスイートを実行
- 職業、育成プロファイル、行動方針の直積テスト
- クリア率、95%信頼区間、ラウンド数、残HP、与被ダメージを集計
- 通常ドロップ、初回確定報酬、残滓、素材、ネクロマンスを観測
- 同一seedで再現
- 武器、軍団、残滓を指定した任意ビルドと感度分析
- JSON/CSV出力、実行履歴、前回差分、regression検出
- Upstash Redisキューによる複数worker実行

プレイヤーDB、ランキング、世界ログ、所持品には書き込まない。Redisへ保存するのはBotのqueue、batch、履歴、scheduleだけである。

## 2. 最短のローカル実行

### 2.1 前提

```bash
npm install
```

ローカルではUpstash Redisを設定しなくても動作する。Redis未設定時はNext.jsプロセス内のインメモリストレージを使うため、dev serverを停止するとqueue・履歴・scheduleは消える。

### 2.2 2ターミナルで実行

ターミナル1:

```bash
npm run dev
```

ターミナル2:

```bash
npm run bot:test -- \
  --stages=yomi \
  --profiles=yomi_deep \
  --policies=weakness_first \
  --jobs=warrior \
  --iterations=20 \
  --seed=local-yomi
```

### 2.3 サーバー起動込みの完全1コマンド

固定ポート`3100`でdev serverを起動し、疎通確認後にBotを実行し、終了時にdev serverを停止する。

```bash
zsh -c '
  npm run dev -- -p 3100 >/tmp/necro-bot-server.log 2>&1 &
  bot_server_pid=$!
  trap "kill $bot_server_pid" EXIT INT TERM
  until curl -s -o /dev/null http://127.0.0.1:3100; do sleep 1; done
  npm run bot:test -- \
    --base-url=http://127.0.0.1:3100 \
    --stages=yomi \
    --profiles=yomi_deep \
    --policies=weakness_first \
    --jobs=warrior \
    --iterations=20 \
    --seed=local-yomi
'
```

サーバーログは`/tmp/necro-bot-server.log`へ出力される。ポート`3100`が使用中の場合は別の固定ポートへ変更する。

## 3. 環境変数

### 3.1 一覧

| 変数 | ローカル | production | 用途 |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | 任意 | queue運用では必須 | Upstash RedisのHTTPS endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | 任意 | queue運用では必須 | Upstash RedisのStandard Token |
| `BOT_TEST_API_ENABLED` | 判定対象外 | `true`必須 | productionのBot API公開スイッチ |
| `BOT_TEST_API_TOKEN` | 任意・共有環境では必須 | 必須 | `/api/admin/bot-*` のBearer認証 |
| `CRON_SECRET` | cron確認時のみ | 定期実行で必須 | `/api/cron/bot-tests` 専用Bearer認証 |
| `BOT_TEST_BASE_URL` | 任意 | GitHub Actionsで必須 | CLI/workerが接続するアプリURL |

`BOT_TEST_API_TOKEN`と`CRON_SECRET`は必ず別の値にする。生成例:

```bash
openssl rand -hex 32
```

上記を2回実行し、それぞれの出力を使用する。秘密値をGit、チャット、ブラウザクライアント、ログへ出さない。

### 3.2 ローカル `.env.local`

`.env.local.example`をコピーする。

```bash
cp .env.local.example .env.local
```

Redisを使わない最小構成:

```dotenv
BOT_TEST_API_ENABLED="false"
BOT_TEST_API_TOKEN=""
CRON_SECRET="local-only-random-secret"
BOT_TEST_BASE_URL="http://127.0.0.1:3000"
```

ローカルでも履歴を保持し、Redisキューを確認する構成:

```dotenv
UPSTASH_REDIS_REST_URL="https://YOUR-DATABASE.upstash.io"
UPSTASH_REDIS_REST_TOKEN="YOUR-STANDARD-TOKEN"
BOT_TEST_API_ENABLED="false"
BOT_TEST_API_TOKEN="YOUR-LOCAL-BOT-TOKEN"
CRON_SECRET="YOUR-SEPARATE-CRON-SECRET"
BOT_TEST_BASE_URL="http://127.0.0.1:3000"
```

CLIは`.env`と`.env.local`を読み、`BOT_TEST_API_TOKEN`が設定されていればBearer tokenを自動送信する。

## 4. Upstash Redisの準備

1. [Upstash Console](https://console.upstash.com/)でRedis Databaseを作成する。
2. アプリのデプロイ先に近いregionを選ぶ。
3. Database詳細のREST API欄を開く。
4. `UPSTASH_REDIS_REST_URL`にHTTPS endpointをコピーする。
5. `UPSTASH_REDIS_REST_TOKEN`にStandard Tokenをコピーする。

queueは`SET / LPUSH / RPOP / LTRIM`等を実行するため、Read Only Tokenでは動作しない。Standard Tokenはサーバー専用secretとして管理する。

公式資料: [Upstash REST API](https://upstash.com/docs/redis/features/restapi)

Redis未設定時の挙動:

| 環境 | 挙動 |
|---|---|
| development / test | インメモリへfallback |
| productionの同期`bot-simulate` / `bot-sensitivity` | Redisなしでも実行可能 |
| productionのqueue / history / schedule | `503 Bot Redis is not configured.` |

## 5. Cloudflare production設定

Cloudflare Dashboardの`Workers & Pages → necro-project → Settings → Variables and Secrets`へ登録する。

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
BOT_TEST_API_ENABLED=true
BOT_TEST_API_TOKEN
CRON_SECRET
```

CLIから登録する場合:

```bash
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
npx wrangler secret put BOT_TEST_API_ENABLED
npx wrangler secret put BOT_TEST_API_TOKEN
npx wrangler secret put CRON_SECRET
```

`BOT_TEST_API_ENABLED`には`true`を入力する。`wrangler secret put`はWorkerの新しいversionを作成して反映するため、production作業として扱う。

設定後の疎通確認:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer YOUR_BOT_TEST_API_TOKEN" \
  "https://YOUR-DOMAIN/api/admin/bot-simulate"
```

想定レスポンスはstage、profile、policy、job、suiteを含むJSONカタログ。

公式資料: [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## 6. GitHub Actions定期実行

定期実行workflowは`.github/workflows/bot-balance.yml`。毎日`18:00 UTC`、日本時間では翌日`03:00`ごろに起動する。

GitHub Repositoryの`Settings → Secrets and variables → Actions`へ以下を登録する。

```text
BOT_TEST_BASE_URL=https://YOUR-DOMAIN
BOT_TEST_API_TOKEN=Cloudflareと同じBot token
CRON_SECRET=Cloudflareと同じCron secret
```

UpstashのURLとtokenはデプロイ済みWorkerが使用するため、GitHub Actions側には不要。

公式資料: [GitHub ActionsでのSecrets利用](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets?tool=webui)

### 6.1 production scheduleの初回有効化

scheduleは安全のため初期状態で無効。さらに`/admin`はdevelopment限定なので、productionではAPIから有効化する。

```bash
curl --fail-with-body \
  -X PUT "https://YOUR-DOMAIN/api/admin/bot-schedules" \
  -H "Authorization: Bearer YOUR_BOT_TEST_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "schedules": [{
      "id": "yomi-daily",
      "name": "黄泉 日次観測",
      "enabled": true,
      "suite": "yomi",
      "intervalMinutes": 1440,
      "iterations": 100,
      "profile": "yomi_deep",
      "policy": "weakness_first",
      "jobId": "warrior",
      "firstClear": true
    }]
  }'
```

設定確認:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer YOUR_BOT_TEST_API_TOKEN" \
  "https://YOUR-DOMAIN/api/admin/bot-schedules"
```

### 6.2 Cronの手動起動

```bash
curl --fail-with-body \
  -X POST "https://YOUR-DOMAIN/api/cron/bot-tests" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Cron APIは期限到来scheduleをqueueへ投入するだけで、戦闘jobはworkerが処理する。GitHub Actionsではenqueue完了後に3つのworker jobを起動する。

## 7. 実行パターン

### 7.1 最小スモーク

```bash
npm run bot:test -- \
  --stages=area1_node1 \
  --profiles=starter \
  --policies=basic_only \
  --jobs=warrior \
  --iterations=5 \
  --seed=smoke
```

### 7.2 黄泉B1〜B20

```bash
npm run bot:test -- \
  --stages=yomi \
  --profiles=yomi_entry,yomi_deep \
  --policies=weakness_first \
  --jobs=warrior \
  --iterations=100 \
  --seed=yomi-nightly
```

### 7.3 Redis分散キュー経由

```bash
npm run bot:test -- \
  --stages=yomi \
  --profiles=yomi_entry,yomi_deep \
  --policies=weakness_first \
  --jobs=warrior \
  --iterations=100 \
  --distributed \
  --seed=yomi-distributed
```

`--distributed`でCLIを1プロセスだけ起動した場合、queueは使うがCLI自身がworker APIを順番に呼ぶため、実際の戦闘並列数は1。複数並列にするにはGitHub Actionsのworker matrix、または複数の独立worker呼び出しが必要。

### 7.4 queue投入だけ行う

```bash
npm run bot:test -- \
  --stages=yomi \
  --profiles=yomi_deep \
  --policies=weakness_first \
  --jobs=warrior \
  --iterations=100 \
  --distributed \
  --enqueue-only \
  --seed=yomi-enqueue-only
```

### 7.5 CIゲート

```bash
npm run bot:test -- \
  --stages=chapter1 \
  --profiles=ch1_end \
  --policies=weakness_first \
  --jobs=warrior \
  --iterations=100 \
  --min-clear-rate=0.7 \
  --max-p95-rounds=60 \
  --seed=ch1-gate
```

ゲート違反はexit code `2`、APIや入出力エラーはexit code `1`。

## 8. CLIオプション

```bash
npm run bot:test -- --help
```

| option | 既定値 | 説明 |
|---|---|---|
| `--base-url` | `BOT_TEST_BASE_URL`または`http://localhost:3000` | API接続先 |
| `--token` | `BOT_TEST_API_TOKEN` | Bot API token |
| `--stages` | `all` | `chapter1 / yomi / all / IDカンマ区切り` |
| `--profiles` | 全profile | profileカンマ区切り |
| `--policies` | 全policy | policyカンマ区切り |
| `--jobs` | 全job | jobカンマ区切り |
| `--iterations` | `100` | シナリオごとの試行数 |
| `--chunk-size` | `100` | 同期API一回の試行数。最大500 |
| `--max-rounds` | `200` | 一戦のラウンド上限。最大500 |
| `--sample-runs` | `1` | 詳細ログを残す試行数。最大20 |
| `--seed` | 実行時刻 | 再現用seed |
| `--first-clear` | false | 初回確定報酬を含める。黄泉は標準で初回扱い |
| `--build` | なし | 任意ビルドJSONファイル |
| `--distributed` | false | queue/worker API経由で実行 |
| `--enqueue-only` | false | queue投入後に終了 |
| `--no-history` | false | 同期実行の履歴登録を抑止 |
| `--min-clear-rate` | なし | 最低クリア率ゲート |
| `--max-p95-rounds` | なし | P95ラウンド上限ゲート |
| `--out` | `artifacts/bot-tests/<run-id>` | 出力先 |

### 8.1 profile

| profile | Job Lv | Necro Lv | 用途 |
|---|---:|---:|---|
| `starter` | 1 | 1 | 初回到達時 |
| `ch1_mid` | 8 | 8 | 第1章中盤 |
| `ch1_end` | 15 | 30 | 第1章終盤 |
| `endgame` | 50 | 200 | 高育成全般 |
| `yomi_entry` | 25 | 60 | 黄泉B1〜B10 |
| `yomi_deep` | 50 | 200 | 黄泉B11〜B20 |

### 8.2 policy

| policy | 動作 |
|---|---|
| `basic_only` | 通常攻撃のみ、魔神化なし |
| `skill_first` | 使用可能な最高威力スキルを優先 |
| `weakness_first` | 弱点属性を最優先し、次に威力を比較 |

### 8.3 job

```text
warrior / mage / dark_priest / rogue
```

## 9. 任意ビルド

例として`bot-build.json`を用意する。

```json
{
  "jobLevel": 50,
  "necroLevel": 200,
  "weaponId": "grudge_manifest",
  "partyMonsterIds": ["goblin", "skeleton", "zombie"],
  "residues": [
    {
      "mainStat": { "type": "ATK%", "value": 20 },
      "subOptions": [
        { "type": "CRIT_RATE", "value": 8 },
        { "type": "DARK_DMG_BOOST", "value": 10 }
      ]
    }
  ]
}
```

```bash
npm run bot:test -- \
  --stages=yomi_b10 \
  --profiles=yomi_deep \
  --policies=weakness_first \
  --jobs=warrior \
  --iterations=100 \
  --build=bot-build.json \
  --seed=custom-build
```

軍団は1〜3体、重複不可、ネクロコスト上限内。残滓は最大5個。

## 10. 出力

既定の出力先:

```text
artifacts/bot-tests/<run-id>/
  report.json
  summary.csv
  drops.csv
```

- `report.json`: シナリオ、集計、系列、drop、警告、サンプルログ
- `summary.csv`: 難易度・生存・ダメージの横断比較
- `drops.csv`: 設定率、実測率、95%信頼区間

`artifacts/bot-tests/`はGit追跡対象外。

## 11. 並列数と負荷設計

### 11.1 現在の実並列数

| 実行方式 | worker呼び出し数 | 実際の同時シナリオ数 |
|---|---:|---:|
| 通常のローカルCLI | 1 | 1 |
| ローカル`--distributed`単体 | 1 | 1 |
| GitHub Actions定期実行 | 3 | 最大3 |
| 独立workerを追加 | 追加数 | worker呼び出し数と同程度 |

`POST /api/admin/bot-worker`の`maxJobs`は並列数ではない。一度のHTTP request内で処理するjob数であり、実装は順番に実行する。API上限は`1〜10`、GitHub Actionsは各worker requestで`maxJobs=5`。

一つのjobは「一つのstage/profile/policy/jobと、そのiterations全部」。job内のiterationsも逐次処理する。

### 11.2 推奨値

| 用途 | worker | iterations |
|---|---:|---:|
| ローカル疎通 | 1 | 5〜20 |
| 黄泉の日次観測 | 3 | 50〜100 |
| ドロップ率精査 | 3 | 300〜500 |
| 全マトリクス | 3 | まず50、安定後100 |

CloudflareでtimeoutやCPU制限に当たる場合、workerを増やす前にiterationsまたは`maxJobs`を下げる。

### 11.3 全件規模

現行マスターの全件既定値:

```text
32戦闘ステージ × 6 profiles × 3 policies × 4 jobs
= 2,304 scenarios

iterations=100
= 230,400 battles
```

日常のローカル確認で無指定の`all`を実行しない。最初はstage、profile、policy、jobを明示して絞る。

## 12. 管理画面とAPI

developmentでは次を開く。

```text
http://localhost:3000/admin/bot-tests
```

確認できるもの:

- 最新クリア率、試行数、警告数、regression数
- クリア率履歴グラフ
- queue投入・worker実行・batch進捗
- schedule設定
- 前回差分

`/admin`全体はdevelopment限定。productionではBot APIを直接利用する。

| API | 用途 |
|---|---|
| `GET /api/admin/bot-simulate` | カタログ取得 |
| `POST /api/admin/bot-simulate` | 同期シナリオ実行 |
| `POST /api/admin/bot-sensitivity` | 感度分析 |
| `GET/POST /api/admin/bot-history` | 履歴取得・登録 |
| `GET/POST /api/admin/bot-jobs` | batch状態・投入 |
| `POST /api/admin/bot-worker` | queue処理 |
| `GET/PUT /api/admin/bot-schedules` | schedule管理 |
| `POST /api/cron/bot-tests` | 期限到来schedule投入 |

## 13. トラブルシュート

### `404 Not found`

productionで`BOT_TEST_API_ENABLED`が文字列`true`になっていない。

### `401 Unauthorized`

`BOT_TEST_API_TOKEN`または`CRON_SECRET`が接続先と一致していない。Bot APIとCron APIでtokenを取り違えていないか確認する。

### `503 Bot simulation API is not configured.`

productionで`BOT_TEST_API_TOKEN`が未設定または空。

### `503 Bot Redis is not configured.`

productionのqueue/history/scheduleでUpstash URLまたはStandard Tokenが不足している。

### 接続先portが違う

Next.jsは3000が使用中だと別portで起動することがある。Botへ`--base-url`で実際のportを渡すか、完全1コマンド例のように固定portで起動する。

### 履歴が消えた

Redis未設定のdevelopmentではインメモリ保存。dev server停止・再起動で消える。保持したい場合はUpstashを設定する。

### queueが進まない

Cron APIはenqueueだけを行う。`/api/admin/bot-worker`を呼ぶworkerが必要。GitHub Actionsの`workers` jobが起動しているか確認する。

### RUNNINGのまま残った

job leaseは既定180秒。期限切れjobは次のclaim時にqueueへ戻される。worker呼び出しが一度も来なければ回収処理も動かない。

### 試行が重い・timeoutする

1. `iterations`を下げる。
2. worker requestの`maxJobs`を下げる。
3. stage/profile/policy/jobを絞る。
4. 固定seedで再実行し、特定シナリオの長期戦を調べる。

## 14. 運用チェックリスト

### ローカル

- [ ] `npm install`済み
- [ ] `.env.local`を作成
- [ ] 固定stage、固定profile、`iterations=5`でスモーク
- [ ] `report.json / summary.csv / drops.csv`を確認
- [ ] 必要ならUpstashを設定して履歴を確認

### production

- [ ] Upstash Standard Tokenを取得
- [ ] Cloudflareへ5変数を登録
- [ ] `GET /api/admin/bot-simulate`のBearer認証を確認
- [ ] GitHub Actionsへ3 secretsを登録
- [ ] production scheduleをAPIで有効化
- [ ] Cron手動起動でbatch IDを確認
- [ ] worker完了後にhistoryを確認
- [ ] 最初は`iterations=20〜50`で実行

## 15. 関連ファイル

- `scripts/run-bot-batch.mts` — CLI
- `src/logic/BotSimulation.ts` — シミュレーションと統計
- `src/logic/BattleSession.ts` — UI/Bot共通WAVE構築・標的規則
- `src/services/BotTestStorage.ts` — Upstash/インメモリ切替
- `src/services/BotTestQueueService.ts` — queue/job/batch
- `src/services/BotTestHistoryService.ts` — 履歴・前回差分
- `src/services/BotTestScheduleService.ts` — schedule
- `src/app/api/admin/bot-*/` — 管理Bot API
- `src/app/api/cron/bot-tests/` — Cron API
- `src/app/admin/bot-tests/` — development管理画面
- `.github/workflows/bot-balance.yml` — 日次enqueue・3 worker

