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
}

const ROOT_PATH: SlotPath = []

export function ItemEditor({ value, onChange, propDef, plugins, className, path = ROOT_PATH }: ItemEditorInternalProps) {
  const { type } = propDef

  // Check plugins first
  if (plugins) {
    for (const plugin of plugins) {
      if (plugin.match(type, path)) {
        const PluginComponent = plugin.component
        return <PluginComponent propDef={propDef} value={value} onChange={onChange} path={path} />
      }
    }
  }

  // Template values, or string properties with interpolatables available
  if (value?.kind === 'template' || (primitiveBase(type) === 'string' && propDef.interpolatables?.length)) {
    return <TemplateEditor propDef={propDef} value={value} onChange={onChange} className={className} />
  }

  // Function types
  if (type.kind === 'function') {
    return <FunctionEditor propDef={propDef} value={value} onChange={onChange} />
  }

  // Array types
  if (type.kind === 'array') {
    return <ArrayEditor elementType={type.elementType} value={value} onChange={onChange} plugins={plugins} path={path} />
  }

  // Tuple types
  if (type.kind === 'tuple') {
    return <TupleEditor types={type.types} value={value} onChange={onChange} plugins={plugins} path={path} />
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
      />
    )
  }

  // Constant unions (dropdown)
  if (type.kind === 'union' && type.types.every(t => t.kind === 'constant')) {
    return <ConstantUnionEditor propDef={propDef} value={value} onChange={onChange} className={className} />
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
      />
    )
  }

  // Date type
  if (type.syntax === 'Date') {
    return <DateEditor propDef={propDef} value={value} onChange={onChange} />
  }

  // String primitive
  if (primitiveBase(type) === 'string') {
    return <StringEditor propDef={propDef} value={value} onChange={onChange} className={className} />
  }

  // Number primitive
  if (primitiveBase(type) === 'number') {
    return <NumberEditor propDef={propDef} value={value} onChange={onChange} className={className} />
  }

  // Boolean primitive
  if (primitiveBase(type) === 'boolean') {
    return <BooleanEditor propDef={propDef} value={value} onChange={onChange} className={className} />
  }

  // Types no form can build a value of. Routed before the JSON fallback: a raw
  // textarea over a database handle only invites input that can never be right.
  if (type.kind === 'opaque') {
    return <OpaqueEditor propDef={propDef} value={value} onChange={onChange} className={className} path={path} />
  }

  // Object types with known properties
  if (type.kind === 'object' && type.properties.length > 0) {
    return <ObjectEditor properties={type.properties} value={value} onChange={onChange} plugins={plugins} path={path} />
  }

  // Fallback
  return <JsonFallbackEditor propDef={propDef} value={value} onChange={onChange} className={className} />
}
