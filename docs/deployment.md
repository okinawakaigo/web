# 設定・公開手順

以下のコマンドは、クライアントのCloudflareアカウントとドメインの準備ができた段階で実行します。この実装ではリモート環境を作成・変更していません。

## ページの設定

`apps/recruit/.env.example` を同じディレクトリの `.env` にコピーします。これらの `PUBLIC_*` はビルド時に埋め込まれる公開情報です。秘密情報は入れないでください。

- `PUBLIC_SITE_URL=https://okinawakaigo.com`：canonical、OGP、サイトマップの基準URL。
- `PUBLIC_SITE_INDEXABLE=false`：レビュー中はnoindex。公開原稿・写真の確認後にtrueへ変更。
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
| Instagramプロフィール | `https://okinawakaigo.com/?utm_source=instagram&utm_medium=bio` |
| Instagramハイライト | `https://okinawakaigo.com/?utm_source=instagram&utm_medium=highlight` |
| Instagram投稿・DM | `https://okinawakaigo.com/?utm_source=instagram&utm_medium=post` |
| Indeed | `https://okinawakaigo.com/?utm_source=indeed&utm_medium=listing` |
| Jwarm | `https://okinawakaigo.com/?utm_source=jwarm&utm_medium=listing` |
| 既存サイト | `https://okinawakaigo.com/?utm_source=corp&utm_medium=link` |
| 説明会・配布物のQR | `https://okinawakaigo.com/?utm_source=qr&utm_medium=print` |

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

独自ドメインを接続するときは、Cloudflare管理下のゾーンを用意し、`wrangler.jsonc` に追記します。

```jsonc
"routes": [{ "pattern": "okinawakaigo.com", "custom_domain": true }]
```

Cloudflare Workers Buildsを使用する場合、接続先は `okinawakaigo/web`、ルートディレクトリはリポジトリのルート（`/`）、ビルドコマンドは `pnpm build`、デプロイコマンドは `pnpm --filter @okinawa-care/edge exec wrangler deploy`。Node 24とpnpm 9.15.4を使用し、ビルド用の `PUBLIC_*` を設定します。配信対象は `apps/recruit/dist` のみで、`archive/` は含まれません。

## 公開前の実データ確認

- 3職種の現在の募集状況・給与・勤務条件
- 職場環境の制度、説明会・見学の実施方法、フォーム回答の確認・日程調整の担当者
- 人物写真の新ドメイン利用権・肖像同意、正式ロゴ
- プライバシー原稿、フォーム回答の閲覧権限・管理方法
- `.com`の所有権と既存サイトからの案内リンク

既存サイトの移行とリダイレクトは別工程です。過去ページをまとめてトップへ転送する設定は加えていません。
