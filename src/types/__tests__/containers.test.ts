import { describe, test, expect } from 'vitest'
import type { PropValue } from '../prop-value.js'
import type { PropType } from '../prop-type.js'
import { canRemoveTupleElement, listElements, recordKeyError, renameRecordKey, uniqueRecordKey } from '../record-entries.js'
import { filterSuggestions, getOpenStringUnionInfo } from '../open-string-union.js'
import { defaultValueForType } from '../default-value.js'

const v = (value: string): PropValue => ({ kind: 'primitive', value })

describe('renameRecordKey', () => {
  test('renames in place, keeping the entry where it was', () => {
    const renamed = renameRecordKey({ a: v('1'), b: v('2'), c: v('3') }, 'b', 'z')
    expect(Object.keys(renamed)).toEqual(['a', 'z', 'c'])
    expect(renamed.z).toEqual(v('2'))
  })

  test('leaves the entries unchanged for a key that does not exist', () => {
    expect(Object.keys(renameRecordKey({ a: v('1') }, 'nope', 'z'))).toEqual(['a'])
  })
})

describe('recordKeyError', () => {
  const props = { a: v('1'), b: v('2') }

  test('rejects an empty key', () => {
    expect(recordKeyError(props, 'a', '')).toMatch(/empty/)
  })

  test("rejects another entry's key", () => {
    expect(recordKeyError(props, 'a', 'b')).toMatch(/exists/)
  })

  test("accepts the entry's own key and a fresh one", () => {
    expect(recordKeyError(props, 'a', 'a')).toBeNull()
    expect(recordKeyError(props, 'a', 'c')).toBeNull()
  })

  test('does not mistake Object.prototype members for keys', () => {
    expect(recordKeyError(props, 'a', 'toString')).toBeNull()
  })
})

describe('uniqueRecordKey', () => {
  test('numbers the base until it is free', () => {
    expect(uniqueRecordKey({}, 'question')).toBe('question')
    expect(uniqueRecordKey({ question: v(''), question2: v('') }, 'question')).toBe('question3')
  })
})

describe('tuples', () => {
  test('never removes a fixed element', () => {
    expect(canRemoveTupleElement(0, 2)).toBe(false)
    expect(canRemoveTupleElement(1, 2)).toBe(false)
    expect(canRemoveTupleElement(2, 2)).toBe(true)
  })

  test('reads elements from a tuple literal parsed as an array', () => {
    const elements = [v('Calm'), v('Angry')]
    expect(listElements({ kind: 'array', elements })).toBe(elements)
    expect(listElements({ kind: 'tuple', elements })).toBe(elements)
    expect(listElements(v('x'))).toEqual([])
  })
})

describe('open string unions', () => {
  const union = (...types: PropType[]): PropType => ({ kind: 'union', syntax: '', types })
  const constant = (value: unknown): PropType => ({ kind: 'constant', syntax: JSON.stringify(value), value })

  test('accepts a template literal or branded string as the open member', () => {
    const branded: PropType = { kind: 'primitive', syntax: 'string & {}', base: 'string' }
    expect(getOpenStringUnionInfo(union(constant('a'), branded))).toEqual({ suggestions: ['a'] })
  })

  test('rejects a union with any member that is not a string', () => {
    const str: PropType = { kind: 'primitive', syntax: 'string' }
    expect(getOpenStringUnionInfo(union(constant('a'), str, constant(null)))).toBeNull()
    expect(getOpenStringUnionInfo(union(constant(1), str))).toBeNull()
  })

  test('rejects a plain string with no suggestions', () => {
    expect(getOpenStringUnionInfo(union({ kind: 'primitive', syntax: 'string' }))).toBeNull()
  })

  test('filters suggestions case-insensitively, prefix matches first', () => {
    const all = ['gpt-4o', 'o3', 'gpt-4o-mini', 'chatgpt-4o-latest']
    expect(filterSuggestions(all, 'GPT-4O')).toEqual(['gpt-4o', 'gpt-4o-mini', 'chatgpt-4o-latest'])
    expect(filterSuggestions(all, '')).toEqual(all)
    expect(filterSuggestions(all, 'my-fine-tune')).toEqual([])
    expect(filterSuggestions(all, '', 2)).toEqual(['gpt-4o', 'o3'])
  })
})

describe('defaultValueForType', () => {
  test('starts a union with a string member as empty text', () => {
    const type: PropType = {
      kind: 'union',
      syntax: '{ a: string } | string | null',
      types: [
        { kind: 'object', syntax: '{ a: string }', properties: [] },
        { kind: 'primitive', syntax: 'string' },
        { kind: 'constant', syntax: 'null', value: null },
      ],
    }
    expect(defaultValueForType(type)).toEqual({ kind: 'primitive', value: '' })
  })

  test('starts a nullable union with no text member as null rather than its first member', () => {
    const type: PropType = {
      kind: 'union',
      syntax: 'number[] | null',
      types: [
        { kind: 'array', syntax: 'number[]', element: { name: '', optional: false, type: { kind: 'primitive', syntax: 'number' } } },
        { kind: 'constant', syntax: 'null', value: null },
      ],
    }
    expect(defaultValueForType(type)).toEqual({ kind: 'primitive', value: null })
  })

  test('fills a tuple to its fixed length', () => {
    const str = { name: '', optional: false, type: { kind: 'primitive', syntax: 'string' } as PropType }
    const type: PropType = { kind: 'tuple', syntax: '[string, string, ...string[]]', elements: [str, str], rest: str }
    expect(defaultValueForType(type)).toEqual({ kind: 'array', elements: [v(''), v('')] })
  })
})
