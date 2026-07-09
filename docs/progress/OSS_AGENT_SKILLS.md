# OSS Agent Skills — 調査結果と導入手順

> 作成日: 2026-05-31  
> 外部リポジトリのエージェント/スキルの調査結果。以下のコマンドを自分で実行してインストールしてください。

---

## 発見したリポジトリ（実在確認済み）

| リポジトリ | Stars | 内容 |
|---|---|---|
| [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) | ⭐20k | ゲーム開発スタジオ構造の49エージェント＋72スキル |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | ⭐21k | 100+汎用サブエージェント（game-developer含む） |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | ⭐23k | Vercel/Neon/Anthropic公式含む1400+スキル集 |
| [VoltAgent/awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design) | ⭐2.5k | 68件のDESIGN.mdテンプレート（Claude Design向け） |
| [HermeticOrmus/LibreUIUX-Claude-Code](https://github.com/HermeticOrmus/LibreUIUX-Claude-Code) | ⭐49 | 152 UI/UX専門エージェント |

---

## 1. ゲームロジック特化 — Claude-Code-Game-Studios

**インストール方法（個別コピー）:**

```bash
# .claude/agents/ にコピーするだけで有効になる

# 戦闘式・ステータス効果・プログレッション曲線の数学設計
curl -o .claude/agents/systems-designer.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/systems-designer.md

# ドロップテーブル・リソースフロー・排出率設計
curl -o .claude/agents/economy-designer.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/economy-designer.md

# PixiJSシェーダー・VFX・レンダリング最適化
curl -o .claude/agents/technical-artist.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/technical-artist.md

# ストーリーアーク・キャラクター・ダイアローグ設計
curl -o .claude/agents/narrative-director.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/narrative-director.md

# ステージレイアウト・エンカウンター・難易度設計
curl -o .claude/agents/level-designer.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/level-designer.md
```

### 各エージェントの使い方

| エージェント | 呼び出す場面 |
|---|---|
| `systems-designer` | 「魔神化のゲージ式を設計して」「状態異常のインタラクションマトリクスを作って」 |
| `economy-designer` | 「深淵の残滓のドロップ率を設計して」「死霊術EXPの成長曲線を調整して」 |
| `technical-artist` | 「FIRE属性のパーティクルVFXを実装して」「PixiJSのシェーダーフィルターを最適化して」 |
| `narrative-director` | 「第1章のストーリーアークを整理して」「ダイアローグの分岐ツリーを設計して」 |
| `level-designer` | 「area1_bossのエンカウントバランスを設計して」「5ステージの難易度曲線を確認して」 |

### Necromance Brave との関連ポイント

**systems-designer が解決できる問題:**
- ダメージ式の `defMult = 1 - def/(def+200)` のパラメータ調整
- 属性耐性インタラクションマトリクス（9属性 × 9属性）
- 魔神化ゲージ（0-100）の充填・消費バランス

**economy-designer が解決できる問題:**
- 深淵の残滓のレアリティ排出確率の設計
- 第1章5ステージのEXP・ドロップ曲線
- 強化素材のスタック消費バランス

---

## 2. UI/UXデザイン特化 — LibreUIUX-Claude-Code

**インストール方法:**

```bash
# UI/UX専門エージェント（67種）を一括取得
# 必要なものだけ個別にコピーする
curl -o .claude/agents/ux-designer.md \
  https://raw.githubusercontent.com/HermeticOrmus/LibreUIUX-Claude-Code/main/agents/ux-designer.md
```

**主要エージェント:**
- `ux-designer` — モバイルUX、タッチインタラクション、iPhone Safari対応
- `accessibility-specialist` — iOS VoiceOverチェック

---

## 3. 公式スキル（Vercel/Neon）— awesome-agent-skills

公式スキルは `.claude/commands/` に `SKILL.md` として配置する形式。

### Neon Serverless Postgres スキル

```bash
# Prismaスキーマ変更・マイグレーション・Neonブランチ操作に使える
curl -o .claude/commands/neon-postgres.md \
  https://raw.githubusercontent.com/neondatabase/agent-skills/main/skills/neon-postgres/SKILL.md
```

**使い方:** `/neon-postgres` でNeonの接続設定、DB分岐、マイグレーションのベストプラクティスを参照できる

### Vercel Web Design Guidelines スキル

```bash
curl -o .claude/commands/web-design-guidelines.md \
  https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md
```

### Vercel React Best Practices スキル

```bash
curl -o .claude/commands/react-best-practices.md \
  https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/SKILL.md
```

---

## 4. Claude Design DESIGN.md — Gothic-Morphism に近いテーマ

[claude.ai/design](https://claude.ai/design) で使えるデザインシステムの雛形ファイル。

Gothic-Morphism（ダーク＋紫グロウ）に近い参照候補:

| テーマ | URL | 特徴 |
|---|---|---|
| **Superhuman** | [getdesign.md/superhuman](https://getdesign.md/superhuman) | Premium dark UI, purple glow accent — 最も近い |
| **ElevenLabs** | [getdesign.md/elevenlabs](https://getdesign.md/elevenlabs) | Dark cinematic, audio-waveform aesthetic |
| **Cursor** | [getdesign.md/cursor](https://getdesign.md/cursor) | Sleek dark interface, gradient accents |
| **Kraken** | [getdesign.md/kraken](https://getdesign.md/kraken) | Purple-accented dark UI, data-dense |

**使い方:**
1. 上記URLから DESIGN.md をダウンロード
2. [claude.ai/design](https://claude.ai/design) を開く
3. DESIGN.md をアップロード → コンポーネント一式が自動生成される
4. Gothic-Morphism 用にカスタマイズ（`#8B00FF` に差し替え）

---

## 5. 全部一括インストールコマンド（推奨5つ）

```bash
# Necromance Brave に最も価値の高い5エージェント
curl -o .claude/agents/systems-designer.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/systems-designer.md

curl -o .claude/agents/economy-designer.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/economy-designer.md

curl -o .claude/agents/technical-artist.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/technical-artist.md

curl -o .claude/agents/narrative-director.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/narrative-director.md

curl -o .claude/agents/level-designer.md \
  https://raw.githubusercontent.com/Donchitos/Claude-Code-Game-Studios/main/.claude/agents/level-designer.md

# Neon公式スキル（DB操作時に便利）
curl -o .claude/commands/neon-postgres.md \
  https://raw.githubusercontent.com/neondatabase/agent-skills/main/skills/neon-postgres/SKILL.md

echo "インストール完了"
```

---

## 注意事項

- エージェントファイルは `.claude/agents/<name>.md` に配置するだけで有効になる
- Game Studios のエージェントは `production/session-state/active.md` への書き込みを試みることがある（そのパスは存在しないが害はない）
- 公式スキル（Neon/Vercel）は `.claude/commands/` に置くとスラッシュコマンドとして呼び出せる
