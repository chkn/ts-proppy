# ts-proppy

Extract, edit, and materialize TypeScript prop definitions and values.

`ts-proppy` reads the props of a TypeScript type, interface, or function
declaration out of source code, parses any existing literal values for those
props, lets you edit those values (and write them back to source as valid
TypeScript), and — at runtime — materializes them into real JavaScript values
that you can hand to a component or function.

It is the engine behind tools like in-editor prop inspectors, design-time
component sandboxes, codemod-style UIs, and "props as data" workflows where
the source file itself is the source of truth.

An optional React entry point (`ts-proppy/react`) ships a styleable
`PropsEditor` component built on the same primitives.

## Install

```sh
npm install ts-proppy
```

`typescript` is a peer dependency. `react` is an optional peer dependency,
only required if you import from `ts-proppy/react`.

## Concepts

ts-proppy is organized around three stages:

1. **Extraction** — parse a TypeScript source file and pull out a list of
   [`PropDefinition`][def]s describing each prop's name, type, optionality,
   description (from JSDoc), and (optionally) default value.
2. **Editing** — given an object literal in source, parse its current values
   into [`PropValue`][val]s, then `addProperty` / `updateProperty` /
   `removeProperty` to produce a new, valid source string. Imports are added
   automatically when a value references one.
3. **Materialization** — turn a `PropValue` into a real runtime value
   (primitives, objects, arrays, functions, dynamic imports for referenced
   modules, scope-bound template strings and lambdas).

[def]: ./src/types/prop-definition.ts
[val]: ./src/types/prop-value.ts

The two halves (extraction/editing vs. materialization) can be used
independently. Extraction depends on the `typescript` compiler API;
materialization is a tiny dependency-free module that runs in any JS
environment.

## Example 1 — extract props from a type

```ts
import ts from 'typescript'
import { extractPropertiesFromDeclaration, findTypeDeclaration } from 'ts-proppy'

const source = `
interface ButtonProps {
  /** The visible label */
  label: string
  variant?: 'primary' | 'secondary'
  onClick: () => void
}
`

const sourceFile = ts.createSourceFile('button.tsx', source, ts.ScriptTarget.ESNext, true)
const decl = findTypeDeclaration(sourceFile, 'ButtonProps')!
const { definitions } = extractPropertiesFromDeclaration(decl, sourceFile)

// definitions[0] === {
//   name: 'label',
//   type: { kind: 'primitive', syntax: 'string' },
//   optional: false,
//   description: 'The visible label',
// }
```

`extractPropertiesFromTypeNode` and `extractPropertiesFromParameters` cover
inline type literals and function-parameter destructuring respectively.

## Example 2 — read and update values in an object literal

```ts
import ts from 'typescript'
import {
  extractPropertiesFromDeclaration,
  extractPropertiesFromObjectLiteral,
  findTypeDeclaration,
  updateProperty,
} from 'ts-proppy'

const source = `
interface Config { retries: number; label: string }
const config: Config = {
  retries: 3,
  label: "hello",
}
`

const sf = ts.createSourceFile('cfg.ts', source, ts.ScriptTarget.ESNext, true)

// 1. Get the type's prop schema
const decl = findTypeDeclaration(sf, 'Config')!
const schema = extractPropertiesFromDeclaration(decl, sf).definitions

// 2. Find the object literal we want to edit, enrich definitions with source spans
const objectLiteral = /* locate `{ retries: 3, label: "hello" }` via ts AST walk */
const extracted = extractPropertiesFromObjectLiteral(objectLiteral, schema, sf)

// extracted.values.retries === { kind: 'primitive', value: 3 }
// extracted.definitions[0].valueSpan === { start, end }  // points at `3`

// 3. Produce updated source text
const next = updateProperty(source, extracted.definitions[0], {
  kind: 'primitive',
  value: 5,
})
// next now contains `retries: 5,`
```

`addProperty` and `removeProperty` work the same way and also keep imports in
sync — adding a `PropValue` like
`{ kind: 'functionCall', callee: 'cn', args: [...], import: { name: 'cn', from: 'clsx' } }`
inserts `import { cn } from 'clsx'` at the top of the file if not already
present.

Pass `undefined` as the `definitions` argument to `extractPropertiesFromObjectLiteral`
for **schemaless** mode — types are inferred from the literal itself.

## Example 3 — materialize values at runtime

```ts
import { materializeValue } from 'ts-proppy'

const value = {
  kind: 'object' as const,
  properties: {
    greeting: { kind: 'template' as const, value: 'Hello, ${name}!' },
    onClick:  { kind: 'lambda' as const, parameters: ['e'], body: 'console.log(name, e)' },
  },
}

const runtime = await materializeValue(value, { name: 'world' })
runtime.greeting       // "Hello, world!"
runtime.onClick(event) // logs "world" and the event
```

`functionCall` values with an `import` specifier are resolved via dynamic
`import()` at materialization time.

## React editor

```tsx
import { useState } from 'react'
import { PropsEditor } from 'ts-proppy/react'
import type { ExtractedProps, PropValue } from 'ts-proppy'

function Inspector({ initial }: { initial: ExtractedProps }) {
  const [props, setProps] = useState(initial)

  return (
    <PropsEditor
      props={props}
      onChange={(name, value) =>
        setProps(p => ({ ...p, values: { ...p.values, [name]: value } }))
      }
    />
  )
}
```

`PropsEditor` renders an appropriate sub-editor per prop type: string, number,
boolean, constant-union dropdown, array, tuple, object, discriminated union,
function, and a JSON fallback. Bring your own editors via the `plugins` prop:

```tsx
<PropsEditor
  props={props}
  onChange={onChange}
  plugins={[{
    match: (t) => t.kind === 'primitive' && t.syntax === 'Date',
    component: MyDateEditor,
  }]}
/>
```

## React UI theming

The editors render with inline styles so they work without a stylesheet
import. Two escape hatches let consumers restyle them:

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

## API surface

Top-level (`ts-proppy`):

- **Types**: `PropType`, `PropDefinition`, `PropValue`, `ExtractedProps`,
  `InsertionPoint`, `ImportSpecifier`, `InterpolatableIdentifier`,
  `DiscriminatedUnionInfo`, `DiscriminatedUnionCase`, `SourceSpan`
- **Extraction**: `extractPropertiesFromDeclaration`,
  `extractPropertiesFromTypeNode`, `extractPropertiesFromParameters`,
  `extractPropertiesFromObjectLiteral`, `buildPropType`,
  `findTypeDeclaration`, `parseValueFromExpression`,
  `inferPropTypeFromExpression`
- **Editing**: `addProperty`, `updateProperty`, `removeProperty`,
  `ensureImport`, `valueToSourceText`, `valueToDisplayString`,
  `collectImports`
- **Materialization**: `materializeValue`
- **Helpers**: `getDiscriminatedUnionInfo`

React subpath (`ts-proppy/react`):

- `PropsEditor`, `ItemEditor`, `RichEditor`, `TemplateEditor`
- Types: `PropsEditorProps`, `ItemEditorProps`, `EditorPlugin`,
  `TemplateEditorProps`
- Re-exports of `valueToSourceText`, `valueToDisplayString`,
  `collectImports`, `materializeValue` so React consumers don't transitively
  pull in the TypeScript compiler.

## Development

```sh
npm install
npm test          # vitest
npm run build     # emits dist/
```

## License

MIT — see [LICENSE](./LICENSE).
