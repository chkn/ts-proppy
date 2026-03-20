import React from 'react'
import type { ItemEditorProps } from '../types.js'

export function BooleanEditor({ value, onChange }: ItemEditorProps) {
  const boolValue = value?.kind === 'primitive' && typeof value.value === 'boolean' ? value.value : false

  return (
    <select
      value={boolValue ? 'true' : 'false'}
      onChange={(e) => onChange({ kind: 'primitive', value: e.target.value === 'true' })}
      style={{
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
