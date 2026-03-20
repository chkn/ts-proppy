import { describe, test, expect } from 'vitest'
import ts from 'typescript'
import { updateProperty, addProperty, removeProperty } from '../apply-value.js'
import { extractPropertiesFromObjectLiteral } from '../../extraction/extract-values.js'
import type { PropDefinition } from '../../types/prop-definition.js'
import type { PropValue } from '../../types/prop-value.js'

function setupSource(source: string, defs: PropDefinition[]) {
  const sourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true)
  let objLiteral: ts.ObjectLiteralExpression | undefined
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node) && !objLiteral) objLiteral = node
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (!objLiteral) throw new Error('No object literal found')
  return extractPropertiesFromObjectLiteral(objLiteral, defs, sourceFile)
}

describe('updateProperty', () => {
  test('replaces a string value', () => {
    const source = `const x = { name: "Alice", age: 30 }`
    const defs: PropDefinition[] = [
      { name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false },
      { name: 'age', type: { kind: 'primitive', syntax: 'number' }, optional: false },
    ]
    const extracted = setupSource(source, defs)
    const nameDef = extracted.definitions.find(d => d.name === 'name')!
    const newValue: PropValue = { kind: 'primitive', value: 'Bob' }

    const result = updateProperty(source, nameDef, newValue)
    expect(result).toContain('"Bob"')
    expect(result).not.toContain('"Alice"')
    expect(result).toContain('age: 30')
  })

  test('replaces with function call and adds import', () => {
    const source = `const x = { model: "gpt-3" }`
    const defs: PropDefinition[] = [
      { name: 'model', type: { kind: 'primitive', syntax: 'any' }, optional: false },
    ]
    const extracted = setupSource(source, defs)
    const modelDef = extracted.definitions.find(d => d.name === 'model')!
    const newValue: PropValue = {
      kind: 'functionCall',
      callee: 'openai',
      args: [{ kind: 'primitive', value: 'gpt-4' }],
      import: { name: 'openai', from: 'ai' },
    }

    const result = updateProperty(source, modelDef, newValue)
    expect(result).toContain('openai("gpt-4")')
    expect(result).toContain("import { openai } from 'ai'")
  })
})

describe('addProperty', () => {
  test('adds a property to an object with existing properties', () => {
    const source = `const x = { name: "Alice" }`
    const defs: PropDefinition[] = [
      { name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false },
    ]
    const extracted = setupSource(source, defs)
    const newValue: PropValue = { kind: 'primitive', value: 30 }

    const result = addProperty(source, extracted, 'age', newValue)
    expect(result).toContain('age: 30')
    expect(result).toContain('name: "Alice"')
  })

  test('adds a property to an empty object', () => {
    const source = `const x = {}`
    const defs: PropDefinition[] = []
    const extracted = setupSource(source, defs)
    const newValue: PropValue = { kind: 'primitive', value: 'hello' }

    const result = addProperty(source, extracted, 'greeting', newValue)
    expect(result).toContain('greeting: "hello"')
  })
})

describe('removeProperty', () => {
  test('removes a property using fullSpan', () => {
    const source = `const x = {\n  name: "Alice",\n  age: 30\n}`
    const defs: PropDefinition[] = [
      { name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false },
      { name: 'age', type: { kind: 'primitive', syntax: 'number' }, optional: false },
    ]
    const extracted = setupSource(source, defs)
    const nameDef = extracted.definitions.find(d => d.name === 'name')!

    const result = removeProperty(source, nameDef)
    expect(result).not.toContain('name')
    expect(result).toContain('age: 30')
  })
})
