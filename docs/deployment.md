# 設定・公開手順

配信先は `okinawakaigo.com` を管理する `Hidechika@okc2000.com's Account`（Account ID: `869d7f9f9faebf609a8363a4f9d9e38b`）です。`apps/edge/wrangler.jsonc` にアカウントを指定しています。ローカルの認証は `jnlmyz@gmail.com` で確認済みです。

## GitHub Actionsからの自動デプロイ

`.github/workflows/website-ci.yml` で、次の順に実行します。

1. PRでは型チェック・テスト・静的ビルド・Wranglerドライランを実行します。
2. `main` へのpush（PRマージを含む）では同じ検証を実行し、すべて成功した場合だけ `pnpm --filter @okinawa-care/edge deploy` を実行します。
3. `okinawa-care-recruit` Workerと `apps/recruit/dist` の静的ファイルをデプロイします。`archive/`、仕様資料、リポジトリ全体は配信しません。

`main` の実行対象は `apps/**`、`packages/**`、`tests/**`、ルートの依存・Node設定とこのワークフローです。`archive/**` や `docs/**`、READMEだけの変更ではデプロイしません。`main` の処理は同時実行を避け、実行中のデプロイは中断しません。PRの古い検証は新しいpushで中断します。

### 最初に設定するSecret

ローカルの `wrangler login` はCIへ引き継がれません。[Cloudflareの公式手順](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) に従い、上記アカウントに限定したAPIトークンを発行し、GitHubリポジトリ `okinawakaigo/web` の **Settings → Secrets and variables → Actions → Secrets** に登録します。

| 名前 | 値 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 対象アカウントのWorkerをデプロイできるAPIトークン |

トークンには対象アカウントの `Workers Scripts: Edit` を設定します。[Custom Domainの接続API](https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/)もこの権限を使用します。ゾーンは `wrangler.jsonc` の `zone_id` で指定しています。Account IDはWranglerの設定から取得するため、別途Secretに登録する必要はありません。トークンはデプロイステップだけに渡します。未設定の場合はエラーを表示して停止します。

### ビルド時のVariables

同じ設定画面の **Variables** に、必要な `PUBLIC_*` を登録します。これらはブラウザへ配信される値で、秘密情報は入れません。

| 名前 | 未設定時 |
| --- | --- |
| `PUBLIC_ANALYTICS_ENABLED` | `false`（計測を無効） |
| `PUBLIC_RESERVATION_URL` | 空（受付準備中） |
| `PUBLIC_FORM_SOURCE_FIELD`、`PUBLIC_FORM_MEDIUM_FIELD`、`PUBLIC_FORM_ROLE_FIELD`、`PUBLIC_FORM_STEP_FIELD` | 空 |

公開URLは `https://recruit.okinawakaigo.com`、検索登録は `false` にCIで固定しています。`PUBLIC_SITE_URL` と `PUBLIC_SITE_INDEXABLE` のGitHub Variablesは使いません。

その他のVariablesは `pnpm build` 時に取り込まれます。設定を変えただけでは再デプロイされないため、`main` の対象ファイルを更新してpushするか、直近の `main` 用ワークフローを再実行します。フォームのURLやentry IDの詳細は後述の「Googleフォーム」を参照してください。

配信先は `https://recruit.okinawakaigo.com/` です。`workers_dev` と `preview_urls` を `false` に固定し、Accessの対象外となる直接アクセス経路を無効にしています。Workers Buildsを別途接続すると二重にデプロイされるため、このGitHub Actionsを使う場合は接続不要です。

## メール認証による限定公開

閲覧制限はCloudflare AccessのSelf-hosted applicationで行います。設定対象は `recruit.okinawakaigo.com` の全パスです。noindexは検索登録を避ける指定であり、閲覧制限はAccessが担当します。

1. 対象アカウントのCloudflare Zero Trustを有効化します。チーム名・プラン選択などの初期設定が必要な場合はアカウント管理者が設定します。
2. Access controls → ApplicationsからSelf-hosted applicationを追加し、公開ホスト名を `recruit.okinawakaigo.com` に設定します。パスは空にして全ページ・画像・APIを対象にします。
3. 認証方法はメールのOne-time PINを有効にします。
4. AllowポリシーのInclude条件で、承認されたメールアドレスを `Emails` に指定します。メールドメインで許可するときは `Emails ending in` を使います。`Everyone` や認証方法だけを許可条件にしません。
5. Accessアプリと許可ポリシーが保存できたことを確認してから、GitHub Actions Variable `RECRUIT_ACCESS_READY` を `true` にします。この値は初期設定完了の確認用で、Accessポリシーそのものではありません。未設定の場合、CIはデプロイ前に停止します。
6. デプロイ後、未認証のHTTPSアクセスがAccessのログイン画面へ移ることと、承認済みメールで認証できることを確認します。HTTPアクセスも確認し、HTTPSの認証画面へ転送される設定にします。

初回確認時（2026-09-07）はAccessが未有効で、公開先ドメインにWorkerは接続されていません。許可メールの確定・Access初期設定・保存済みポリシーの確認が完了するまでは `RECRUIT_ACCESS_READY` を設定しません。

[Cloudflare Accessの公式手順](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)を参照してください。

## ページの設定

`apps/recruit/.env.example` を同じディレクトリの `.env` にコピーします。これらの `PUBLIC_*` はビルド時に埋め込まれる公開情報です。秘密情報は入れないでください。

- `PUBLIC_SITE_URL=https://recruit.okinawakaigo.com`：canonical、OGP、サイトマップの基準URL。
- `PUBLIC_SITE_INDEXABLE=false`：レビュー中はnoindex。CIでも `false` に固定し、静的配信とAPIに `X-Robots-Tag: noindex, nofollow, noarchive` を付けています。検索登録を許可する際は、CIの固定値、`apps/recruit/public/_headers`、`apps/edge/src/index.ts` をあわせて見直します。
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

`http://127.0.0.1:8787/` で画面、`/api/health` でWorkerを確認できます。最後に、対象アカウントを確認したうえで公開します。

```sh
pnpm --filter @okinawa-care/edge exec wrangler whoami
pnpm deploy
```

独自ドメインは `wrangler.jsonc` の `routes` に設定済みです。Cloudflare Accessによる保護を先に設定してからデプロイします。Custom Domainの接続に伴うDNS・証明書はCloudflare Workersが管理します。既存の同名レコードがある場合は、用途を確認してから切り替えます。

Cloudflare Workers Buildsを使用する場合、接続先は `okinawakaigo/web`、ルートディレクトリはリポジトリのルート（`/`）、ビルドコマンドは `pnpm build`、デプロイコマンドは `pnpm --filter @okinawa-care/edge exec wrangler deploy`。Node 24とpnpm 9.15.4を使用し、ビルド用の `PUBLIC_*` を設定します。配信対象は `apps/recruit/dist` のみで、`archive/` は含まれません。

## 公開前の実データ確認

- 3職種の現在の募集状況・給与・勤務条件
- 職場環境の制度、説明会・見学の実施方法、フォーム回答の確認・日程調整の担当者
- 人物写真の新ドメイン利用権・肖像同意、正式ロゴ
- プライバシー原稿、フォーム回答の閲覧権限・管理方法
- `.com`の所有権と既存サイトからの案内リンク

既存サイトの移行とリダイレクトは別工程です。過去ページをまとめてトップへ転送する設定は加えていません。
