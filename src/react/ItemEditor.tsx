import React from 'react'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropValue } from '../types/prop-value.js'
import type { EditorPlugin, SlotPath } from './types.js'
import { getDiscriminatedUnionInfo } from '../types/discriminated-union.js'
import { getSelectableUnionInfo } from '../types/selectable-union.js'
import { StringEditor } from './editors/StringEditor.js'
import { NumberEditor } from './editors/NumberEditor.js'
import { BooleanEditor } from './editors/BooleanEditor.js'
import { ConstantUnionEditor } from './editors/ConstantUnionEditor.js'
import { DateEditor } from './editors/DateEditor.js'
import { FunctionEditor } from './editors/FunctionEditor.js'
import { JsonFallbackEditor } from './editors/JsonFallbackEditor.js'
import { ObjectEditor } from './editors/ObjectEditor.js'
import { ArrayEditor } from './editors/ArrayEditor.js'
import { TupleEditor } from './editors/TupleEditor.js'
import { DiscriminatedUnionEditor } from './editors/DiscriminatedUnionEditor.js'
import { UnionMemberEditor } from './editors/UnionMemberEditor.js'
import { TemplateEditor } from './editors/TemplateEditor.js'
import { OpaqueEditor } from './editors/OpaqueEditor.js'
import { RecordEditor } from './editors/RecordEditor.js'
import { CatalogEditor } from './editors/CatalogEditor.js'
import { ComboboxEditor } from './editors/ComboboxEditor.js'
import { getOpenStringUnionInfo } from '../types/open-string-union.js'
import { InterpolatablesContext, useInterpolatables } from './interpolatables-context.js'
import { ParameterMenu, ReferenceEditor } from './editors/ReferenceEditor.js'
import { defaultValueForType } from '../types/default-value.js'
import type { PropType } from '../types/prop-type.js'

/**
 * The JS primitive category a `primitive` {@link PropType} should be edited
 * as. Prefers the checker-derived `base` (set for branded/template-literal
 * types whose `syntax` isn't the bare keyword); falls back to `syntax` for
 * the syntax-tree extraction path, which already normalizes it to the
 * keyword itself.
 */
function primitiveBase(type: PropType): string | undefined {
  if (type.kind !== 'primitive') return undefined
  return type.base ?? type.syntax
}

interface ItemEditorInternalProps {
  propDef: PropDefinition
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
  className?: string
  /** This slot's position in the value being edited. See {@link SlotPath}. */
  path?: SlotPath
  /** See {@link ItemEditorProps.disabled}. */
  disabled?: boolean
}

const ROOT_PATH: SlotPath = []

export function ItemEditor(props: ItemEditorInternalProps) {
  const inherited = useInterpolatables()
  const own = props.propDef.interpolatables
  const interpolatables = own ?? inherited
  const propDef = interpolatables === own ? props.propDef : { ...props.propDef, interpolatables }
  const editor = <RoutedEditor {...props} propDef={propDef} />
  // A definition that declares its own interpolatables scopes them to
  // everything beneath it, however deep the container editors nest.
  return own && own !== inherited ? (
    <InterpolatablesContext.Provider value={own}>{editor}</InterpolatablesContext.Provider>
  ) : (
    editor
  )
}

/**
 * Whether a slot of `type` is offered a parameter reference beside its own
 * editor. Strings already take `${…}` in their template editor, and a number,
 * boolean or choice of constants is rarely worth one; structured slots are
 * where a whole value tends to come from a parameter.
 */
function offersReference(type: PropType): boolean {
  switch (type.kind) {
    case 'object':
    case 'record':
    case 'array':
    case 'tuple':
    case 'opaque':
      return true
    case 'union':
      // A union that takes text already takes `${…}` in its text editor.
      return !type.types.every(t => t.kind === 'constant') && !type.types.some(t => primitiveBase(t) === 'string')
    case 'primitive':
      return !['string', 'number', 'boolean'].includes(primitiveBase(type) ?? '') && type.syntax !== 'Date'
    default:
      return false
  }
}

function RoutedEditor(props: ItemEditorInternalProps) {
  const { value, onChange, propDef, disabled } = props
  const interpolatables = propDef.interpolatables

  if (value?.kind === 'reference') {
    return (
      <ReferenceEditor
        path={value.path}
        interpolatables={interpolatables ?? []}
        onChange={onChange}
        onClear={() => onChange(propDef.defaultValue ?? defaultValueForType(propDef.type))}
        disabled={disabled}
      />
    )
  }

  const editor = <SlotEditor {...props} />
  // A slot with catalogs has its own menu of values to choose from.
  if (!interpolatables?.length || propDef.catalogs?.length || !offersReference(propDef.type)) return editor
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>{editor}</div>
      <ParameterMenu interpolatables={interpolatables} onChange={onChange} disabled={disabled} />
    </div>
  )
}

function SlotEditor({ value, onChange, propDef, plugins, className, path = ROOT_PATH, disabled }: ItemEditorInternalProps) {
  const { type } = propDef

  // Check plugins first
  if (plugins) {
    for (const plugin of plugins) {
      if (plugin.match(type, path)) {
        const PluginComponent = plugin.component
        return <PluginComponent propDef={propDef} value={value} onChange={onChange} path={path} disabled={disabled} />
      }
    }
  }

  // Slots with catalogs: ready-made values and factories beside the slot's own editing
  if (propDef.catalogs?.length) {
    return <CatalogEditor propDef={propDef} value={value} onChange={onChange} plugins={plugins} className={className} path={path} disabled={disabled} />
  }

  // Template values, or string properties with interpolatables available
  if (value?.kind === 'template' || (primitiveBase(type) === 'string' && propDef.interpolatables?.length)) {
    return <TemplateEditor propDef={propDef} value={value} onChange={onChange} className={className} disabled={disabled} />
  }

  // Function types
  if (type.kind === 'function') {
    return <FunctionEditor propDef={propDef} value={value} onChange={onChange} disabled={disabled} />
  }

  // Array types
  if (type.kind === 'array') {
    return <ArrayEditor element={type.element} value={value} onChange={onChange} plugins={plugins} path={path} disabled={disabled} />
  }

  // Tuple types
  if (type.kind === 'tuple') {
    return <TupleEditor elements={type.elements} rest={type.rest} value={value} onChange={onChange} plugins={plugins} path={path} disabled={disabled} />
  }

  // Records: keys chosen by the user
  if (type.kind === 'record') {
    return <RecordEditor value={type.value} current={value} onChange={onChange} plugins={plugins} path={path} disabled={disabled} />
  }

  // Open string unions: free text, with the known values as suggestions
  const openUnion = getOpenStringUnionInfo(type)
  if (openUnion) {
    return <ComboboxEditor propDef={propDef} unionInfo={openUnion} value={value} onChange={onChange} className={className} disabled={disabled} />
  }

  // Discriminated unions
  const discriminatedUnionInfo = getDiscriminatedUnionInfo(type)
  if (discriminatedUnionInfo) {
    return (
      <DiscriminatedUnionEditor
        discriminatedUnionInfo={discriminatedUnionInfo}
        value={value}
        onChange={onChange}
        plugins={plugins}
        path={path}
        disabled={disabled}
      />
    )
  }

  // Constant unions (dropdown)
  if (type.kind === 'union' && type.types.every(t => t.kind === 'constant')) {
    return <ConstantUnionEditor propDef={propDef} value={value} onChange={onChange} className={className} disabled={disabled} />
  }

  // Any other union: a dropdown over its members, plus the selected member's editor
  const unionInfo = getSelectableUnionInfo(type)
  if (unionInfo) {
    return (
      <UnionMemberEditor
        propDef={propDef}
        unionInfo={unionInfo}
        value={value}
        onChange={onChange}
        plugins={plugins}
        className={className}
        path={path}
        disabled={disabled}
      />
    )
  }

  // Date type
  if (type.syntax === 'Date') {
    return <DateEditor propDef={propDef} value={value} onChange={onChange} disabled={disabled} />
  }

  // String primitive
  if (primitiveBase(type) === 'string') {
    return <StringEditor propDef={propDef} value={value} onChange={onChange} className={className} disabled={disabled} />
  }

  // Number primitive
  if (primitiveBase(type) === 'number') {
    return <NumberEditor propDef={propDef} value={value} onChange={onChange} className={className} disabled={disabled} />
  }

  // Boolean primitive
  if (primitiveBase(type) === 'boolean') {
    return <BooleanEditor propDef={propDef} value={value} onChange={onChange} className={className} disabled={disabled} />
  }

  // Types no form can build a value of. Routed before the JSON fallback: a raw
  // textarea over a database handle only invites input that can never be right.
  if (type.kind === 'opaque') {
    return <OpaqueEditor propDef={propDef} value={value} onChange={onChange} className={className} path={path} />
  }

  // Object types with known properties
  if (type.kind === 'object' && type.properties.length > 0) {
    return <ObjectEditor properties={type.properties} value={value} onChange={onChange} plugins={plugins} path={path} disabled={disabled} />
  }

  // Fallback
  return <JsonFallbackEditor propDef={propDef} value={value} onChange={onChange} className={className} disabled={disabled} />
}
