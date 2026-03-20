import type { PropValue } from '../types/prop-value.js'
import type { PropType } from '../types/prop-type.js'

export async function materializeValue(value: PropValue): Promise<any> {
  switch (value.kind) {
    case 'primitive':
      return value.value

    case 'object': {
      const entries = await Promise.all(
        Object.entries(value.properties).map(async ([k, v]) => [k, await materializeValue(v)] as const)
      )
      return Object.fromEntries(entries)
    }

    case 'array':
    case 'tuple':
      return Promise.all(value.elements.map(materializeValue))

    case 'lambda':
      return new Function(...value.parameters, value.body)

    case 'functionCall': {
      const mod = await import(value.import.from)
      const fn = value.import.isDefault ? mod.default : mod[value.import.name]
      if (typeof fn !== 'function') {
        throw new Error(`${value.import.name} from '${value.import.from}' is not a function`)
      }
      const args = await Promise.all(value.args.map(materializeValue))
      return fn(...args)
    }

    case 'raw': {
      throw new Error('Cannot materialize raw value');
    }
  }
}
