export default {
  rules: {
    'color-no-hex': true,
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'oklab', 'lab', 'lch'],
    'declaration-property-value-allowed-list': {
      'font': ['inherit'],
      '/^(font-size|line-height|letter-spacing)$/': ['/^var\\(/', '/^theme\\(/', 'inherit', 'normal'],
      '/^(color|background-color|border-color)$/': ['/^var\\(/', 'inherit', 'transparent', 'currentColor'],
    },
    'declaration-property-unit-disallowed-list': {
      '/^(margin|padding|gap|row-gap|column-gap)(-|$)/': ['px', 'rem', 'em'],
    },
    'declaration-block-no-duplicate-properties': true,
    'color-no-invalid-hex': true,
  },
  overrides: [
    { files: ['**/*.astro'], customSyntax: 'postcss-html' },
    {
      files: ['packages/ui/src/tokens.css'],
      rules: { 'color-no-hex': null, 'function-disallowed-list': null },
    },
  ],
};
