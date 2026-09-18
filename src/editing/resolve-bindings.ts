import ts from 'typescript'
import type { CalleeBinding, PropValue } from '../types/prop-value.js'

type FunctionCallValue = Extract<PropValue, { kind: 'functionCall' }>

/**
 * A place to introduce a destructured callee for a `parameter` binding: either
 * an existing object binding pattern to augment, or a factory whose empty
 * parameter list needs a destructure created at `paramOpenParen` (the offset of
 * its `(`).
 */
type DestructureTarget =
  | { pattern: ts.ObjectBindingPattern; paramOpenParen?: undefined }
  | { pattern?: undefined; paramOpenParen: number }

/**
 * Resolve every call's binding candidates against the file `value` is about to
 * be written into.
 *
 * For each `functionCall` whose `binding` is a list, the candidates are tried
 * in order and the first that fits the file wins:
 *
 * - A `parameter` candidate fits when the file contains its `enclosingCall`
 *   (e.g. `prompts(({ openai }) => …)`) with a destructured first parameter, or
 *   no parameter at all yet. The callee is added to that destructure (creating
 *   it if needed) and the call's binding is dropped: it reads its callee from
 *   the closure rather than from an import.
 * - An `import` candidate always fits, and becomes the call's single binding,
 *   so writing the value adds the import.
 *
 * A single (already resolved) binding is left as it is. Calls nested anywhere
 * in `value` are resolved too.
 *
 * @returns The source with any destructures augmented — so spans taken from
 *   the original source may have shifted — and the value with every binding
 *   resolved, ready for `updateProperty`/`addProperty`.
 */
export function resolveBindings(
  sourceCode: string,
  value: PropValue,
  fileName = 'source.ts'
): { sourceCode: string; value: PropValue } {
  const sourceFile = ts.createSourceFile(fileName, sourceCode, ts.ScriptTarget.Latest, true)

  // Per-target set of callee names to introduce. A target is either an
  // existing destructure to augment or a factory whose (empty) parameter list
  // needs a fresh destructure created.
  const targetAdditions = new Map<DestructureTarget, Set<string>>()
  // Keyed by the call node's identity so two candidates naming the same
  // enclosing call share one target.
  const targets = new Map<string, DestructureTarget | null>()

  const destructureFor = (candidate: Extract<CalleeBinding, { kind: 'parameter' }>) => {
    const key = JSON.stringify(candidate.enclosingCall ?? null)
    if (!targets.has(key)) targets.set(key, findEnclosingCallDestructure(sourceFile, candidate.enclosingCall))
    return targets.get(key)!
  }

  const adjusted = mapFunctionCalls(value, call => {
    if (!Array.isArray(call.binding)) return call
    for (const candidate of call.binding) {
      if (candidate.kind === 'parameter') {
        const target = destructureFor(candidate)
        if (!target) continue
        const names = targetAdditions.get(target) ?? new Set<string>()
        names.add(call.callee)
        targetAdditions.set(target, names)
        const { binding: _drop, ...rest } = call
        return rest
      }
      return { ...call, binding: candidate }
    }
    const { binding: _none, ...rest } = call
    return rest
  })

  // Build the textual edits, then apply them from latest position to earliest
  // so earlier offsets remain valid through the edits.
  const edits = [...targetAdditions.entries()]
    .map(([target, names]) => {
      const existing = new Set<string>()
      for (const el of target.pattern?.elements ?? []) {
        if (ts.isIdentifier(el.name)) existing.add(el.name.text)
      }
      const toAdd = [...names].filter(n => !existing.has(n))
      if (toAdd.length === 0) return null

      if (target.pattern) {
        const pattern = target.pattern
        const isEmpty = pattern.elements.length === 0
        return {
          end: pattern.getEnd(),
          apply: (src: string) => {
            let offset = pattern.getEnd() - 1 // position of `}`
            while (src[offset - 1] === ' ') offset--
            const insertion = (isEmpty ? ' ' : ', ') + toAdd.join(', ') + (isEmpty ? ' ' : '')
            return src.slice(0, offset) + insertion + src.slice(offset)
          },
        }
      }

      // Turn `() => …` into `({ a, b }) => …`.
      const openParen = target.paramOpenParen
      return {
        end: openParen + 1,
        apply: (src: string) => src.slice(0, openParen + 1) + `{ ${toAdd.join(', ')} }` + src.slice(openParen + 1),
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => b.end - a.end)

  let nextSource = sourceCode
  for (const edit of edits) nextSource = edit.apply(nextSource)

  return { sourceCode: nextSource, value: adjusted }
}

/**
 * Find where to bind a callee against the destructured first parameter of a
 * call matching `enclosingCall`.
 *
 * Returns the existing object binding pattern when the factory already
 * destructures its first parameter, or — when the factory takes no parameters
 * yet (a freshly created `() => …` skeleton) — a target describing where to
 * create one. Returns null when no matching call exists, or when its first
 * parameter is present but isn't an object binding pattern.
 *
 * When `enclosingCall.import` is given, the file must import the callee from
 * there.
 */
function findEnclosingCallDestructure(
  sourceFile: ts.SourceFile,
  enclosingCall?: { callee: string; import?: { name: string; from: string } }
): DestructureTarget | null {
  if (!enclosingCall) return null
  if (enclosingCall.import && !hasNamedImport(sourceFile, enclosingCall.import.name, enclosingCall.import.from)) {
    return null
  }

  let found: DestructureTarget | null = null
  const visit = (node: ts.Node): void => {
    if (found) return
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === enclosingCall.callee) {
      // The factory is the first function argument — it may follow a leading
      // options argument (`prompts({ id }, factory)`).
      const factory = node.arguments.find(
        (arg): arg is ts.ArrowFunction | ts.FunctionExpression => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)
      )
      if (factory) {
        const param = factory.parameters[0]
        if (param && ts.isObjectBindingPattern(param.name)) {
          found = { pattern: param.name }
          return
        }
        if (!param) {
          const openParen = sourceFile.text.indexOf('(', factory.getStart(sourceFile))
          if (openParen >= 0) {
            found = { paramOpenParen: openParen }
            return
          }
        }
        // A non-destructure parameter (`(providers) => …`) isn't a target —
        // fall through so an `import` candidate can match instead.
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

function hasNamedImport(sourceFile: ts.SourceFile, name: string, from: string): boolean {
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue
    if (stmt.moduleSpecifier.text !== from) continue
    const bindings = stmt.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings) && bindings.elements.some(el => el.name.text === name)) return true
  }
  return false
}

/** `value` with every function call, at any depth, transformed by `fn` (innermost first). */
function mapFunctionCalls(value: PropValue, fn: (call: FunctionCallValue) => FunctionCallValue): PropValue {
  switch (value.kind) {
    case 'functionCall':
      return fn({ ...value, args: value.args.map(a => mapFunctionCalls(a, fn)) })
    case 'object':
      return {
        ...value,
        properties: Object.fromEntries(Object.entries(value.properties).map(([k, v]) => [k, mapFunctionCalls(v, fn)])),
      }
    case 'array':
    case 'tuple':
      return { ...value, elements: value.elements.map(el => mapFunctionCalls(el, fn)) }
    default:
      return value
  }
}
