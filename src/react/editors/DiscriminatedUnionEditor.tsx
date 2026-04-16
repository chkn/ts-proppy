import React from 'react'
import type { PropValue } from '../../types/prop-value.js'
import type { DiscriminatedUnionInfo } from '../../types/discriminated-union.js'
import type { EditorPlugin } from '../types.js'
import { ItemEditor } from '../ItemEditor.js'

interface DiscriminatedUnionEditorProps {
  discriminatedUnionInfo: DiscriminatedUnionInfo
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
}

export function DiscriminatedUnionEditor({
  discriminatedUnionInfo,
  value,
  onChange,
  plugins,
}: DiscriminatedUnionEditorProps) {
  const { discriminator, cases } = discriminatedUnionInfo

  const objProps: Record<string, PropValue> = value?.kind === 'object' ? value.properties : {}
  const currentDiscriminatorValue =
    objProps[discriminator]?.kind === 'primitive'
      ? String(objProps[discriminator].value)
      : cases[0]?.discriminatorValue ?? ''

  const currentCase = cases.find(c => String(c.discriminatorValue) === currentDiscriminatorValue)

  const handleDiscriminatorChange = (newValue: string) => {
    onChange({
      kind: 'object',
      properties: { [discriminator]: { kind: 'primitive', value: newValue } },
    })
  }

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
      <div>
        <label style={{ display: 'block', fontSize: '11px', marginBottom: '2px', fontWeight: 500, color: 'var(--proppy-text-primary, inherit)' }}>
          {discriminator} *
        </label>
        <select
          value={currentDiscriminatorValue}
          onChange={(e) => handleDiscriminatorChange(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 6px',
            background: 'var(--proppy-input-bg, #fff)',
            color: 'var(--proppy-input-color, inherit)',
            border: '1px solid var(--proppy-border, #ddd)',
            borderRadius: '3px',
            fontSize: '12px',
          }}
        >
          {cases.map(c => (
            <option key={String(c.discriminatorValue)} value={String(c.discriminatorValue)}>
              {String(c.discriminatorValue)}
            </option>
          ))}
        </select>
      </div>

      {currentCase && currentCase.properties.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid var(--proppy-border, #ddd)', margin: '4px 0' }} />
          {currentCase.properties.map(prop => (
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
        </>
      )}
    </div>
  )
}
