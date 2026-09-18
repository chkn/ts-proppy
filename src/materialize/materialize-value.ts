import type { PropValue } from '../types/prop-value.js'
import { parseInterpolationPath } from '../editing/interpolation.js'

/**
 * Materializes a `PropValue` into a concrete runtime value.
 *
 * @param value - The prop value to materialize.
 * @param scope - Optional map of named values available at materialization time.
 *   - **template**: `${expr}` tokens are replaced with the corresponding scope value;
 *     dotted/bracket member access (e.g. `config.host`) is walked through nested objects.
 *   - **lambda**: scope keys are prepended as parameters and their values are pre-bound,
 *     so the returned function closes over the scope without requiring the caller to pass them.
 *   - **functionCall** (no import binding): the callee is resolved from scope and invoked.
 *   - All other kinds propagate scope recursively to nested values.
 * @returns The materialized value.
 */
export async function materializeValue(value: PropValue, scope?: Record<string, any>): Promise<any> {
  switch (value.kind) {
    case 'primitive':
      return value.value

    case 'template': {
      let out = ''
      for (const seg of value.value) {
        if (typeof seg === 'string') {
          out += seg
          continue
        }
        const resolved = resolveTokenInScope(seg.expr, scope)
        if (!resolved.found) {
          throw new Error(`Variable '${seg.expr}' not found in scope for template string`)
        }
        out += String(resolved.value)
      }
      return out
    }

    case 'object': {
      const entries = await Promise.all(
        Object.entries(value.properties).map(async ([k, v]) => [k, await materializeValue(v, scope)] as const)
      )
      return Object.fromEntries(entries)
    }

    case 'array':
    case 'tuple':
      return Promise.all(value.elements.map(v => materializeValue(v, scope)))

    case 'lambda': {
      if (!scope) return new Function(...value.parameters, value.body)
      const scopeKeys = Object.keys(scope)
      const scopeValues = Object.values(scope)
      const fn = new Function(...scopeKeys, ...value.parameters, value.body)
      return fn.bind(null, ...scopeValues)
    }

    case 'functionCall': {
      // Unresolved candidates: the first import among them is the one a file
      // without a matching destructure would get.
      const binding = Array.isArray(value.binding)
        ? value.binding.find(b => b.kind === 'import')
        : value.binding
      const spec = binding?.kind === 'import' ? binding.spec : undefined
      let fn: Function
      let source: string
      if (!spec) {
        fn = scope?.[value.callee]
        source = 'scope'
      } else {
        const mod = await import(/* @vite-ignore */ spec.from)
        fn = spec.isDefault ? mod.default : mod[spec.name]
        source = spec.from
      }
      if (typeof fn !== 'function') {
        throw new Error(`${spec?.name ?? value.callee} from '${source}' is not a function`)
      }
      const args = await Promise.all(value.args.map(v => materializeValue(v, scope)))
      return fn(...args)
    }

    case 'reference': {
      const [root, ...rest] = value.path
      if (!scope || !(root in scope)) throw new Error(`'${root}' not found in scope`)
      let cur: unknown = scope[root]
      for (const key of rest) {
        if (cur == null || typeof cur !== 'object' || !(key in cur)) {
          throw new Error(`'${value.path.join('.')}' not found in scope`)
        }
        cur = (cur as Record<string, unknown>)[key]
      }
      return cur
    }

    case 'raw': {
      throw new Error(`Cannot materialize raw value: ${value.sourceText}`)
    }
  }
}

/**
 * Resolve a template token's expression against the scope. A bare key matches
 * directly; otherwise a plain member-access chain (`config.host`,
 * `config['host']`) is walked through nested objects. Expressions that aren't
 * member access (e.g. calls) don't resolve.
 */
function resolveTokenInScope(
  expr: string,
  scope: Record<string, any> | undefined
): { found: boolean; value?: unknown } {
  if (!scope) return { found: false }
  if (expr in scope) return { found: true, value: scope[expr] }

  const path = parseInterpolationPath(expr)
  if (!path) return { found: false }

  let cur: unknown = scope
  for (const key of path) {
    if (cur == null || typeof cur !== 'object' || !(key in cur)) return { found: false }
    cur = (cur as Record<string, unknown>)[key]
  }
  return { found: true, value: cur }
}
