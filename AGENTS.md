# 沖縄介護センター Web基盤

資料・ユーザーへの説明は日本語。Node.js 24・pnpm 9.15.4のモノレポ。移行元と保存資料は [docs/migration.md](docs/migration.md) を参照。

## 構成

- `apps/recruit`: Astroの採用サイトと「説明会への参加相談」フォーム。
- `apps/dashboard`: React＋Viteの社内ダッシュボード。概要と採用の参加相談をサイドバーで切り替える。本番URLは `https://dashboard.okinawakaigo.com/`。
- `apps/api`（旧 `apps/edge`）: Hono＋Cloudflare Workers。D1保存・管理API・Resend通知。本番用Workerは `src/index.ts`（サイト）と `src/dashboard-worker.ts`（管理）。`src/local-worker.ts` はローカル専用でデプロイしない。
- `apps/design`: ローカル専用デザインガイド。公開せず、採用サイトの `/design/` にもデプロイの静的配信対象にも含めない。
- `packages/ui`: 共通トークンと操作部品。`packages/contracts`: APIの型・項目・検証。`packages/content`: 原稿と流入分類。
- `archive/`: 保存資料。変更・ビルド・配信の対象外。旧仕様を現行方針として適用しない。

## 受付と管理の方針

- 入口は「説明会への参加相談」のみ。専用フォームからD1に保存する。Googleフォーム・Sheets API・採用の電話リンクは使わない。
- 年齢層・性別は任意。流入元と掲載場所は入力欄を設けず、既知のURLパラメータだけを相談に付加し、管理画面で確認する。
- D1保存後にResend APIで担当者へ通知する。本文は受付番号と認証必須の管理画面リンクのみ。通知に失敗しても相談の保存は維持する。
- 相談者への連絡は管理画面の「メールで連絡する」からメールアプリを開いて行う。管理画面内の返信・送信履歴は実装しない。Resendは担当者通知のみ。
- 本番の受付にはTurnstileとレート制限が必要。Turnstile検証の省略はローカルのループバック限定。

## 認証と秘密情報

- 本番では採用サイトの制作確認用Basic認証と管理者用Basic認証を分ける。未設定時は配信を閉じる。全静的ファイルとAPIを認証し、noindex・キャッシュ禁止を付ける。
- `pnpm preview` はローカル専用Workerのループバック接続に限りBasic認証を省略する。本番用Workerに省略経路を作らない。
- 秘密情報はWorker Secrets・GitHub Actions Secrets・Git管理対象外の `.dev.vars` に置く。`PUBLIC_*` に含めない。
- 相談本文・メモ・メールアドレスをログに出さない。

## 原稿とデザイン

- 未確認の給与・勤務条件・職員の声は作らない。提案していた新ロゴは不採用のため使用せず、会社名を文字で表示する。素材の扱いは [docs/content-sources.md](docs/content-sources.md) を参照。
- Tailwind CSS 4と `packages/ui/src/tokens.css` を使い、ボタン・選択欄・入力欄は共通部品を使う。[docs/styling.md](docs/styling.md) に従う。

## 開発・確認

Reactの派生値はレンダー中に計算し、操作に伴う処理はイベントハンドラに置く。関連する状態はreducerにまとめる。D1のクエリはDrizzleを使い、`apps/api/src/db/`に置く。[docs/code-quality.md](docs/code-quality.md) に従い、ESLint・Stylelintを通す。

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local   # ローカルD1にマイグレーションを適用
pnpm preview            # ビルド後、サイト 127.0.0.1:8787・管理 127.0.0.1:8788
pnpm dev                # 採用サイトの画面のみ 4322（APIなし）
pnpm dev:dashboard      # ダッシュボードの画面のみ 4323（APIなし）
pnpm dev:design         # デザインガイド 4324
pnpm check && pnpm test && pnpm build   # 変更後に通す
```

設定ファイルは既存値を上書きせず [README.md](README.md) に従う。CIは検査・ビルド・両Workerのドライランを実施し、`DEPLOY_ENABLED=true` の `main` pushでのみ本番へ反映する。D1・Resend・ドメインの設定と公開手順は [docs/deployment.md](docs/deployment.md) を参照。既存会社サイトやメールのDNSは一括変更しない。
