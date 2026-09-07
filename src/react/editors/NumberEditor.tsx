import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { defaultPlaceholder } from '../default-placeholder.js'
import { controlStyle } from '../theme.js'

export function NumberEditor({ value, onChange, propDef, className, disabled }: ItemEditorProps) {
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
      className={className}
      readOnly={disabled}
      style={className ? undefined : controlStyle}
    />
  )
}
