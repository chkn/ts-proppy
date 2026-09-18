import React from 'react'
import type { ItemEditorProps } from '../types.js'
import { defaultPlaceholder } from '../default-placeholder.js'
import { colors, controlStyle, monoFont, radius } from '../theme.js'

export function FunctionEditor({ value, onChange, propDef, disabled }: ItemEditorProps) {
  const parameters = propDef.type.kind === 'function' ? propDef.type.parameters : []
  const paramSignature = parameters.map(p =>
    `${p.name}${p.optional ? '?' : ''}: ${p.type.syntax}`
  ).join(', ')

  const body = value?.kind === 'lambda' ? value.body : ''
  const placeholder = defaultPlaceholder(propDef) || 'Enter function body (without braces)'

  return (
    <div>
      <div style={{
        fontSize: 11,
        fontFamily: monoFont,
        color: colors.textSecondary,
        marginBottom: 4,
        padding: '4px 8px',
        background: colors.buttonBg,
        borderRadius: radius.sm,
        border: `1px solid ${colors.border}`,
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
        readOnly={disabled}
        style={{
          ...controlStyle,
          padding: '6px 8px',
          borderRadius: radius.md,
          fontFamily: monoFont,
          minHeight: 60,
          resize: 'vertical',
        }}
      />
    </div>
  )
}
