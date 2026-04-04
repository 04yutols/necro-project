# ネクロマンス・ブレイブ (Necromance Brave)

魔族の少年が親友の復讐と「新魔王」への道を歩む、魔王育成・ターン制RPG。

## 概要
本作は、勇者の力を受け継いだ魔族の主人公を操作し、職業（勇者の力）と死霊術（魔族の力）という二つの相反するシステムを駆使して戦う育成RPGです。Next.jsによる高速なSPA体験と、PixiJSによるダイナミックなバトル演出を融合させています。

## 主な機能
- **ハイブリッド育成システム**: 
  - **職業 (GDD-004)**: 転職しても維持される「永続パッシブ」を蓄積し、最強の基礎ステータスを構築。
  - **死霊術 (GDD-005)**: 3枠のコスト制限内で軍団を編成。Lv.99到達後の「転生（ランクアップ）」で最大コストを爆発的に上昇。
- **タクティカル・バトル (GDD-003, 006)**: 
  - 物理/魔法の使い分けが鍵を握るダメージ計算。
  - 職業カテゴリに応じたMPリソース管理のジレンマ。
- **死霊術研究所 (Necro-Lab)**:
  - リアルタイムコスト監視付きの軍団編成UI。
  - モンスターを犠牲に強化アイテムを生成する「魂石化」システム。

## 技術スタック
- **表現層 (Frontend)**:
  - **Framework**: Next.js (App Router)
  - **Game Engine**: PixiJS (バトル演出・アニメーション)
  - **State Management**: Zustand (グローバルステータス管理)
  - **Styling**: Tailwind CSS (ダークファンタジーUI)
- **論理層 (Backend/DB)**:
  - **Language**: TypeScript
  - **ORM**: Prisma
  - **Database**: PostgreSQL
  - **Communication**: Next.js Server Actions

## 起動方法

### 1. Dockerを使用した起動（推奨・コマンド一つ）
DockerおよびDocker Composeがインストールされている環境であれば、以下のコマンド一つでデータベースの構築からアプリの起動まで完了します。

```bash
docker compose up --build
```

起動後、ブラウザで [http://localhost:3080](http://localhost:3080) を開いてください。

#### ソースコードの変更を反映する方法
ソースコード（`src/` 内のファイルなど）を更新した場合は、以下のコマンドを再度実行してください。イメージの再ビルドとコンテナの再起動が行われ、変更が反映されます。

```bash
docker compose up --build
```

※ データベースの内容（`postgres_data`）はボリュームとして保持されるため、再ビルドしても初期化されません。完全に初期化したい場合は `docker compose down -v` を実行してください。

---

### 2. ローカル環境での手動起動
Dockerを使用しない場合は、以下の手順でセットアップしてください。

#### 1. 環境構築
リポジトリをクローンし、依存関係をインストールします。

```bash
npm install
```

#### 2. データベースの準備
PostgreSQLを起動し、`.env` ファイルを作成して接続文字列を設定します。

```env
DATABASE_URL="postgresql://user:password@localhost:5432/necro_db"
```

Prismaスキーマを同期し、クライアントを生成します。

```bash
npx prisma db push
npx prisma generate
```

#### 3. 開発サーバーの起動
ローカル環境でアプリを起動します。

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## プロジェクト構造
- `src/app`: Next.js ページと Server Actions
- `src/components`: UIコンポーネント（PixiJSキャンバス、研究所UI等）
- `src/logic`: ゲームコアロジック（バトルエンジン、進行管理）
- `src/services`: ビジネスロジック（職業、死霊術、マスターデータ）
- `src/store`: Zustand グローバルストア
- `src/types`: TypeScript 型定義
- `src/data/master`: マスターデータ (JSON)
- `docs`: ゲームデザインドキュメント (GDD) / 技術設計書 (TDD)

## 開発ルール
本プロジェクトは自律型AIエージェントによる開発を前提とした設計（厳格な型定義、ロジックとデータの分離）を行っています。詳細は `.gemini/GEMINI.md` を参照してください。
