import ts from 'typescript'
import type { PrimitiveBase, PropType } from '../types/prop-type.js'
import type { PropDefinition } from '../types/prop-definition.js'
import { slotDefinition } from '../types/prop-type.js'
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

  // `(T)` — parentheses are only grouping, so they shouldn't hide the shape
  // inside (`(string & {})` in an open string union, say).
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return { ...buildPropType(typeNode.type, sourceFile, typeChecker), syntax }
  }

  // Tuple types
  if (ts.isTupleTypeNode(typeNode)) {
    return buildTupleFromNode(typeNode, syntax, sourceFile, typeChecker)
  }

  // `T & { __brand }` / `string & {}`: an intersection over a primitive keyword
  // is edited as that primitive. (With a checker, the resolved type says the
  // same thing; this covers the checker-less path.)
  if (ts.isIntersectionTypeNode(typeNode)) {
    const base = typeNode.types.map(primitiveKeywordBase).find(b => b !== undefined)
    if (base) return { kind: 'primitive', syntax, base }
  }

  // Union types
  if (ts.isUnionTypeNode(typeNode)) {
    const types = typeNode.types.map(t => buildPropType(t, sourceFile, typeChecker))
    return { kind: 'union', syntax, types }
  }

  // Array types
  if (ts.isArrayTypeNode(typeNode)) {
    const elementType = buildPropType(typeNode.elementType, sourceFile, typeChecker)
    return { kind: 'array', syntax, element: slotDefinition(elementType) }
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
    const record = properties.length === 0 && recordFromMembers(typeNode.members, sourceFile, typeChecker)
    if (record) return { kind: 'record', syntax, value: record }
    return { kind: 'object', syntax, properties }
  }

  // Type references
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName.getText(sourceFile)

    let typeDecl = findTypeDeclaration(sourceFile, typeName)

    // `ReadonlyArray<T>` — treat the same as `T[]`.
    if (!typeDecl && typeName === 'ReadonlyArray' && typeNode.typeArguments?.length === 1) {
      const elementType = buildPropType(typeNode.typeArguments[0], sourceFile, typeChecker)
      return { kind: 'array', syntax, element: slotDefinition(elementType) }
    }

    // `Record<string, T>` — a record, when `Record` is the global one.
    if (
      !typeDecl &&
      typeName === 'Record' &&
      typeNode.typeArguments?.length === 2 &&
      typeNode.typeArguments[0].kind === ts.SyntaxKind.StringKeyword
    ) {
      const value = buildPropType(typeNode.typeArguments[1], sourceFile, typeChecker)
      return { kind: 'record', syntax, value: slotDefinition(value) }
    }

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
          const record = !typeDecl.heritageClauses?.length && recordFromMembers(typeDecl.members, declSourceFile, typeChecker)
          if (record) return { kind: 'record', syntax, value: record }
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

/** The primitive a keyword type node names (`string`, `number`, …), if it is one. */
function primitiveKeywordBase(node: ts.TypeNode): PrimitiveBase | undefined {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return 'string'
    case ts.SyntaxKind.NumberKeyword:
      return 'number'
    case ts.SyntaxKind.BooleanKeyword:
      return 'boolean'
    case ts.SyntaxKind.BigIntKeyword:
      return 'bigint'
    case ts.SyntaxKind.SymbolKeyword:
      return 'symbol'
    default:
      return undefined
  }
}

/**
 * The value definition of a type whose only members are a string index
 * signature (`{ [name: string]: T }`), or `undefined` if it has any other
 * member.
 */
function recordFromMembers(
  members: ts.NodeArray<ts.TypeElement>,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): PropDefinition | undefined {
  if (members.length !== 1) return undefined
  const [member] = members
  if (!ts.isIndexSignatureDeclaration(member) || !member.type) return undefined
  const key = member.parameters[0]?.type
  if (key?.kind !== ts.SyntaxKind.StringKeyword) return undefined
  return slotDefinition(buildPropType(member.type, sourceFile, typeChecker))
}

/**
 * A tuple type node's fixed elements and, for a variadic tuple
 * (`[A, B, ...C[]]`), the definition of its rest elements. Named members
 * (`[first: A, rest?: B]`) and optional elements (`[A, B?]`) are unwrapped.
 */
function buildTupleFromNode(
  typeNode: ts.TupleTypeNode,
  syntax: string,
  sourceFile: ts.SourceFile,
  typeChecker?: ts.TypeChecker
): PropType {
  const elements: PropDefinition[] = []
  let rest: PropDefinition | undefined

  for (const el of typeNode.elements) {
    let node: ts.TypeNode = el
    let optional = false
    let spread = false
    if (ts.isNamedTupleMember(node)) {
      optional = !!node.questionToken
      spread = !!node.dotDotDotToken
      node = node.type
    }
    if (ts.isOptionalTypeNode(node)) {
      optional = true
      node = node.type
    }
    if (ts.isRestTypeNode(node)) {
      spread = true
      node = node.type
    }

    if (spread) {
      if (rest) break
      // `...T[]` spreads elements of `T`; anything else (`...Items`) is kept
      // whole, since the syntax tree alone can't say what it spreads.
      let elementNode = node
      if (ts.isArrayTypeNode(elementNode)) elementNode = elementNode.elementType
      rest = slotDefinition(buildPropType(elementNode, sourceFile, typeChecker), '[...]')
      continue
    }
    if (rest) break

    const def = slotDefinition(buildPropType(node, sourceFile, typeChecker), `[${elements.length}]`)
    if (optional) def.optional = true
    elements.push(def)
  }

  return rest ? { kind: 'tuple', syntax, elements, rest } : { kind: 'tuple', syntax, elements }
}
