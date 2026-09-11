# 設定・公開手順

採用サイトは `https://recruit.okinawakaigo.com/`、管理画面は `https://dashboard.okinawakaigo.com/`。`apps/design` はローカル専用で公開しません。配信アカウントは両Wrangler設定に指定した `869d7f9f9faebf609a8363a4f9d9e38b`、ゾーンは `okinawakaigo.com` です。

## ローカルで動かす

初回のみ `.env.example` と `.dev.vars.example` を同じ場所の `.env`・`.dev.vars` にコピーします。既存設定を上書きしないでください。

| ファイル | 設定 |
| --- | --- |
| `apps/recruit/.env` | `PUBLIC_CONSULTATION_ENABLED=true`。Turnstile site keyはローカルでは空で可 |
| `apps/api/.dev.vars` | サイト用 `BASIC_AUTH_*`、管理用 `ADMIN_*`、`CONSULTATION_ENABLED=true`、`LOCAL_FORM_TEST=true` |
| 同上のResend設定 | 空なら送信しない。保存された相談は「通知未設定」と表示 |

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm preview
# 別ターミナル
pnpm dev:design
```

サイト `127.0.0.1:8787`・管理画面 `127.0.0.1:8788`はそれぞれの認証情報で開きます。ガイドは http://127.0.0.1:4324/ です。ローカルでは受付側と管理側のHonoアプリを一つのWorkerで動かし、`apps/api/.wrangler/state` の同じD1を使います。別プロセスで同じDBを開くと競合するため、`pnpm preview` でまとめて起動します。`wrangler.local.jsonc` はローカル専用でデプロイしません。サイトと管理画面のビルド成果物だけを `.wrangler/preview-assets` にコピーして配信します。画面を変更したら `pnpm preview` を起動し直してください。本番データには接続しません。相談本文、メモ、メールアドレス等をログに出さない実装です。

`pnpm dev` と `pnpm dev:dashboard` は画面開発のみでAPIは動きません。フォームは接続先の準備を確認できない場合、入力・送信を無効にします。ローカルの検証省略は `localhost`・`127.0.0.1`・`[::1]` のみで、本番ホストには適用されません。

## 本番設定

本番D1・Turnstile・Resendは未設定です。コードの実装と本番受付の開始は別です。次の設定を用意してからデプロイを有効にします。

1. Cloudflareの対象アカウントで `recruitment` D1データベースを作成し、IDを控えます。必要なら `pnpm --filter @okinawa-care/api exec wrangler d1 create recruitment` を実行します。このコマンドは本番リソースを作成します。
2. Turnstileのウィジェットを作成し、許可ホストに `recruit.okinawakaigo.com` を指定します。site keyとsecret keyを別々に設定します。
3. Resendで送信元ドメインを認証し、送信元アドレス、担当者の通知先アドレス、送信用APIキーを用意します。実際の送信先は一つです。既存メールのDNSを変更する場合は、追加するレコードと影響を確認してから反映します。
4. サイト閲覧用とは異なるパスワードで管理者用認証を用意します。
5. 下記GitHub設定を登録します。`DEPLOY_ENABLED` は設定が揃った後に `true` にします。

`apps/api/wrangler.jsonc` と `wrangler.dashboard.jsonc` のゼロのD1 IDはローカル用プレースホルダーです。デプロイスクリプトはGitHub Variableの実IDを両設定に反映した一時ファイルを使い、プレースホルダーのままでは停止します。設定ファイルへ直接実IDを書き込む必要はありません。

### GitHub Actions Secrets

| 名前 | 内容 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 対象アカウントのWorkers Scripts Edit、D1 Edit、対象ゾーンのWorkers Routes Readを持つトークン |
| `BASIC_AUTH_USERNAME`・`BASIC_AUTH_PASSWORD` | 制作確認用サイトの閲覧情報 |
| `ADMIN_USERNAME`・`ADMIN_PASSWORD` | 管理画面専用の認証情報。サイトと別のパスワード |
| `TURNSTILE_SECRET_KEY` | 送信検証用の秘密鍵 |
| `RESEND_API_KEY` | Resend送信用APIキー |
| `NOTIFICATION_FROM` | Resendの認証済み送信元メールアドレス |
| `NOTIFICATION_TO` | 担当者の通知先メールアドレス |

認証IDは1〜64文字、半角英数字で始まり、以後は英数字・`.`・`_`・`@`・`-`。パスワードは16〜256文字、制御文字なしです。本番ではパスワードマネージャー等で生成した値を使い、ローカルのサンプル値は使いません。秘密情報は `PUBLIC_*` やソースコードに入れません。

### GitHub Actions Variables

| 名前 | 内容 |
| --- | --- |
| `DEPLOY_ENABLED` | `true` でmainからのデプロイを有効化。初期は無効 |
| `D1_DATABASE_ID` | 作成した本番D1のID。公開側と管理側で共用 |
| `PUBLIC_CONSULTATION_ENABLED` | `true` で受付を有効化。初期は `false` |
| `PUBLIC_TURNSTILE_SITE_KEY` | ブラウザ用の公開鍵 |
| `PUBLIC_ANALYTICS_ENABLED` | 初期は `false`。件数計測用DB・制限を別途設定するまで無効 |

サイトURL・noindexはCIで固定します。Googleフォーム関連の旧 `PUBLIC_RESERVATION_URL`・`PUBLIC_FORM_*` は不要です。Variablesの変更は実行済みのサイトに自動反映されないため、mainの対象ファイルを更新するかワークフローを再実行します。

## CIとデプロイ

PRとmainのCIで `pnpm check`・`pnpm test`・`pnpm build`・両Workerのドライランを実施します。ビルド後には、公開用の成果物に `/design/` が存在しないこと、各Workerの配信ディレクトリが対象アプリだけであることを検査します。

`DEPLOY_ENABLED=true` のmainでは `scripts/deploy.mjs` が次を行います。

1. D1 ID・別々の認証情報を検証します。受付を有効にする場合はTurnstile・Resend設定も必須です。
2. 実IDを適用した一時設定と、Workerごとに必要なSecretsのJSONを権限600で作成します。
3. D1マイグレーションを本番へ適用します。
4. 管理Worker `okinawa-care-dashboard`、採用Worker `okinawa-care-recruit` の順に配信し、それぞれ独自ドメインを接続します。二つの配信は一つのトランザクションではありません。片方が失敗した場合は原因を直してCIを再実行します。
5. 未認証・サイト認証では管理情報を取得できないこと、正しい認証で静的ファイルとAPIを読めること、noindex・キャッシュ禁止を検証します。一時ファイルは終了時に削除します。

`apps/design/dist`・`docs`・`archive` は配信しません。`workers.dev` とプレビューURLは無効です。ローカルから公開する場合も `pnpm deploy` を使います。`wrangler deploy` の直接実行は共通の事前検査を迂回するため使わないでください。`node scripts/deploy.mjs --validate` は設定検証のみで、リモートへの変更を行いません（ビルドと設定済み環境変数が必要）。

## 認証とデータの扱い

両Workerは静的ファイルも含め必ず先に認証します。認証未設定では503、未認証・誤認証では401。管理画面に採用サイトの共有パスワードでは入れません。管理画面の認証は共有管理者ID方式で、個人アカウント・権限の段階・操作担当者別の監査ログは初版にはありません。

全レスポンスに `Cache-Control: private, no-store` と `X-Robots-Tag: noindex, nofollow, noarchive`、HTTPSにHSTSを付けます。認証情報をStatic Assetsへ引き継ぎません。Cloudflareが自動生成するrobots.txtだけは未認証の401がクローラー用文書の200に置き換わることがあるため、検証スクリプトで内容とヘッダーを確認します。

受付APIは同一OriginのJSONのみ、最大16KiB、既知の項目・文字数・選択肢を検査します。Turnstileの成功・ホスト・用途を検証し、レート制限を適用します。制限はCloudflare拠点単位の共有キーなので、全世界の厳密な上限ではありません。流入元・掲載場所は媒体分類として扱い、本人確認や改ざん防止には使いません。

管理APIは名前・仕事の検索と状態の絞り込みに対応し、50件ずつ一覧を返します。状態別の件数は全件から集計し、検索結果の件数とは分けて返します。連絡先や相談本文は個別の詳細で取得します。更新時はrevisionを検査し、別画面からの更新を上書きしません。保持期間や削除窓口の運用は受付開始前に決めてください。初版にはCSV出力や削除ボタンはありません。削除依頼は対象を確認して管理者がD1で対応します。

## Resend通知の確認

D1保存が受付成功の基準です。その後、担当者に受付番号と認証必須の管理画面リンクだけをメールで送ります。相談者への自動返信はありません。担当者が入力されたアドレスへ日程をご案内します。

通知の状態は「通知待ち」「通知メールの受付成功」「通知失敗」「通知未設定」。受付成功はResend APIによる受付で、配信完了を保証する表示ではありません。配信先での受信・バウンスはResendで確認します。保存後にWorkerが停止した場合など、通知待ちが残っても管理画面から確認・再試行できます。

再試行には同じ受付番号のIdempotency-Keyと、初回に保存した同じメール内容を使います。Resendの重複防止期間を越えないよう、最初の通知処理から23時間を過ぎた再送は停止します。設定を変えても再試行先は初回の宛先です。期限を越えた通知は管理画面で相談を確認し、手動で対応します。

本番受付前に、自分の連絡先で一件送信し、D1保存・管理画面・通知メールの実配信・返信の担当者を確認してください。ローカルのResend設定を空にした確認では実メールを送っていません。

## 件数計測（任意）

旧来の匿名件数API `/api/events` は残しています。現在の画面は `page_view`・`reserve_view` を送信でき、旧 `form_open` は過去データとの互換のため型に残します。受付数は `consultations` の保存件数で確認します。

有効化する場合は公開Workerに別のD1 `METRICS` と `METRICS_RATE_LIMITER` を設定し、`0001_metrics.sql` をそのDBへ適用してから `PUBLIC_ANALYTICS_ENABLED=true` にします。受付用DBの `DB` バインディングだけでは計測は有効になりません。

## 参照

- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Turnstileのサーバー側検証](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Resend送信API](https://resend.com/docs/api-reference/emails/send-email)
- [Resendの重複防止キー](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
