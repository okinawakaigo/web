# 旧実装のアーカイブ

[`legacy-2026-09-07/`](legacy-2026-09-07/) は、Astro構成への移行前の `okinawakaigo/web`（コミット `cac6626`）を保存したものです。ファイルの内容と相対的な配置を保っています。

- `index.html`、`style.css`、`script.js`: 旧会社トップと共通スタイル・操作
- `recruit/`: 旧職種別5ページ
- `tour/`: 旧ツアーナースページ
- `docs/spec/`: 旧調査・仕様資料5点
- `CLAUDE.md`、`.claude/launch.json`: 移行前の開発方針・起動設定

通常のビルド・配信対象には含まれません。比較用に表示する場合は、リポジトリのルートから以下を実行します。

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory archive/legacy-2026-09-07
```

`http://127.0.0.1:8765/` で旧サイトを確認できます。終了は Ctrl+C。旧仕様は履歴であり、現在の実装方針はルートの [CLAUDE.md](../CLAUDE.md) と [移行記録](../docs/migration.md) を参照してください。
