import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { valueToSourceText } from '../../editing/value-to-string.js'
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
        background: 'var(--proppy-input-bg, #fff)',
        color: 'var(--proppy-input-color, inherit)',
        border: '1px solid var(--proppy-border, #ddd)',
        borderRadius: '3px',
        fontSize: '11px',
        fontFamily: 'monospace',
        minHeight: '40px',
        resize: 'vertical',
      }}
    />
  )
}
