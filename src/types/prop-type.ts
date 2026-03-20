import type { PropDefinition } from './prop-definition.js'

export type PropType =
  | { kind: 'primitive'; syntax: string }
  | { kind: 'object'; syntax: string; properties: PropDefinition[] }
  | { kind: 'function'; syntax: string; parameters: PropDefinition[] }
  | { kind: 'union'; syntax: string; types: PropType[] }
  | { kind: 'constant'; syntax: string; value: any }
  | { kind: 'array'; syntax: string; elementType: PropType }
  | { kind: 'tuple'; syntax: string; types: PropType[] }
