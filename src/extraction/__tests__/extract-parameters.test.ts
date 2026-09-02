import { describe, test, expect } from 'vitest'
import ts from 'typescript'

import { extractDefinitionsFromParameters } from '../extract-properties.js'

function extractFromFunction(source: string) {
  const sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true)
  let fn: ts.FunctionDeclaration | undefined

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      fn = node
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  if (!fn) throw new Error('No function declaration found')
  return extractDefinitionsFromParameters(fn.parameters, sourceFile)
}

describe('extractDefinitionsFromParameters', () => {
  test('extracts simple identifier parameters', () => {
    const result = extractFromFunction(`function greet(name: string, age: number) {}`)
    expect(result).toEqual([
      { name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false },
      { name: 'age', type: { kind: 'primitive', syntax: 'number' }, optional: false },
    ])
  })

  test('marks parameters with default values as optional and captures defaultValue', () => {
    const result = extractFromFunction(`function greet(name: string, language = 'en') {}`)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false })
    expect(result[1]).toEqual({
      name: 'language',
      type: { kind: 'primitive', syntax: 'string' },
      optional: true,
      defaultValue: { kind: 'primitive', value: 'en' },
    })
  })

  test('flattens object binding pattern into one definition per field', () => {
    const result = extractFromFunction(
      `function greet({ name, age }: { name: string; age: number }) {}`
    )
    expect(result).toEqual([
      { name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false },
      { name: 'age', type: { kind: 'primitive', syntax: 'number' }, optional: false },
    ])
  })

  test('captures defaults inside destructured parameters', () => {
    const result = extractFromFunction(
      `function greet({ name, greeting = 'Hello' }: { name: string; greeting?: string }) {}`
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false })
    expect(result[1]).toEqual({
      name: 'greeting',
      type: { kind: 'primitive', syntax: 'string' },
      optional: true,
      defaultValue: { kind: 'primitive', value: 'Hello' },
    })
  })

  test('preserves object type for non-destructured object parameters', () => {
    const result = extractFromFunction(
      `function userProfile(config: { name: string; age: number }) {}`
    )
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('config')
    expect(result[0].type).toMatchObject({ kind: 'object', syntax: '{ name: string; age: number }' })
  })

  test('falls back to any when no annotation and no initializer', () => {
    const result = extractFromFunction(`function greet(x) {}`)
    expect(result).toEqual([
      { name: 'x', type: { kind: 'primitive', syntax: 'any' }, optional: false },
    ])
  })

  test('unwraps readonly arrays into the array kind', () => {
    const result = extractFromFunction(`function greet(names: readonly string[]) {}`)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('names')
    expect(result[0].type.kind).toBe('array')
    if (result[0].type.kind === 'array') {
      expect(result[0].type.elementType).toEqual({ kind: 'primitive', syntax: 'string' })
    }
  })

  test('unwraps ReadonlyArray<T> into the array kind', () => {
    const result = extractFromFunction(`function greet(names: ReadonlyArray<string>) {}`)
    expect(result).toHaveLength(1)
    expect(result[0].type.kind).toBe('array')
    if (result[0].type.kind === 'array') {
      expect(result[0].type.elementType).toEqual({ kind: 'primitive', syntax: 'string' })
    }
  })

  test('unwraps a readonly array of an inline object type', () => {
    const result = extractFromFunction(
      `function greet(items: readonly { id: number; label: string }[]) {}`
    )
    expect(result[0].type.kind).toBe('array')
    if (result[0].type.kind === 'array') {
      expect(result[0].type.elementType.kind).toBe('object')
      if (result[0].type.elementType.kind === 'object') {
        expect(result[0].type.elementType.properties).toEqual([
          { name: 'id', type: { kind: 'primitive', syntax: 'number' }, optional: false },
          { name: 'label', type: { kind: 'primitive', syntax: 'string' }, optional: false },
        ])
      }
    }
  })

  test('does not recurse forever on a self-referential type', () => {
    const result = extractFromFunction(
      `interface Node { label: string; children: Node[] }
function render(root: Node) {}`
    )
    expect(result[0].type.kind).toBe('object')
    if (result[0].type.kind === 'object') {
      expect(result[0].type.properties.map(p => p.name)).toEqual(['label', 'children'])
    }
  })

  test('unwraps a readonly tuple', () => {
    const result = extractFromFunction(`function greet(pair: readonly [string, number]) {}`)
    expect(result[0].type.kind).toBe('tuple')
    if (result[0].type.kind === 'tuple') {
      expect(result[0].type.types).toEqual([
        { kind: 'primitive', syntax: 'string' },
        { kind: 'primitive', syntax: 'number' },
      ])
    }
  })
})
