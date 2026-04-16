import React from 'react'
import type { PropValue } from '../../types/prop-value.js'
import type { PropDefinition } from '../../types/prop-definition.js'
import type { EditorPlugin } from '../types.js'
import { ItemEditor } from '../ItemEditor.js'

interface ObjectEditorProps {
  properties: PropDefinition[]
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
}

export function ObjectEditor({ properties, value, onChange, plugins }: ObjectEditorProps) {
  const objProps: Record<string, PropValue> = value?.kind === 'object' ? { ...value.properties } : {}

  const updateField = (fieldName: string, fieldValue: PropValue) => {
    const newProps = { ...objProps, [fieldName]: fieldValue }
    onChange({ kind: 'object', properties: newProps })
  }

  return (
    <div style={{
      border: '1px solid var(--proppy-border, #ddd)',
      borderRadius: '4px',
      padding: '8px',
      background: 'var(--proppy-container-bg, #fafafa)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {properties.map(prop => (
        <div key={prop.name}>
          <label style={{ display: 'block', fontSize: '11px', marginBottom: '2px', fontWeight: 500, color: 'var(--proppy-text-primary, inherit)' }}>
            {prop.name}{prop.optional ? '' : ' *'}
            <span style={{ color: 'var(--proppy-text-muted, #999)', fontWeight: 'normal', marginLeft: '4px' }}>
              {prop.type.syntax}
            </span>
          </label>
          {prop.description && (
            <div style={{ fontSize: '10px', color: 'var(--proppy-text-secondary, #666)', marginBottom: '2px', fontStyle: 'italic' }}>
              {prop.description}
            </div>
          )}
          <ItemEditor
            propDef={prop}
            value={objProps[prop.name]}
            onChange={(newValue) => updateField(prop.name, newValue)}
            plugins={plugins}
          />
        </div>
      ))}
    </div>
  )
}
