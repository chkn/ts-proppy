import ts from 'typescript'
import type { PropType } from '../types/prop-type.js'
import { findTypeDeclaration } from './helpers.js'
import { extractDefinitionsFromDeclaration, extractDefinitionsFromTypeNode } from './extract-properties.js'

function isFunctionType(typeNode: ts.TypeNode | undefined): boolean {
  if (!typeNode) return false
  if (ts.isFunctionTypeNode(typeNode)) return true
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return isFunctionType(typeNode.type)
  }
  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.some(t => isFunctionType(t))
  }
  return false
}

function extractLiteralValue(typeNode: ts.LiteralTypeNode, sourceFile: ts.SourceFile): unknown {
  const rawValue = typeNode.literal.getText(sourceFile)
  const jsonValue = rawValue.replace(/^["']|["']$/g, '"')
  try {
    return JSON.parse(jsonValue)
  } catch {
    return rawValue
  }
}

export function buildPropType(
  typeNode: ts.TypeNode,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): PropType {
  const syntax = typeNode.getText(sourceFile)

  // Literal types (string/number/boolean constants)
  if (ts.isLiteralTypeNode(typeNode)) {
    const value = extractLiteralValue(typeNode, sourceFile)
    return { kind: 'constant', syntax, value }
  }

  // Tuple types
  if (ts.isTupleTypeNode(typeNode)) {
    const types = typeNode.elements.map(el => buildPropType(el, sourceFile, typeChecker))
    return { kind: 'tuple', syntax, types }
  }

  // Union types
  if (ts.isUnionTypeNode(typeNode)) {
    const types = typeNode.types.map(t => buildPropType(t, sourceFile, typeChecker))
    return { kind: 'union', syntax, types }
  }

  // Array types
  if (ts.isArrayTypeNode(typeNode)) {
    const elementType = buildPropType(typeNode.elementType, sourceFile, typeChecker)
    return { kind: 'array', syntax, elementType }
  }

  // Function types
  if (isFunctionType(typeNode)) {
    const parameters = extractDefinitionsFromTypeNode(typeNode, sourceFile, typeChecker)
    return { kind: 'function', syntax, parameters }
  }

  // Type literals (inline objects)
  if (ts.isTypeLiteralNode(typeNode)) {
    const properties = extractDefinitionsFromTypeNode(typeNode, sourceFile, typeChecker)
    return { kind: 'object', syntax, properties }
  }

  // Type references
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName.getText(sourceFile)
    let typeDecl = findTypeDeclaration(sourceFile, typeName)
    let declSourceFile = sourceFile

    // If not found in same file and typeChecker available, resolve cross-file
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
      if (ts.isTypeAliasDeclaration(typeDecl) && typeDecl.type) {
        return buildPropType(typeDecl.type, declSourceFile, typeChecker)
      }
      if (ts.isInterfaceDeclaration(typeDecl)) {
        const properties = extractDefinitionsFromDeclaration(typeDecl, declSourceFile, typeChecker)
        if (properties.length > 0) {
          return { kind: 'object', syntax, properties }
        }
      }
    }
  }

  // Default: primitive
  return { kind: 'primitive', syntax }
}
