import React from 'react'
import type { PropValue } from '../../types/prop-value.js'
import type { PropType } from '../../types/prop-type.js'
import type { EditorPlugin } from '../types.js'
import { ItemEditor } from '../ItemEditor.js'

interface TupleEditorProps {
  types: PropType[]
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
}

export function TupleEditor({ types, value, onChange, plugins }: TupleEditorProps) {
  const elements: PropValue[] = value?.kind === 'tuple' ? value.elements : []

  const updateItem = (index: number, newValue: PropValue) => {
    const newElements = [...elements]
    newElements[index] = newValue
    onChange({ kind: 'tuple', elements: newElements })
  }

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '4px',
      padding: '8px',
      background: '#fafafa',
    }}>
      <div style={{ marginBottom: '8px', fontSize: '11px', color: '#666' }}>
        Tuple [{types.map(t => t.syntax).join(', ')}]
      </div>
      {types.map((elementType, index) => {
        const elementPropDef = { name: `[${index}]`, type: elementType, optional: false }
        return (
          <div key={index} style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '11px', marginBottom: '2px', fontWeight: 500 }}>
              [{index}] {elementType.syntax}
            </label>
            <ItemEditor
              propDef={elementPropDef}
              value={elements[index]}
              onChange={(newValue) => updateItem(index, newValue)}
              plugins={plugins}
            />
          </div>
        )
      })}
    </div>
  )
}
