import type { PropType } from './prop-type.js'
import type { PropDefinition } from './prop-definition.js'

export interface DiscriminatedUnionCase {
  discriminatorValue: any
  properties: PropDefinition[]
}

export interface DiscriminatedUnionInfo {
  discriminator: string
  cases: DiscriminatedUnionCase[]
}

export function getDiscriminatedUnionInfo(propType: PropType): DiscriminatedUnionInfo | null {
  if (propType.kind !== 'union') return null

  // Check if all union members are objects
  const objectTypes = propType.types.filter((t): t is Extract<PropType, { kind: 'object' }> => t.kind === 'object')
  if (objectTypes.length !== propType.types.length) return null
  if (objectTypes.length < 2) return null

  // Find a property that is present in all members and has a constant value in each
  const firstProps = objectTypes[0].properties
  for (const prop of firstProps) {
    const isDiscriminator = objectTypes.every(obj => {
      const match = obj.properties.find(p => p.name === prop.name)
      return match && match.type.kind === 'constant'
    })

    if (isDiscriminator) {
      const cases: DiscriminatedUnionCase[] = objectTypes.map(obj => {
        const discriminatorProp = obj.properties.find(p => p.name === prop.name)!
        return {
          discriminatorValue: (discriminatorProp.type as Extract<PropType, { kind: 'constant' }>).value,
          properties: obj.properties.filter(p => p.name !== prop.name),
        }
      })

      return {
        discriminator: prop.name,
        cases,
      }
    }
  }

  return null
}
