import { describe, test, expect } from 'vitest'
import ts from 'typescript'
import path from 'node:path'
import { extractDefinitionsFromParameters } from '../extract-properties.js'

const LIB_DIR = path.dirname(ts.getDefaultLibFilePath({}))

/**
 * Build a program over `files` (virtual paths under `/proj`), falling back to
 * the real lib.d.ts on disk so utility types like `Pick` resolve properly.
 */
function programFrom(files: Record<string, string>, entry: string) {
  const host: ts.CompilerHost = {
    getSourceFile: (name, languageVersion) => {
      const text = files[name] ?? (name.startsWith(LIB_DIR) ? ts.sys.readFile(name) : undefined)
      return text === undefined ? undefined : ts.createSourceFile(name, text, languageVersion, true)
    },
    writeFile: () => {},
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    useCaseSensitiveFileNames: () => true,
    getCanonicalFileName: f => f,
    getCurrentDirectory: () => '/proj',
    getNewLine: () => '\n',
    fileExists: name => name in files || ts.sys.fileExists(name),
    readFile: name => files[name] ?? ts.sys.readFile(name),
  }
  const program = ts.createProgram([entry], { strict: true, target: ts.ScriptTarget.ES2022 }, host)
  return { program, typeChecker: program.getTypeChecker(), sourceFile: program.getSourceFile(entry)! }
}

function extractParams(files: Record<string, string>, entry: string) {
  const { typeChecker, sourceFile } = programFrom(files, entry)
  let fn: ts.FunctionDeclaration | undefined
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) fn = node
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (!fn) throw new Error('No function declaration found')
  return extractDefinitionsFromParameters(fn.parameters, sourceFile, typeChecker)
}

describe('checker-backed type resolution', () => {
  test('expands a readonly array of Pick<> over a cross-file interface', () => {
    const defs = extractParams(
      {
        '/proj/types.ts': `export interface ThreadMessage {
  /** Portion of the message relevant to this thread. */
  excerpt: string
  body: string
  sentAt: number
}`,
        '/proj/prompt.ts': `import type { ThreadMessage } from './types'
export function orchestrate(threadMsgs: readonly Pick<ThreadMessage, 'excerpt'>[]) {}`,
      },
      '/proj/prompt.ts'
    )

    expect(defs).toHaveLength(1)
    const type = defs[0].type
    expect(type.kind).toBe('array')
    if (type.kind !== 'array') return

    // Original source text is preserved for display.
    expect(type.syntax).toBe(`readonly Pick<ThreadMessage, 'excerpt'>[]`)

    expect(type.elementType.kind).toBe('object')
    if (type.elementType.kind !== 'object') return
    expect(type.elementType.properties).toEqual([
      {
        name: 'excerpt',
        type: { kind: 'primitive', syntax: 'string' },
        optional: false,
        description: 'Portion of the message relevant to this thread.',
      },
    ])
  })

  test('resolves a plain cross-file interface', () => {
    const defs = extractParams(
      {
        '/proj/types.ts': `export interface User { name: string; age?: number }`,
        '/proj/prompt.ts': `import type { User } from './types'
export function greet(user: User) {}`,
      },
      '/proj/prompt.ts'
    )

    expect(defs[0].type.kind).toBe('object')
    if (defs[0].type.kind !== 'object') return
    expect(defs[0].type.properties).toEqual([
      { name: 'name', type: { kind: 'primitive', syntax: 'string' }, optional: false },
      { name: 'age', type: { kind: 'primitive', syntax: 'number' }, optional: true },
    ])
  })

  test('surfaces a nullable member as a constant, like the syntax-tree path', () => {
    const defs = extractParams(
      {
        '/proj/types.ts': `export interface Task { description: string | null }`,
        '/proj/prompt.ts': `import type { Task } from './types'
export function plan(task: Pick<Task, 'description'>) {}`,
      },
      '/proj/prompt.ts'
    )

    // Resolved through Pick<>, so this can only come from the checker. `null`
    // has to land as a constant here too, or the same type would get a
    // different editor depending on how it was written.
    expect(defs[0].type.kind).toBe('object')
    if (defs[0].type.kind !== 'object') return
    const description = defs[0].type.properties[0].type
    expect(description.kind).toBe('union')
    if (description.kind !== 'union') return
    // The checker decides the order of union members, so match on content.
    expect(description.types).toEqual(
      expect.arrayContaining([
        { kind: 'primitive', syntax: 'string' },
        { kind: 'constant', syntax: 'null', value: null },
      ])
    )
    expect(description.types).toHaveLength(2)
  })

  test('expands Omit<> and Partial<>', () => {
    const defs = extractParams(
      {
        '/proj/types.ts': `export interface User { name: string; age: number; secret: string }`,
        '/proj/prompt.ts': `import type { User } from './types'
export function greet(a: Omit<User, 'secret'>, b: Partial<User>) {}`,
      },
      '/proj/prompt.ts'
    )

    expect(defs[0].type.kind).toBe('object')
    if (defs[0].type.kind === 'object') {
      expect(defs[0].type.properties.map(p => p.name)).toEqual(['name', 'age'])
    }
    expect(defs[1].type.kind).toBe('object')
    if (defs[1].type.kind === 'object') {
      expect(defs[1].type.properties.every(p => p.optional)).toBe(true)
    }
  })

  test('leaves method-only library types opaque instead of expanding members', () => {
    const defs = extractParams(
      { '/proj/prompt.ts': `export function at(when: Date) {}` },
      '/proj/prompt.ts'
    )
    expect(defs[0].type).toEqual({ kind: 'primitive', syntax: 'Date' })
  })

  test('keeps a template-literal string type opaque', () => {
    const defs = extractParams(
      {
        '/proj/ids.ts': 'export type TaskId = `tsk_${string}`',
        '/proj/prompt.ts': `import type { TaskId } from './ids'
export function run(taskId: TaskId) {}`,
      },
      '/proj/prompt.ts'
    )
    expect(defs[0].type).toEqual({ kind: 'primitive', syntax: 'TaskId' })
  })

  test('keeps a branded primitive opaque', () => {
    const defs = extractParams(
      {
        '/proj/ids.ts': `export type UserId = string & { readonly __brand: 'UserId' }`,
        '/proj/prompt.ts': `import type { UserId } from './ids'
export function run(id: UserId) {}`,
      },
      '/proj/prompt.ts'
    )
    expect(defs[0].type).toEqual({ kind: 'primitive', syntax: 'UserId' })
  })

  test('stops recursing on self-referential types', () => {
    const defs = extractParams(
      {
        '/proj/prompt.ts': `interface Node { label: string; children: Node[] }
export function render(root: Node) {}`,
      },
      '/proj/prompt.ts'
    )
    expect(defs[0].type.kind).toBe('object')
  })
})
