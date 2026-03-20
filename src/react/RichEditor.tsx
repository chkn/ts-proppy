import React from 'react'
import type { PropType } from '../types/prop-type.js'
import type { PropValue } from '../types/prop-value.js'
import type { EditorPlugin } from './types.js'
import { getDiscriminatedUnionInfo } from '../types/discriminated-union.js'
import { ArrayEditor } from './editors/ArrayEditor.js'
import { TupleEditor } from './editors/TupleEditor.js'
import { ObjectEditor } from './editors/ObjectEditor.js'
import { DiscriminatedUnionEditor } from './editors/DiscriminatedUnionEditor.js'
import { ConstantUnionEditor } from './editors/ConstantUnionEditor.js'
import { JsonFallbackEditor } from './editors/JsonFallbackEditor.js'

interface RichEditorProps {
  propType: PropType
  value: PropValue | undefined
  onChange: (value: PropValue) => void
  plugins?: EditorPlugin[]
}

export function RichEditor({ propType, value, onChange, plugins }: RichEditorProps) {
  const propDef = { name: '', type: propType, optional: false }

  // Array type
  if (propType.kind === 'array') {
    return <ArrayEditor elementType={propType.elementType} value={value} onChange={onChange} plugins={plugins} />
  }

  // Tuple type
  if (propType.kind === 'tuple') {
    return <TupleEditor types={propType.types} value={value} onChange={onChange} plugins={plugins} />
  }

  // Discriminated union
  const discriminatedUnionInfo = getDiscriminatedUnionInfo(propType)
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

  // Constant union
  if (propType.kind === 'union' && propType.types.every(t => t.kind === 'constant')) {
    return <ConstantUnionEditor propDef={propDef} value={value} onChange={onChange} />
  }

  // Object with known properties
  if (propType.kind === 'object' && propType.properties.length > 0) {
    return <ObjectEditor properties={propType.properties} value={value} onChange={onChange} plugins={plugins} />
  }

  // Fallback
  return <JsonFallbackEditor propDef={propDef} value={value} onChange={onChange} />
}
