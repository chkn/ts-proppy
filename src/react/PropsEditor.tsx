import React, { useState } from 'react'
import type { PropsEditorProps } from './types.js'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropValue } from '../types/prop-value.js'
import { ItemEditor } from './ItemEditor.js'
import { RichEditor } from './RichEditor.js'
import { JsonFallbackEditor } from './editors/JsonFallbackEditor.js'
import { valueToSourceText } from '../react.js'

function isComplexType(propDef: PropDefinition): boolean {
  const { type } = propDef
  // Constant unions get a dropdown, not complex
  if (type.kind === 'union' && type.types.every(t => t.kind === 'constant')) return false
  // Functions get a special editor, not complex
  if (type.kind === 'function') return false
  // Objects, arrays, tuples, and other unions are complex
  return type.kind === 'object' || type.kind === 'union' || type.kind === 'array' || type.kind === 'tuple'
}

export function PropsEditor({ props, onChange, plugins }: PropsEditorProps) {
  const [jsonMode, setJsonMode] = useState<Record<string, boolean>>({})

  const toggleJsonMode = (propName: string) => {
    setJsonMode(prev => ({ ...prev, [propName]: !prev[propName] }))
  }

  const { definitions, values } = props

  const renderPropEditor = (propDef: PropDefinition) => {
    const isComplex = isComplexType(propDef)
    const isJson = jsonMode[propDef.name]
    const currentValue = values?.[propDef.name]

    if (!isComplex) {
      return (
        <ItemEditor
          propDef={propDef}
          value={currentValue}
          onChange={(value: PropValue) => onChange(propDef.name, value)}
          plugins={plugins}
        />
      )
    }

    if (isJson) {
      return (
        <JsonFallbackEditor
          propDef={propDef}
          value={currentValue}
          onChange={(value: PropValue) => onChange(propDef.name, value)}
        />
      )
    }

    return (
      <RichEditor
        propType={propDef.type}
        value={currentValue}
        onChange={(value: PropValue) => onChange(propDef.name, value)}
        plugins={plugins}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {definitions.length > 0 ? definitions.map(propDef => {
        const isComplex = isComplexType(propDef)
        const isJson = jsonMode[propDef.name]

        return (
          <div key={propDef.name}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
              flexWrap: 'wrap',
              gap: '4px',
            }}>
              <label style={{ fontSize: '12px', fontWeight: 500 }}>
                {propDef.name}{propDef.optional ? '' : ' *'}
                <span style={{ color: '#999', fontWeight: 'normal', marginLeft: '4px' }}>
                  {propDef.type.syntax}
                </span>
              </label>
              {isComplex && (
                <button
                  onClick={() => toggleJsonMode(propDef.name)}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: '#f5f5f5',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  {isJson ? 'Rich Editor' : 'JSON'}
                </button>
              )}
            </div>
            {propDef.description && (
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px', fontStyle: 'italic' }}>
                {propDef.description}
              </div>
            )}
            {propDef.defaultValue && !values?.[propDef.name] && (
              <div style={{ fontSize: '10px', color: '#999', marginBottom: '4px' }}>
                Default: {valueToSourceText(propDef.defaultValue)}
              </div>
            )}
            {renderPropEditor(propDef)}
          </div>
        )
      }) : (
        <p style={{ fontSize: '12px', color: '#999' }}>No props defined</p>
      )}
    </div>
  )
}
