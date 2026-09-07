# 沖縄介護センター Web基盤

## 現在の構成

`jnlmyz/junabel` の PR #2 にある `nursing/website` を、このリポジトリのルートへ移行したpnpmモノレポ。移行の範囲と元のコミットは [docs/migration.md](docs/migration.md) を参照する。資料は日本語で書く。

- `apps/recruit`: Astro＋TypeScriptの静的採用サイト。現在は `/` に採用1ページ、`/privacy/`、`/design/`、`/photo-brief/` を配置
- `apps/edge`: Cloudflare Workersによる静的配信と任意の件数計測API
- `packages/ui`: 共通の色・書体・余白・コンポーネント
- `packages/content`: 会社・職種・FAQ・流入元・GoogleフォームURL生成
- `docs`: 現行の設計・公開手順・素材の出典
- `archive/legacy-2026-09-07`: 旧HTMLサイト・仕様資料・開発設定の保存版

## 開発

リポジトリのルートから、Node.js 22.12以上（推奨24 LTS）・pnpm 9.15.4で実行する。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm test
pnpm build
```

Worker・配信ヘッダー・404を確認するときは `pnpm preview`。GitHub Actionsは検証のみを行う。詳細は [README.md](README.md) と [docs/deployment.md](docs/deployment.md)。

## 実装方針

- 説明会・見学相談を入口にする。受付はGoogleフォームに統一し、採用の電話リンクは設けない
- フォーム未設定時は「受付準備中」と表示し、入力・送信を無効にする。個人情報はサイトや計測DBで受け付けない
- 検索登録・計測は初期状態で無効。未確認の給与・勤務条件・職員の声は作らない
- Astroで静的HTMLを生成し、操作に必要な箇所だけTypeScriptを使う。共通化は実際に再利用するUIとデータに限定する
- デザイン方針は [docs/architecture.md](docs/architecture.md)、素材・原稿の確認箇所は [docs/content-sources.md](docs/content-sources.md) を参照する
- 旧構成の会社トップ・職種別5ページ・ツアーナースページはアーカイブに保存済み。今後の企業サイトや職種別ページを設計する際の参考にする
- `archive/` は保存資料として扱い、通常の実装変更・ビルド・配信の対象にしない。アーカイブ内の旧技術方針やURL構成を現行の指示として適用しない
- 新ドメインへの公開を想定する。既存の会社サイトは別管理で、移行作業にDNS・メール設定の変更は含めない
