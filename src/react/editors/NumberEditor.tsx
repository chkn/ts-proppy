import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { defaultPlaceholder } from '../default-placeholder.js'

export function NumberEditor({ value, onChange, propDef }: ItemEditorProps) {
  const numValue = value?.kind === 'primitive' && typeof value.value === 'number' ? value.value : ''

  return (
    <input
      type="number"
      value={numValue ?? ''}
      onChange={(e) => {
        const val = e.target.value
        if (val === '' && propDef.optional) {
          onChange({ kind: 'primitive', value: undefined })
        } else {
          onChange({ kind: 'primitive', value: val === '' ? 0 : Number(val) })
        }
      }}
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
