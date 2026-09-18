import type { PropDefinition } from '../../types/prop-definition.js'
import type { PropValue } from '../../types/prop-value.js'
import { defaultValueForType } from '../../types/default-value.js'
import { canRemoveTupleElement, listElements } from '../../types/record-entries.js'
import { ItemEditor } from '../ItemEditor.js'
import { PropRow } from '../PropRow.js'
import { buttonStyle, colors, nestedGroupStyle, radius } from '../theme.js'
import type { EditorPlugin, SlotPath } from '../types.js'

interface TupleEditorProps {
  /** One definition per fixed position. */
  elements: PropDefinition[]
  /** For a variadic tuple, the definition of every element past the fixed ones. */
  rest?: PropDefinition
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
  path?: SlotPath
  disabled?: boolean
}

/**
 * A tuple's fixed elements, one {@link PropRow} each, then — for a variadic
 * tuple — any number of rest elements that can be appended and removed. The
 * fixed elements themselves can never be removed.
 *
 * A tuple literal in source parses as an `array` value, so either kind is read
 * and the kind it arrived as is kept.
 */
export function TupleEditor({ elements: defs, rest, value, onChange, plugins, path = [], disabled }: TupleEditorProps) {
  const elements = listElements(value)
  const kind = value?.kind === 'tuple' ? 'tuple' : 'array'
  const emit = (next: PropValue[]) => onChange({ kind, elements: next })

  const updateItem = (index: number, newValue: PropValue) => {
    const next = [...elements]
    // Fill any gap below `index` so positions stay aligned with their types.
    for (let i = next.length; i < index; i++) {
      const def = defs[i] ?? rest
      next[i] = def ? defaultValueForType(def.type) : { kind: 'primitive', value: null }
    }
    next[index] = newValue
    emit(next)
  }

  const count = rest ? Math.max(elements.length, defs.length) : defs.length

  return (
    <div style={nestedGroupStyle}>
      {Array.from({ length: count }, (_, index) => {
        const def = defs[index] ?? rest!
        const name = index < defs.length ? def.name || `[${index}]` : `[${index}]`
        const removable = !!rest && canRemoveTupleElement(index, defs.length)
        return (
          <PropRow
            key={index}
            name={name}
            type={def.type}
            optional={def.optional}
            description={def.description}
            actions={
              removable && (
                <button
                  type="button"
                  onClick={() => emit(elements.filter((_, i) => i !== index))}
                  aria-label={`Remove item ${index + 1}`}
                  disabled={disabled}
                  style={{
                    ...buttonStyle,
                    background: colors.dangerBg,
                    color: colors.dangerColor,
                    borderColor: colors.dangerBorder,
                  }}
                >
                  ✕
                </button>
              )
            }
          >
            <ItemEditor
              propDef={{ ...def, name }}
              value={elements[index]}
              onChange={newValue => updateItem(index, newValue)}
              plugins={plugins}
              path={[...path, String(index)]}
              disabled={disabled}
            />
          </PropRow>
        )
      })}
      {rest && (
        <button
          type="button"
          onClick={() => updateItem(count, rest.defaultValue ?? defaultValueForType(rest.type))}
          disabled={disabled}
          style={{ ...buttonStyle, width: '100%', padding: '6px', borderStyle: 'dashed', borderRadius: radius.sm }}
        >
          + Add item
        </button>
      )}
    </div>
  )
}
