import ts from 'typescript'
import type { PropType } from '../types/prop-type.js'
import type { PropDefinition } from '../types/prop-definition.js'
import {
  findTypeDeclaration,
  extractPropertyFromSignature,
  extractPropertiesFromDeclaration,
} from './helpers.js'

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

function extractLiteralValue(typeNode: ts.LiteralTypeNode, sourceFile: ts.SourceFile): string {
  const rawValue = typeNode.literal.getText(sourceFile)
  const jsonValue = rawValue.replace(/^["']|["']$/g, '"')
  try {
    return JSON.parse(jsonValue)
  } catch {
    return rawValue
  }
}

function extractFunctionParameters(
  typeNode: ts.TypeNode,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): PropDefinition[] {
  let functionNode: ts.FunctionTypeNode | undefined

  if (ts.isFunctionTypeNode(typeNode)) {
    functionNode = typeNode
  } else if (ts.isParenthesizedTypeNode(typeNode) && ts.isFunctionTypeNode(typeNode.type)) {
    functionNode = typeNode.type
  } else if (ts.isUnionTypeNode(typeNode)) {
    for (const unionMember of typeNode.types) {
      if (ts.isFunctionTypeNode(unionMember)) {
        functionNode = unionMember
        break
      } else if (ts.isParenthesizedTypeNode(unionMember) && ts.isFunctionTypeNode(unionMember.type)) {
        functionNode = unionMember.type
        break
      }
    }
  }

  if (!functionNode) return []

  const parameters: PropDefinition[] = []
  for (const param of functionNode.parameters) {
    const name = param.name.getText(sourceFile)
    const optional = !!param.questionToken
    const propType: PropType = param.type
      ? buildPropType(param.type, sourceFile, typeChecker)
      : { kind: 'primitive', syntax: 'any' }
    parameters.push({ name, type: propType, optional })
  }

  return parameters
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
    const parameters = extractFunctionParameters(typeNode, sourceFile, typeChecker)
    return { kind: 'function', syntax, parameters }
  }

  // Type literals (inline objects)
  if (ts.isTypeLiteralNode(typeNode)) {
    const properties: PropDefinition[] = []
    for (const member of typeNode.members) {
      if (ts.isPropertySignature(member) && member.name) {
        properties.push(extractPropertyFromSignature(member, sourceFile, typeChecker))
      }
    }
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
        const properties = extractPropertiesFromDeclaration(typeDecl, declSourceFile, typeChecker)
        if (properties.length > 0) {
          return { kind: 'object', syntax, properties }
        }
      }
    }
  }

  // Default: primitive
  return { kind: 'primitive', syntax }
}
