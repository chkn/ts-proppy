import { useState } from 'react'
import type { PropsEditorProps } from './types.js'
import type { PropValue } from '../types/prop-value.js'
import { isComplexPropType } from './complex-type.js'
import { ItemEditor } from './ItemEditor.js'
import { PropRow } from './PropRow.js'
import { RichEditor } from './RichEditor.js'
import { JsonFallbackEditor } from './editors/JsonFallbackEditor.js'
import { buttonStyle, colors } from './theme.js'
import { InterpolatablesContext } from './interpolatables-context.js'

export function PropsEditor({ props, onChange, plugins, disabled, interpolatables }: PropsEditorProps) {
  const [jsonMode, setJsonMode] = useState<Record<string, boolean>>({})

  const toggleJsonMode = (propName: string) => {
    setJsonMode(prev => ({ ...prev, [propName]: !prev[propName] }))
  }

  const { definitions, values } = props

  if (definitions.length === 0) {
    return <p style={{ fontSize: '12px', color: colors.textMuted }}>No props defined</p>
  }

  return (
    <InterpolatablesContext.Provider value={interpolatables}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {definitions.map(propDef => {
          const isComplex = isComplexPropType(propDef.type)
          const isJson = jsonMode[propDef.name]
          const currentValue = values?.[propDef.name]

          const editor = !isComplex ? (
            <ItemEditor
              propDef={propDef}
              value={currentValue}
              onChange={(value: PropValue) => onChange(propDef.name, value)}
              plugins={plugins}
              path={[propDef.name]}
              disabled={disabled}
            />
          ) : isJson ? (
            <JsonFallbackEditor
              propDef={propDef}
              value={currentValue}
              onChange={(value: PropValue) => onChange(propDef.name, value)}
              disabled={disabled}
            />
          ) : (
            <RichEditor
              propType={propDef.type}
              value={currentValue}
              onChange={(value: PropValue) => onChange(propDef.name, value)}
              plugins={plugins}
              path={[propDef.name]}
              disabled={disabled}
            />
          )

          return (
            <PropRow
              key={propDef.name}
              name={propDef.name}
              type={propDef.type}
              optional={propDef.optional}
              description={propDef.description}
              actions={
                isComplex && (
                  <button type="button" onClick={() => toggleJsonMode(propDef.name)} style={buttonStyle}>
                    {isJson ? 'Rich Editor' : 'JSON'}
                  </button>
                )
              }
            >
              {editor}
            </PropRow>
          )
        })}
      </div>
    </InterpolatablesContext.Provider>
  )
}
