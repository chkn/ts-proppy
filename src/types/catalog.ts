import type { PropDefinition, ValueCatalog, ValueCatalogPreset, ValueFactory } from './prop-definition.js'
import type { PropType } from './prop-type.js'
import type { PropValue } from './prop-value.js'
import { defaultValueForType } from './default-value.js'

type FunctionCallValue = Extract<PropValue, { kind: 'functionCall' }>

function hasOwn(properties: Record<string, PropValue>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(properties, name)
}

/**
 * Whether two values would write the same source. Display values and callee
 * bindings are ignored: a preset carrying binding candidates is the same model
 * as the call already in the file.
 */
export function valuesEqual(a: PropValue | undefined, b: PropValue | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  switch (b.kind) {
    case 'primitive':
      return a.kind === 'primitive' && a.value === b.value
    case 'template':
      return (
        a.kind === 'template' &&
        a.value.length === b.value.length &&
        a.value.every((seg, i) => {
          const other = b.value[i]
          return typeof seg === 'string' || typeof other === 'string' ? seg === other : seg.expr === other.expr
        })
      )
    case 'functionCall':
      return (
        a.kind === 'functionCall' &&
        a.callee === b.callee &&
        a.args.length === b.args.length &&
        a.args.every((arg, i) => valuesEqual(arg, b.args[i]))
      )
    case 'lambda':
      return a.kind === 'lambda' && a.parameters.join(',') === b.parameters.join(',') && a.body === b.body
    case 'object': {
      if (a.kind !== 'object') return false
      const aKeys = Object.keys(a.properties)
      const bKeys = Object.keys(b.properties)
      return aKeys.length === bKeys.length && aKeys.every(k => hasOwn(b.properties, k) && valuesEqual(a.properties[k], b.properties[k]))
    }
    case 'array':
    case 'tuple':
      return (
        (a.kind === 'array' || a.kind === 'tuple') &&
        a.elements.length === b.elements.length &&
        a.elements.every((el, i) => valuesEqual(el, b.elements[i]))
      )
    case 'reference':
      return a.kind === 'reference' && a.path.join('\0') === b.path.join('\0')
    case 'raw':
      return a.kind === 'raw' && a.sourceText === b.sourceText
  }
}

/** Where a value was found in a slot's catalogs. */
export interface CatalogMatch {
  catalogIndex: number
  groupIndex: number
}

/** The preset `value` is, if any, and where it lives. Presets are compared by {@link valuesEqual}. */
export function findPreset(
  catalogs: readonly ValueCatalog[],
  value: PropValue | undefined
): (CatalogMatch & { preset: ValueCatalogPreset }) | undefined {
  if (!value) return undefined
  for (const [catalogIndex, catalog] of catalogs.entries()) {
    for (const [groupIndex, group] of catalog.groups.entries()) {
      const preset = group.presets?.find(p => valuesEqual(value, p.value))
      if (preset) return { catalogIndex, groupIndex, preset }
    }
  }
  return undefined
}

/** The factory `value` is a call to, if any, and where it lives. Matched by callee name. */
export function findFactory(
  catalogs: readonly ValueCatalog[],
  value: PropValue | undefined
): (CatalogMatch & { factory: ValueFactory }) | undefined {
  if (value?.kind !== 'functionCall') return undefined
  for (const [catalogIndex, catalog] of catalogs.entries()) {
    for (const [groupIndex, group] of catalog.groups.entries()) {
      if (group.factory?.def.name === value.callee) return { catalogIndex, groupIndex, factory: group.factory }
    }
  }
  return undefined
}

/**
 * The definition a catalog's free-form entry edits against: the slot's own
 * (minus its catalogs) for `literal: true`, the narrowed definition when one is
 * given, or `undefined` for a catalog with no free-form entry.
 */
export function literalDefinition(catalog: ValueCatalog, slot: PropDefinition): PropDefinition | undefined {
  if (!catalog.literal) return undefined
  if (catalog.literal === true) return { ...slot, catalogs: undefined }
  return { ...catalog.literal, name: catalog.literal.name || slot.name, interpolatables: slot.interpolatables }
}

/**
 * Whether `value` has the shape `type` describes, loosely: enough to tell which
 * member of a union a value belongs to, not to validate it.
 */
export function valueFitsType(type: PropType, value: PropValue): boolean {
  // A reference's shape is whatever it refers to, which isn't known here.
  if (value.kind === 'reference') return true
  switch (type.kind) {
    case 'constant':
      return value.kind === 'primitive' && value.value === type.value
    case 'primitive': {
      const base = type.base ?? type.syntax
      if (value.kind === 'template') return base === 'string'
      if (value.kind !== 'primitive') return base !== 'string' && base !== 'number' && base !== 'boolean'
      if (base === 'string' || base === 'number' || base === 'boolean') return typeof value.value === base
      return true
    }
    case 'union':
      return type.types.some(t => valueFitsType(t, value))
    case 'object': {
      if (value.kind !== 'object') return false
      const names = new Set(type.properties.map(p => p.name))
      const keys = Object.keys(value.properties)
      return (
        keys.every(k => names.has(k)) &&
        type.properties.every(p =>
          hasOwn(value.properties, p.name) ? valueFitsType(p.type, value.properties[p.name]) : p.optional
        )
      )
    }
    case 'record':
      return value.kind === 'object'
    case 'array':
    case 'tuple':
      return value.kind === 'array' || value.kind === 'tuple'
    case 'function':
      return value.kind === 'lambda' || value.kind === 'functionCall'
    case 'opaque':
      return value.kind === 'raw' || value.kind === 'functionCall'
  }
}

/**
 * Which of a slot's catalogs `value` belongs to: the one holding it as a
 * preset, then the one whose factory it calls, then the first whose free-form
 * entry it fits. Falls back to the first catalog.
 */
export function activeCatalogIndex(catalogs: readonly ValueCatalog[], slot: PropDefinition, value: PropValue | undefined): number {
  const preset = findPreset(catalogs, value)
  if (preset) return preset.catalogIndex
  const factory = findFactory(catalogs, value)
  if (factory) return factory.catalogIndex
  if (value) {
    const literal = catalogs.findIndex(c => {
      const def = literalDefinition(c, slot)
      return def && valueFitsType(def.type, value)
    })
    if (literal >= 0) return literal
  }
  return 0
}

function parametersOf(factory: ValueFactory): PropDefinition[] {
  return factory.def.type.kind === 'function' ? factory.def.type.parameters : []
}

/**
 * A fresh call to `factory`, with a default value for each parameter up to and
 * including the last required one. Its binding is the factory's, still
 * unresolved.
 */
export function defaultCall(factory: ValueFactory): FunctionCallValue {
  const params = parametersOf(factory)
  let count = 0
  params.forEach((p, i) => {
    if (!p.optional) count = i + 1
  })
  // A function whose parameters are all optional still gets its first, so the
  // new call has something to fill in.
  if (count === 0 && params.length > 0) count = 1
  return {
    kind: 'functionCall',
    callee: factory.def.name,
    args: params.slice(0, count).map(p => p.defaultValue ?? defaultValueForType(p.type)),
    binding: factory.binding,
  }
}

const UNDEFINED: PropValue = { kind: 'primitive', value: undefined }

/**
 * `call` with its argument at `index` set to `value`. Skipped positions are
 * filled with defaults (or `undefined` for an optional parameter), and trailing
 * `undefined`s for optional parameters are dropped so the call stays as short
 * as its source would be written.
 */
export function setCallArgument(
  call: FunctionCallValue,
  parameters: readonly PropDefinition[],
  index: number,
  value: PropValue
): FunctionCallValue {
  const args = [...call.args]
  for (let i = args.length; i < index; i++) {
    const p = parameters[i]
    args[i] = !p || p.optional ? UNDEFINED : (p.defaultValue ?? defaultValueForType(p.type))
  }
  args[index] = value
  while (args.length > 0) {
    const last = args.length - 1
    const p = parameters[last]
    const a = args[last]
    if (p?.optional && a.kind === 'primitive' && a.value === undefined) args.pop()
    else break
  }
  return { ...call, args }
}
