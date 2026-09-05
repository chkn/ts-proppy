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

/**
 * Where a slot sits inside the value being edited, as the chain of keys that
 * reaches it from the top-level property: `['ctx', 'db']` for the `db` field of
 * a `ctx` prop, `['tags', '0']` for the first element of a `tags` array.
 *
 * Threaded through every nested editor so an {@link EditorPlugin} can key off
 * *which* slot it is looking at, not just what type the slot has.
 */
export type SlotPath = readonly string[]

export interface ItemEditorProps {
  propDef: PropDefinition
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  className?: string
  /** This slot's position in the value being edited. See {@link SlotPath}. */
  path?: SlotPath
}

export interface EditorPlugin {
  /**
   * Whether this plugin handles the slot. `path` locates the slot within the
   * value being edited, so a plugin can match one particular field rather than
   * every occurrence of a type.
   */
  match: (propType: PropType, path: SlotPath) => boolean
  component: React.ComponentType<ItemEditorProps>
}
