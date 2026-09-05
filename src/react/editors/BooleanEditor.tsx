import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { controlStyle } from '../theme.js'

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
      style={className ? undefined : controlStyle}
    >
      <option value="true">true</option>
      <option value="false">false</option>
    </select>
  )
}
