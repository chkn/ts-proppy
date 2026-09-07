import type { PropValue } from '../../types/prop-value.js'
import type { DiscriminatedUnionInfo } from '../../types/discriminated-union.js'
import type { EditorPlugin, SlotPath } from '../types.js'
import { ItemEditor } from '../ItemEditor.js'
import { PropRow } from '../PropRow.js'
import { colors, controlStyle, nestedGroupStyle } from '../theme.js'

interface DiscriminatedUnionEditorProps {
  discriminatedUnionInfo: DiscriminatedUnionInfo
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
  path?: SlotPath
  disabled?: boolean
}

export function DiscriminatedUnionEditor({
  discriminatedUnionInfo,
  value,
  onChange,
  plugins,
  path = [],
  disabled,
}: DiscriminatedUnionEditorProps) {
  const { discriminator, cases } = discriminatedUnionInfo

  const objProps: Record<string, PropValue> = value?.kind === 'object' ? value.properties : {}
  const currentDiscriminatorValue =
    objProps[discriminator]?.kind === 'primitive'
      ? String(objProps[discriminator].value)
      : (cases[0]?.discriminatorValue ?? '')

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
    <div style={nestedGroupStyle}>
      <div>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500, color: colors.textPrimary }}>
          {discriminator} *
        </label>
        <select
          value={currentDiscriminatorValue}
          onChange={e => handleDiscriminatorChange(e.target.value)}
          style={controlStyle}
          disabled={disabled}
        >
          {cases.map(c => (
            <option key={String(c.discriminatorValue)} value={String(c.discriminatorValue)}>
              {String(c.discriminatorValue)}
            </option>
          ))}
        </select>
      </div>

      {currentCase &&
        currentCase.properties.length > 0 &&
        currentCase.properties.map(prop => (
          <PropRow key={prop.name} name={prop.name} type={prop.type} optional={prop.optional} description={prop.description}>
            <ItemEditor
              propDef={prop}
              value={objProps[prop.name]}
              onChange={newValue => updateField(prop.name, newValue)}
              plugins={plugins}
              path={[...path, prop.name]}
              disabled={disabled}
            />
          </PropRow>
        ))}
    </div>
  )
}
