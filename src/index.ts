// Types
export type { PropType } from './types/prop-type.js'
export type { PropDefinition, InterpolatableIdentifier } from './types/prop-definition.js'
export type { PropValue, ImportSpecifier, CalleeBinding, TemplateValue, TemplateToken } from './types/prop-value.js'
export { TemplateValueBuilder } from './types/template-value-builder.js'
export type { ExtractedProps, InsertionPoint } from './types/extracted-props.js'
export type { DiscriminatedUnionCase, DiscriminatedUnionInfo } from './types/discriminated-union.js'
export type { SelectableUnionInfo } from './types/selectable-union.js'
export type { SourceSpan } from './types/source-location.js'
export { getDiscriminatedUnionInfo } from './types/discriminated-union.js'
export { getSelectableUnionInfo, matchUnionMember } from './types/selectable-union.js'

// Extraction
export { extractPropertiesFromDeclaration, extractPropertiesFromParameters, extractPropertiesFromTypeNode } from './extraction/extract-properties.js'
export { extractPropertiesFromObjectLiteral } from './extraction/extract-values.js'
export { buildPropType } from './extraction/build-prop-type.js'
export { findTypeDeclaration, parseValueFromExpression, inferPropTypeFromExpression } from './extraction/helpers.js'

// Editing
export { collectImports, valueToDisplayString, valueToSourceText } from './editing/value-to-string.js'
export { ensureImport } from './editing/ensure-import.js'
export { addProperty, removeProperty, updateProperty } from './editing/apply-value.js'
export { interpolatablesFromDefinitions, parseInterpolationPath, resolveInterpolatable, interpolationSuggestions, collapseTemplateValue } from './editing/interpolation.js'

// Materialization
export { materializeValue } from './materialize/materialize-value.js'
