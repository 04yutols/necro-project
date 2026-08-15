# Visual Asset Forge

bitmap画像を制作するときだけ全文読む。Content Packageの`assets[]`を生成前仕様からゲーム反映までの正本とする。

## Workflow

1. 画像ごとに`spec: AssetSpec`を記録する。
2. `npm run content:assets:prompts -- <package.json>`を実行する。
3. `content/packages/{packageId}/reviews/asset-prompts.json`を開く。
4. `jobs`を記録順に処理する。これは`referenceAssetRefs`の依存順である。
5. 新規基準画像はCodex内蔵`imagegen`へ`prompt`を渡す。派生画像は`referenceAssetPaths`の実画像をすべて参照し、同一デザインを維持する。
6. imagegenの出力をjobの`originalPath`へコピーする。Codex側の生成原本は削除しない。
7. `npm run content:assets:forge -- <package.json>`を実行する。
8. `npm run content:assets:check -- <package.json>`を実行する。
9. `content/packages/{packageId}/reviews/contact-sheet.webp`と`/admin/assets`を開き、人間が一貫性を確認する。
10. package全体の`content:validate`を実行する。画像だけのPASSをpackage完成と解釈しない。

画像生成サービスやAPIキーをゲームへ組み込まない。画像生成はCodexの制作工程、Sharpによる最適化・検査はリポジトリの決定論工程とする。

## AssetSpec

必須:

- `usage`: 使用箇所
- `variant`: `default`、`awakened`などの識別子
- `width`, `height`, `aspectRatio`
- `transparency`: `OPAQUE` / `ALPHA` / `CHROMA_KEY`
- `safeArea`: top / right / bottom / leftのpx
- `style`: medium / palette / lighting / mood / materials
- `mustInclude`, `avoid`
- `maxBytes`

任意:

- `expression`: `character-expression`では必須
- `effectKey`: skill系出力ディレクトリ
- `consistencyGroup`: 同じ造形を共有する画像群

対応usage:

```text
character-fullbody  character-expression  character-bust  battle-unit
weapon-icon         weapon-card            weapon-silhouette
residue-icon        skill-icon             vfx-texture      vfx-mask
background
```

## Consistency graph

基準画像を先に作り、派生assetの`referenceAssetRefs`へ基準asset IDを入れる。

```text
character-fullbody -> character-expression / character-bust / battle-unit
weapon-card        -> weapon-icon / weapon-silhouette
skill-icon         -> vfx-texture / vfx-mask
```

派生jobでは`referenceAssetPaths`が空でないことを確認する。画像生成へ参照画像を渡し、「顔・比率・装備・配色・素材を再設計しない」と再指定する。基準画像の置換後は全派生を再生成する。

## Output policy

```text
original:  content/packages/{packageId}/originals/{assetId}.<source extension>
optimized: content/packages/{packageId}/optimized/{assetId}.webp
review:    content/packages/{packageId}/reviews/contact-sheet.webp

public/images/generated/characters/{ownerId}/
public/images/generated/weapons/{ownerId}/
public/images/generated/residues/{ownerId}/
public/images/generated/skills/{effectKey}/
public/images/generated/backgrounds/{ownerId}/
```

原本は非破壊で保持する。`sourcePath`は最適化済みWebPを指し、`outputPath`は承認・apply後のゲーム配信先を指す。READY assetへwidth / height / format / alpha / safeArea / bytes / sha256を保存する。

## Transparency

- `OPAQUE`: 最終画像を不透明WebPへflattenする。
- `ALPHA`: すでにalpha channelを持つ入力だけに使う。
- `CHROMA_KEY`: Codex内蔵画像生成へ完全に均一な`#00ff00`背景を要求する。影、床、反射、勾配、模様、照明むらを禁止し、forgeでsoft edgeとdespillを施してalphaへ変換する。
- 毛髪、毛皮、ガラス、煙、液体、半透明素材などクロマキーが破綻しやすい対象では、勝手に外部API fallbackへ切り替えない。ユーザーへ確認するか、OPAQUE assetとして設計する。

## Mechanical gates

forge/checkは以下を検査する。

- output pathと命名規約
- 画像デコード、寸法、aspect ratio、WebP形式
- alpha mode
- `maxBytes`
- bytes / sha256のmanifest一致
- safe areaの幾何的妥当性
- `referenceAssetRefs`の参照切れと循環
- originals / optimized配下のorphan

PASS後も次を人間がcontact sheetで見る。

- 顔・体格・武器形状・装備の一致
- 表情だけが意図どおり変わっているか
- palette、材質、光源の連続性
- 小サイズでのシルエット判別
- safe area内への収まり
- 世界観上の魅力と既存設定との整合

作例は`content/packages/phase3-visual-example.json`を参照する。
