import type { PropType } from './prop-type.js'
import type { PropValue } from './prop-value.js'

/**
 * A union rendered as a member picker: a dropdown listing every member, and
 * beneath it the selected member's own editor when that member is open-ended
 * (`string | null`, `'auto' | 'none' | number`, `string | number`, …).
 */
export interface SelectableUnionInfo {
  /** The union's members, in declaration order — one dropdown option each. */
  members: PropType[]
  /** Index of the member to open on: the first that isn't a single constant. */
  defaultIndex: number
}

/**
 * Describes `propType` as a {@link SelectableUnionInfo}, or null if it isn't a
 * union with at least one open-ended member.
 *
 * A union of nothing but constants is already just a dropdown, so it stays with
 * the editor built for that rather than gaining an empty editor slot below.
 */
export function getSelectableUnionInfo(propType: PropType): SelectableUnionInfo | null {
  if (propType.kind !== 'union') return null

  const defaultIndex = propType.types.findIndex(t => t.kind !== 'constant')
  if (defaultIndex === -1) return null

  return { members: propType.types, defaultIndex }
}

/** Whether `member` could have produced `value`, ignoring constants. */
function accepts(member: PropType, value: PropValue): boolean {
  switch (member.kind) {
    case 'object':
      return value.kind === 'object'
    case 'array':
      return value.kind === 'array'
    case 'tuple':
      return value.kind === 'tuple'
    case 'function':
      return value.kind === 'lambda' || value.kind === 'functionCall'
    case 'primitive': {
      // A template interpolates into text, so only a stringy member takes one.
      if (value.kind === 'template') return member.syntax !== 'number' && member.syntax !== 'boolean'
      if (value.kind !== 'primitive') return false
      if (member.syntax === 'number') return typeof value.value === 'number'
      if (member.syntax === 'boolean') return typeof value.value === 'boolean'
      return typeof value.value === 'string'
    }
    default:
      return false
  }
}

/**
 * Index into {@link SelectableUnionInfo.members} of the member that owns
 * `value`, falling back to {@link SelectableUnionInfo.defaultIndex} when
 * nothing fits — including when nothing has been entered yet.
 *
 * An exact constant match wins over a member that merely accepts the value's
 * shape: `'auto'` in `'auto' | string` reads as the constant, not as an
 * arbitrary string that happens to spell it.
 */
export function matchUnionMember(info: SelectableUnionInfo, value: PropValue | undefined): number {
  if (!value) return info.defaultIndex

  if (value.kind === 'primitive') {
    const constant = info.members.findIndex(m => m.kind === 'constant' && m.value === value.value)
    if (constant !== -1) return constant
  }

  const member = info.members.findIndex(m => m.kind !== 'constant' && accepts(m, value))
  return member === -1 ? info.defaultIndex : member
}
