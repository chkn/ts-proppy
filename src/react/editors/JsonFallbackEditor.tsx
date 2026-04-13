import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { valueToSourceText } from '../../editing/value-to-source.js'
import { defaultPlaceholder } from '../default-placeholder.js'

export function JsonFallbackEditor({ value, onChange, propDef, className }: ItemEditorProps) {
  const text = value ? valueToSourceText(value) : ''

  return (
    <textarea
      value={text}
      onChange={(e) => onChange({ kind: 'raw', sourceText: e.target.value })}
      placeholder={defaultPlaceholder(propDef)}
      className={className}
      style={className ? undefined : {
        width: '100%',
        padding: '4px 6px',
        border: '1px solid #ddd',
        borderRadius: '3px',
        fontSize: '11px',
        fontFamily: 'monospace',
        minHeight: '40px',
        resize: 'vertical',
      }}
    />
  )
}
