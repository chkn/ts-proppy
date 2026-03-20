import type { PropDefinition } from './prop-definition.js'
import type { PropValue } from './prop-value.js'

export interface ExtractedProps {
  /** The property definitions with their types */
  definitions: PropDefinition[]
  /** Current property values parsed from source (populated by extractPropertiesFromObjectLiteral) */
  values?: Record<string, PropValue>
  /** Insertion context for adding new properties (populated by extractPropertiesFromObjectLiteral) */
  insertionPoint?: InsertionPoint
}

export interface InsertionPoint {
  /** Position of the closing brace of the target object literal */
  objectEnd: number
  /** Position of the end of the last property (after trailing comma), or opening brace if empty */
  lastPropertyEnd: number
  /** Indentation string to use for new properties */
  indent: string
}
