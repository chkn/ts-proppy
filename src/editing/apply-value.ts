import type { PropDefinition } from '../types/prop-definition.js'
import type { PropValue } from '../types/prop-value.js'
import type { ExtractedProps } from '../types/extracted-props.js'
import { valueToSourceText, collectImports } from './value-to-source.js'
import { ensureImport } from './ensure-import.js'

/** Update an existing property value in source code */
export function updateProperty(
  sourceCode: string,
  property: PropDefinition,
  value: PropValue
): string {
  if (!property.valueSpan) {
    throw new Error(`Property '${property.name}' is missing valueSpan`)
  }

  const newText = valueToSourceText(value)
  let result = sourceCode.slice(0, property.valueSpan.start) + newText + sourceCode.slice(property.valueSpan.end)

  // Ensure any required imports
  for (const imp of collectImports(value)) {
    result = ensureImport(result, imp)
  }

  return result
}

/** Add a new property to an object literal in source code */
export function addProperty(
  sourceCode: string,
  extractedProps: ExtractedProps,
  propertyName: string,
  value: PropValue
): string {
  if (!extractedProps.insertionPoint) {
    throw new Error('ExtractedProps is missing insertionPoint')
  }

  const { lastPropertyEnd, objectEnd, indent } = extractedProps.insertionPoint
  const valueText = valueToSourceText(value)

  let result: string
  const hasProperties = lastPropertyEnd !== objectEnd

  if (hasProperties) {
    // Insert after last property
    const insertText = `\n${indent}${propertyName}: ${valueText},`
    result = sourceCode.slice(0, lastPropertyEnd) + insertText + sourceCode.slice(lastPropertyEnd)
  } else {
    // Empty object
    const insertText = `\n${indent}${propertyName}: ${valueText},\n`
    result = sourceCode.slice(0, lastPropertyEnd) + insertText + sourceCode.slice(lastPropertyEnd)
  }

  // Ensure any required imports
  for (const imp of collectImports(value)) {
    result = ensureImport(result, imp)
  }

  return result
}

/** Remove a property from source code using its fullSpan */
export function removeProperty(
  sourceCode: string,
  property: PropDefinition
): string {
  if (!property.fullSpan) {
    throw new Error(`Property '${property.name}' is missing fullSpan`)
  }

  return sourceCode.slice(0, property.fullSpan.start) + sourceCode.slice(property.fullSpan.end)
}
