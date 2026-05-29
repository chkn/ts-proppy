import ts from 'typescript'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropType } from '../types/prop-type.js'
import type { PropValue, CalleeBinding, ImportSpecifier } from '../types/prop-value.js'
import { TemplateValueBuilder } from '../types/template-value-builder.js'
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

/**
 * Collect a map of property name → type node for the members of a type
 * literal. Used to resolve field types for destructured parameters.
 */
export function collectObjectFieldTypes(
  typeNode: ts.TypeNode,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): Map<string, ts.TypeNode> {
  const map = new Map<string, ts.TypeNode>()

  const addFromTypeLiteral = (literal: ts.TypeLiteralNode) => {
    for (const member of literal.members) {
      if (ts.isPropertySignature(member) && member.name && member.type) {
        map.set(member.name.getText(sourceFile), member.type)
      }
    }
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    addFromTypeLiteral(typeNode)
  } else if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName.getText(sourceFile)
    let decl = findTypeDeclaration(sourceFile, typeName)
    if (!decl && typeChecker) {
      const type = typeChecker.getTypeAtLocation(typeNode)
      const symbol = type.getSymbol()
      if (symbol && symbol.declarations && symbol.declarations.length > 0) {
        const d = symbol.declarations[0]
        if (ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d)) {
          decl = d
        }
      }
    }
    if (decl) {
      if (ts.isTypeAliasDeclaration(decl) && decl.type && ts.isTypeLiteralNode(decl.type)) {
        addFromTypeLiteral(decl.type)
      } else if (ts.isInterfaceDeclaration(decl)) {
        for (const member of decl.members) {
          if (ts.isPropertySignature(member) && member.name && member.type) {
            map.set(member.name.getText(sourceFile), member.type)
          }
        }
      }
    }
  }

  return map
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

  // Template expressions with interpolation: `Hello ${name}`. We use cooked
  // (`.text`) text for the string segments — any `\${…}` escapes naturally
  // collapse into literal `${…}` inside a string segment, where they cannot
  // be confused with a real interp token.
  if (ts.isTemplateExpression(node)) {
    const builder = new TemplateValueBuilder().appendString(node.head.text)
    for (const span of node.templateSpans) {
      builder.appendToken(span.expression.getText(sourceFile))
      builder.appendString(span.literal.text)
    }
    return { kind: 'template', value: builder.build() }
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

    const binding = resolveCalleeBinding(node, callee, sourceFile)

    return {
      kind: 'functionCall',
      callee,
      args,
      binding,
    }
  }

  // Concatenated string literals: "a" + "b" + expr
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    function collectConcatParts(n: ts.Expression): PropValue[] {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        return [...collectConcatParts(n.left), ...collectConcatParts(n.right)]
      }
      return [parseValueFromExpression(n, sourceFile)]
    }
    const parts = collectConcatParts(node)

    if (parts.every(p => p.kind === 'primitive' && (typeof p.value === 'string' || typeof p.value === 'number'))) {
      return { kind: 'primitive', value: parts.map(p => String((p as Extract<PropValue, { kind: 'primitive' }>).value)).join('') }
    }

    const builder = new TemplateValueBuilder()
    for (const part of parts) {
      if (part.kind === 'primitive' && (typeof part.value === 'string' || typeof part.value === 'number')) {
        builder.appendString(String(part.value))
      } else if (part.kind === 'template') {
        builder.appendSegments(part.value)
      } else if (part.kind === 'raw') {
        builder.appendToken(part.sourceText)
      } else {
        return { kind: 'raw', sourceText: node.getText(sourceFile) }
      }
    }
    return { kind: 'template', value: builder.build() }
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
): ImportSpecifier | undefined {
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

type FunctionLike = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration | ts.AccessorDeclaration | ts.ConstructorDeclaration

function isFunctionLike(node: ts.Node): node is FunctionLike {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  )
}

/** Does this parameter (including destructured bindings) introduce `name`? */
function parameterBindsName(param: ts.ParameterDeclaration, name: string): boolean {
  return bindingNameContains(param.name, name)
}

function bindingNameContains(b: ts.BindingName, name: string): boolean {
  if (ts.isIdentifier(b)) return b.text === name
  if (ts.isObjectBindingPattern(b)) {
    for (const el of b.elements) {
      // `{ name }` → propertyName undefined, name is el.name (Identifier or nested pattern)
      // `{ name: alias }` → propertyName=name, el.name=alias
      // The introduced binding is el.name.
      if (bindingNameContains(el.name, name)) return true
    }
    return false
  }
  if (ts.isArrayBindingPattern(b)) {
    for (const el of b.elements) {
      if (ts.isBindingElement(el) && bindingNameContains(el.name, name)) return true
    }
    return false
  }
  return false
}

/**
 * Resolve where `callee` is bound at the given call site.
 *
 * Preference order:
 * 1. Parameter of an enclosing function (innermost wins). If that function is
 *    passed as an argument to another call expression, that call's identity is
 *    attached as `enclosingCall`.
 * 2. Top-level import.
 */
function resolveCalleeBinding(
  callNode: ts.CallExpression,
  callee: string,
  sourceFile: ts.SourceFile,
): CalleeBinding | undefined {
  // Only resolve bare identifiers; `a.b()` style is left unbound.
  if (!ts.isIdentifier(callNode.expression)) {
    return undefined
  }

  // Walk up looking for an enclosing function whose params bind `callee`.
  let cur: ts.Node | undefined = callNode.parent
  while (cur) {
    if (isFunctionLike(cur)) {
      const fn = cur
      if (fn.parameters.some(p => parameterBindsName(p, callee))) {
        const enclosingCall = describeEnclosingCall(fn, sourceFile)
        return enclosingCall
          ? { kind: 'parameter', enclosingCall }
          : { kind: 'parameter' }
      }
    }
    cur = cur.parent
  }

  // Fall back to top-level import.
  const spec = findImportForIdentifier(sourceFile, callee)
  return spec ? { kind: 'import', spec } : undefined
}

/**
 * If `fn` is itself passed as an argument to a call expression — e.g. the
 * `(({ openai }) => …)` in `prompts(({ openai }) => …)` — return the outer
 * call's callee identity. Otherwise undefined.
 */
function describeEnclosingCall(
  fn: FunctionLike,
  sourceFile: ts.SourceFile,
): { callee: string; import?: ImportSpecifier } | undefined {
  const parent = fn.parent
  if (!parent || !ts.isCallExpression(parent)) return undefined
  if (!parent.arguments.includes(fn as ts.Expression)) return undefined
  if (!ts.isIdentifier(parent.expression)) return undefined
  const calleeName = parent.expression.text
  const spec = findImportForIdentifier(sourceFile, calleeName)
  return spec ? { callee: calleeName, import: spec } : { callee: calleeName }
}
