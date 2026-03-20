import type { PropType } from './prop-type.js'
import type { PropValue } from './prop-value.js'
import type { SourceSpan } from './source-location.js'

export interface PropDefinition {
  name: string
  type: PropType
  optional: boolean
  description?: string
  /** Default value for this property */
  defaultValue?: PropValue
  /** Source span of the value expression (for editing existing properties) */
  valueSpan?: SourceSpan
  /** Source span of the full property including name, colon, value, trailing comma/whitespace (for removal) */
  fullSpan?: SourceSpan
}
