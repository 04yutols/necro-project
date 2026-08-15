# Content Package completion contract

## Package states

| State | Meaning |
|---|---|
| `DRAFT` | 制作中。欠落成果物があってよい |
| `VALIDATED` | 構造・参照・数値の決定論検証を通過 |
| `REVIEWED` | 人間が内容を確認し、コメントを残した |
| `APPROVED` | 明示承認済み。適用可能 |
| `APPLIED` | ゲームへ反映し、回帰確認済み |
| `BLOCKED` | 必須成果物または利用可能な制作手段が不足 |

## Shared required sections

```yaml
id: snake_case
chapter: 1
status: DRAFT
brief:
  playerExperience: ""
  themes: []
  mustInclude: []
  avoid: []
targets: []
lore: {}
deliverables: []
dependencies: []
changes: []
assets: []
presentation: []
localization: []
evidence: []
provenance: {}
review:
  history: []
  blockers: []
```

## Completeness matrix

### Story character

- profile: id、日英名、役割、望み、恐れ、価値観、口調
- relationships: 既存人物との関係、時系列
- expressions: 使用する全表情
- assets: 基準立ち絵、必要な表情差分、safe area
- integration: 登場scene、speaker / portrait参照
- localization: ja / en。必要ならalt

### Combat unit

- identity: enemy / monster / Aldo jobのいずれか
- gameplay: BaseStats 8種、耐性、MP、cost、role、target level
- growth: 必要なレベル帯の成長曲線
- skills: 通常行動、skill、ultimate、AI利用条件
- assets: battle visual、icon、必要ならportrait
- presentation: spawn、attack、hit、defeatの最低演出
- integration: stage / necromance / party / reward
- evidence: EHP、TTK、被ダメージ、AV、costの評価

### Weapon

- gameplay: rarity、archetype、rank、ilv、subOptions、passive A/B
- narrative: name、flavor、由来
- assets: inventory icon、detail/card art
- presentation: rarity reveal、必要なら固有passive feedback
- integration: drop source、inventory、equip
- evidence: weapon balance、代表build比較

### Skill

- gameplay: power、MP、element、attackType、targetType、ailment、effectKey
- assets: skill icon、必要なVFX texture / mask
- presentation:
  - cast / travel / impact / aftermath
  - durationとdamage / multi-hit timing
  - renderer / colors / blend / texture、hit-stop / camera shake / flash / target marker / particle・DOM予算
  - SFX profile / pitch / volume / layer / 再生時刻
  - reduced-motion代替、色以外のshape cue、flash 3Hz以下
  - low-device particle budget / max DOM nodes / targetFrameMs
- integration: job / monster / enemy AI、battle action
- evidence: skill balance、simulation、preview screenshot

### Abyssal residue

- narrative: name、rarity、origin、tags
- assets: slotまたはrarity visual
- integration: residue name pool、drop、equip UI
- gameplay valuesはRewardService側の独立成果物。名称packageに混ぜない

### Encounter

- enemy / wave / stage / area / reward / story trigger
- background、map node、enemy visual
- bossならgimmick、専用skill presentation、reward reveal
- unlock graph、TTK、clear flow、result persistenceの証跡

## Asset record

各画像に次を記録する。

- `id`, `ownerId`, `kind`, `originalPath`, `sourcePath`, `outputPath`
- `spec`: usage / variant / dimensions / aspectRatio / transparency / safeArea / style / mustInclude / avoid / maxBytes
- width / height / format / alpha / safeArea
- generation prompt / negative constraints / reference asset IDs
- content hash / generator / generatedAt
- review status / reviewer

標準候補:

```text
public/images/generated/characters/{id}/
public/images/generated/weapons/{id}/
public/images/generated/residues/{id}/
public/images/generated/skills/{effectKey}/
public/images/generated/backgrounds/{id}/
```

## Validation gates

1. lore: 固有名詞、関係、時系列、release scope
2. schema: 型、ID、未知フィールド、参照
3. balance: role帯、simulation、経済
4. assets: path、寸法、alpha、容量、hash、orphan
5. presentation: effectKey、timing、SFX、fallback
6. runtime: typecheck、Jest、Playwright、visual check、60fps目安
7. review: 人間承認。Codex自己承認禁止

必須成果物が未実装ツールに依存する場合は`BLOCKED`ではなく、手動制作で安全に進められるなら`DRAFT`の未完項目として残す。完成報告はしない。

## Authoring artifact

数値を持つREADY deliverableの`artifact`へ次の形で要求を書く。`request`の詳細は`src/lib/content/gameplayAuthoring.ts`の型を正とする。

```json
{
  "authoringKind": "combat-unit | skill | weapon | residue-name",
  "request": {},
  "simulationTargets": {
    "ttkTurns": { "min": 2, "max": 8 },
    "incomingDamagePct": { "min": 5, "max": 75 },
    "aoeValue": { "min": 2, "max": 3.2 },
    "partyCost": { "min": 0, "max": 6 }
  }
}
```

`content:author`はDRAFTだけを更新する。結果は次へ保存される。

- 実マスター形式: `changes`
- 数値根拠と既存gate結果: `deliverables[].artifact.authored`
- 実BattleEngineの詳細: `deliverables[].artifact.simulation`
- レビュー用要約: `evidence`

目標帯内はPASS、近い逸脱はWARN、大きい逸脱はFAIL。FAILがあっても自動調整や自己承認はせずDRAFTに残す。第1部のpartyは必ずアルド＋3 monster slotとする。残滓の`residue-name` requestは名称・由来・themeだけを生成し、性能RNGへ触れない。

## Commands

```bash
npm run content:author -- <package.json>
npm run content:assets:prompts -- <package.json>
npm run content:assets:forge -- <package.json>
npm run content:assets:check -- <package.json>
npm run content:present -- <package.json>
npm run content:validate -- <package.json>
npm run content:production -- <package.json>
npm run content:transition -- <package.json> --to=VALIDATED
npm run content:transition -- <package.json> --to=REVIEWED --actor=<reviewer> --actor-type=human --comment='<comment>'
npm run content:transition -- <package.json> --to=APPROVED --actor=<approver> --actor-type=human
npm run content:apply -- <package.json> --approved-by=<approver>
# 初回環境だけ: npx playwright install webkit
npm run content:qa -- <package.json>
npm run content:undo -- .content-snapshots/<snapshot-directory>
```

- DRAFT / BLOCKEDでは不足成果物をWARN、VALIDATED以降ではFAILにする。
- REQUIRES依存の循環と、すべての内部参照切れをFAILにする。
- READY assetは`content/packages/`でstagingし、寸法・alpha・safe area・bytes・sha256を記録する。
- READY presentationは`content:present`でstoryboardとhash付き証跡を作り、`/admin/effects`で通常・reduced-motion・低負荷を確認する。
- 承認後のapplyはREADY presentationを専用registryへcreate-onlyで登録する。既存effectKeyの上書きは禁止する。
- encounterは`stage` changeを必須とし、WAVE enemy、drop / reward、story triggerをruntime参照へ接続する。
- production gateは日英、alt、SFX字幕、flash、shape cue、reduced-motion、orphan、effectKey、drop参照をFAIL判定する。
- すべてのtargetに日英名と日英画像altを記録する。
- REVIEWED / APPROVEDはhuman actorだけが実行できる。
