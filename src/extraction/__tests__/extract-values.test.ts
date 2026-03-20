import { describe, test, expect } from 'vitest'
import ts from 'typescript'
import { extractPropertiesFromObjectLiteral } from '../extract-values.js'
import type { PropDefinition } from '../../types/prop-definition.js'

function extractValues(source: string, definitions: PropDefinition[]) {
  const sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true)

  // Find the object literal expression
  let objLiteral: ts.ObjectLiteralExpression | undefined
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node) && !objLiteral) {
      objLiteral = node
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  if (!objLiteral) throw new Error('No object literal found')
  return extractPropertiesFromObjectLiteral(objLiteral, definitions, sourceFile)
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
        type: { kind: 'array', syntax: 'string[]', elementType: { kind: 'primitive', syntax: 'string' } },
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
      expect(result.values!.model.import.name).toBe('openai')
      expect(result.values!.model.import.from).toBe('ai')
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
