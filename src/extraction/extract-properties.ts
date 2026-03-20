import ts from 'typescript'
import type { PropDefinition } from '../types/prop-definition.js'
import type { ExtractedProps } from '../types/extracted-props.js'
import { buildPropType } from './build-prop-type.js'
import {
  findTypeDeclaration,
  extractPropertyFromSignature,
  extractPropertiesFromDeclaration,
} from './helpers.js'

/**
 * Core extraction: convert a TS type node into ExtractedProps.
 * Returns ExtractedProps with definitions only (no values or insertionPoint).
 */
export function extractPropertiesFromTypeNode(
  typeNode: ts.TypeNode,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): ExtractedProps {
  const definitions = extractDefinitionsFromTypeNode(typeNode, sourceFile, typeChecker)
  return { definitions }
}

function extractDefinitionsFromTypeNode(
  typeNode: ts.TypeNode,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): PropDefinition[] {
  // Inline object type: { foo: string; bar: number }
  if (ts.isTypeLiteralNode(typeNode)) {
    const props: PropDefinition[] = []
    for (const member of typeNode.members) {
      if (ts.isPropertySignature(member) && member.name) {
        props.push(extractPropertyFromSignature(member, sourceFile, typeChecker))
      }
    }
    return props
  }

  // Type reference: Props, ComponentProps, etc.
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName.getText(sourceFile)
    let typeDecl = findTypeDeclaration(sourceFile, typeName)
    let declSourceFile = sourceFile

    if (!typeDecl && typeChecker) {
      const type = typeChecker.getTypeAtLocation(typeNode)
      const symbol = type.getSymbol()
      if (symbol && symbol.declarations && symbol.declarations.length > 0) {
        const d = symbol.declarations[0]
        if (ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d)) {
          typeDecl = d
          declSourceFile = d.getSourceFile()
        }
      }
    }

    if (typeDecl) {
      return extractPropertiesFromDeclaration(typeDecl, declSourceFile, typeChecker)
    }
  }

  return []
}
