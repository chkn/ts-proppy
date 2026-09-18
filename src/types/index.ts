export type { CatalogMatch } from "./catalog.js";
export {
  activeCatalogIndex,
  defaultCall,
  findFactory,
  findPreset,
  literalDefinition,
  setCallArgument,
  valueFitsType,
  valuesEqual,
} from "./catalog.js";
export { defaultValueForType } from "./default-value.js";
export type {
  DiscriminatedUnionCase,
  DiscriminatedUnionInfo,
} from "./discriminated-union.js";
export { getDiscriminatedUnionInfo } from "./discriminated-union.js";
export type { ExtractedProps, InsertionPoint } from "./extracted-props.js";
export type { OpenStringUnionInfo } from "./open-string-union.js";
export {
  filterSuggestions,
  getOpenStringUnionInfo,
} from "./open-string-union.js";
export type {
  InterpolatableIdentifier,
  PropDefinition,
  ValueCatalog,
  ValueCatalogGroup,
  ValueCatalogPreset,
  ValueFactory,
} from "./prop-definition.js";
export type { PropType } from "./prop-type.js";
export { slotDefinition } from "./prop-type.js";
export type { ImportSpecifier, PropValue } from "./prop-value.js";
export {
  canRemoveTupleElement,
  listElements,
  recordKeyError,
  renameRecordKey,
  uniqueRecordKey,
} from "./record-entries.js";
export type { SelectableUnionInfo } from "./selectable-union.js";
export {
  getSelectableUnionInfo,
  matchUnionMember,
} from "./selectable-union.js";
export type { SourceSpan } from "./source-location.js";
