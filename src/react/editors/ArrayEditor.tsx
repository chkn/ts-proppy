import React from 'react'
import type { PropValue } from '../../types/prop-value.js'
import type { PropType } from '../../types/prop-type.js'
import type { EditorPlugin } from '../types.js'
import { ItemEditor } from '../ItemEditor.js'

interface ArrayEditorProps {
  elementType: PropType
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
}

export function ArrayEditor({ elementType, value, onChange, plugins }: ArrayEditorProps) {
  const elements: PropValue[] = value?.kind === 'array' ? value.elements : []

  const addItem = () => {
    onChange({ kind: 'array', elements: [...elements, { kind: 'primitive', value: '' }] })
  }

  const removeItem = (index: number) => {
    onChange({ kind: 'array', elements: elements.filter((_, i) => i !== index) })
  }

  const updateItem = (index: number, newValue: PropValue) => {
    const newElements = [...elements]
    newElements[index] = newValue
    onChange({ kind: 'array', elements: newElements })
  }

  const elementPropDef = { name: '', type: elementType, optional: false }

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '4px',
      padding: '8px',
      background: '#fafafa',
    }}>
      <div style={{ marginBottom: '8px', fontSize: '11px', color: '#666' }}>
        Array of {elementType.syntax} ({elements.length} item{elements.length !== 1 ? 's' : ''})
      </div>
      {elements.map((item, index) => (
        <div key={index} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          <div style={{ flex: 1 }}>
            <ItemEditor
              propDef={elementPropDef}
              value={item}
              onChange={(newValue) => updateItem(index, newValue)}
              plugins={plugins}
            />
          </div>
          <button
            onClick={() => removeItem(index)}
            style={{
              padding: '4px 8px',
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        style={{
          width: '100%',
          padding: '6px',
          background: '#f0f0f0',
          border: '1px solid #ddd',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '12px',
          marginTop: '4px',
        }}
      >
        + Add Item
      </button>
    </div>
  )
}
