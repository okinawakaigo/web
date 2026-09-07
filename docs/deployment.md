# 設定・公開手順

配信先は `okinawakaigo.com` を管理する `Hidechika@okc2000.com's Account`（Account ID: `869d7f9f9faebf609a8363a4f9d9e38b`）です。`apps/edge/wrangler.jsonc` にアカウントを指定しています。ローカルの認証は `jnlmyz@gmail.com` で確認済みです。

## GitHub Actionsからの自動デプロイ

`.github/workflows/website-ci.yml` で、次の順に実行します。

1. PRではスタイル検査・型チェック・テスト・静的ビルド・Wranglerドライランを実行します。
2. `main` へのpush（PRマージを含む）では同じ検証を実行し、すべて成功した場合だけ `pnpm --filter @okinawa-care/edge deploy` を実行します。
3. `okinawa-care-recruit` Workerと `apps/recruit/dist` の静的ファイルをデプロイします。`archive/`、仕様資料、リポジトリ全体は配信しません。
4. 公開URLで未認証・誤認証の拒否、正しい認証でのページ・画像・CSS・フォント・APIの応答、noindex・キャッシュ禁止・HTTPSへの転送を検証します。認証情報はログに出しません。

`main` の実行対象は `apps/**`、`packages/**`、`tests/**`、ルートの依存・Node設定、`stylelint.config.mjs` とこのワークフローです。`archive/**` や `docs/**`、READMEだけの変更ではデプロイしません。`main` の処理は同時実行を避け、実行中のデプロイは中断しません。PRの古い検証は新しいpushで中断します。

### 最初に設定するSecret

ローカルの `wrangler login` はCIへ引き継がれません。[Cloudflareの公式手順](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) に従い、上記アカウントに限定したAPIトークンを発行し、GitHubリポジトリ `okinawakaigo/web` の **Settings → Secrets and variables → Actions → Secrets** に登録します。

| 名前 | 値 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 対象アカウントのWorkerをデプロイできるAPIトークン |
| `BASIC_AUTH_USERNAME` | 閲覧用ID。例：`recruit`。半角英数字で始まる1〜64文字（英数字・`.`・`_`・`@`・`-`） |
| `BASIC_AUTH_PASSWORD` | パスワードマネージャー等で生成した16〜256文字のランダムなパスワード。改行・制御文字は不可 |

トークンには対象アカウントの `Workers Scripts: Edit` を設定します。[Custom Domainの接続API](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/)もこの権限を使用します。ゾーンは `wrangler.jsonc` の `zone_id` で指定しています。Account IDはWranglerの設定から取得するため、別途Secretに登録する必要はありません。トークンはデプロイステップだけに渡します。未設定の場合はエラーを表示して停止します。

閲覧用ID・パスワードも **Secrets** に登録し、Variables・ソースコード・`PUBLIC_*`には入れません。CIは形式を検証し、権限を600にした一時JSONファイルから `wrangler deploy --secrets-file` でコードと一緒にWorker Secretsへ登録します。一時ファイルは終了時に削除します。初回も認証情報とコードを同じバージョンで公開するため、Cloudflare管理画面でWorkerを先に作る必要はありません。[Secretsの公式手順](https://developers.cloudflare.com/workers/configuration/secrets/)を参照してください。

### ビルド時のVariables

同じ設定画面の **Variables** に、必要な `PUBLIC_*` を登録します。これらはブラウザへ配信される値で、秘密情報は入れません。

| 名前 | 未設定時 |
| --- | --- |
| `PUBLIC_ANALYTICS_ENABLED` | `false`（計測を無効） |
| `PUBLIC_RESERVATION_URL` | 空（受付準備中） |
| `PUBLIC_FORM_SOURCE_FIELD`、`PUBLIC_FORM_MEDIUM_FIELD`、`PUBLIC_FORM_ROLE_FIELD`、`PUBLIC_FORM_STEP_FIELD` | 空 |

公開URLは `https://recruit.okinawakaigo.com`、検索登録は `false` にCIで固定しています。`PUBLIC_SITE_URL` と `PUBLIC_SITE_INDEXABLE` のGitHub Variablesは使いません。

その他のVariablesは `pnpm build` 時に取り込まれます。設定を変えただけでは再デプロイされないため、`main` の対象ファイルを更新してpushするか、直近の `main` 用ワークフローを再実行します。フォームのURLやentry IDの詳細は後述の「Googleフォーム」を参照してください。

配信先は `https://recruit.okinawakaigo.com/` です。`workers_dev` と `preview_urls` を `false` に固定し、公開URLを独自ドメインに限定しています。Workers Buildsを別途接続すると二重にデプロイされるため、このGitHub Actionsを使う場合は接続不要です。

## Basic認証による限定公開

閲覧制限はWorkerのBasic認証で行います。共有IDとパスワードを知る人が閲覧できる方式で、メールアドレスの本人確認は行いません。Cloudflare Zero Trustの登録は不要です。

1. 上記3件のGitHub Actions Secretsを登録します。
2. PRの検証成功を確認してマージします。`main` のCIがWorker・認証情報・静的ファイルをまとめてデプロイし、独自ドメインを接続します。
3. `https://recruit.okinawakaigo.com/` を開き、ブラウザの認証ダイアログに閲覧用ID・パスワードを入力します。
4. 未認証・誤ったパスワードではトップ・画像・CSS・APIが401、正しい認証ではサイトが表示されることを確認します。HTTPは同じパス・クエリーのHTTPSへ転送します。

`assets.run_worker_first=true` により、全ページ・画像・CSS・フォント・APIで配信前に認証します。認証情報が欠けたり形式が不正だったりする場合は503を返し、ファイルもAPIも配信しません。IDとパスワードを合わせて固定長にハッシュ化し、一定時間で比較するAPIで照合します。認証ヘッダーは静的配信へ引き継ぎません。

認証済みのファイルを含む全レスポンスに `Cache-Control: private, no-store` と `X-Robots-Tag: noindex, nofollow, noarchive` をWorkerから付与します。HTTPSにはHSTSを設定します。noindexは検索登録を避ける指定で、閲覧制限はBasic認証が担当します。[Basic認証の公式実装例](https://developers.cloudflare.com/workers/examples/basic-auth/)を参照してください。

パスワードの変更はGitHubの `BASIC_AUTH_PASSWORD` Secretを更新し、直近の `main` 用ワークフローを再実行します。Cloudflare管理画面で直接変更した値は次回CIでGitHubの値に戻るため、GitHub Secretsを管理元にします。共有を終了するときも同じ手順でパスワードを変更してください。ブラウザは認証情報を記憶するため、未認証の確認には新しいプライベートウィンドウを使用します。

## ローカルでの認証確認

`pnpm dev` は認証なしの画面開発用です。Workerを含めて確認する場合は、次のローカル専用設定を作成します。

```sh
cp apps/edge/.dev.vars.example apps/edge/.dev.vars
pnpm preview
```

`http://127.0.0.1:8787/` を開き、`.dev.vars` のID・パスワードを入力します。`.dev.vars` はGit管理対象外で、サンプルの認証情報を本番で使用しません。ループバックHTTPでも認証は必須です。

## ページの設定

`apps/recruit/.env.example` を同じディレクトリの `.env` にコピーします。これらの `PUBLIC_*` はビルド時に埋め込まれる公開情報です。秘密情報は入れないでください。

- `PUBLIC_SITE_URL=https://recruit.okinawakaigo.com`：canonical、OGP、サイトマップの基準URL。
- `PUBLIC_SITE_INDEXABLE=false`：レビュー中はnoindex。CIでも `false` に固定し、全レスポンスに `X-Robots-Tag: noindex, nofollow, noarchive` を付けています。一般公開の際はCIの固定値、`apps/edge/src/response-headers.ts` のnoindex・キャッシュ設定とBasic認証をあわせて見直します。
- `PUBLIC_ANALYTICS_ENABLED=false`：D1・Rate Limiterを設定するまで無効。

企業サイトを同一ドメインに追加する際はルーティングとcanonicalを再設計します。既存サイトのDNS・メール設定は、このサイトの公開と一括変更しないでください。

## Googleフォーム

クライアント所有のGoogleアカウントでフォームを作成し、次の項目を用意します。

| 項目 | 内容 |
| --- | --- |
| 氏名・連絡先 | 日程調整用。計測DBには送らない |
| 希望職種 | ヘルパー／ケアマネジャー／相談員／その他 |
| 希望する次のステップ | 説明会に参加したい／職場を見学したい／面接について相談したい |
| きっかけ | Instagram／Indeed／ハローワーク／Jwarm／知人・紹介／検索／その他 |
| 流入元 | 短文、事前入力用 |
| 掲載場所 | 短文、事前入力用 |

Googleフォームの「事前入力したURLを取得」でサンプル値を入力し、URL内の `entry.数字` を確認します。URLは短縮URLではなく `https://docs.google.com/forms/d/e/.../viewform` を指定してください。

```dotenv
PUBLIC_RESERVATION_URL=https://docs.google.com/forms/d/e/実際のID/viewform
PUBLIC_FORM_SOURCE_FIELD=entry.実際の数字
PUBLIC_FORM_MEDIUM_FIELD=entry.実際の数字
PUBLIC_FORM_ROLE_FIELD=entry.実際の数字
PUBLIC_FORM_STEP_FIELD=entry.実際の数字
```

4つのentry IDはすべて異なる値が必要です。設定が不完全な場合、ビルドを失敗させて壊れた導線の公開を防ぎます。URLが空のときは「受付準備中」と表示し、入力・送信を無効にします。採用の受付はフォームのみです。公開前にフォームを設定し、希望職種・次のステップを引き継げることを確認してください。

希望職種・次のステップは上表とサイトの表示を一致させてください。Googleフォームの事前入力は回答者が編集でき、秘匿や改ざん防止の機能ではありません。新しい予約は実際のフォーム回答で数えます。回答先のスプレッドシートと通知・日程調整の担当者はクライアント側で設定してください。

JavaScriptが無効の場合はフォームへの通常リンクを表示します。その場合、自動入力はされません。外部フォームへの移動は、サイト上では予約完了として扱いません。

## 計測（任意）

`apps/edge` でD1を作成します。

```sh
pnpm exec wrangler d1 create recruitment-metrics
```

返されたdatabase_idを `wrangler.jsonc` に追記します。`namespace_id` はアカウント内の他のRate Limiterと重複しない整数文字列にしてください。

```jsonc
"d1_databases": [{
  "binding": "METRICS",
  "database_name": "recruitment-metrics",
  "database_id": "作成したD1のID",
  "migrations_dir": "migrations"
}],
"ratelimits": [{
  "name": "METRICS_RATE_LIMITER",
  "namespace_id": "1001",
  "simple": { "limit": 120, "period": 60 }
}]
```

```sh
pnpm exec wrangler d1 migrations apply recruitment-metrics --remote
```

次に `apps/recruit/.env` の `PUBLIC_ANALYTICS_ENABLED=true` を設定して再ビルドします。DBまたはRate Limiterが未設定の場合、APIは503を返し、計測成功にはしません。ローカル検証時は `--remote` を `--local` に置き換えます。

集計の例（管理者がCloudflareのD1コンソール等で実行）：

```sql
SELECT substr(day, 1, 7) AS month, source, medium, event, SUM(count) AS total
FROM daily_events
GROUP BY month, source, medium, event
ORDER BY month, source, medium, event;
```

Googleスプレッドシートへの自動同期・月次レポートは、このWeb実装には含めていません。必要な場合は上記の集計結果とGoogleフォームの実回答を別々の列で集計します。

## 計測用リンク

| 入口 | URL |
| --- | --- |
| Instagramプロフィール | `https://recruit.okinawakaigo.com/?utm_source=instagram&utm_medium=bio` |
| Instagramハイライト | `https://recruit.okinawakaigo.com/?utm_source=instagram&utm_medium=highlight` |
| Instagram投稿・DM | `https://recruit.okinawakaigo.com/?utm_source=instagram&utm_medium=post` |
| Indeed | `https://recruit.okinawakaigo.com/?utm_source=indeed&utm_medium=listing` |
| Jwarm | `https://recruit.okinawakaigo.com/?utm_source=jwarm&utm_medium=listing` |
| 既存サイト | `https://recruit.okinawakaigo.com/?utm_source=corp&utm_medium=link` |
| 説明会・配布物のQR | `https://recruit.okinawakaigo.com/?utm_source=qr&utm_medium=print` |

許可していないパラメータは保存しません。パラメータがないアクセスは `direct/none` とし、検索と直接アクセスを推定で区別しません。

## ビルドと公開

このリポジトリのルートで実行します。

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm --filter @okinawa-care/edge exec wrangler deploy --dry-run
pnpm preview
```

上記のローカル認証設定を作成してから、`http://127.0.0.1:8787/` で画面、`/api/health` でWorkerを確認できます。通常の公開はGitHub Actionsを使います。手動デプロイが必要な場合は、対象アカウントとWorker Secretsが登録済みであることを確認します。

```sh
pnpm --filter @okinawa-care/edge exec wrangler whoami
pnpm deploy
```

独自ドメインは `wrangler.jsonc` の `routes` に設定済みです。Custom Domainの接続に伴うDNS・証明書はCloudflare Workersが管理します。既存の同名レコードがある場合は、用途を確認してから切り替えます。手動デプロイは既存のWorker Secretsを維持しますが、未登録なら503になるため、初回はGitHub Actionsを使用してください。

Cloudflare Workers Buildsを使用する場合、接続先は `okinawakaigo/web`、ルートディレクトリはリポジトリのルート（`/`）、ビルドコマンドは `pnpm build`、デプロイコマンドは `pnpm --filter @okinawa-care/edge exec wrangler deploy`。Node 24とpnpm 9.15.4を使用し、ビルド用の `PUBLIC_*` を設定します。配信対象は `apps/recruit/dist` のみで、`archive/` は含まれません。

## 公開前の実データ確認

- 3職種の現在の募集状況・給与・勤務条件
- 職場環境の制度、説明会・見学の実施方法、フォーム回答の確認・日程調整の担当者
- 人物写真の新ドメイン利用権・肖像同意、正式ロゴ
- プライバシー原稿、フォーム回答の閲覧権限・管理方法
- `.com`の所有権と既存サイトからの案内リンク

既存サイトの移行とリダイレクトは別工程です。過去ページをまとめてトップへ転送する設定は加えていません。
