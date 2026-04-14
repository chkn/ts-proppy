import type { PropDefinition } from '../types/prop-definition.js'
import { valueToSourceText } from '../editing/value-to-string.js'

/** Derive placeholder text from a PropDefinition's defaultValue */
export function defaultPlaceholder(propDef: PropDefinition): string | undefined {
  if (!propDef.defaultValue) return undefined
  return `Default: ${valueToSourceText(propDef.defaultValue)}`
}
