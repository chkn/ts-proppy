import React from 'react'
import type { ItemEditorProps } from '../types.js'
import type { PropType } from '../../types/prop-type.js'

function parseConstantUnion(propType: PropType): any[] {
  if (propType.kind !== 'union') return []
  return propType.types
    .filter((t): t is Extract<PropType, { kind: 'constant' }> => t.kind === 'constant')
    .map(t => t.value)
}

export function ConstantUnionEditor({ value, onChange, propDef }: ItemEditorProps) {
  const options = parseConstantUnion(propDef.type)
  const defaultStr = propDef.defaultValue?.kind === 'primitive' ? String(propDef.defaultValue.value) : ''
  const currentValue = value?.kind === 'primitive' ? String(value.value) : defaultStr

  return (
    <select
      value={currentValue || ''}
      onChange={(e) => onChange({ kind: 'primitive', value: e.target.value })}
      style={{
        width: '100%',
        padding: '4px 6px',
        border: '1px solid #ddd',
        borderRadius: '3px',
        fontSize: '12px',
      }}
    >
      {propDef.optional && <option value="">-- Select --</option>}
      {options.map((option: any) => (
        <option key={String(option)} value={String(option)}>{String(option)}</option>
      ))}
    </select>
  )
}
