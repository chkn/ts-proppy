import React from 'react'
import type { PropDefinition } from '../types/prop-definition.js'
import type { PropValue } from '../types/prop-value.js'
import type { EditorPlugin } from './types.js'
import { getDiscriminatedUnionInfo } from '../types/discriminated-union.js'
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
import { TemplateEditor } from './editors/TemplateEditor.js'

interface ItemEditorInternalProps {
  propDef: PropDefinition
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
  className?: string
}

export function ItemEditor({ value, onChange, propDef, plugins, className }: ItemEditorInternalProps) {
  const { type } = propDef

  // Check plugins first
  if (plugins) {
    for (const plugin of plugins) {
      if (plugin.match(type)) {
        const PluginComponent = plugin.component
        return <PluginComponent propDef={propDef} value={value} onChange={onChange} />
      }
    }
  }

  // Template values, or string properties with interpolatables available
  if (value?.kind === 'template' || (type.syntax === 'string' && propDef.interpolatables?.length)) {
    return <TemplateEditor propDef={propDef} value={value} onChange={onChange} className={className} />
  }

  // Function types
  if (type.kind === 'function') {
    return <FunctionEditor propDef={propDef} value={value} onChange={onChange} />
  }

  // Array types
  if (type.kind === 'array') {
    return <ArrayEditor elementType={type.elementType} value={value} onChange={onChange} plugins={plugins} />
  }

  // Tuple types
  if (type.kind === 'tuple') {
    return <TupleEditor types={type.types} value={value} onChange={onChange} plugins={plugins} />
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
      />
    )
  }

  // Constant unions (dropdown)
  if (type.kind === 'union' && type.types.every(t => t.kind === 'constant')) {
    return <ConstantUnionEditor propDef={propDef} value={value} onChange={onChange} className={className} />
  }

  // Date type
  if (type.syntax === 'Date') {
    return <DateEditor propDef={propDef} value={value} onChange={onChange} />
  }

  // String primitive
  if (type.syntax === 'string') {
    return <StringEditor propDef={propDef} value={value} onChange={onChange} className={className} />
  }

  // Number primitive
  if (type.syntax === 'number') {
    return <NumberEditor propDef={propDef} value={value} onChange={onChange} className={className} />
  }

  // Boolean primitive
  if (type.syntax === 'boolean') {
    return <BooleanEditor propDef={propDef} value={value} onChange={onChange} className={className} />
  }

  // Object types with known properties
  if (type.kind === 'object' && type.properties.length > 0) {
    return <ObjectEditor properties={type.properties} value={value} onChange={onChange} plugins={plugins} />
  }

  // Fallback
  return <JsonFallbackEditor propDef={propDef} value={value} onChange={onChange} className={className} />
}
