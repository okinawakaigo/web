# 沖縄介護センター Web基盤

採用サイトと社内ダッシュボードをまとめたpnpmモノレポです。コンテンツはAstro、管理画面はReact＋Vite、APIはHono＋Cloudflare Workers、保存にD1、通知にResend APIを使用します。

## ローカル起動

Node.js 24（`.node-version` は24.7.0）、pnpm 9.15.4を使用します。初回のみ設定ファイルをコピーしてください。既存ファイルには上書きしません。

```sh
pnpm install --frozen-lockfile
cp -n apps/recruit/.env.example apps/recruit/.env
cp -n apps/api/.dev.vars.example apps/api/.dev.vars
```

`apps/recruit/.env` の `PUBLIC_CONSULTATION_ENABLED=true` を設定して起動します。

```sh
pnpm db:migrate:local
pnpm preview
```

| 画面 | URL・起動方法 |
| --- | --- |
| 採用サイト・相談フォーム | http://127.0.0.1:8787/ |
| 社内ダッシュボード | http://127.0.0.1:8788/ |
| 共通デザインガイド（ローカル専用） | `pnpm dev:design` → http://127.0.0.1:4324/ |

サイトには `.dev.vars` の `BASIC_AUTH_*`、管理画面には `ADMIN_*` でログインします。ローカルでは受付側と管理側のHonoアプリを一つのWorkerで動かし、同じD1を参照します。管理画面への接続はローカル専用プロキシが担当し、外部には公開しません。サンプル設定ではTurnstileの検証省略はループバックでのみ有効です。Resend未設定でも相談を保存でき、管理画面には「通知未設定」と表示します。

ポートが使用中なら `PREVIEW_PORT=8789 pnpm preview` のように変更できます。

`pnpm dev`（4322）・`pnpm dev:dashboard`（4323）は画面編集用で、APIと認証は動きません。保存・管理操作は `pnpm preview` で確認します。Astroの開発サーバーは対象アプリで `pnpm exec astro dev stop`、Viteの開発サーバーは起動したターミナルのCtrl+Cで終了します。

```sh
pnpm check  # スタイル検査・全アプリの型チェック
pnpm test   # 認証・入力検証・実際のSQLiteによる保存・更新・通知再試行
pnpm build  # 3画面をビルドし、公開用成果物にガイドがないことを検査
```

## 構成

| 場所 | 役割 |
| --- | --- |
| `apps/recruit` | 採用ページ、専用の参加相談フォーム、プライバシー、撮影依頼メモ |
| `apps/dashboard` | React＋Viteによる社内ダッシュボード。概要、採用の参加相談・検索・対応状況・担当者メモ |
| `apps/api` | Honoによる公開側と管理側のWorker、認証、D1保存、Resend API、マイグレーション |
| `apps/design` | 共通部品を表示するローカル専用ガイド。デプロイ対象外 |
| `packages/ui` | 色・書体・余白、Brand・Button・Icon・SelectField・TextField |
| `packages/contracts` | フォームの項目・選択肢、APIの型と入力検証 |
| `packages/content` | 会社情報、職種、FAQ、流入元の分類 |
| `docs` | 設計、公開手順、スタイル、原稿・写真の出典 |
| `archive` | 旧サイト・資料。ビルド・配信対象外 |

共通デザインの実体は `packages/ui` に置きます。ガイドはその部品を読み込む独立アプリです。採用サイトの `/design/` は削除し、公開用Workerは `apps/recruit/dist` と `apps/dashboard/dist` だけを配信します。

## 受付と公開準備

入口は「説明会への参加相談」。氏名・メール・気になっている仕事・同意は必須、年齢層・性別・都合のよい日時・聞きたいことは任意です。流入元・掲載場所はURLの既知の分類を自動で引き継ぎ、入力欄には表示しません。Googleフォーム・スプレッドシートへの接続は使用しません。既存のGoogle上の回答は変更していません。

本番の予定URLは `recruit.okinawakaigo.com` と `dashboard.okinawakaigo.com`。制作確認中のサイトと管理画面は別のBasic認証で保護し、noindexとキャッシュ禁止を維持します。相談内容はD1に保存し、Resendの担当者通知には受付番号と管理画面のリンクだけを含めます。メール失敗時も相談は残ります。

本番D1、管理者認証、Turnstile、Resendの設定が必要です。CIは検証を常時実行し、`DEPLOY_ENABLED=true` のときだけ `main` からデプロイします。未設定のデータベースIDで公開しないよう事前検査を行います。ガイドの公開先は設けません。

給与・勤務条件は未確定のため数値を掲載していません。ヒーローはイメージ写真、撮影依頼メモはAI生成の参考画像です。原稿・写真は引き続き確認が必要です。提案していた新ロゴは不採用とし、会社名を文字で表示しています。

詳しくは [公開手順](docs/deployment.md)、[設計](docs/architecture.md)、[スタイル](docs/styling.md)、[出典](docs/content-sources.md) を参照してください。旧 `jnlmyz/junabel` からの移行履歴は [移行記録](docs/migration.md) に保存しています。

## ダッシュボード

`apps/dashboard` は会社全体の業務を管理するReact＋Viteアプリです。概要から対応状況を確認し、サイドバーの「採用 → 参加相談」で検索・絞り込み・詳細の編集ができます。未保存の変更がある移動時は確認を表示します。メールの旧形式の詳細リンクも引き続き使用できます。

画面のみの開発は `pnpm dev:dashboard`（4323）、APIを含む動作確認は `pnpm preview`（8788）。採用サイトへのリンクをローカルに向ける場合は `apps/dashboard/.env.example` を `.env.local` にコピーし、`VITE_RECRUIT_URL` を起動中のURLに合わせます。認証用の既存 `ADMIN_USERNAME` / `ADMIN_PASSWORD` はそのまま使います。画面設計は [docs/dashboard-design.md](docs/dashboard-design.md) を参照してください。
