import { describe, test, expect } from 'vitest'
import type { PropType } from '../prop-type.js'
import { getSelectableUnionInfo, matchUnionMember } from '../selectable-union.js'

const str: PropType = { kind: 'primitive', syntax: 'string' }
const num: PropType = { kind: 'primitive', syntax: 'number' }
const bool: PropType = { kind: 'primitive', syntax: 'boolean' }
const nul: PropType = { kind: 'constant', syntax: 'null', value: null }
const undef: PropType = { kind: 'constant', syntax: 'undefined', value: undefined }
const auto: PropType = { kind: 'constant', syntax: "'auto'", value: 'auto' }
const none: PropType = { kind: 'constant', syntax: "'none'", value: 'none' }
const obj: PropType = {
  kind: 'object',
  syntax: '{ id: string }',
  properties: [{ name: 'id', type: str, optional: false }],
}
const arr: PropType = { kind: 'array', syntax: 'string[]', element: { name: '', type: str, optional: false } }

function union(...types: PropType[]): PropType {
  return { kind: 'union', syntax: types.map(t => t.syntax).join(' | '), types }
}

describe('getSelectableUnionInfo', () => {
  test('lists every member of a nullable primitive', () => {
    expect(getSelectableUnionInfo(union(str, nul))).toEqual({
      members: [str, nul],
      defaultIndex: 0,
    })
  })

  test('lists constants and open-ended members alike', () => {
    expect(getSelectableUnionInfo(union(auto, none, num))).toEqual({
      members: [auto, none, num],
      defaultIndex: 2,
    })
  })

  test('handles several open-ended members', () => {
    expect(getSelectableUnionInfo(union(str, num, obj))).toEqual({
      members: [str, num, obj],
      defaultIndex: 0,
    })
  })

  test('opens on the first member that is not a constant', () => {
    expect(getSelectableUnionInfo(union(nul, num, str))?.defaultIndex).toBe(1)
  })

  test('rejects an all-constant union — ConstantUnionEditor already covers it', () => {
    expect(getSelectableUnionInfo(union(auto, none))).toBeNull()
    expect(getSelectableUnionInfo(union(str, nul))).not.toBeNull()
  })

  test('rejects a non-union type', () => {
    expect(getSelectableUnionInfo(str)).toBeNull()
  })
})

describe('matchUnionMember', () => {
  test('finds the constant a value holds', () => {
    const info = getSelectableUnionInfo(union(auto, none, str))!
    expect(matchUnionMember(info, { kind: 'primitive', value: 'auto' })).toBe(0)
    expect(matchUnionMember(info, { kind: 'primitive', value: 'none' })).toBe(1)
  })

  test('prefers an exact constant over a member that merely accepts the shape', () => {
    const info = getSelectableUnionInfo(union(str, auto))!
    expect(matchUnionMember(info, { kind: 'primitive', value: 'auto' })).toBe(1)
    expect(matchUnionMember(info, { kind: 'primitive', value: 'other' })).toBe(0)
  })

  test('picks the open-ended member whose type fits the value', () => {
    const info = getSelectableUnionInfo(union(str, num, bool))!
    expect(matchUnionMember(info, { kind: 'primitive', value: 'hi' })).toBe(0)
    expect(matchUnionMember(info, { kind: 'primitive', value: 42 })).toBe(1)
    expect(matchUnionMember(info, { kind: 'primitive', value: true })).toBe(2)
  })

  test('routes structured values to the member that can hold them', () => {
    const info = getSelectableUnionInfo(union(str, obj, arr))!
    expect(matchUnionMember(info, { kind: 'object', properties: {} })).toBe(1)
    expect(matchUnionMember(info, { kind: 'array', elements: [] })).toBe(2)
  })

  test('sends a template to a stringy member, never to a number', () => {
    const info = getSelectableUnionInfo(union(num, str))!
    expect(matchUnionMember(info, { kind: 'template', value: ['hi ', { expr: 'name' }] })).toBe(1)
  })

  test('falls back to the default member when nothing has been entered', () => {
    const info = getSelectableUnionInfo(union(nul, str))!
    expect(matchUnionMember(info, undefined)).toBe(1)
  })

  test('falls back to the default member when no member fits', () => {
    const info = getSelectableUnionInfo(union(auto, num))!
    expect(matchUnionMember(info, { kind: 'primitive', value: 'unlisted' })).toBe(1)
  })

  test('distinguishes null from undefined and from an empty string', () => {
    const info = getSelectableUnionInfo(union(str, nul, undef))!
    expect(matchUnionMember(info, { kind: 'primitive', value: null })).toBe(1)
    expect(matchUnionMember(info, { kind: 'primitive', value: undefined })).toBe(2)
    expect(matchUnionMember(info, { kind: 'primitive', value: '' })).toBe(0)
  })

  test('does not confuse a falsy constant with an absent one', () => {
    const zero: PropType = { kind: 'constant', syntax: '0', value: 0 }
    const info = getSelectableUnionInfo(union(zero, str))!
    expect(matchUnionMember(info, { kind: 'primitive', value: 0 })).toBe(0)
    expect(matchUnionMember(info, { kind: 'primitive', value: false })).toBe(1)
  })
})
