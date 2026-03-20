import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { defaultPlaceholder } from '../default-placeholder.js'

export function DateEditor({ value, onChange, propDef }: ItemEditorProps) {
  const strValue = value?.kind === 'primitive' && typeof value.value === 'string' ? value.value : ''

  return (
    <input
      type="datetime-local"
      value={strValue}
      onChange={(e) => onChange({ kind: 'primitive', value: e.target.value })}
      placeholder={defaultPlaceholder(propDef)}
      style={{
        width: '100%',
        padding: '4px 6px',
        border: '1px solid #ddd',
        borderRadius: '3px',
        fontSize: '12px',
      }}
    />
  )
}
