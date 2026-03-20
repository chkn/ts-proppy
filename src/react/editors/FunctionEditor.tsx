import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { defaultPlaceholder } from '../default-placeholder.js'

export function FunctionEditor({ value, onChange, propDef }: ItemEditorProps) {
  const parameters = propDef.type.kind === 'function' ? propDef.type.parameters : []
  const paramSignature = parameters.map(p =>
    `${p.name}${p.optional ? '?' : ''}: ${p.type.syntax}`
  ).join(', ')

  const body = value?.kind === 'lambda' ? value.body : ''
  const placeholder = defaultPlaceholder(propDef) || 'Enter function body (without braces)'

  return (
    <div>
      <div style={{
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#666',
        marginBottom: '4px',
        padding: '4px 8px',
        background: '#f5f5f5',
        borderRadius: '3px',
        border: '1px solid #e0e0e0',
      }}>
        ({paramSignature}) =&gt;
      </div>
      <textarea
        value={body}
        onChange={(e) => onChange({
          kind: 'lambda',
          parameters: parameters.map(p => p.name),
          body: e.target.value,
        })}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '6px 8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          boxSizing: 'border-box',
          minHeight: '60px',
          resize: 'vertical',
        }}
      />
    </div>
  )
}
