import { describe, test, expect } from 'vitest'
import { ensureImport } from '../ensure-import.js'

describe('ensureImport', () => {
  test('adds new import when no imports exist', () => {
    const source = `const x = 1`
    const result = ensureImport(source, { name: 'foo', from: 'bar' })
    expect(result).toBe(`import { foo } from 'bar'\nconst x = 1`)
  })

  test('adds new import after existing imports', () => {
    const source = `import { x } from 'x'\nconst y = 1`
    const result = ensureImport(source, { name: 'foo', from: 'bar' })
    expect(result).toContain(`import { foo } from 'bar'`)
    expect(result.indexOf("from 'bar'")).toBeGreaterThan(result.indexOf("from 'x'"))
  })

  test('does not duplicate existing named import', () => {
    const source = `import { foo } from 'bar'\nconst x = 1`
    const result = ensureImport(source, { name: 'foo', from: 'bar' })
    expect(result).toBe(source)
  })

  test('adds to existing import from same module', () => {
    const source = `import { foo } from 'bar'\nconst x = 1`
    const result = ensureImport(source, { name: 'baz', from: 'bar' })
    expect(result).toContain('foo, baz')
  })

  test('handles default import', () => {
    const source = `const x = 1`
    const result = ensureImport(source, { name: 'React', from: 'react', isDefault: true })
    expect(result).toBe(`import React from 'react'\nconst x = 1`)
  })

  test('does not duplicate existing default import', () => {
    const source = `import React from 'react'\nconst x = 1`
    const result = ensureImport(source, { name: 'React', from: 'react', isDefault: true })
    expect(result).toBe(source)
  })

  test('skips import when from is empty', () => {
    const source = `const x = 1`
    const result = ensureImport(source, { name: 'foo', from: '' })
    expect(result).toBe(source)
  })
})
