import ts from 'typescript'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropType } from '../types/prop-type.js'
import type { PropValue } from '../types/prop-value.js'
import { buildPropType } from './build-prop-type.js'

export function findTypeDeclaration(
  sourceFile: ts.SourceFile,
  typeName: string
): ts.InterfaceDeclaration | ts.TypeAliasDeclaration | null {
  let result: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | null = null

  function visit(node: ts.Node) {
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name.text === typeName
    ) {
      result = node
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return result
}

export function extractJSDocComment(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const fullText = sourceFile.getFullText()
  const commentRanges = ts.getLeadingCommentRanges(fullText, node.pos)

  if (!commentRanges || commentRanges.length === 0) {
    return undefined
  }

  for (let i = commentRanges.length - 1; i >= 0; i--) {
    const range = commentRanges[i]
    const commentText = fullText.substring(range.pos, range.end)

    if (commentText.startsWith('/**')) {
      return commentText
        .replace(/^\/\*\*/, '')
        .replace(/\*\/$/, '')
        .split('\n')
        .map(line => line.trim().replace(/^\* ?/, ''))
        .filter(line => line.length > 0)
        .join(' ')
        .trim()
    }
  }

  return undefined
}

export function extractPropertyFromSignature(
  member: ts.PropertySignature,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): PropDefinition {
  const name = member.name!.getText(sourceFile)
  const optional = !!member.questionToken
  const propType: PropType = member.type
    ? buildPropType(member.type, sourceFile, typeChecker)
    : { kind: 'primitive', syntax: 'any' }

  const propDef: PropDefinition = { name, type: propType, optional }
  const description = extractJSDocComment(member, sourceFile)
  if (description) {
    propDef.description = description
  }

  return propDef
}

export function extractPropertiesFromDeclaration(
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
              const inheritedProps = extractPropertiesFromDeclaration(baseDecl, baseSrcFile, typeChecker)
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

/**
 * Infer a {@link PropType} from an expression's shape without a TypeChecker.
 *
 * Covers literals, array/object literals, and template expressions.
 * Everything else (call expressions, identifiers, etc.) falls back to
 * `{ kind: 'primitive', syntax: 'any' }`.
 */
export function inferPropTypeFromExpression(
  node: ts.Expression,
  sourceFile: ts.SourceFile
): PropType {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
    return { kind: 'primitive', syntax: 'string' }
  }
  if (ts.isNumericLiteral(node) || (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand))) {
    return { kind: 'primitive', syntax: 'number' }
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: 'primitive', syntax: 'boolean' }
  }
  if (node.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(node) && node.text === 'undefined')) {
    return { kind: 'primitive', syntax: 'any' }
  }
  if (ts.isArrayLiteralExpression(node)) {
    const elementType: PropType = node.elements.length > 0
      ? inferPropTypeFromExpression(node.elements[0] as ts.Expression, sourceFile)
      : { kind: 'primitive', syntax: 'any' }
    return { kind: 'array', syntax: `${elementType.syntax}[]`, elementType }
  }
  if (ts.isObjectLiteralExpression(node)) {
    const properties: PropDefinition[] = []
    for (const prop of node.properties) {
      if (ts.isPropertySignature(prop) || ts.isPropertyAssignment(prop)) {
        const name = prop.name!.getText(sourceFile)
        const initExpr = ts.isPropertyAssignment(prop) ? prop.initializer : undefined
        const type: PropType = initExpr
          ? inferPropTypeFromExpression(initExpr, sourceFile)
          : { kind: 'primitive', syntax: 'any' }
        properties.push({ name, type, optional: false })
      }
    }
    return { kind: 'object', syntax: '{...}', properties }
  }
  if (ts.isArrowFunction(node)) {
    const params: PropDefinition[] = node.parameters.map(p => ({
      name: p.name.getText(sourceFile),
      type: { kind: 'primitive' as const, syntax: 'any' },
      optional: !!p.questionToken,
    }))
    return { kind: 'function', syntax: node.getText(sourceFile), parameters: params }
  }
  return { kind: 'primitive', syntax: 'any' }
}

export function parseValueFromExpression(
  node: ts.Expression,
  sourceFile: ts.SourceFile
): PropValue {
  // String literal
  if (ts.isStringLiteral(node)) {
    return { kind: 'primitive', value: node.text }
  }

  // Numeric literal
  if (ts.isNumericLiteral(node)) {
    return { kind: 'primitive', value: parseFloat(node.text) }
  }

  // Boolean literals
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: 'primitive', value: true }
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: 'primitive', value: false }
  }

  // null
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: 'primitive', value: null }
  }

  // undefined
  if (ts.isIdentifier(node) && node.text === 'undefined') {
    return { kind: 'primitive', value: undefined }
  }

  // Template literals (no interpolation)
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return { kind: 'primitive', value: node.text }
  }

  // Template expressions with interpolation: `Hello ${name}`
  if (ts.isTemplateExpression(node)) {
    let result = node.head.text
    for (const span of node.templateSpans) {
      result += `\${${span.expression.getText(sourceFile)}}`
      result += span.literal.text
    }
    return { kind: 'template', value: result }
  }

  // Array literals
  if (ts.isArrayLiteralExpression(node)) {
    const elements = node.elements.map(el => parseValueFromExpression(el as ts.Expression, sourceFile))
    return { kind: 'array', elements }
  }

  // Object literals
  if (ts.isObjectLiteralExpression(node)) {
    const properties: Record<string, PropValue> = {}
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = prop.name.getText(sourceFile)
        properties[key] = parseValueFromExpression(prop.initializer, sourceFile)
      }
    }
    return { kind: 'object', properties }
  }

  // Call expressions → functionCall
  if (ts.isCallExpression(node)) {
    const callee = node.expression.getText(sourceFile)
    const args = node.arguments.map(arg => parseValueFromExpression(arg as ts.Expression, sourceFile))

    // Try to find the import for this callee
    const importSpec = findImportForIdentifier(sourceFile, callee)

    return {
      kind: 'functionCall',
      callee,
      args,
      import: importSpec,
    }
  }

  // Arrow functions
  if (ts.isArrowFunction(node)) {
    const parameters = node.parameters.map(p => p.name.getText(sourceFile))
    const body = ts.isBlock(node.body) ? node.body.getText(sourceFile) : node.body.getText(sourceFile)
    return { kind: 'lambda', parameters, body }
  }

  // Prefix unary (negative numbers)
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    if (ts.isNumericLiteral(node.operand)) {
      return { kind: 'primitive', value: -parseFloat(node.operand.text) }
    }
  }

  // Fallback: raw source text
  return { kind: 'raw', sourceText: node.getText(sourceFile) }
}

function findImportForIdentifier(
  sourceFile: ts.SourceFile,
  name: string
): { name: string; from: string; isDefault?: boolean } | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    const from = statement.moduleSpecifier.text
    const clause = statement.importClause
    if (!clause) continue

    // Default import
    if (clause.name && clause.name.text === name) {
      return { name, from, isDefault: true }
    }

    // Named imports
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        if (el.name.text === name) {
          return { name, from }
        }
      }
    }
  }
}
