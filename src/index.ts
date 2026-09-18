// Types

export {
  addProperty,
  removeProperty,
  updateProperty,
} from "./editing/apply-value.js";
export { ensureImport } from "./editing/ensure-import.js";
export {
  collapseTemplateValue,
  interpolatablePaths,
  interpolatablesFromDefinitions,
  interpolationSuggestions,
  parseInterpolationPath,
  resolveInterpolatable,
} from "./editing/interpolation.js";
export { resolveBindings } from "./editing/resolve-bindings.js";
// Editing
export {
  collectImports,
  propertyKeyToSource,
  referenceToSource,
  valueToDisplayString,
  valueToSourceText,
} from "./editing/value-to-string.js";
export { buildPropType } from "./extraction/build-prop-type.js";
export {
  buildPropTypeFromType,
  isOpaqueType,
} from "./extraction/build-prop-type-from-type.js";
// Extraction
export {
  extractPropertiesFromDeclaration,
  extractPropertiesFromParameters,
  extractPropertiesFromTypeNode,
} from "./extraction/extract-properties.js";
export { extractPropertiesFromObjectLiteral } from "./extraction/extract-values.js";
export {
  findTypeDeclaration,
  inferPropTypeFromExpression,
  parseValueFromExpression,
  propertyNameText,
} from "./extraction/helpers.js";
// Materialization
export { materializeValue } from "./materialize/materialize-value.js";
export type { CatalogMatch } from "./types/catalog.js";
export {
  activeCatalogIndex,
  defaultCall,
  findFactory,
  findPreset,
  literalDefinition,
  setCallArgument,
  valueFitsType,
  valuesEqual,
} from "./types/catalog.js";
export { defaultValueForType } from "./types/default-value.js";
export type {
  DiscriminatedUnionCase,
  DiscriminatedUnionInfo,
} from "./types/discriminated-union.js";
export { getDiscriminatedUnionInfo } from "./types/discriminated-union.js";
export type {
  ExtractedProps,
  InsertionPoint,
} from "./types/extracted-props.js";
export type { OpenStringUnionInfo } from "./types/open-string-union.js";
export {
  filterSuggestions,
  getOpenStringUnionInfo,
} from "./types/open-string-union.js";
export type {
  InterpolatableIdentifier,
  PropDefinition,
  ValueCatalog,
  ValueCatalogGroup,
  ValueCatalogPreset,
  ValueFactory,
} from "./types/prop-definition.js";
export type { PrimitiveBase, PropType } from "./types/prop-type.js";
export { slotDefinition } from "./types/prop-type.js";
export type {
  CalleeBinding,
  ImportSpecifier,
  PropValue,
  TemplateToken,
  TemplateValue,
} from "./types/prop-value.js";
export {
  canRemoveTupleElement,
  listElements,
  recordKeyError,
  renameRecordKey,
  uniqueRecordKey,
} from "./types/record-entries.js";
export type { SelectableUnionInfo } from "./types/selectable-union.js";
export {
  getSelectableUnionInfo,
  matchUnionMember,
} from "./types/selectable-union.js";
export type { SourceSpan } from "./types/source-location.js";
export { TemplateValueBuilder } from "./types/template-value-builder.js";
