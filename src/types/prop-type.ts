import type { PropDefinition } from './prop-definition.js'

/**
 * The underlying JS primitive a `primitive` {@link PropType} boils down to,
 * distinct from its display `syntax`. A branded or template-literal type
 * (e.g. `` `tsk_${string}` ``, `string & { __brand: 'TaskId' }`) keeps its
 * original syntax for display but still needs to route to the right editor —
 * `base` carries that without losing the display text.
 */
export type PrimitiveBase = 'string' | 'number' | 'boolean' | 'bigint' | 'symbol'

export type PropType =
  | { kind: 'primitive'; syntax: string; base?: PrimitiveBase }
  | { kind: 'object'; syntax: string; properties: PropDefinition[] }
  | { kind: 'function'; syntax: string; parameters: PropDefinition[] }
  | { kind: 'union'; syntax: string; types: PropType[] }
  | { kind: 'constant'; syntax: string; value: any }
  /**
   * A list of `element`s. The element is a full {@link PropDefinition} (named
   * `""`) rather than a bare type, so an element slot can carry docs,
   * interpolatables and catalogs just like a named property.
   */
  | { kind: 'array'; syntax: string; element: PropDefinition }
  /**
   * A fixed-length list, one definition per position (named `[0]`, `[1]`, …).
   * A variadic tuple (`[A, B, ...C[]]`) also has a `rest` definition for
   * any number of further elements after the fixed ones.
   */
  | { kind: 'tuple'; syntax: string; elements: PropDefinition[]; rest?: PropDefinition }
  /**
   * An object whose keys aren't known ahead of time — a string index signature
   * with no named members (`{ [name: string]: T }`, `Record<string, T>`).
   * Every property's value is described by `value` (named `""`).
   */
  | { kind: 'record'; syntax: string; value: PropDefinition }
  /**
   * A type no form can construct a value of — a class instance (a db handle, a
   * socket), an all-method service interface, or a shape so large that
   * expanding it is the wrong trade. It carries only its `syntax`, because
   * there is nothing beneath it an editor could usefully show.
   *
   * Opacity is a property of the type alone. It says "this slot has no
   * editor", not "nothing can fill this slot" — a host is expected to offer
   * some other source (a picker over values it can produce at run time) in
   * place of the missing editor.
   */
  | { kind: 'opaque'; syntax: string }

/** A definition for a slot inside a container type, which has no name of its own. */
export function slotDefinition(type: PropType, name = ''): PropDefinition {
  return { name, type, optional: false }
}
