import ts from 'typescript'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropType } from '../types/prop-type.js'
import type { ExtractedProps } from '../types/extracted-props.js'
import { buildPropType } from './build-prop-type.js'
import {
  findTypeDeclaration,
  extractPropertyFromSignature,
  inferPropTypeFromExpression,
  parseValueFromExpression,
  collectObjectFieldTypes
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

export function extractDefinitionsFromTypeNode(
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
      return extractDefinitionsFromDeclaration(typeDecl, declSourceFile, typeChecker)
    }
  }

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

  return extractDefinitionsFromParameters(functionNode.parameters, sourceFile, typeChecker)
}

/**
 * Extract {@link ExtractedProps} from a function's parameter list.
 *
 * Handles both simple identifier parameters (`fn(a: string)`) and destructured
 * object binding patterns (`fn({ a, b = 1 }: { a: string; b?: number })`).
 * A destructured parameter is flattened into one {@link PropDefinition} per
 * bound identifier, with field types resolved from the parameter's type
 * annotation.
 *
 * Default values from initializers are captured as {@link PropDefinition.defaultValue}
 * and mark the parameter as `optional`.
 */
export function extractPropertiesFromParameters(
  parameters: readonly ts.ParameterDeclaration[],
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): ExtractedProps {
  const definitions = extractDefinitionsFromParameters(parameters, sourceFile, typeChecker)
  return { definitions }
}

export function extractDefinitionsFromParameters(
  parameters: readonly ts.ParameterDeclaration[],
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): PropDefinition[] {
  const props: PropDefinition[] = []

  for (const param of parameters) {
    if (ts.isIdentifier(param.name)) {
      const name = param.name.text
      const type: PropType = param.type
        ? buildPropType(param.type, sourceFile, typeChecker)
        : param.initializer
          ? inferPropTypeFromExpression(param.initializer, sourceFile)
          : { kind: 'primitive', syntax: 'any' }
      const optional = !!param.questionToken || !!param.initializer
      const def: PropDefinition = { name, type, optional }
      if (param.initializer) {
        def.defaultValue = parseValueFromExpression(param.initializer, sourceFile)
      }
      props.push(def)
    } else if (ts.isObjectBindingPattern(param.name)) {
      const fieldTypes = param.type
        ? collectObjectFieldTypes(param.type, sourceFile, typeChecker)
        : new Map<string, ts.TypeNode>()

      for (const element of param.name.elements) {
        if (!ts.isBindingElement(element)) continue
        if (!ts.isIdentifier(element.name)) continue

        const propertyName = element.propertyName && ts.isIdentifier(element.propertyName)
          ? element.propertyName.text
          : element.name.text
        const fieldType = fieldTypes.get(propertyName)
        const type: PropType = fieldType
          ? buildPropType(fieldType, sourceFile, typeChecker)
          : element.initializer
            ? inferPropTypeFromExpression(element.initializer, sourceFile)
            : { kind: 'primitive', syntax: 'any' }
        const optional = !!element.initializer
        const def: PropDefinition = { name: element.name.text, type, optional }
        if (element.initializer) {
          def.defaultValue = parseValueFromExpression(element.initializer, sourceFile)
        }
        props.push(def)
      }
    }
  }

  return props
}

export function extractPropertiesFromDeclaration(
  decl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): ExtractedProps {
  const definitions = extractDefinitionsFromDeclaration(decl, sourceFile, typeChecker)
  return { definitions }
}

export function extractDefinitionsFromDeclaration(
  decl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): PropDefinition[] {
  const props: PropDefinition[] = []

  if (ts.isInterfaceDeclaration(decl)) {
    if (decl.heritageClauses) {
      for (const heritageClause of decl.heritageClauses) {
        if (heritageClause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const typeExpr of heritageClause.types) {
            let baseDecl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | null = null
            let baseSrcFile = sourceFile

            if (typeChecker) {
              const type = typeChecker.getTypeAtLocation(typeExpr)
              const symbol = type.getSymbol()
              if (symbol && symbol.declarations && symbol.declarations.length > 0) {
                const d = symbol.declarations[0]
                if (ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d)) {
                  baseDecl = d
                  baseSrcFile = d.getSourceFile()
                }
              }
            } else {
              const typeName = typeExpr.expression.getText(sourceFile)
              baseDecl = findTypeDeclaration(sourceFile, typeName)
            }

            if (baseDecl) {
              const inheritedProps = extractDefinitionsFromDeclaration(baseDecl, baseSrcFile, typeChecker)
              props.push(...inheritedProps)
            }
          }
        }
      }
    }

    for (const member of decl.members) {
      if (ts.isPropertySignature(member) && member.name) {
        props.push(extractPropertyFromSignature(member, sourceFile, typeChecker))
      }
    }
  } else if (ts.isTypeAliasDeclaration(decl) && decl.type) {
    if (ts.isTypeLiteralNode(decl.type)) {
      for (const member of decl.type.members) {
        if (ts.isPropertySignature(member) && member.name) {
          props.push(extractPropertyFromSignature(member, sourceFile, typeChecker))
        }
      }
    }
  }

  return props
}
