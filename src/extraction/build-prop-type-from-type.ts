import ts from 'typescript'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PrimitiveBase, PropType } from '../types/prop-type.js'
import { slotDefinition } from '../types/prop-type.js'

/**
 * Depth limit for recursing into resolved types. Guards against self-referential
 * shapes (e.g. `interface Node { children: Node[] }`) expanding forever.
 */
const MAX_DEPTH = 6

/**
 * Circuit breaker on how many properties one top-level type may expand into.
 *
 * {@link MAX_DEPTH} bounds depth but not breadth: a handle type like a database
 * client has a couple of dozen top-level members and the checker walks every
 * overload beneath each of them, which is how a single parameter turns into
 * megabytes of JSON.
 *
 * This is deliberately *not* a semantic rule — collapsing a merely large type
 * into an opaque one is wrong when the type is genuinely editable, so the
 * ceiling is set high and firing is logged loudly. Treat a hit as a missing
 * rule in {@link isUnconstructible}, not as designed behaviour.
 */
const MAX_PROPERTIES = 5000

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

/** Mutable state shared by one top-level {@link buildPropTypeFromType} call. */
interface BuildContext {
  /** Properties expanded so far, against {@link MAX_PROPERTIES}. */
  propertyCount: number
  /** Whether the circuit breaker has already been reported for this call. */
  reported: boolean
}

/**
 * The {@link PrimitiveBase} a type's flags boil down to, if any. Used to route
 * a `primitive` {@link PropType} to the right editor even when its `syntax`
 * isn't the bare keyword — a branded or template-literal type (e.g.
 * `` `tsk_${string}` ``) is still `StringLike` under the hood.
 */
function primitiveBase(flags: ts.TypeFlags): PrimitiveBase | undefined {
  if (flags & ts.TypeFlags.StringLike) return 'string'
  if (flags & ts.TypeFlags.NumberLike) return 'number'
  if (flags & ts.TypeFlags.BooleanLike) return 'boolean'
  if (flags & ts.TypeFlags.BigIntLike) return 'bigint'
  if (flags & ts.TypeFlags.ESSymbolLike) return 'symbol'
  return undefined
}

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

/** Whether any of `symbol`'s declarations is `private` or `protected`. */
function hasInaccessibleDeclaration(symbol: ts.Symbol): boolean {
  const nonPublic = ts.ModifierFlags.Private | ts.ModifierFlags.Protected
  return !!symbol.declarations?.some(d => ts.getCombinedModifierFlags(d as ts.Declaration) & nonPublic)
}

/**
 * Whether `type` is a class *instance* type — declared with `class`, or
 * carrying members no outside code could supply.
 *
 * This is the motivating opacity rule: a `DrizzleD1Database` is
 * `declare class … extends BaseSQLiteDatabase`, and no form builds one.
 */
function isClassInstanceType(type: ts.Type): boolean {
  const symbol = type.getSymbol()
  if (symbol) {
    if (symbol.flags & ts.SymbolFlags.Class) return true
    if (symbol.declarations?.some(d => ts.isClassDeclaration(d) || ts.isClassExpression(d))) {
      return true
    }
  }
  // A type can be instance-shaped without a class declaration in view — an
  // anonymous or mapped view over one still carries its inaccessible members.
  return type.getProperties().some(hasInaccessibleDeclaration)
}

/**
 * The two structural opacity rules, applied to a type already known not to be
 * a primitive, array, union, or function:
 *
 * 1. **Class instance types**, looking through intersections — an intersection
 *    is unconstructible if *any* constituent is, since building the whole
 *    means building that part too.
 * 2. **All-method object types** — an interface whose members are all methods
 *    or function-typed properties and which holds no data at all. An RPC client
 *    handle or a service interface: not a class, equally unconstructible.
 */
function isUnconstructible(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  location: ts.Node,
  properties: readonly ts.Symbol[] = typeChecker.getPropertiesOfType(type)
): boolean {
  if (type.isIntersection()) {
    return type.types.some(t => isUnconstructible(t, typeChecker, location))
  }
  // Guard the recursion into intersection members: `string` reports every
  // member of the `String` interface, all of them methods, so without this the
  // all-method rule would swallow every branded primitive.
  if (type.flags & PRIMITIVE_FLAGS) return false
  if (isClassInstanceType(type)) return true

  return (
    properties.length > 0 && properties.every(p => isBehaviour(p, typeChecker, location))
  )
}

/**
 * Whether no value of `type` could be constructed from a `PropValue` — that is,
 * from data typed into a form — and so the type should surface as
 * `{ kind: 'opaque' }` rather than being expanded into an editor.
 *
 * Opacity is a property of the type alone. It is never decided by what a host
 * happens to have available to fill the slot: a slot that *is* editable keeps
 * its editor even when the host could also supply it some other way.
 *
 * The rules are narrow by design, so a genuinely unconstructible type that is
 * neither class-shaped nor all-method still expands. Prefer adding a rule here
 * over lowering {@link MAX_PROPERTIES}.
 *
 * @param type - The resolved type to classify.
 * @param typeChecker - Checker that produced `type`.
 * @param location - A node in the program, used to resolve member types.
 * @param properties - `type`'s own properties, if the caller already has them
 *   (e.g. to decide whether to expand into an object). Defaults to resolving
 *   them here so the check still works standalone.
 */
export function isOpaqueType(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  location: ts.Node,
  properties: readonly ts.Symbol[] = typeChecker.getPropertiesOfType(type)
): boolean {
  // Everything with an editor of its own is constructible by definition.
  if (type.flags & PRIMITIVE_FLAGS) return false
  if (typeChecker.isArrayType(type) || typeChecker.isTupleType(type)) return false
  if (type.isUnion()) return false
  // A branded primitive (`string & { __brand }`) is edited as its primitive.
  if (type.isIntersection() && type.types.some(t => t.flags & PRIMITIVE_FLAGS)) return false
  if (type.getCallSignatures().length > 0) return false

  return isUnconstructible(type, typeChecker, location, properties)
}

function symbolToPropDefinition(
  symbol: ts.Symbol,
  typeChecker: ts.TypeChecker,
  location: ts.Node,
  depth: number,
  ctx: BuildContext
): PropDefinition {
  // A parameter's `?` (or default) isn't carried by its symbol's flags, only
  // by its declaration.
  const declaration = symbol.valueDeclaration
  const optional =
    !!(symbol.flags & ts.SymbolFlags.Optional) ||
    (!!declaration && ts.isParameter(declaration) && typeChecker.isOptionalParameter(declaration))
  let type = typeChecker.getTypeOfSymbolAtLocation(symbol, location)
  // An optional property's type includes `undefined`; strip it so the editor
  // shows the underlying shape rather than a union with undefined.
  if (optional) type = typeChecker.getNonNullableType(type)

  const def: PropDefinition = {
    name: symbol.getName(),
    type: build(type, typeChecker, location, depth + 1, ctx),
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
 * Types that no form could build a value of surface as
 * `{ kind: 'opaque' }` rather than being expanded — see
 * {@link isUnconstructible}.
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
  return build(type, typeChecker, location, depth, { propertyCount: 0, reported: false })
}

function build(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  location: ts.Node,
  depth: number,
  ctx: BuildContext
): PropType {
  const syntax = typeChecker.typeToString(type)

  if (depth >= MAX_DEPTH) return { kind: 'primitive', syntax }

  // A generic parameter (`criteria: T` where `T extends ChoiceCriteria`) is
  // edited as whatever its constraint allows.
  if (type.flags & ts.TypeFlags.TypeParameter) {
    const constraint = typeChecker.getBaseConstraintOfType(type)
    if (constraint && constraint !== type) return build(constraint, typeChecker, location, depth, ctx)
    return { kind: 'primitive', syntax: 'unknown' }
  }

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
    return { kind: 'primitive', syntax, base: primitiveBase(type.flags) }
  }

  // Arrays and tuples
  if (typeChecker.isArrayType(type)) {
    const [element] = typeChecker.getTypeArguments(type as ts.TypeReference)
    const elementType: PropType = element
      ? build(element, typeChecker, location, depth + 1, ctx)
      : { kind: 'primitive', syntax: 'any' }
    return { kind: 'array', syntax, element: slotDefinition(elementType) }
  }
  if (typeChecker.isTupleType(type)) {
    return buildTuple(type as ts.TupleTypeReference, syntax, typeChecker, location, depth, ctx)
  }

  // A branded primitive (`string & { __brand: 'TaskId' }`) is edited as the
  // primitive it wraps, not as an object with a brand field. Checked before
  // opacity: the brand carries no members to make the whole unconstructible.
  if (type.isIntersection()) {
    const primitiveMember = type.types.find(t => t.flags & PRIMITIVE_FLAGS)
    if (primitiveMember) {
      return { kind: 'primitive', syntax, base: primitiveBase(primitiveMember.flags) }
    }
  }

  // Unions
  if (type.isUnion()) {
    const types = type.types.map(t => build(t, typeChecker, location, depth + 1, ctx))
    return { kind: 'union', syntax, types }
  }

  // Functions
  const callSignatures = type.getCallSignatures()
  if (callSignatures.length > 0) {
    const parameters = callSignatures[0]
      .getParameters()
      .map(p => symbolToPropDefinition(p, typeChecker, location, depth, ctx))
    return { kind: 'function', syntax, parameters }
  }

  // Objects. Resolved once: used both to decide opacity (an all-method
  // interface) and, if not opaque, to expand into an object below.
  const properties = typeChecker.getPropertiesOfType(type)

  // The property-count budget is a cheap length check, so it runs before the
  // opacity scan below: no point walking every property's call signatures to
  // classify a type that's going to collapse to opaque either way.
  if (properties.length > 0) {
    ctx.propertyCount += properties.length
    if (ctx.propertyCount > MAX_PROPERTIES) {
      if (!ctx.reported) {
        ctx.reported = true
        console.warn(
          `[ts-proppy] '${syntax}' exceeded the ${MAX_PROPERTIES}-property expansion budget ` +
            `and was collapsed to an opaque type. This is a circuit breaker, not a rule: ` +
            `if the type is genuinely editable, it needs a narrower opacity rule (or lazy ` +
            `subtree expansion), not a lower budget.`
        )
      }
      return { kind: 'opaque', syntax }
    }
  }

  // Types no form can build a value of stop here rather than expanding into a
  // form over their prototype.
  if (isOpaqueType(type, typeChecker, location, properties)) {
    return { kind: 'opaque', syntax }
  }

  if (properties.length > 0) {
    return {
      kind: 'object',
      syntax,
      properties: properties.map(p =>
        symbolToPropDefinition(p, typeChecker, location, depth, ctx)
      ),
    }
  }

  // No named members, but a string index signature: keys are the caller's to
  // choose (`{ [name: string]: T }`, `Record<string, T>`).
  const indexType = type.getStringIndexType()
  if (indexType) {
    const value = build(indexType, typeChecker, location, depth + 1, ctx)
    return { kind: 'record', syntax, value: slotDefinition(value) }
  }

  return { kind: 'primitive', syntax }
}

/**
 * A tuple's fixed elements, plus a `rest` definition when it is variadic
 * (`[A, B, ...C[]]`). The checker reports a rest element's *element* type as
 * its type argument, flagged `Rest`; a variadic element (`...T` for a generic
 * array `T`) is treated the same way, as any number of `T`'s elements.
 */
function buildTuple(
  type: ts.TupleTypeReference,
  syntax: string,
  typeChecker: ts.TypeChecker,
  location: ts.Node,
  depth: number,
  ctx: BuildContext
): PropType {
  const args = typeChecker.getTypeArguments(type)
  const flags = type.target.elementFlags
  const elements: PropDefinition[] = []
  let rest: PropDefinition | undefined

  args.forEach((arg, i) => {
    const flag = flags[i] ?? ts.ElementFlags.Required
    if (flag & ts.ElementFlags.Variable) {
      // Only the first variable-length element is representable; anything
      // after it (`[...A[], B]`) can't be addressed by a fixed position.
      if (rest) return
      let elementType = arg
      if (flag & ts.ElementFlags.Variadic && typeChecker.isArrayType(arg)) {
        elementType = typeChecker.getTypeArguments(arg as ts.TypeReference)[0] ?? arg
      }
      rest = slotDefinition(build(elementType, typeChecker, location, depth + 1, ctx), '[...]')
      return
    }
    if (rest) return
    const def = slotDefinition(build(arg, typeChecker, location, depth + 1, ctx), `[${i}]`)
    if (flag & ts.ElementFlags.Optional) def.optional = true
    elements.push(def)
  })

  return rest ? { kind: 'tuple', syntax, elements, rest } : { kind: 'tuple', syntax, elements }
}
