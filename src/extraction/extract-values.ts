import ts from 'typescript'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropValue } from '../types/prop-value.js'
import type { ExtractedProps, InsertionPoint } from '../types/extracted-props.js'
import { parseValueFromExpression, inferPropTypeFromExpression, propertyNameText } from './helpers.js'

/**
 * Extract properties with their current values from an object literal expression.
 *
 * When `definitions` is provided, values are matched to existing definitions by
 * name and the definitions are enriched with source spans.
 *
 * When `definitions` is `undefined` (schemaless mode), a {@link PropDefinition}
 * is auto-generated for every property in the object literal with its type
 * inferred from the expression shape.
 *
 * @returns ExtractedProps with definitions (including valueSpan/fullSpan), parsed PropValues, and insertion context.
 */
export function extractPropertiesFromObjectLiteral(
  objectLiteral: ts.ObjectLiteralExpression,
  definitions: PropDefinition[] | undefined,
  sourceFile: ts.SourceFile
): ExtractedProps {
  const values: Record<string, PropValue> = {}
  const fullText = sourceFile.getFullText()
  const schemaless = definitions === undefined

  // Clone definitions and add spans
  const defsWithSpans: PropDefinition[] = schemaless ? [] : definitions.map(d => ({ ...d }))

  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = propertyNameText(prop.name) ?? prop.name.getText(sourceFile)

    // Parse the value
    values[name] = parseValueFromExpression(prop.initializer, sourceFile)

    // Compute spans
    const valueSpan = {
      start: prop.initializer.getStart(sourceFile),
      end: prop.initializer.getEnd(),
    }

    let fullEnd = prop.getEnd()
    if (fullText[fullEnd] === ',') fullEnd++
    // Include trailing inline whitespace (spaces/tabs) but not the newline —
    // the newline belongs to the next line (next property or closing brace).
    while (fullEnd < fullText.length && (fullText[fullEnd] === ' ' || fullText[fullEnd] === '\t')) {
      fullEnd++
    }

    const fullSpan = {
      start: prop.getFullStart(),
      end: fullEnd,
    }

    if (schemaless) {
      // Auto-generate definition with inferred type
      defsWithSpans.push({
        name,
        type: inferPropTypeFromExpression(prop.initializer, sourceFile),
        optional: false,
        valueSpan,
        fullSpan,
      })
    } else {
      // Find the matching definition and add spans
      const def = defsWithSpans.find(d => d.name === name)
      if (def) {
        def.valueSpan = valueSpan
        def.fullSpan = fullSpan
      }
    }
  }

  // Build insertion point
  const insertionPoint = buildInsertionPoint(objectLiteral, sourceFile)

  return {
    definitions: defsWithSpans,
    values,
    insertionPoint,
  }
}

function buildInsertionPoint(
  objectLiteral: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile
): InsertionPoint {
  const sourceCode = sourceFile.getFullText()
  const objectEnd = objectLiteral.getEnd() - 1 // position of closing brace

  let lineStart: number
  let lastPropertyEnd: number
  let increaseIndent: boolean
  const hasProperties = objectLiteral.properties.length > 0

  if (hasProperties) {
    const lastProp = objectLiteral.properties[objectLiteral.properties.length - 1]
    lastPropertyEnd = lastProp.getEnd()
    if (sourceCode[lastPropertyEnd] === ',') lastPropertyEnd++

    // Derive indentation from first property
    const firstProp = objectLiteral.properties[0]
    const propPos = firstProp.getStart(sourceFile)
    lineStart = propPos
    increaseIndent = false
  } else {
    const bracePos = objectLiteral.getStart(sourceFile)
    lastPropertyEnd = bracePos + 1 // after opening brace

    // Derive indentation from first opening brace
    lineStart = bracePos
    increaseIndent = true
  }

  let nonWhitespaceStart = lineStart
  while (lineStart > 0 && sourceCode[lineStart - 1] !== '\n') {
    const i = lineStart - 1
    const chr = sourceCode[i]
    if (chr !== '\t' && chr !== ' ') nonWhitespaceStart = i
    lineStart = i
  }

  // FIXME: Determine actual indent type from the rest of the file and use that
  const indent = sourceCode.slice(lineStart, nonWhitespaceStart) + (increaseIndent ? '  ' : '')

  return { objectEnd, lastPropertyEnd, indent, hasProperties }
}
