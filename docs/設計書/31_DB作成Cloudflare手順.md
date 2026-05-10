# 31 — DB作成 & Cloudflare デプロイ手順

> このファイルは **あなた自身が行う作業** の手順書です。  
> コードは既に Cloudflare + Neon に対応済みです。

---

## 環境変数の渡し方（最初に理解する）

`.env.local` は Git に入れてはいけないファイルです。  
そのため Cloudflare には **ダッシュボードから直接入力する** 方法で渡します。

```
ローカル開発                     Cloudflare（本番）
────────────────────────         ─────────────────────────────────
.env.local に書く                ダッシュボードの「Environment variables」に入力
        ↓                                       ↓
   process.env.DATABASE_URL  =  process.env.DATABASE_URL
```

コードは同じ `process.env.*` を読むだけです。値の渡し方が違うだけで、動作は同じです。

---

## 全体の流れ

```
Neon でDB作成 → .env.local に URL 登録 → マイグレーション実行
  → GitHub に push → Cloudflare Pages と接続
  → Cloudflare ダッシュボードに環境変数を直接入力 → 完成
```

---

## 1. Neon で PostgreSQL を作成する

Neon はサーバーレス対応の PostgreSQL サービスです。  
無料プランで **0.5GB・接続数無制限** 使えます。Cloudflare との相性が最も良いです。

### 1-1. アカウント作成

1. https://neon.tech を開く
2. **「Sign Up」** → GitHub または Google でサインアップ（無料）

### 1-2. プロジェクト作成

1. ダッシュボード → **「New project」**
2. 以下を設定:

| 項目 | 設定値 |
|---|---|
| Project name | `necromance-brave` |
| Database name | `neondb`（デフォルトのまま） |
| Region | **Asia Pacific (Tokyo)** → `ap-southeast-1` |
| Postgres version | 16（最新） |

3. **「Create project」** をクリック

### 1-3. 接続文字列を取得

プロジェクト作成直後に表示される画面、または:

1. 左メニュー → **「Connection string」**
2. 接続タイプを **「Pooled connection」** に切り替える（重要）
3. 以下のような文字列が表示される:

```
postgresql://USER:PASSWORD@ep-xxx-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

4. **「Copy」** ボタンでコピーしておく

> **「Pooled connection」を選ぶ理由**  
> Cloudflare などのサーバーレス環境では接続が短命なため、コネクションプーラー経由が必須です。

---

## 2. .env.local を作成する

プロジェクトルートで以下を実行:

```bash
cp .env.local.example .env.local
```

作成された `.env.local` を開いて値を記入:

```bash
# AUTH_SECRET を生成（ターミナルで実行してコピー）
openssl rand -base64 32
```

```bash
# .env.local
AUTH_SECRET="← openssl の出力を貼り付ける"
DATABASE_URL="← Neon からコピーした接続文字列を貼り付ける"
```

**記入例:**
```bash
AUTH_SECRET="Kj8mN2pQr5vXyZ1aB3cD7eF9gH0iJ4kL6mN8oP2qR="
DATABASE_URL="postgresql://alice:pass123@ep-cool-firefly-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

---

## 3. マイグレーションを実行する

`.env.local` の設定が完了したら DB にテーブルを作成します。

```bash
# スキーマを DB に反映（初回）
npx prisma migrate dev --name "initial"

# 成功すると以下が表示される:
# ✔  Generated Prisma Client
# The following migration(s) have been applied: ...
```

### 確認（任意）

```bash
# ブラウザで DB の中身を確認
npx prisma studio
# → http://localhost:5555 が開く
```

---

## 4. ローカルで動作確認

```bash
npm run dev
# → http://localhost:3000 でゲームが起動

# /api/auth/signin にアクセスして登録・ログインが動くか確認
```

---

## 5. Cloudflare Pages にデプロイする

### 5-1. GitHub にコードを push

```bash
git add .
git commit -m "add db and auth setup"
git push origin main
```

### 5-2. Cloudflare Pages でプロジェクト作成

1. https://dash.cloudflare.com を開く
2. 左メニュー → **「Workers & Pages」** → **「Create application」**
3. **「Pages」** タブ → **「Connect to Git」**
4. GitHub アカウントと連携 → リポジトリ `necro-project` を選択
5. **「Begin setup」**

### 5-3. ビルド設定

| 項目 | 設定値 |
|---|---|
| Framework preset | **Next.js** |
| Build command | `npx @cloudflare/next-on-pages@1` |
| Build output directory | `.vercel/output/static` |
| Root directory | `/`（デフォルト） |
| Node.js version | `20.x` |

**「Environment variables (advanced)」を開いて以下を入力（これが本番用の .env.local 相当）:**

| 変数名 | 値 | 説明 |
|---|---|---|
| `AUTH_SECRET` | openssl で生成した文字列 | .env.local と同じ値でOK |
| `DATABASE_URL` | Neon の Pooled 接続文字列 | .env.local と同じ値でOK |
| `NODE_VERSION` | `20` | ビルド用 Node バージョン指定 |

> **ポイント**: `.env.local` は Git に入れないので Cloudflare には届きません。  
> 代わりにここで直接入力した値が、ビルド時・実行時の `process.env.*` に自動で注入されます。

6. **「Save and Deploy」**

> 初回ビルドは 2〜3 分かかります。

### 5-4. カスタムドメインの設定（独自ドメインがある場合）

1. Pages プロジェクト → **「Custom domains」**
2. **「Set up a custom domain」** → ドメインを入力
3. DNS が Cloudflare 管理下なら自動設定されます
4. 独自 DNS の場合は CNAME レコードを追加:

```
CNAME  www  → necro-project.pages.dev
```

---

## 6. 本番用マイグレーション

Cloudflare Pages からは `prisma migrate` を直接実行できません。  
本番 DB へのマイグレーションはローカルから実行します。

```bash
# 本番用の接続文字列を一時的に使ってマイグレーション
# （本番と開発が同じ Neon プロジェクトの場合はそのまま）
npx prisma migrate deploy
```

> `migrate deploy` は `migrate dev` と違い、既存のマイグレーションを適用するだけです。  
> 安全に本番 DB に反映できます。

---

## 7. Cloudflare 環境変数の更新方法

環境変数を変更したい場合:

1. Cloudflare ダッシュボード → Pages プロジェクト
2. **「Settings」** → **「Environment variables」**
3. 値を編集 → **「Save」**
4. **「Deployments」** → **「Retry deployment」** でリデプロイ

---

## 8. Neon の開発 / 本番 DB を分ける（推奨）

本番データを開発で誤って消さないために DB を分けることを推奨します。

### Neon のブランチ機能を使う

Neon には Git と同様の「ブランチ」機能があります。

1. Neon ダッシュボード → **「Branches」** → **「New branch」**
2. ブランチ名: `development`
3. 開発用の接続文字列が発行される → `.env.local` の `DATABASE_URL` に使う

| 環境 | Neon ブランチ | 接続文字列の使用場所 |
|---|---|---|
| ローカル開発 | `development` | `.env.local` |
| 本番 | `main` | Cloudflare 環境変数 |

---

## 9. 動作確認チェックリスト

```
ローカル
[ ] .env.local に AUTH_SECRET と DATABASE_URL が記入されている
[ ] npx prisma migrate dev --name "initial" が成功した
[ ] npm run dev でゲームが起動する
[ ] http://localhost:3000 でプレイヤー登録・ログインができる

Cloudflare
[ ] GitHub push 後に Cloudflare でビルドが成功する
[ ] https://necro-project.pages.dev にアクセスできる
[ ] ゲームが起動してログインできる
[ ] ステージクリア後にドロップが DB に保存される（Neon Studio で確認）
```

---

## 10. よくある問題

| 症状 | 原因 | 対処 |
|---|---|---|
| `Error: DATABASE_URL is not set` | `.env.local` に URL がない | 記入して `npm run dev` を再起動 |
| `Can't reach database server` | Neon の URL が間違っている | Neon ダッシュボードでコピーし直す |
| `sslmode=require` のエラー | URL に `?sslmode=require` がない | 接続文字列の末尾に追加 |
| Cloudflare でビルドが失敗する | Node.js バージョンが低い | 環境変数 `NODE_VERSION=20` を追加 |
| `prisma migrate dev` がタイムアウト | VPN / ファイアウォールの問題 | VPN をオフにして再実行 |
| ログインできるが DB に保存されない | Cloudflare の `DATABASE_URL` が未設定 | ダッシュボードで環境変数を追加 |
