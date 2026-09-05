import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { valueToSourceText } from '../../editing/value-to-string.js'
import { defaultPlaceholder } from '../default-placeholder.js'
import { controlStyle } from '../theme.js'

export function JsonFallbackEditor({ value, onChange, propDef, className }: ItemEditorProps) {
  const text = value ? valueToSourceText(value) : ''

  return (
    <textarea
      value={text}
      onChange={(e) => onChange({ kind: 'raw', sourceText: e.target.value })}
      placeholder={defaultPlaceholder(propDef)}
      className={className}
      data-proppy-editor="json-fallback"
      style={className ? undefined : {
        ...controlStyle,
        fontSize: 11,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        minHeight: 40,
        resize: 'vertical',
      }}
    />
  )
}
