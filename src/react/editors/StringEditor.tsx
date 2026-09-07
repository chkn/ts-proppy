import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { defaultPlaceholder } from '../default-placeholder.js'
import { controlStyle } from '../theme.js'

export function StringEditor({ value, onChange, propDef, className, disabled }: ItemEditorProps) {
  const strValue = value?.kind === 'primitive' && typeof value.value === 'string' ? value.value : ''

  return (
    <textarea
      value={strValue}
      onChange={(e) => onChange({ kind: 'primitive', value: e.target.value })}
      placeholder={defaultPlaceholder(propDef)}
      className={className}
      rows={1}
      readOnly={disabled}
      style={className ? undefined : { ...controlStyle, resize: 'vertical' }}
    />
  )
}
