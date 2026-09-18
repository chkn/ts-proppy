// Types
export type { PropType, PrimitiveBase } from './types/prop-type.js'
export type { PropDefinition, InterpolatableIdentifier, ValueCatalog, ValueCatalogGroup, ValueCatalogPreset, ValueFactory } from './types/prop-definition.js'
export type { PropValue, ImportSpecifier, CalleeBinding, TemplateValue, TemplateToken } from './types/prop-value.js'
export { TemplateValueBuilder } from './types/template-value-builder.js'
export type { ExtractedProps, InsertionPoint } from './types/extracted-props.js'
export type { DiscriminatedUnionCase, DiscriminatedUnionInfo } from './types/discriminated-union.js'
export type { SelectableUnionInfo } from './types/selectable-union.js'
export type { SourceSpan } from './types/source-location.js'
export { getDiscriminatedUnionInfo } from './types/discriminated-union.js'
export { getSelectableUnionInfo, matchUnionMember } from './types/selectable-union.js'
export { getOpenStringUnionInfo, filterSuggestions } from './types/open-string-union.js'
export type { OpenStringUnionInfo } from './types/open-string-union.js'
export { defaultValueForType } from './types/default-value.js'
export { renameRecordKey, recordKeyError, uniqueRecordKey, listElements, canRemoveTupleElement } from './types/record-entries.js'
export { slotDefinition } from './types/prop-type.js'
export { valuesEqual, findPreset, findFactory, literalDefinition, valueFitsType, activeCatalogIndex, defaultCall, setCallArgument } from './types/catalog.js'
export type { CatalogMatch } from './types/catalog.js'

// Extraction
export { extractPropertiesFromDeclaration, extractPropertiesFromParameters, extractPropertiesFromTypeNode } from './extraction/extract-properties.js'
export { extractPropertiesFromObjectLiteral } from './extraction/extract-values.js'
export { buildPropType } from './extraction/build-prop-type.js'
export { buildPropTypeFromType, isOpaqueType } from './extraction/build-prop-type-from-type.js'
export { findTypeDeclaration, parseValueFromExpression, inferPropTypeFromExpression, propertyNameText } from './extraction/helpers.js'

// Editing
export { collectImports, valueToDisplayString, valueToSourceText, propertyKeyToSource, referenceToSource } from './editing/value-to-string.js'
export { ensureImport } from './editing/ensure-import.js'
export { resolveBindings } from './editing/resolve-bindings.js'
export { addProperty, removeProperty, updateProperty } from './editing/apply-value.js'
export { interpolatablesFromDefinitions, parseInterpolationPath, resolveInterpolatable, interpolationSuggestions, collapseTemplateValue, interpolatablePaths } from './editing/interpolation.js'

// Materialization
export { materializeValue } from './materialize/materialize-value.js'
