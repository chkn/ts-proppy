import { describe, test, expect } from 'vitest'
import {
  activeCatalogIndex,
  defaultCall,
  findFactory,
  findPreset,
  literalDefinition,
  setCallArgument,
  valueFitsType,
  valuesEqual,
} from '../catalog.js'
import type { PropDefinition, ValueCatalog, ValueFactory } from '../prop-definition.js'
import type { PropType } from '../prop-type.js'
import type { PropValue } from '../prop-value.js'

const str: PropType = { kind: 'primitive', syntax: 'string' }
const def = (name: string, type: PropType, optional = false): PropDefinition => ({ name, type, optional })
const text = (value: string): PropValue => ({ kind: 'primitive', value })

const openai: ValueFactory = {
  def: def('openai', { kind: 'function', syntax: '(id: string) => LanguageModel', parameters: [def('modelId', str)] }),
  binding: [{ kind: 'import', spec: { name: 'openai', from: '@ai-sdk/openai' } }],
}
const gpt = (id: string, binding?: ValueFactory['binding']): PropValue => ({
  kind: 'functionCall',
  callee: 'openai',
  args: [text(id)],
  ...(binding && { binding }),
})

const providerCatalog: ValueCatalog = {
  label: 'Provider',
  groups: [{ label: 'OpenAI', icon: 'openai', presets: [{ label: 'GPT-5.5', value: gpt('gpt-5.5', openai.binding) }], factory: openai }],
}
const gatewayCatalog: ValueCatalog = {
  label: 'Gateway',
  groups: [{ label: 'OpenAI', presets: [{ label: 'GPT-5.5', value: text('openai/gpt-5.5') }] }],
  literal: true,
}
const catalogs = [providerCatalog, gatewayCatalog]
const slot = def('model', { kind: 'union', syntax: 'LanguageModel', types: [str, { kind: 'opaque', syntax: 'LanguageModelV3' }] })

describe('preset selection', () => {
  test('finds a preset equal to the value, ignoring its binding candidates', () => {
    const inFile = gpt('gpt-5.5', { kind: 'parameter' })
    expect(findPreset(catalogs, inFile)).toMatchObject({ catalogIndex: 0, groupIndex: 0, preset: { label: 'GPT-5.5' } })
    expect(findPreset(catalogs, text('openai/gpt-5.5'))).toMatchObject({ catalogIndex: 1 })
  })

  test('finds no preset for a value that differs in an argument', () => {
    expect(findPreset(catalogs, gpt('gpt-4o'))).toBeUndefined()
  })

  test('picks the catalog a value belongs to', () => {
    expect(activeCatalogIndex(catalogs, slot, text('openai/gpt-5.5'))).toBe(1)
    expect(activeCatalogIndex(catalogs, slot, gpt('my-fine-tune'))).toBe(0)
    expect(activeCatalogIndex(catalogs, slot, text('xai/grok'))).toBe(1)
    expect(activeCatalogIndex(catalogs, slot, undefined)).toBe(0)
  })

  test('compares templates, arrays and objects structurally', () => {
    expect(valuesEqual({ kind: 'template', value: ['a', { expr: 'b' }, ''] }, { kind: 'template', value: ['a', { expr: 'b' }, ''] })).toBe(true)
    expect(valuesEqual({ kind: 'array', elements: [text('a')] }, { kind: 'tuple', elements: [text('a')] })).toBe(true)
    expect(valuesEqual({ kind: 'object', properties: { a: text('1') } }, { kind: 'object', properties: { a: text('2') } })).toBe(false)
  })
})

describe('factory calls', () => {
  test('finds the factory a call is made to, by callee', () => {
    expect(findFactory(catalogs, gpt('anything'))?.factory).toBe(openai)
    expect(findFactory(catalogs, text('openai'))).toBeUndefined()
  })

  test('builds a default call with the factory binding and required arguments', () => {
    expect(defaultCall(openai)).toEqual({ kind: 'functionCall', callee: 'openai', args: [text('')], binding: openai.binding })
  })

  test('gives a factory with only optional parameters its first argument', () => {
    const noul: ValueFactory = {
      def: def('noul', { kind: 'function', syntax: '', parameters: [def('instructions', str, true), def('criteria', str, true)] }),
      binding: { kind: 'import', spec: { name: 'noul', from: '@typesafe-ai/sdk' } },
    }
    expect(defaultCall(noul).args).toEqual([text('')])
  })

  test('edits one argument, padding skipped optional ones and trimming trailing ones', () => {
    const params = [def('a', str, true), def('b', str, true), def('c', str, true)]
    const call: Extract<PropValue, { kind: 'functionCall' }> = { kind: 'functionCall', callee: 'f', args: [] }
    const withC = setCallArgument(call, params, 2, text('c'))
    expect(withC.args).toEqual([{ kind: 'primitive', value: undefined }, { kind: 'primitive', value: undefined }, text('c')])
    const cleared = setCallArgument(withC, params, 2, { kind: 'primitive', value: undefined })
    expect(cleared.args).toEqual([])
  })

  test('pads a skipped required argument with its default', () => {
    const params = [def('a', str), def('b', str)]
    expect(setCallArgument({ kind: 'functionCall', callee: 'f', args: [] }, params, 1, text('b')).args).toEqual([text(''), text('b')])
  })
})

describe('narrowed literals', () => {
  // Gemini's model row: `{ model: Model } | { agent: Agent }`, a catalog per member.
  const modelMember: PropType = { kind: 'object', syntax: '{ model: Model }', properties: [def('model', str)] }
  const agentMember: PropType = { kind: 'object', syntax: '{ agent: Agent }', properties: [def('agent', str)] }
  const slot = def('model', { kind: 'union', syntax: '', types: [modelMember, agentMember] })
  const models: ValueCatalog = { label: 'Models', groups: [], literal: def('', modelMember) }
  const agents: ValueCatalog = { label: 'Agents', groups: [], literal: def('', agentMember) }

  test("narrows each catalog's free-form entry to its own member", () => {
    expect(literalDefinition(models, slot)?.type).toBe(modelMember)
    expect(literalDefinition(agents, slot)?.type).toBe(agentMember)
    expect(literalDefinition({ label: 'x', groups: [] }, slot)).toBeUndefined()
    expect(literalDefinition({ label: 'x', groups: [], literal: true }, { ...slot, catalogs: [models] })).toMatchObject({ catalogs: undefined })
  })

  test('opens a value in the catalog whose member it fits', () => {
    const agent: PropValue = { kind: 'object', properties: { agent: text('deep-research') } }
    const model: PropValue = { kind: 'object', properties: { model: text('gemini-3.5-flash') } }
    expect(activeCatalogIndex([models, agents], slot, agent)).toBe(1)
    expect(activeCatalogIndex([models, agents], slot, model)).toBe(0)
  })

  test('does not fit an object with a key the member lacks', () => {
    expect(valueFitsType(modelMember, { kind: 'object', properties: { model: text('x'), agent: text('y') } })).toBe(false)
  })
})
