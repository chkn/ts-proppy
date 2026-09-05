import ts from 'typescript'
import type { PropType } from '../types/prop-type.js'
import { findTypeDeclaration } from './helpers.js'
import { extractDefinitionsFromDeclaration, extractDefinitionsFromTypeNode } from './extract-properties.js'
import { buildPropTypeFromType, isOpaqueType } from './build-prop-type-from-type.js'

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

/**
 * Type declarations currently being expanded, used to break cycles in
 * self-referential types. Safe as module state: extraction is synchronous.
 */
const expanding = new Set<ts.Node>()

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

  // Literal types (string/number/boolean constants). `null` is a literal type
  // node too, and reaches this as `{ value: null }`.
  if (ts.isLiteralTypeNode(typeNode)) {
    const value = extractLiteralValue(typeNode, sourceFile)
    return { kind: 'constant', syntax, value }
  }

  // `undefined` is a keyword rather than a literal type node, but it names a
  // single value just as `null` does, so it surfaces as the same kind. That
  // lets `T | undefined` be recognized as a union around one open-ended member.
  if (typeNode.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: 'constant', syntax, value: undefined }
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

  // `readonly T[]` / `readonly [A, B]` — unwrap and recurse so the readonly
  // modifier doesn't hide an otherwise-recognized array/tuple shape.
  if (ts.isTypeOperatorNode(typeNode) && typeNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
    return { ...buildPropType(typeNode.type, sourceFile, typeChecker), syntax }
  }

  // Function types
  if (isFunctionType(typeNode)) {
    const parameters = extractDefinitionsFromTypeNode(typeNode, sourceFile, typeChecker)
    return { kind: 'function', syntax, parameters }
  }

  // Types no form can build a value of, asked before either expansion path
  // below: an interface or inline object whose members are all methods, or a
  // reference that resolves to a class instance, must not become a form over
  // its own prototype. Needs the checker — without one the syntax tree alone
  // can't tell a service handle from a data shape, and expansion is the safer
  // default.
  if (typeChecker && (ts.isTypeLiteralNode(typeNode) || ts.isTypeReferenceNode(typeNode))) {
    if (isOpaqueType(typeChecker.getTypeAtLocation(typeNode), typeChecker, typeNode)) {
      return { kind: 'opaque', syntax }
    }
  }

  // Type literals (inline objects)
  if (ts.isTypeLiteralNode(typeNode)) {
    const properties = extractDefinitionsFromTypeNode(typeNode, sourceFile, typeChecker)
    return { kind: 'object', syntax, properties }
  }

  // Type references
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName.getText(sourceFile)

    // `ReadonlyArray<T>` — treat the same as `T[]`.
    if (typeName === 'ReadonlyArray' && typeNode.typeArguments?.length === 1) {
      const elementType = buildPropType(typeNode.typeArguments[0], sourceFile, typeChecker)
      return { kind: 'array', syntax, elementType }
    }

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

    // A type that refers to itself (`interface Node { children: Node[] }`)
    // would otherwise expand forever; stop when we re-enter one.
    if (typeDecl && !expanding.has(typeDecl)) {
      expanding.add(typeDecl)
      try {
        if (ts.isTypeAliasDeclaration(typeDecl) && typeDecl.type) {
          return buildPropType(typeDecl.type, declSourceFile, typeChecker)
        }
        if (ts.isInterfaceDeclaration(typeDecl)) {
          const properties = extractDefinitionsFromDeclaration(typeDecl, declSourceFile, typeChecker)
          if (properties.length > 0) {
            return { kind: 'object', syntax, properties }
          }
        }
      } finally {
        expanding.delete(typeDecl)
      }
    }
  }

  // Nothing in the syntax tree resolved it. With a checker we can still ask for
  // the resolved type, which sees through mapped/utility types (`Pick`, `Omit`,
  // …), generic instantiations, and types declared in other files. The original
  // source text is kept as `syntax` so the UI still shows what the author wrote.
  if (typeChecker) {
    const resolved = buildPropTypeFromType(
      typeChecker.getTypeAtLocation(typeNode),
      typeChecker,
      typeNode
    )
    return { ...resolved, syntax }
  }

  // Default: primitive
  return { kind: 'primitive', syntax }
}
