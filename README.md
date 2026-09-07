# 沖縄介護センター Web基盤

採用ページを起点に、企業サイトと将来のサービスへ展開するpnpmモノレポ。フロントエンドはAstro＋TypeScript＋Tailwind CSS 4、配信・APIはCloudflare Workers＋TypeScriptです。

[jnlmyz/junabel PR #2](https://github.com/jnlmyz/junabel/pull/2) の `nursing/website` をこのリポジトリのルートへ移行しました。旧HTMLサイト・仕様資料・開発設定は [`archive/legacy-2026-09-07/`](archive/legacy-2026-09-07/) に保存しています。移行元のコミットと構成の違いは [移行記録](docs/migration.md) を参照してください。

## 起動

Node.js 22.12以上（推奨24 LTS）、pnpm 9.15.4を使用します。

nodenv等を使うローカル環境向けに、`.node-version` でNode 24.7.0を指定しています。該当バージョンが未導入の場合は、先にバージョン管理ツールでインストールしてください。

```sh
# このリポジトリのルートで実行
pnpm install --frozen-lockfile
pnpm dev
```

採用ページは `http://127.0.0.1:4321/`、デザインガイドは `/design/`、画像付きの撮影依頼メモは `/photo-brief/`。この環境のAstro 7のdevサーバーはバックグラウンドで継続します。終了は `pnpm --filter @okinawa-care/recruit exec astro dev stop`。

```sh
pnpm lint:styles # 共通テーマ・余白ルールの検査
pnpm check      # スタイル検査とAstro・Workerの型チェック
pnpm test       # 流入元・フォームURL・計測APIの検証
pnpm build      # 静的HTMLと最適化した画像を生成
pnpm preview    # ビルド後、Workersで配信 http://127.0.0.1:8787
```

`pnpm dev` は画面開発用です。API・配信ヘッダー・404は `pnpm preview` で確認します。別のプロジェクトの依存関係やデプロイ設定には依存しません。

## 構成

| 場所 | 責務 |
| --- | --- |
| `apps/recruit` | 採用ページ、問い合わせ導線、SEO、レスポンシブ表示 |
| `apps/edge` | 静的ファイル配信、件数集計API、D1マイグレーション |
| `packages/ui` | 色・文字・余白、Brand・Button・Iconの共通コンポーネント |
| `packages/content` | 会社情報、職種、FAQ、流入元の型とフォームURL生成 |
| `tests` | データを扱う境界のテスト |
| `docs` | 設計判断、公開・フォーム設定、掲載情報と写真の出典 |
| `archive` | 移行前のサイト・仕様資料。ビルド・配信の対象外 |

ページ全体を巨大な共有コンポーネントにせず、複数のサイトで使う基礎だけを共有します。企業サイト追加時は `apps/corporate` を追加し、同じパッケージを参照します。将来の業務アプリは別のアプリ・Worker・DBとして追加できます。

## 実装済み

- 採用1ページ：理念、職場環境、3職種の開閉式紹介、旅行の支援、Instagram、FAQ、説明会・見学相談、会社情報
- スマホ固定CTA、開閉メニュー、キーボード操作、スキップリンク、reduced-motion対応
- Googleフォームで説明会・見学の相談を受付。希望職種・次のステップ・流入元を引き継ぐ予約導線
- Cookie・ユーザーIDを使用しない日次件数集計API。初期状態は無効
- canonical、OGP、sitemap、robots、プライバシーページ、404、ローカルフォント、WebP画像
- Tailwindの共通テーマで色・文字サイズ・4px単位の余白を統一。ボタン・選択欄を共有し、Stylelintでルールを検査。[スタイルの統一ルール](docs/styling.md)を参照
- `/design/` で実装と同じテーマ色・コンポーネント・無効状態を確認できるデザインガイド
- ヒーローは当初の大きな写真1枚。ページ全体の実写撮影に向けた、画像付きの撮影依頼メモ `/photo-brief/`
- GitHub Actionsによる型チェック・テスト・ビルド・Wranglerドライラン。`main` への対象ファイルのpush時は成功後にWorkersへ自動デプロイ（APIトークンの設定が必要）

## 現在の公開準備状況

Webページはローカルで動作します。Cloudflareへの公開、DNS変更、Googleフォーム・スプレッドシートの作成は実行していません。

- **予約フォーム未設定**：「受付準備中」と表示し、入力・送信を無効にしています。電話相談は受け付けません。公開前にフォームURLと事前入力項目のIDを設定してください。
- **給与等は未確認**：過去の議事録に誤記の記録があるため転載していません。現状は条件を問い合わせる表示です。確定後、職種データへ募集条件を追加してください。
- **人物写真**：ヒーローは当初のイメージ写真を仮使用。撮影依頼ページにはAI生成の参考画像を明示して掲載しています。[撮影依頼メモ](docs/photography-brief.md)に沿って実写を撮影し、ヒーローと本文の写真を整えます。
- **ロゴ**：新しいマークの提案。既存の正式ロゴの改変ではありません。
- **限定公開**：公開先は `https://recruit.okinawakaigo.com/`。Cloudflare Accessで許可メールだけが閲覧できるよう設定してから公開します。`workers.dev` とプレビューURLは無効です。
- **検索登録**：CIでnoindexを固定し、HTTPレスポンスにも `X-Robots-Tag` を付けています。Access設定の確認後に `RECRUIT_ACCESS_READY=true` を登録するまで、CIのデプロイは停止します。

運用手順は [deployment.md](docs/deployment.md)、設計判断は [architecture.md](docs/architecture.md)、素材・原稿の確認箇所は [content-sources.md](docs/content-sources.md) を参照してください。

ヒーローはユーザーの指定により当初の1枚構成へ戻しました。会社の雰囲気はページ全体の写真で伝える方針です。[81webの事例研究と決定内容](docs/design-research-81web.md)に、採用専用サイト6件の構成比較と経緯を記録しています。
