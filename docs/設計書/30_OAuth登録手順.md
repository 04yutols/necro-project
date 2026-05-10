# 30 — OAuth 登録手順（本番リリース対応）

> **現状**: メールアドレス + パスワード認証を実装済み（OAuth 登録作業は不要）。  
> Google / Discord ログインを追加したくなった時点でこの手順書に従う。

---

> 対象: Google OAuth / Discord OAuth の実際の登録作業  
> このファイルは **あなた自身が行う作業** の手順書です。コードは変更しません。

---

## 事前確認

| 必要なもの | 用意するもの |
|---|---|
| Google アカウント | Gmail アカウントがあれば OK |
| Discord アカウント | Discord アカウントがあれば OK |
| 本番ドメイン | リリース予定ドメイン（例: `necromancebrave.com`）|
| Vercel アカウント | デプロイ先（無料プランで開始可） |
| PostgreSQL DB | Vercel Postgres / Supabase / Neon など |

---

## 1. AUTH_SECRET の生成（最初に行う）

`AUTH_SECRET` は NextAuth がセッションの署名・暗号化に使う秘密鍵です。  
**絶対に外部に漏らさないこと。Git にコミットしないこと。**

ターミナルで以下を実行:

```bash
openssl rand -base64 32
```

出力された文字列（例: `Kj8mN2pQ...`）を `.env.local` に保存します。

```bash
# .env.local（プロジェクトルート）
AUTH_SECRET="ここに生成した文字列を貼り付け"
```

---

## 2. Google OAuth 登録

### 2-1. Google Cloud Console でプロジェクト作成

1. https://console.cloud.google.com/ を開く
2. 画面左上のプロジェクト選択プルダウン → **「新しいプロジェクト」**
3. プロジェクト名: `necromance-brave`（任意）→ **「作成」**

### 2-2. OAuth 同意画面の設定

1. 左メニュー → **「APIとサービス」** → **「OAuth 同意画面」**
2. User Type: **「外部」** を選択 → **「作成」**
3. 以下を入力:

| 項目 | 入力値 |
|---|---|
| アプリ名 | Necromance Brave |
| ユーザーサポートメール | あなたのメールアドレス |
| アプリのロゴ | （後から追加可） |
| アプリのドメイン | `necromancebrave.com`（本番ドメイン） |
| 承認済みドメイン | `necromancebrave.com` |
| デベロッパーの連絡先 | あなたのメールアドレス |

4. **「保存して次へ」** → スコープは変更不要 → **「保存して次へ」**
5. テストユーザー: 開発中は自分の Gmail アドレスを追加しておく

> **注意**: 本番公開する前に「アプリを公開」ボタンを押す必要があります（後述）。

### 2-3. OAuth クライアント ID の作成

1. 左メニュー → **「APIとサービス」** → **「認証情報」**
2. **「＋ 認証情報を作成」** → **「OAuth クライアント ID」**
3. アプリケーションの種類: **「ウェブアプリケーション」**
4. 名前: `necromance-brave-web`

5. **「承認済みのリダイレクト URI」** に以下を追加:

```
# 開発環境
http://localhost:3000/api/auth/callback/google

# 本番環境（実際のドメインに変更）
https://necromancebrave.com/api/auth/callback/google
https://www.necromancebrave.com/api/auth/callback/google

# Vercel プレビュー（ブランチデプロイ用）
https://*.vercel.app/api/auth/callback/google
```

6. **「作成」** → クライアント ID とクライアントシークレットが表示される

7. `.env.local` に追加:

```bash
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
```

### 2-4. 本番公開前に行うこと（リリース時）

1. OAuth 同意画面 → **「アプリを公開」** ボタンを押す
2. 確認が必要な場合は **「確認のため送信」** → Google による審査（通常1〜3営業日）
3. 審査が必要になるスコープ: `openid`, `email`, `profile` は基本的に **審査不要**

> Google は「機密性の高いスコープ」（Gmail 読み取りなど）のみ審査が必要。
> ログイン用途のみなら審査なしで公開可能です。

---

## 3. Discord OAuth 登録

### 3-1. Discord Developer Portal でアプリ作成

1. https://discord.com/developers/applications を開く
2. **「New Application」** ボタン
3. 名前: `Necromance Brave` → **「Create」**

### 3-2. OAuth2 設定

1. 左メニュー → **「OAuth2」**
2. **「Redirects」** セクション → **「Add Redirect」** で以下を追加:

```
# 開発環境
http://localhost:3000/api/auth/callback/discord

# 本番環境
https://necromancebrave.com/api/auth/callback/discord
https://www.necromancebrave.com/api/auth/callback/discord
```

3. **「Save Changes」**

### 3-3. クライアント ID とシークレットの取得

1. 左メニュー → **「OAuth2」** → **「General」**
2. **CLIENT ID** をコピー
3. **「Reset Secret」** → 表示されたシークレットをコピー（再表示されないので必ず保存）

4. `.env.local` に追加:

```bash
DISCORD_CLIENT_ID="..."
DISCORD_CLIENT_SECRET="..."
```

### 3-4. アプリアイコンとストアページ（リリース前推奨）

1. **「General Information」** → アプリアイコンをアップロード
2. **「Rich Presence」** → ゲームとして Discord に認識させる設定

---

## 4. PostgreSQL データベースの用意

### 選択肢比較

| サービス | 無料枠 | 特徴 |
|---|---|---|
| **Vercel Postgres** | 60時間/月・256MB | Vercel と最も統合しやすい |
| **Supabase** | 500MB・2プロジェクト | ダッシュボードが充実 |
| **Neon** | 0.5GBストレージ | ブランチ機能が便利 |
| **Railway** | $5/月クレジット | Prisma との相性良好 |

### Vercel Postgres を使う場合（推奨）

1. https://vercel.com にログイン
2. プロジェクト → **「Storage」** タブ → **「Create Database」**
3. **「Postgres」** を選択 → リージョン: `nrt1`（東京）→ **「Create」**
4. **「.env.local」** タブ → 環境変数をコピー

以下のような変数が取得できます:

```bash
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://...?pgbouncer=true&connect_timeout=15"
POSTGRES_URL_NON_POOLING="postgres://..."
```

`prisma/schema.prisma` の `DATABASE_URL` には `POSTGRES_PRISMA_URL` を使います:

```bash
# .env.local
DATABASE_URL="postgres://...?pgbouncer=true&connect_timeout=15"
```

> Vercel のサーバーレス環境では **PgBouncer 経由の接続** (`pgbouncer=true`) が必須です。
> Prisma はコネクションプーリングのために `connection_limit=1` も推奨します:
> ```
> DATABASE_URL="postgres://...?pgbouncer=true&connect_timeout=15&connection_limit=1"
> ```

---

## 5. .env.local の完成形

```bash
# ─── NextAuth ───────────────────────────────────────────────
AUTH_SECRET="<openssl rand -base64 32 の出力>"
NEXTAUTH_URL="http://localhost:3000"         # 本番では削除（自動検出）

# ─── Google OAuth ───────────────────────────────────────────
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."

# ─── Discord OAuth ──────────────────────────────────────────
DISCORD_CLIENT_ID="000000000000000000"
DISCORD_CLIENT_SECRET="..."

# ─── Database ───────────────────────────────────────────────
DATABASE_URL="postgres://...?pgbouncer=true&connect_timeout=15"
```

> `.env.local` は `.gitignore` に必ず含まれていることを確認してください。
> 含まれていない場合は `echo ".env.local" >> .gitignore` を実行。

---

## 6. データベースへのマイグレーション適用

`.env.local` の設定が完了したら:

```bash
# スキーマをDBに反映
npx prisma migrate dev --name "add_weapon_fields_nextauth"

# Prisma Client を再生成（migrate dev が自動で行う）
npx prisma generate

# 確認
npx prisma studio   # ブラウザでDB確認（localhost:5555）
```

---

## 7. Vercel 本番環境への環境変数設定

ローカルの `.env.local` は本番には反映されません。  
Vercel のダッシュボードで別途設定が必要です。

1. https://vercel.com → プロジェクト → **「Settings」** → **「Environment Variables」**
2. 以下を **「Production」** 環境に追加:

| 変数名 | 値 |
|---|---|
| `AUTH_SECRET` | openssl で生成した値（ローカルと同じ値でOK） |
| `NEXTAUTH_URL` | `https://necromancebrave.com`（本番ドメイン） |
| `GOOGLE_CLIENT_ID` | Google Console の値 |
| `GOOGLE_CLIENT_SECRET` | Google Console の値 |
| `DISCORD_CLIENT_ID` | Discord Portal の値 |
| `DISCORD_CLIENT_SECRET` | Discord Portal の値 |
| `DATABASE_URL` | Vercel Postgres の URL |

3. **「Save」** → デプロイを再実行（Redeploy）

---

## 8. 本番ドメインの設定

### Vercel でカスタムドメインを設定する

1. Vercel → プロジェクト → **「Settings」** → **「Domains」**
2. `necromancebrave.com` を入力 → **「Add」**
3. DNS レコードの設定（ドメインレジストラ側）:

```
# A レコード
necromancebrave.com → 76.76.21.21

# CNAME レコード
www.necromancebrave.com → cname.vercel-dns.com
```

4. SSL 証明書は Vercel が自動で発行（Let's Encrypt）

### OAuth リダイレクト URI の更新

ドメインが確定したら **Google と Discord の両方** で本番 URL をリダイレクト URI に追加（§2-3 と §3-2 で追加した URI の確認）。

---

## 9. 動作確認チェックリスト

```
開発環境（localhost:3000）
[ ] npm run dev が起動する
[ ] http://localhost:3000/api/auth/signin にアクセスできる
[ ] Google ログインボタンが表示される
[ ] Discord ログインボタンが表示される
[ ] Google でログインできる（Gmail アドレスがテストユーザーに追加されていること）
[ ] ログイン後 DB の User テーブルにレコードが作成されている
[ ] npx prisma studio で Account/Session テーブルにデータが入っている

本番環境（necromancebrave.com）
[ ] https://necromancebrave.com/api/auth/signin にアクセスできる
[ ] Google OAuth 同意画面が「Necromance Brave」として表示される
[ ] Discord OAuth の認証ページが表示される
[ ] ログイン後プレイヤーデータが保存される
```

---

## 10. よくある問題と対処

| 症状 | 原因 | 対処 |
|---|---|---|
| `redirect_uri_mismatch` | Google/Discord のリダイレクト URI と実際の URL が不一致 | Console でリダイレクト URI を追加・保存 |
| `invalid_client` | CLIENT_ID/SECRET が間違っている | `.env.local` と Console の値を照合 |
| ログインは通るが DB に保存されない | DATABASE_URL が接続できていない | `npx prisma studio` で接続確認 |
| 本番で `NEXTAUTH_URL` エラー | 環境変数未設定 | Vercel の Environment Variables に追加 |
| Google が「このアプリは確認されていません」 | 同意画面が「テスト」状態 | OAuth 同意画面 → 「アプリを公開」 |
| セッションが維持されない | `AUTH_SECRET` が環境によって異なる | 本番・開発で同じ `AUTH_SECRET` を使う |

---

## 11. セキュリティチェック（リリース前）

```
[ ] .env.local が .gitignore に含まれている
[ ] AUTH_SECRET が 32 バイト以上のランダム文字列
[ ] Google の CLIENT_SECRET が GitHub/公開リポジトリにない
[ ] Discord の CLIENT_SECRET が GitHub/公開リポジトリにない
[ ] 本番 DATABASE_URL が公開リポジトリにない
[ ] Google OAuth 同意画面のアプリが「公開」になっている
[ ] Discord アプリが Public Bot になっていない（ゲームログイン用途のみ）
```
