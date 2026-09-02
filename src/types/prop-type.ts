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
