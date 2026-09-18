import { describe, test, expect } from 'vitest'
import ts from 'typescript'
import { extractPropertiesFromObjectLiteral } from '../extract-values.js'
import type { PropDefinition } from '../../types/prop-definition.js'

function findObjectLiteral(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression {
  let objLiteral: ts.ObjectLiteralExpression | undefined
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node) && !objLiteral) {
      objLiteral = node
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (!objLiteral) throw new Error('No object literal found')
  return objLiteral
}

function extractValues(source: string, definitions: PropDefinition[] | undefined = undefined) {
  const sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true)
  return extractPropertiesFromObjectLiteral(findObjectLiteral(sourceFile), definitions, sourceFile)
}

const simpleDefs: PropDefinition[] = [
  { name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false },
  { name: 'age', type: { kind: 'primitive', syntax: 'number' }, optional: false },
  { name: 'active', type: { kind: 'primitive', syntax: 'boolean' }, optional: true },
]

describe('extractPropertiesFromObjectLiteral', () => {
  test('extracts primitive values', () => {
    const result = extractValues(
      `const x = { name: "Alice", age: 30, active: true }`,
      simpleDefs
    )

    expect(result.values).toBeDefined()
    expect(result.values!.name).toEqual({ kind: 'primitive', value: 'Alice' })
    expect(result.values!.age).toEqual({ kind: 'primitive', value: 30 })
    expect(result.values!.active).toEqual({ kind: 'primitive', value: true })
  })

  test('adds valueSpan to definitions', () => {
    const source = `const x = { name: "Alice", age: 30 }`
    const result = extractValues(source, simpleDefs)

    const nameDef = result.definitions.find(d => d.name === 'name')!
    expect(nameDef.valueSpan).toBeDefined()
    expect(source.slice(nameDef.valueSpan!.start, nameDef.valueSpan!.end)).toBe('"Alice"')
  })

  test('adds fullSpan to definitions', () => {
    const source = `const x = { name: "Alice", age: 30 }`
    const result = extractValues(source, simpleDefs)

    const nameDef = result.definitions.find(d => d.name === 'name')!
    expect(nameDef.fullSpan).toBeDefined()
  })

  test('provides insertionPoint', () => {
    const source = `const x = { name: "Alice", age: 30 }`
    const result = extractValues(source, simpleDefs)

    expect(result.insertionPoint).toBeDefined()
    expect(result.insertionPoint!.objectEnd).toBeGreaterThan(0)
  })

  test('handles empty object', () => {
    const source = `const x = {}`
    const result = extractValues(source, simpleDefs)

    expect(result.values).toEqual({})
    expect(result.insertionPoint).toBeDefined()
  })

  test('extracts nested object values', () => {
    const source = `const x = { config: { key: "abc", timeout: 5000 } }`
    const defs: PropDefinition[] = [
      {
        name: 'config',
        type: { kind: 'object', syntax: '{ key: string; timeout: number }', properties: [] },
        optional: false,
      },
    ]
    const result = extractValues(source, defs)

    expect(result.values!.config.kind).toBe('object')
    if (result.values!.config.kind === 'object') {
      expect(result.values!.config.properties.key).toEqual({ kind: 'primitive', value: 'abc' })
      expect(result.values!.config.properties.timeout).toEqual({ kind: 'primitive', value: 5000 })
    }
  })

  test('extracts array values', () => {
    const source = `const x = { items: ["a", "b", "c"] }`
    const defs: PropDefinition[] = [
      {
        name: 'items',
        type: { kind: 'array', syntax: 'string[]', element: { name: '', type: { kind: 'primitive', syntax: 'string' }, optional: false } },
        optional: false,
      },
    ]
    const result = extractValues(source, defs)

    expect(result.values!.items.kind).toBe('array')
    if (result.values!.items.kind === 'array') {
      expect(result.values!.items.elements).toHaveLength(3)
      expect(result.values!.items.elements[0]).toEqual({ kind: 'primitive', value: 'a' })
    }
  })

  test('extracts function call values', () => {
    const source = `import { openai } from 'ai'\nconst x = { model: openai("gpt-4") }`
    const defs: PropDefinition[] = [
      { name: 'model', type: { kind: 'primitive', syntax: 'any' }, optional: false },
    ]
    const result = extractValues(source, defs)

    expect(result.values!.model.kind).toBe('functionCall')
    if (result.values!.model.kind === 'functionCall') {
      expect(result.values!.model.callee).toBe('openai')
      expect(result.values!.model.args).toHaveLength(1)
      expect(result.values!.model.binding).toEqual({ kind: 'import', spec: { name: 'openai', from: 'ai' } })
    }
  })

  test('resolves callee binding to a destructured parameter of an enclosing closure', () => {
    const source = `
      import { prompts } from '@evalution/vercel-ai-sdk'
      export default prompts(({ openai }) => ({ model: openai('gpt-4') }))
    `
    const defs: PropDefinition[] = [
      { name: 'model', type: { kind: 'primitive', syntax: 'any' }, optional: false },
    ]
    const result = extractValues(source, defs)
    const model = result.values!.model
    expect(model.kind).toBe('functionCall')
    if (model.kind === 'functionCall') {
      expect(model.binding).toEqual({
        kind: 'parameter',
        enclosingCall: {
          callee: 'prompts',
          import: { name: 'prompts', from: '@evalution/vercel-ai-sdk' },
        },
      })
    }
  })

  test('callee binding is undefined when the identifier resolves to neither parameter nor import', () => {
    const source = `const localFn = (s: string) => s; const x = { model: localFn('hi') }`
    const defs: PropDefinition[] = [
      { name: 'model', type: { kind: 'primitive', syntax: 'any' }, optional: false },
    ]
    const result = extractValues(source, defs)
    const model = result.values!.model
    expect(model.kind).toBe('functionCall')
    if (model.kind === 'functionCall') {
      expect(model.binding).toBeUndefined()
    }
  })

  test('extracts arrow function values', () => {
    const source = `const x = { onClick: (e) => console.log(e) }`
    const defs: PropDefinition[] = [
      { name: 'onClick', type: { kind: 'function', syntax: '(e: any) => void', parameters: [] }, optional: false },
    ]
    const result = extractValues(source, defs)

    expect(result.values!.onClick.kind).toBe('lambda')
    if (result.values!.onClick.kind === 'lambda') {
      expect(result.values!.onClick.parameters).toEqual(['e'])
    }
  })
})

describe('extractPropertiesFromObjectLiteral (schemaless)', () => {
  test('auto-generates definitions with inferred types', () => {
    const source = `const x = { name: "Alice", age: 30, active: true }`
    const result = extractValues(source)

    expect(result.definitions).toHaveLength(3)
    expect(result.definitions[0]).toMatchObject({ name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false })
    expect(result.definitions[1]).toMatchObject({ name: 'age', type: { kind: 'primitive', syntax: 'number' }, optional: false })
    expect(result.definitions[2]).toMatchObject({ name: 'active', type: { kind: 'primitive', syntax: 'boolean' }, optional: false })
  })

  test('extracts values alongside definitions', () => {
    const source = `const x = { name: "Alice", count: 42 }`
    const result = extractValues(source)

    expect(result.values!.name).toEqual({ kind: 'primitive', value: 'Alice' })
    expect(result.values!.count).toEqual({ kind: 'primitive', value: 42 })
  })

  test('populates valueSpan and fullSpan', () => {
    const source = `const x = { name: "Alice", age: 30 }`
    const result = extractValues(source)

    const nameDef = result.definitions.find(d => d.name === 'name')!
    expect(nameDef.valueSpan).toBeDefined()
    expect(source.slice(nameDef.valueSpan!.start, nameDef.valueSpan!.end)).toBe('"Alice"')
    expect(nameDef.fullSpan).toBeDefined()
  })

  test('infers array type from first element', () => {
    const source = `const x = { items: ["a", "b"] }`
    const result = extractValues(source)

    expect(result.definitions[0].type).toMatchObject({ kind: 'array', element: { type: { kind: 'primitive', syntax: 'string' } } })
  })

  test('infers object type from properties', () => {
    const source = `const x = { config: { key: "abc", timeout: 5000 } }`
    const result = extractValues(source)

    const configType = result.definitions[0].type
    expect(configType.kind).toBe('object')
    if (configType.kind === 'object') {
      expect(configType.properties).toHaveLength(2)
      expect(configType.properties[0]).toMatchObject({ name: 'key', type: { kind: 'primitive', syntax: 'string' } })
      expect(configType.properties[1]).toMatchObject({ name: 'timeout', type: { kind: 'primitive', syntax: 'number' } })
    }
  })

  test('falls back to any for call expressions', () => {
    const source = `import { openai } from 'ai'\nconst x = { model: openai("gpt-4") }`
    const result = extractValues(source)

    expect(result.definitions[0].type).toMatchObject({ kind: 'primitive', syntax: 'any' })
    expect(result.values!.model.kind).toBe('functionCall')
  })

  test('provides insertionPoint', () => {
    const source = `const x = { name: "Alice" }`
    const result = extractValues(source)

    expect(result.insertionPoint).toBeDefined()
    expect(result.insertionPoint!.objectEnd).toBeGreaterThan(0)
  })

  test('handles empty object', () => {
    const source = `const x = {}`
    const result = extractValues(source)

    expect(result.definitions).toHaveLength(0)
    expect(result.values).toEqual({})
    expect(result.insertionPoint).toBeDefined()
  })
})

describe('parseValueFromExpression – string concatenation', () => {
  test('collapses all-literal concatenation into a primitive string', () => {
    const result = extractValues(`const x = { label: "Hello" + ", " + "world" }`)
    expect(result.values!.label).toEqual({ kind: 'primitive', value: 'Hello, world' })
  })

  test('collapses two-operand literal concatenation', () => {
    const result = extractValues(`const x = { label: "foo" + "bar" }`)
    expect(result.values!.label).toEqual({ kind: 'primitive', value: 'foobar' })
  })

  test('produces a template when an identifier is mixed in', () => {
    const result = extractValues(`const x = { greeting: "Hello " + name }`)
    expect(result.values!.greeting).toEqual({ kind: 'template', value: ['Hello ', { expr: 'name' }, ''] })
  })

  test('produces a template for identifier + literal', () => {
    const result = extractValues(`const x = { path: base + "/suffix" }`)
    expect(result.values!.path).toEqual({ kind: 'template', value: ['', { expr: 'base' }, '/suffix'] })
  })

  test('includes a number literal as a string segment', () => {
    const result = extractValues(`const x = { label: "count: " + 42 }`)
    expect(result.values!.label).toEqual({ kind: 'primitive', value: 'count: 42' })
  })

  test('falls back to raw for non-string/identifier operands like function calls', () => {
    const result = extractValues(`const x = { label: "prefix-" + fn() }`)
    expect(result.values!.label.kind).toBe('raw')
  })

  test('appends a literal after a template expression', () => {
    const result = extractValues('const x = { msg: `Hello ${name}` + "!" }')
    expect(result.values!.msg).toEqual({ kind: 'template', value: ['Hello ', { expr: 'name' }, '!'] })
  })

  test('prepends a literal before a template expression', () => {
    const result = extractValues('const x = { msg: "prefix: " + `${value} end` }')
    expect(result.values!.msg).toEqual({ kind: 'template', value: ['prefix: ', { expr: 'value' }, ' end'] })
  })

  test('concatenates two template expressions', () => {
    const result = extractValues('const x = { msg: `${a} foo` + ` bar ${b}` }')
    expect(result.values!.msg).toEqual({ kind: 'template', value: ['', { expr: 'a' }, ' foo bar ', { expr: 'b' }, ''] })
  })

  test('concatenates a no-substitution template with a literal string', () => {
    // `hello` parses to primitive, so the result should also be primitive
    const result = extractValues('const x = { msg: `hello` + " world" }')
    expect(result.values!.msg).toEqual({ kind: 'primitive', value: 'hello world' })
  })
})
