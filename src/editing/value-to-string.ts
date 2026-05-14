import type { PropValue, ImportSpecifier } from '../types/prop-value.js'

export function valueToDisplayString(value: PropValue): string {
  if (value.displayValue !== undefined) return value.displayValue
  return valueToSourceText(value)
}

/** Convert a PropValue to TypeScript source text */
export function valueToSourceText(value: PropValue): string {
  switch (value.kind) {
    case 'primitive': {
      if (value.value === null) return 'null'
      if (value.value === undefined) return 'undefined'
      if (typeof value.value === 'string') return JSON.stringify(value.value)
      return String(value.value)
    }

    case 'template': {
      return '`' + value.value.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`'
    }

    case 'functionCall': {
      const args = value.args.map(valueToSourceText).join(', ')
      return `${value.callee}(${args})`
    }

    case 'lambda': {
      const params = value.parameters.join(', ')
      return `(${params}) => ${value.body}`
    }

    case 'object': {
      const entries = Object.entries(value.properties)
      if (entries.length === 0) return '{}'
      const props = entries.map(([k, v]) => `${k}: ${valueToSourceText(v)}`).join(', ')
      return `{ ${props} }`
    }

    case 'array':
    case 'tuple': {
      const els = value.elements.map(valueToSourceText).join(', ')
      return `[${els}]`
    }

    case 'raw':
      return value.sourceText
  }
}

/** Collect all ImportSpecifiers from a PropValue tree */
export function collectImports(value: PropValue): ImportSpecifier[] {
  const imports: ImportSpecifier[] = []

  function walk(v: PropValue) {
    if (v.kind === 'functionCall') {
      if (v.import) imports.push(v.import)
      v.args.forEach(walk)
    } else if (v.kind === 'object') {
      Object.values(v.properties).forEach(walk)
    } else if (v.kind === 'array' || v.kind === 'tuple') {
      v.elements.forEach(walk)
    }
  }

  walk(value)
  return imports
}
