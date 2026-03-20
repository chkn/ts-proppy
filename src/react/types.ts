import type { ExtractedProps } from '../types/extracted-props.js'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropType } from '../types/prop-type.js'
import type { PropValue } from '../types/prop-value.js'

export interface PropsEditorProps {
  props: ExtractedProps
  onChange: (name: string, value: PropValue) => void
  /** Custom editor plugins (checked before built-in editors) */
  plugins?: EditorPlugin[]
}

export interface ItemEditorProps {
  propDef: PropDefinition
  value: PropValue | undefined
  onChange: (value: PropValue) => void
}

export interface EditorPlugin {
  match: (propType: PropType) => boolean
  component: React.ComponentType<ItemEditorProps>
}
