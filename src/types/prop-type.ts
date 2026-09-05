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
  | { kind: 'array'; syntax: string; elementType: PropType }
  | { kind: 'tuple'; syntax: string; types: PropType[] }
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
