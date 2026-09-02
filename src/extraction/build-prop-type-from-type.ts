import ts from 'typescript'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropType } from '../types/prop-type.js'

/**
 * Depth limit for recursing into resolved types. Guards against self-referential
 * shapes (e.g. `interface Node { children: Node[] }`) expanding forever.
 */
const MAX_DEPTH = 6

/**
 * Type flags that should always surface as an opaque `primitive`.
 *
 * The `*Like` flags matter: they also cover the shapes that merely stand in for
 * a primitive, such as the template literal type `` `tsk_${string}` ``. Those
 * carry the whole `String` interface, so without this they would expand into an
 * object of every string method.
 */
const PRIMITIVE_FLAGS =
  ts.TypeFlags.StringLike |
  ts.TypeFlags.NumberLike |
  ts.TypeFlags.BooleanLike |
  ts.TypeFlags.BigIntLike |
  ts.TypeFlags.ESSymbolLike |
  ts.TypeFlags.VoidLike |
  ts.TypeFlags.Null |
  ts.TypeFlags.Never |
  ts.TypeFlags.Any |
  ts.TypeFlags.Unknown

/**
 * Whether `symbol` is behaviour (a method, or a property holding a function)
 * rather than data. Note a member can be function-valued without being a
 * method: lib.d.ts declares `Date.getVarDate` as `getVarDate: () => VarDate`.
 */
function isBehaviour(symbol: ts.Symbol, typeChecker: ts.TypeChecker, location: ts.Node): boolean {
  if (symbol.flags & ts.SymbolFlags.Method) return true
  const decl = symbol.valueDeclaration ?? symbol.declarations?.[0]
  if (decl && (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl))) return true
  return typeChecker.getTypeOfSymbolAtLocation(symbol, location).getCallSignatures().length > 0
}

function symbolToPropDefinition(
  symbol: ts.Symbol,
  typeChecker: ts.TypeChecker,
  location: ts.Node,
  depth: number
): PropDefinition {
  const optional = !!(symbol.flags & ts.SymbolFlags.Optional)
  let type = typeChecker.getTypeOfSymbolAtLocation(symbol, location)
  // An optional property's type includes `undefined`; strip it so the editor
  // shows the underlying shape rather than a union with undefined.
  if (optional) type = typeChecker.getNonNullableType(type)

  const def: PropDefinition = {
    name: symbol.getName(),
    type: buildPropTypeFromType(type, typeChecker, location, depth + 1),
    optional,
  }

  const description = ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)).trim()
  if (description) def.description = description

  return def
}

/**
 * Build a {@link PropType} from a type the checker has already resolved.
 *
 * Unlike {@link buildPropType}, which reads the syntax tree, this works from
 * the checker's view of a type and so can see through constructs that have no
 * direct declaration to walk: mapped and utility types (`Pick`, `Omit`,
 * `Partial`, …), generic instantiations, and types imported from other files.
 *
 * @param type - The resolved type.
 * @param typeChecker - Checker that produced `type`.
 * @param location - A node in the program, used to resolve property types.
 * @param depth - Current recursion depth; recursion stops at {@link MAX_DEPTH}.
 */
export function buildPropTypeFromType(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  location: ts.Node,
  depth = 0
): PropType {
  const syntax = typeChecker.typeToString(type)

  if (depth >= MAX_DEPTH) return { kind: 'primitive', syntax }

  // Literal constants
  if (type.isStringLiteral() || type.isNumberLiteral()) {
    return { kind: 'constant', syntax, value: type.value }
  }
  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return { kind: 'constant', syntax, value: syntax === 'true' }
  }
  // `null` and `undefined` each name a single value, so they surface as
  // constants here too — matching the syntax-tree path, and letting
  // `T | null` be recognized as a union around one open-ended member.
  if (type.flags & ts.TypeFlags.Null) return { kind: 'constant', syntax, value: null }
  if (type.flags & ts.TypeFlags.Undefined) return { kind: 'constant', syntax, value: undefined }

  // Primitives. Checked before unions: `boolean` is itself a `true | false` union.
  if (type.flags & PRIMITIVE_FLAGS) {
    return { kind: 'primitive', syntax }
  }

  // Arrays and tuples
  if (typeChecker.isArrayType(type)) {
    const [element] = typeChecker.getTypeArguments(type as ts.TypeReference)
    const elementType: PropType = element
      ? buildPropTypeFromType(element, typeChecker, location, depth + 1)
      : { kind: 'primitive', syntax: 'any' }
    return { kind: 'array', syntax, elementType }
  }
  if (typeChecker.isTupleType(type)) {
    const types = typeChecker
      .getTypeArguments(type as ts.TypeReference)
      .map(t => buildPropTypeFromType(t, typeChecker, location, depth + 1))
    return { kind: 'tuple', syntax, types }
  }

  // A branded primitive (`string & { __brand: 'TaskId' }`) is edited as the
  // primitive it wraps, not as an object with a brand field.
  if (type.isIntersection() && type.types.some(t => t.flags & PRIMITIVE_FLAGS)) {
    return { kind: 'primitive', syntax }
  }

  // Unions
  if (type.isUnion()) {
    const types = type.types.map(t => buildPropTypeFromType(t, typeChecker, location, depth + 1))
    return { kind: 'union', syntax, types }
  }

  // Functions
  const callSignatures = type.getCallSignatures()
  if (callSignatures.length > 0) {
    const parameters = callSignatures[0]
      .getParameters()
      .map(p => symbolToPropDefinition(p, typeChecker, location, depth))
    return { kind: 'function', syntax, parameters }
  }

  // Objects. Only worth expanding if the type carries data: one whose members
  // are all behaviour (`Date`, `RegExp`, …) stays opaque so the UI can treat it
  // as a single value rather than a form over its prototype.
  const properties = typeChecker.getPropertiesOfType(type)
  if (properties.some(p => !isBehaviour(p, typeChecker, location))) {
    return {
      kind: 'object',
      syntax,
      properties: properties.map(p => symbolToPropDefinition(p, typeChecker, location, depth)),
    }
  }

  return { kind: 'primitive', syntax }
}
