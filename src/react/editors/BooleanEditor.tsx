import React from 'react'
import type { ItemEditorProps } from '../types.js'

export function BooleanEditor({ value, onChange, propDef, className }: ItemEditorProps) {
  const defaultBool = propDef.defaultValue?.kind === 'primitive' && typeof propDef.defaultValue.value === 'boolean'
    ? propDef.defaultValue.value
    : false
  const boolValue = value?.kind === 'primitive' && typeof value.value === 'boolean' ? value.value : defaultBool

  return (
    <select
      value={boolValue ? 'true' : 'false'}
      onChange={(e) => onChange({ kind: 'primitive', value: e.target.value === 'true' })}
      className={className}
      style={className ? undefined : {
        width: '100%',
        padding: '4px 6px',
        border: '1px solid #ddd',
        borderRadius: '3px',
        fontSize: '12px',
      }}
    >
      <option value="true">true</option>
      <option value="false">false</option>
    </select>
  )
}
