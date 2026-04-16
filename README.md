# ts-proppy

Extract, edit, and materialize TypeScript prop definitions and values.

## React UI theming

`ts-proppy/react` editors render with inline styles so they work without a
stylesheet import. Two escape hatches let consumers restyle them:

### CSS custom properties

Set any of the following on an ancestor element to recolor the default editors.
Each variable has a light-mode fallback baked in, so light-themed apps need
nothing. Dark-themed apps typically only need to override these inside a
`@media (prefers-color-scheme: dark)` block.

| Variable | Applies to | Default |
| --- | --- | --- |
| `--proppy-border` | Borders on containers, inputs, buttons | `#ddd` |
| `--proppy-container-bg` | Nested editor background (Object, Array, Tuple, DiscriminatedUnion) | `#fafafa` |
| `--proppy-input-bg` | `<input>`, `<select>`, `<textarea>`, and template contentEditable background | `#fff` |
| `--proppy-input-color` | Text color for the same | `inherit` |
| `--proppy-button-bg` | Button backgrounds (JSON/Rich toggle, Add Item, function signature) | `#f5f5f5` / `#f0f0f0` |
| `--proppy-button-color` | Button text color | `inherit` |
| `--proppy-text-primary` | Field labels | `inherit` |
| `--proppy-text-secondary` | Descriptions, array/tuple captions, function signatures | `#666` |
| `--proppy-text-muted` | Type syntax hints, default-value hints, "No props defined" | `#999` |
| `--proppy-danger-bg` | Destructive button background (array remove) | `#fee` |
| `--proppy-danger-border` | Destructive button border | `#fcc` |
| `--proppy-danger-color` | Destructive button text | `inherit` |

### `className` prop (wholesale override)

Primitive editors (`StringEditor`, `NumberEditor`, `BooleanEditor`,
`ConstantUnionEditor`, `JsonFallbackEditor`, `TemplateEditor`) accept a
`className` on `ItemEditor`. When provided, the default inline `style` is
dropped entirely and the caller's class controls all appearance.
