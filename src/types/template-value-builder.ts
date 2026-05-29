import type { TemplateValue, TemplateToken } from './prop-value.js'

/**
 * Incrementally builds a {@link TemplateValue}, keeping the alternating
 * string-segment / token invariant intact.
 *
 * The result always starts with a string segment and has a string segment
 * after every token, coalescing consecutive literal text into a single
 * segment. Both the parser (building from concatenated source) and the editor
 * (building from edited DOM) accumulate segments this way.
 */
export class TemplateValueBuilder {
  private readonly segments: TemplateValue = ['']

  /** Append literal text, coalescing with the trailing string segment. */
  appendString(s: string): this {
    const last = this.segments[this.segments.length - 1]
    if (typeof last === 'string') this.segments[this.segments.length - 1] = last + s
    else this.segments.push(s)
    return this
  }

  /** Append an interpolation token followed by a fresh empty string segment. */
  appendToken(expr: string): this {
    this.segments.push({ expr })
    this.segments.push('')
    return this
  }

  /** Append each segment of an existing {@link TemplateValue}. */
  appendSegments(value: TemplateValue): this {
    for (const seg of value) {
      if (typeof seg === 'string') this.appendString(seg)
      else this.appendToken(seg.expr)
    }
    return this
  }

  /** The accumulated segments. */
  build(): TemplateValue {
    return this.segments
  }
}
