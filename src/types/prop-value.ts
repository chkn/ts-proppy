/**
 * A single interpolation slot inside a {@link TemplateValue}. `expr` is the
 * source text of the interpolated expression (e.g. `name`, `user.name`,
 * `getValue()`). Literal text around it lives in the adjacent string segments.
 */
export interface TemplateToken {
  expr: string
}

/**
 * The body of a `kind: 'template'` {@link PropValue}. Alternates between
 * literal string segments and interpolation tokens. String segments are
 * always literal text — the parser/serializer takes care of any source-level
 * escaping needed to round-trip them through the host language.
 */
export type TemplateValue = (string | TemplateToken)[]

export type PropValue =
  {
    /** Optional pretty display value for better UI rendering, not used for code generation or equality checks. */
    displayValue?: string
  } &
  ( { kind: 'primitive'; value: string | number | boolean | null | undefined }
  | { kind: 'template'; value: TemplateValue }
  | {
      kind: 'functionCall'
      callee: string
      args: PropValue[]
      /**
       * Where the callee comes from. A list is a set of *candidates*, in
       * order of preference, for a value that hasn't been placed in a file
       * yet (a catalog preset, say): `resolveBindings` picks the one
       * that fits the file it is written into.
       */
      binding?: CalleeBinding | CalleeBinding[]
    }
  | { kind: 'lambda'; parameters: string[]; body: string }
  | { kind: 'object'; properties: Record<string, PropValue> }
  | { kind: 'array'; elements: PropValue[] }
  | { kind: 'tuple'; elements: PropValue[] }
  /**
   * The value of something in scope — a function parameter, or a path into one
   * (`ticket`, `ticket.subject`) — rather than a literal. Written as that
   * expression, or as a shorthand property (`{ ticket }`) when the key matches.
   */
  | { kind: 'reference'; path: string[] }
  | { kind: 'raw'; sourceText: string } )

export interface ImportSpecifier {
  name: string
  from: string
  isDefault?: boolean
}

/**
 * Describes how a function-call callee is bound at the call site.
 *
 * - `import`: the callee resolves to a top-level import statement.
 * - `parameter`: the callee resolves to a parameter of an enclosing function
 *   (including destructured names). If that function is itself an argument
 *   passed to another call, `enclosingCall` carries that call's identity so
 *   consumers can recognize specific patterns (e.g. `prompts(({ openai }) => …)`).
 */
export type CalleeBinding =
  | { kind: 'import'; spec: ImportSpecifier }
  | { kind: 'parameter'; enclosingCall?: { callee: string; import?: ImportSpecifier } }
