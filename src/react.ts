export { PropsEditor } from './react/PropsEditor.js'
export { ItemEditor } from './react/ItemEditor.js'
export { RichEditor } from './react/RichEditor.js'
export { TemplateEditor } from './react/editors/TemplateEditor.js'
export type { PropsEditorProps, ItemEditorProps, EditorPlugin } from './react/types.js'
export type { TemplateEditorProps } from './react/editors/TemplateEditor.js'

// Re-export lightweight utilities so client code doesn't need the main entry
// (which transitively pulls in the typescript compiler via extraction code).
export { valueToSourceText, collectImports } from './editing/value-to-source.js'
