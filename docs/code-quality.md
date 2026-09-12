# React・DB処理・Lintの方針

## Reactの状態とEffect

[React公式「そのエフェクトは不要かも」](https://ja.react.dev/learn/you-might-not-need-an-effect) に沿って、状態の持ち方を判断します。

- 表示件数・未保存判定・処理中判定など、既存の値から計算できるものはレンダー中に求めます。
- 検索や保存、通知再試行はイベントハンドラで処理します。親への編集状態の通知も同じイベントで行い、Effectでstateを同期しません。
- 相談IDが変わったときの編集状態や、URLの検索語が変わったときの入力欄は、`key`でリセットします。
- 一緒に変わる複数の状態は、操作を名前にしたreducerでまとめて更新します。単純なメニューの開閉には`useState`を使います。
- `useRef`はDOM操作と、再レンダー前の二重送信防止・通信の中断に使用します。画面に表示する値をrefに逃がしません。
- Effectは通信・DOM・ブラウザイベントとの同期に使用します。通信には中断処理を付け、古い検索や別の相談の応答を反映しません。読み込み中かどうかは現在の検索条件と応答のキーからも判断し、Effectの先頭でstateを更新しません。

画面は`apps/dashboard/src/components/`、一覧取得・編集・移動制御は`apps/dashboard/src/hooks/`に置きます。移動制御は未保存・送信中の画面を保護するためにブラウザの履歴操作も扱います。

## D1とDrizzle

`apps/api/src/db/schema.ts`で既存D1テーブルとTypeScriptの列名を対応させます。クエリは同じディレクトリの`consultations.ts`・`notifications.ts`・`metrics.ts`に置きます。HTTPハンドラでは入力検証・認証後の処理・レスポンスを扱い、DB処理はこれらの関数を呼び出します。

一覧と詳細で取得する列を明示し、通知用の内部データをAPIへ返しません。検索文字列はパラメータとして渡し、`%`・`_`・`\`は通常の文字として検索します。`sql`タグは検索のESCAPE・カウンタ加算・COALESCEなどの式に限定し、値を文字列連結しません。

既存の`apps/api/migrations/`とWranglerによる適用を維持します。今回の移行はDBアクセス方法の変更であり、テーブルの作り直しやデータ移行は不要です。スキーマを変更するときは既存の制約も維持したマイグレーションを追加し、Drizzleの定義と一緒に更新してください。

## 強制するルール

`eslint.config.mjs`でTypeScriptとReact Hooksの推奨ルールを有効にしています。

| 検査 | 検出する問題 |
| --- | --- |
| `react-hooks/set-state-in-effect` | Effect内での同期的なstate更新 |
| `react-hooks/exhaustive-deps` | フックの依存関係の不足 |
| `react-hooks/rules-of-hooks` | 条件分岐やループ内でのフック呼び出し |
| `react-hooks/refs`などの推奨ルール | レンダー中のref操作、stateの直接変更など |
| DB層の境界 | `src/db/`外のAPIコードでDrizzleをimportすること、`.prepare()`でSQLを直接実行すること |

フックの個数による機械的な禁止は設けません。既存の制御文字拒否用の正規表現だけは、意図をコメントした行単位の例外です。

```sh
pnpm lint:code    # ESLint。警告も失敗扱い
pnpm lint:styles  # Stylelint
pnpm lint         # 両方実行
pnpm check        # Lintと全アプリの型検査
pnpm test         # 振る舞いとLintの検出を確認
```

CIも`pnpm check`と`pnpm test`を実行します。Drizzleのクエリは本番用マイグレーションを適用したSQLiteで検証し、D1の呼び出し形式だけをテスト用に変換します。
