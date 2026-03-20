import ts from 'typescript'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropValue } from '../types/prop-value.js'
import type { ExtractedProps, InsertionPoint } from '../types/extracted-props.js'
import { parseValueFromExpression } from './helpers.js'

/**
 * Extract properties with their current values from an object literal expression.
 * Returns ExtractedProps with definitions (including valueSpan/fullSpan), parsed PropValues, and insertion context.
 */
export function extractPropertiesFromObjectLiteral(
  objectLiteral: ts.ObjectLiteralExpression,
  definitions: PropDefinition[],
  sourceFile: ts.SourceFile
): ExtractedProps {
  const values: Record<string, PropValue> = {}
  const fullText = sourceFile.getFullText()

  // Clone definitions and add spans
  const defsWithSpans: PropDefinition[] = definitions.map(d => ({ ...d }))

  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = prop.name.getText(sourceFile)

    // Parse the value
    values[name] = parseValueFromExpression(prop.initializer, sourceFile)

    // Find the matching definition and add spans
    const def = defsWithSpans.find(d => d.name === name)
    if (def) {
      def.valueSpan = {
        start: prop.initializer.getStart(sourceFile),
        end: prop.initializer.getEnd(),
      }

      let fullEnd = prop.getEnd()
      if (fullText[fullEnd] === ',') fullEnd++
      // Include trailing whitespace/newline
      while (fullEnd < fullText.length && (fullText[fullEnd] === ' ' || fullText[fullEnd] === '\t')) {
        fullEnd++
      }
      if (fullEnd < fullText.length && fullText[fullEnd] === '\n') {
        fullEnd++
      }

      def.fullSpan = {
        start: prop.getFullStart(),
        end: fullEnd,
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

  let lastPropertyEnd: number
  let indent = '  '

  if (objectLiteral.properties.length > 0) {
    const lastProp = objectLiteral.properties[objectLiteral.properties.length - 1]
    lastPropertyEnd = lastProp.getEnd()
    if (sourceCode[lastPropertyEnd] === ',') lastPropertyEnd++

    // Derive indentation from first property
    const firstProp = objectLiteral.properties[0]
    const propPos = firstProp.getStart(sourceFile)
    let lineStart = propPos
    while (lineStart > 0 && sourceCode[lineStart - 1] !== '\n') lineStart--
    indent = sourceCode.slice(lineStart, propPos)
  } else {
    lastPropertyEnd = objectLiteral.getStart(sourceFile) + 1 // after opening brace
  }

  return { objectEnd, lastPropertyEnd, indent }
}
