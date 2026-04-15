import type { PropValue } from '../types/prop-value.js'
import type { PropType } from '../types/prop-type.js'

/**
 * Materializes a `PropValue` into a concrete runtime value.
 *
 * @param value - The prop value to materialize.
 * @param scope - Optional map of named values available at materialization time.
 *   - **template**: `${key}` placeholders are replaced with the corresponding scope value.
 *   - **lambda**: scope keys are prepended as parameters and their values are pre-bound,
 *     so the returned function closes over the scope without requiring the caller to pass them.
 *   - **functionCall** (no `import`): the callee is resolved from scope and invoked.
 *   - All other kinds propagate scope recursively to nested values.
 * @returns The materialized value.
 */
export async function materializeValue(value: PropValue, scope?: Record<string, any>): Promise<any> {
  switch (value.kind) {
    case 'primitive':
      return value.value

    case 'template': {
      return value.value.replace(/\$\{(\w+)\}/g, (_, key) => {
        if (scope && key in scope) {
          return String(scope[key])
        } else {
          throw new Error(`Variable '${key}' not found in scope for template string`)
        }
      })
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
      let fn: Function
      let source: string
      if (!value.import) {
        fn = scope?.[value.callee]
        source = 'scope'
      } else {
        const mod = await import(/* @vite-ignore */ value.import.from)
        fn = value.import.isDefault ? mod.default : mod[value.import.name]
        source = value.import.from
      }
      if (typeof fn !== 'function') {
        throw new Error(`${value.import?.name ?? value.callee} from '${source}' is not a function`)
      }
      const args = await Promise.all(value.args.map(v => materializeValue(v, scope)))
      return fn(...args)
    }

    case 'raw': {
      throw new Error('Cannot materialize raw value');
    }
  }
}
