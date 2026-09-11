# 掲載原稿・素材の出典

確認日：2026-09-06。公開前にクライアントへ現在の運用を確認してください。

| 掲載項目 | 根拠 | 扱い |
| --- | --- | --- |
| 会社名、所在地、電話番号、設立年月、事業内容 | [会社概要](https://www.okinawakaigo.jp/会社概要/) | 公開情報から記載 |
| 生活・旅行の想いを支える事業 | [公式トップページ](https://www.okinawakaigo.jp/) | 原稿を新たに整理 |
| 新人指導、職員間の相談、研修補助、オンライン研修、記録電子化 | [処遇改善加算に基づく取り組み](https://www.okinawakaigo.jp/会社概要/処遇改善加算に基づく取り組み/) | 制度の金額は掲載せず、取り組みを要約。現在の適用条件は公開前に確認 |
| 訪問介護員・ケアマネ・相談員の紹介 | 公式事業情報、[移行元の採用サイト・Web刷新議事録](https://github.com/jnlmyz/junabel/blob/843fc0782b2f1a247ef83049458dfff7052cfd09/nursing/meetings/2026-08-17-採用サイト・Web刷新.md) | 現在の募集条件を保証しない仕事紹介。相談員は募集状況の確認を案内 |
| 採用コンセプト | 同議事録・[旧仕様・採用サイトラフ](../archive/legacy-2026-09-07/docs/spec/04_採用サイトラフ.md) | 今回のコピー提案 |
| 説明会への参加相談を入口にする方針 | 2026-09-10の制作方針確認 | 入口を一本化。説明会後に希望に応じて見学・応募を案内 |
| 給与・休日・賞与・勤務時間 | 過去議事録に既存サイトの誤記の記録あり | 確認済みの数値を受領していないため未掲載 |
| 職員インタビュー・勤続年数 | 取材素材なし | 作成せず、Instagramへの案内を配置 |

## 写真

### hero-care-dummy.png / hero-team-dummy.png / hero-preparation-dummy.png

- 生成日：2026-09-06。OpenAIの画像生成機能で、撮影構成の検討用に個別生成した3枚。
- 人物・室内・制服は架空。現クライアントの実際の職員・利用者・事務所を写した写真ではない。
- 横3:2、1536×1024pxの元画像を `apps/recruit/src/assets/` に保存。配信時にはAstroで複数サイズのWebPを生成する。
- 現在は撮影依頼ページのみで使用し、AI生成の注記を表示。
- [使用した生成プロンプト](image-generation-prompts.md)。

### care.jpg（現在のヒーローの仮画像）

- 取得元：[クライアントの公式サイト](https://www.okinawakaigo.jp/)
- 元画像：`https://image.jimcdn.com/app/cms/image/transf/dimension=1920x400:format=jpg/path/s93ad6739755cd47c/image/icf3aaa00a61ef03c/version/1605151120/image.jpg`
- 内容：介護職と高齢の女性のイメージ写真。原寸600×400px。
- ヒーローの仮画像として使用。実際の職員・利用者として紹介せず、写真はイメージと表示。新ドメインでの再利用権・肖像利用条件は未確認のため、公開前に確認するか同意済みの実写へ差し替える。

### okinawa.jpg / og.jpg

- 写真：Roméo A. / Unsplash
- [写真ページ](https://unsplash.com/photos/calm-ocean-waters-meet-a-beautiful-lush-landscape-dRYpjXkbUoI)
- [Unsplash License](https://unsplash.com/license)
- 元画像：`https://images.unsplash.com/photo-1754228771091-e0c10ce4550c`
- 写真ページで無料のUnsplashライセンス表示を確認。沖縄の風景として使用。事業所所在地や実際の業務風景としては使用しない。
- 自己配信のため、閲覧者がUnsplashに直接アクセスする画像構成ではない。

## ロゴ・アイコン・フォント

- 提案していた新ロゴは2026-09-11に不採用と決定。採用サイト・ダッシュボード・デザインガイド・ファビコンから削除し、会社名を文字で表示する。正式なロゴの提供・使用指示があるまで新しいマークは使用しない。
- Iconは機能を示す単純な線画。装飾的なイラスト素材は作成していない。
- Noto Sans JP、Noto Serif JP、DM SansはFontsource経由で自己配信。各パッケージのOFLライセンスを保持する。

## 差し替え箇所

- 原稿：`packages/content/src/index.ts`
- ヒーローのコピー・画像・説明：`apps/recruit/src/pages/index.astro`
- ヒーローの写真配置：`apps/recruit/src/styles/recruit.css`
- 撮影参考画像・撮影意図：`apps/recruit/src/content/photography-brief.ts`
- 写真：`apps/recruit/src/assets/`
- 会社名の文字表示：`packages/ui/src/components/Brand.astro`、`packages/ui/src/react/index.tsx`、`apps/dashboard/src/components/DashboardShell.tsx`
- 色・書体：`packages/ui/src/tokens.css`
- プライバシー原稿：`apps/recruit/src/pages/privacy.astro`
