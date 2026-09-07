# スタイルの統一ルール

Tailwind CSS 4をAstroのViteプラグインで使用します。採用ページ・補助ページ・共通UIは、`packages/ui/src/tokens.css` の同じテーマを参照します。確認用の `/design/` も実際のテーマと共通部品を表示します。

## 値の定義

| 対象 | ルール・使用例 |
| --- | --- |
| 色 | 意味で選ぶ。`bg-paper`、`text-ink`、`text-muted`、`bg-primary`、`border-line`。新しい色はテーマに追加する |
| 書体 | 本文・操作は `font-body`、大見出しは `font-display`、欧文は `font-latin` |
| 文字サイズ | 短い注記10px `text-micro`、補足12px `text-caption`、ラベル13px `text-label`、本文14px `text-body`・16px `text-base` |
| 小見出し | 18px `text-subtitle`、20px `text-title`、24px `text-subheading`、28px `text-headline` |
| 大見出し | `text-section`、`text-hero` など用途別の可変サイズ。式はテーマに置く |
| 行高 | 操作 `leading-compact`、見出し `leading-heading`、通常文 `leading-body`、長文 `leading-prose` |
| 余白 | 基本4px単位。`gap-3` = 12px、`p-6` = 24px。よく使う値は8・12・16・24・32・48・64px |
| 操作の大きさ | 標準は `min-h-control` / `h-control` = 56px、モバイル固定CTAは `min-h-control-compact` = 48px |
| 角丸 | 小装飾 `rounded-small` = 4px、操作 `rounded-control` = 6px、カード `rounded-card` = 8px、相談パネル `rounded-panel` = 16px |
| ページ幅 | `content-container` は最大1184px・可変左右余白。本文中心のページは `max-w-reading` などで制限 |
| セクション間隔 | `section` または `py-section`。ページごとに別の間隔を定義しない |

注記用の小さい文字は募集説明・フォーム入力・主要な操作には使いません。色や文字サイズを `text-[#…]`、`text-[15px]` のように直接指定せず、テーマの名前を選びます。`gap-3.5` など半端な余白を追加しません。

## コンポーネントとCSSの配置

- 単独の配置調整にはHTMLのTailwindクラスを使います。例：`class="mt-6 w-full"`。
- ボタンは `Button.astro`、ラベル付き選択欄は `SelectField.astro` を使います。リンクと送信ボタンの見た目は同じ定義を参照します。送信ボタンは `as="button" type="submit"` を指定します。
- 共通の見出し・コンテナー・操作部品は `packages/ui/src/components.css` に集約します。
- ページ固有の写真配置や開閉状態は、そのページのCSSで扱います。繰り返す宣言は `@apply` でテーマのユーティリティを使い、`@layer components` に置きます。
- Astroの `<style>` には `@reference "@okinawa-care/ui/styles.css";` を付けます。グローバルCSSを再出力するための `@import` は使いません。
- 共有CSSの読み込みはLayoutから1回。優先順位は `theme → base → components → utilities` です。コンポーネントを調整するクラスはutilitiesで上書きできます。
- TailwindのPreflightは使用せず、`base.css` でリセットと基本表示を管理します。箇条書き・フォーム・フォーカス・`hidden`・動きを減らす設定を確認してください。
- Tailwindが読み取る範囲は `apps/recruit/src` と `packages/ui/src/components` に限定します。クラス名は完全な文字列で記述し、`bg-${color}` のような組み立ては避けます。

```astro
<Button href="#reserve">説明会・見学の相談</Button>
<Button as="button" type="submit" class="mt-6 w-full">送信する</Button>
<SelectField id="role" name="role" label="気になっている仕事">
  <option>相談して決めたい</option>
</SelectField>
```

## レスポンシブと例外

| 名前 | 境界 | 用途 |
| --- | --- | --- |
| `mini` | 360px | 狭い画面のヒーロー |
| `xs` | 400px | ロゴの収まり |
| `sm` | 600px | 固定CTA・フッター |
| `md` | 760px | 主な2列レイアウトの切り替え |
| `nav` | 900px | ナビゲーション |
| `lg` | 1152px | デスクトップの余白調整 |
| `wide` | 1600px | 大画面の写真配置 |

HTMLでは `max-md:grid-cols-1`、通常CSSでは `@variant max-md` を使います。Astroのスコープ付きCSSでは `@media (width < theme(--breakpoint-md))` を使用します。値はテーマから解決されます。メニューのJavaScriptもテーマの `--breakpoint-nav` を読み取ります。画像の `sizes` 属性を変更する場合も、この境界と揃えてください。

写真の切り抜き位置・縦横比・非対称の角丸・グリッドの比率は、写真や内容に依存するため通常CSSを認めます。セーフエリアやフォーカスの線幅も例外です。こうした値を色・文字サイズ・通常の余白の例外として流用しません。

## 確認

`pnpm lint:styles` で、テーマ以外のCSSへの色コード・色関数、文字サイズ・行高の直接指定、px/rem/emでの余白指定を検出します。Astroの `<style>` も対象です。`pnpm check` とGitHub Actionsにも組み込んでいます。

StylelintはHTMLのTailwindクラスの組み合わせまでは判定しません。任意値クラス、テーマにない新しい値、写真配置の例外はレビューで確認します。変更後はデスクトップ・スマートフォン、メニュー・開閉・無効フォーム・キーボードフォーカスを確認します。

参考：[TailwindのAstro導入](https://tailwindcss.com/docs/installation/framework-guides/astro)、[テーマ変数](https://tailwindcss.com/docs/theme)、[Preflightの省略](https://tailwindcss.com/docs/preflight#disabling-preflight)。
