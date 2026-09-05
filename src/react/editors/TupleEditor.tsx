import type { PropValue } from '../../types/prop-value.js'
import type { PropType } from '../../types/prop-type.js'
import type { EditorPlugin, SlotPath } from '../types.js'
import { ItemEditor } from '../ItemEditor.js'
import { PropRow } from '../PropRow.js'
import { nestedGroupStyle } from '../theme.js'

interface TupleEditorProps {
  types: PropType[]
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
  path?: SlotPath
}

export function TupleEditor({ types, value, onChange, plugins, path = [] }: TupleEditorProps) {
  const elements: PropValue[] = value?.kind === 'tuple' ? value.elements : []

  const updateItem = (index: number, newValue: PropValue) => {
    const newElements = [...elements]
    newElements[index] = newValue
    onChange({ kind: 'tuple', elements: newElements })
  }

  return (
    <div style={nestedGroupStyle}>
      {types.map((elementType, index) => {
        const elementPropDef = { name: `[${index}]`, type: elementType, optional: false }
        return (
          <PropRow key={index} name={`[${index}]`} type={elementType} optional={false}>
            <ItemEditor
              propDef={elementPropDef}
              value={elements[index]}
              onChange={newValue => updateItem(index, newValue)}
              plugins={plugins}
              path={[...path, String(index)]}
            />
          </PropRow>
        )
      })}
    </div>
  )
}
