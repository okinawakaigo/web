# PR #2 からの移行記録

移行日: 2026-09-07

## 移行元と保存元

- 実装元: [jnlmyz/junabel PR #2](https://github.com/jnlmyz/junabel/pull/2)
- 取り込み対象: [`nursing/website`](https://github.com/jnlmyz/junabel/tree/843fc0782b2f1a247ef83049458dfff7052cfd09/nursing/website) と採用サイト用CI
- 実装元のPR最終コミット: `843fc0782b2f1a247ef83049458dfff7052cfd09`
- 保存した旧実装: `okinawakaigo/web` の `cac6626`（移行前の `main`）
- 保存先: [`archive/legacy-2026-09-07/`](../archive/legacy-2026-09-07/)

PRの2コミットには採用サイトと共通Web基盤の追加、相談受付のGoogleフォームへの統一が含まれています。このリポジトリでは履歴の異なるリポジトリ全体をマージせず、対象ディレクトリをPR最終コミットから取り込みました。移行元モノレポのトップレベルREADMEや、Web実装と無関係な業務資料は対象外です。

## 配置の変更

| 移行前または移行元 | このリポジトリでの配置 |
| --- | --- |
| 旧 `index.html`・`style.css`・`script.js` | `archive/legacy-2026-09-07/` |
| 旧 `recruit/`・`tour/` | `archive/legacy-2026-09-07/recruit/`・`tour/` |
| 旧 `docs/spec/` | `archive/legacy-2026-09-07/docs/spec/` |
| 旧 `CLAUDE.md`・`.claude/launch.json` | `archive/legacy-2026-09-07/` 内に同じ相対配置で保存 |
| PRの `nursing/website/*`（隠しファイルを含む） | リポジトリのルート |
| PRの `.github/workflows/nursing-website-ci.yml` | `.github/workflows/website-ci.yml`（ルートで検証するよう変更） |

旧ファイルは内容を変更せず移動しました。旧HTML同士やCSS・JavaScriptへの相対リンクを維持しているため、アーカイブをローカル配信して比較できます。pnpmのワークスペースは `apps/*` と `packages/*`、Workersの静的配信先は `apps/recruit/dist` に限定され、アーカイブは含まれません。

## 現在のページと旧構成の違い

旧実装は会社トップと職種別6ページ（うちツアーナースは `tour/`）でした。今回はPRの採用1ページを `/` に配置し、訪問介護員・ケアマネジャー・相談支援専門員の3職種を紹介しています。旧職種別URLの移植・リダイレクトは実装していません。会社トップ、サービス提供責任者、訪問介護の勤務形態別ページ、ツアーナース専用ページの再構築は今後の設計対象です。

PRの画面・共通データ・Worker・テスト・画像・依存バージョンはそのまま取り込みました。このリポジトリに合わせた変更は、起動設定、CIの実行場所、README・開発方針・公開手順と資料参照先です。ローカルのnodenvが旧Node 21を選択していたため、`.node-version` で導入済みのNode 24.7.0を指定しています。元モノレポの議事録はコミットを固定したGitHubリンクで参照し、既存の仕様資料はアーカイブへリンクしています。

## 起動と確認

現行サイトはルートで `pnpm install --frozen-lockfile`、`pnpm dev` を実行します。検証は `pnpm check`、`pnpm test`、`pnpm build` と `pnpm --filter @okinawa-care/api exec wrangler deploy --dry-run`。Workerを含む確認は `pnpm preview` を使います。

旧サイトの確認手順は [archive/README.md](../archive/README.md) を参照してください。復元用の元ファイルは保存先に揃っており、移行前のコミットもGit履歴に残っています。

移行時はフォーム・検索登録・計測が未設定／無効でした。その後、専用フォーム＋D1・管理画面・Resend APIへ方針を更新しました。現在の公開準備は [deployment.md](deployment.md) を参照してください。

## 移行時の検証結果

- 旧追跡ファイル16点が、移行前の `HEAD` とバイト単位で一致
- PRの対象ファイルがすべて存在し、移行に合わせた差分はREADMEと資料3点のみ
- Node 24.7.0・pnpm 9.15.4でロックファイルを変更せずインストール成功
- Astro・Workerの型チェック成功（エラー・警告なし）、テスト27件成功
- 静的ビルド・Wranglerのデプロイドライラン成功
- Workersローカル配信で各ページ・ヘルスチェック・配信ヘッダー・404を確認。旧職種別URLとアーカイブURLは404、計測APIは未設定のため503
- ブラウザでPC・スマホ表示、画像読み込み、メニュー開閉・Escape操作、職種・FAQの開閉を確認。フォームの入力・送信は無効、電話リンクは0件、コンソールエラーなし
- 現行資料のローカルMarkdownリンク31件の参照先が存在

標準ポートの4321・8787が既に使用中だったため、移行時の画面確認は4322、Workers配信の確認は8799で実施しました。既存プロセスやリモート環境は変更していません。
