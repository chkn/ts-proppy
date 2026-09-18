export {
  collapseTemplateValue,
  interpolatablePaths,
  interpolatablesFromDefinitions,
  interpolationSuggestions,
  parseInterpolationPath,
  resolveInterpolatable,
} from "./editing/interpolation.js";
// Re-export lightweight utilities so client code doesn't need the main entry
// (which transitively pulls in the typescript compiler via extraction code).
export {
  collectImports,
  propertyKeyToSource,
  referenceToSource,
  valueToDisplayString,
  valueToSourceText,
} from "./editing/value-to-string.js";
export { materializeValue } from "./materialize/materialize-value.js";
export type { CatalogIconRenderer } from "./react/catalog-icon-context.js";
export {
  CatalogIconContext,
  useCatalogIcon,
} from "./react/catalog-icon-context.js";
export { isComplexPropType } from "./react/complex-type.js";
export { CatalogEditor } from "./react/editors/CatalogEditor.js";
export { ComboboxEditor } from "./react/editors/ComboboxEditor.js";
export { FunctionCallEditor } from "./react/editors/FunctionCallEditor.js";
export { RecordEditor, recordFactories } from "./react/editors/RecordEditor.js";
export {
  ParameterMenu,
  ReferenceChip,
  ReferenceEditor,
} from "./react/editors/ReferenceEditor.js";
export type { TemplateEditorProps } from "./react/editors/TemplateEditor.js";
export { TemplateEditor } from "./react/editors/TemplateEditor.js";
export { TupleEditor } from "./react/editors/TupleEditor.js";
export { shortSyntax, typeSummary } from "./react/format-syntax.js";
export { ItemEditor } from "./react/ItemEditor.js";
export {
  InterpolatablesContext,
  useInterpolatables,
} from "./react/interpolatables-context.js";
export type { PropRowProps } from "./react/PropRow.js";
export { PropRow } from "./react/PropRow.js";
export { PropsEditor } from "./react/PropsEditor.js";
export { RichEditor } from "./react/RichEditor.js";
export type {
  EditorPlugin,
  ItemEditorProps,
  PropsEditorProps,
  SlotPath,
} from "./react/types.js";
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
export type { OpenStringUnionInfo } from "./types/open-string-union.js";
export {
  filterSuggestions,
  getOpenStringUnionInfo,
} from "./types/open-string-union.js";
export type {
  ValueCatalog,
  ValueCatalogGroup,
  ValueCatalogPreset,
  ValueFactory,
} from "./types/prop-definition.js";
export { slotDefinition } from "./types/prop-type.js";
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
export { TemplateValueBuilder } from "./types/template-value-builder.js";
