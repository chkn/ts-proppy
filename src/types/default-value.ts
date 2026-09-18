import type { PropType } from './prop-type.js'
import type { PropValue } from './prop-value.js'

/**
 * A reasonable starting value for a new slot of `type` — what an editor puts
 * in place when the user adds an element, an entry or a property.
 *
 * Prefers the emptiest value that still has the type's shape: `""`, `0`,
 * `false`, an empty list or object, the first constant of a union.
 */
export function defaultValueForType(type: PropType): PropValue {
  switch (type.kind) {
    case 'primitive': {
      const base = type.base ?? type.syntax
      if (base === 'number') return { kind: 'primitive', value: 0 }
      if (base === 'boolean') return { kind: 'primitive', value: false }
      if (base === 'string') return { kind: 'primitive', value: '' }
      return { kind: 'primitive', value: null }
    }
    case 'constant':
      return { kind: 'primitive', value: type.value }
    case 'array':
      return { kind: 'array', elements: [] }
    case 'tuple':
      return { kind: 'array', elements: type.elements.map(e => defaultValueForType(e.type)) }
    case 'object':
      return {
        kind: 'object',
        properties: Object.fromEntries(
          type.properties.filter(p => !p.optional).map(p => [p.name, p.defaultValue ?? defaultValueForType(p.type)])
        ),
      }
    case 'record':
      return { kind: 'object', properties: {} }
    case 'union': {
      // Text is the most inviting place to start; failing that, a nullable
      // union starts empty rather than as some arbitrary member.
      const text = type.types.find(t => t.kind === 'primitive' && (t.base ?? t.syntax) === 'string')
      if (text) return defaultValueForType(text)
      const empty = type.types.find(t => t.kind === 'constant' && (t.value === null || t.value === undefined))
      if (empty) return defaultValueForType(empty)
      return type.types.length > 0 ? defaultValueForType(type.types[0]) : { kind: 'primitive', value: null }
    }
    case 'function':
    case 'opaque':
      return { kind: 'primitive', value: undefined }
  }
}
