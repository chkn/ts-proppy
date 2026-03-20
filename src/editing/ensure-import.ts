import ts from 'typescript'
import type { ImportSpecifier } from '../types/prop-value.js'

/** Add a named import if it doesn't already exist. Returns modified source. */
export function ensureImport(
  sourceCode: string,
  importSpec: ImportSpecifier,
  filePath?: string
): string {
  if (!importSpec.from) return sourceCode

  const sourceFile = ts.createSourceFile(
    filePath ?? 'source.ts',
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  )

  // Check if import already exists
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (statement.moduleSpecifier.text !== importSpec.from) continue

    const clause = statement.importClause
    if (!clause) continue

    // Check default import
    if (importSpec.isDefault && clause.name && clause.name.text === importSpec.name) {
      return sourceCode // already imported
    }

    // Check named imports
    if (!importSpec.isDefault && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        if (el.name.text === importSpec.name) {
          return sourceCode // already imported
        }
      }

      // Module import exists but name not imported — add to existing named imports
      const lastElement = clause.namedBindings.elements[clause.namedBindings.elements.length - 1]
      const insertPos = lastElement.getEnd()
      return sourceCode.slice(0, insertPos) + `, ${importSpec.name}` + sourceCode.slice(insertPos)
    }
  }

  // No import from this module — insert new import statement
  const importStatement = importSpec.isDefault
    ? `import ${importSpec.name} from '${importSpec.from}'`
    : `import { ${importSpec.name} } from '${importSpec.from}'`

  // Find last import to insert after
  let lastImportEnd = -1
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      lastImportEnd = statement.getEnd()
    }
  }

  if (lastImportEnd >= 0) {
    return sourceCode.slice(0, lastImportEnd) + '\n' + importStatement + sourceCode.slice(lastImportEnd)
  }

  return importStatement + '\n' + sourceCode
}
