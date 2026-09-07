import React, { useRef, useLayoutEffect, useEffect, useState } from 'react'
import type { ItemEditorProps } from '../types.js'
import type { TemplateValue } from '../../types/prop-value.js'
import type { InterpolatableIdentifier } from '../../types/prop-definition.js'
import { TemplateValueBuilder } from '../../types/template-value-builder.js'
import { collapseTemplateValue, interpolationSuggestions } from '../../editing/interpolation.js'
import { valueToDisplayString } from '../../editing/value-to-string.js'
import { colors, controlStyle, radius } from '../theme.js'

export interface TemplateEditorProps extends ItemEditorProps {
  className?: string
  placeholder?: string
  onBlur?: () => void
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderPlainText(text: string): string {
  const withCode = escapeHTML(text).replace(
    /`[^`\n]+`/g,
    match => `<span class="te-code">${match}</span>`
  )
  return withCode.replace(/\n/g, '<br>')
}

function toHTML(value: TemplateValue): string {
  let html = ''
  for (const seg of value) {
    if (typeof seg === 'string') {
      html += renderPlainText(seg)
    } else {
      const display = '${' + seg.expr + '}'
      html += `<span class="te-token">${escapeHTML(display)}</span>`
    }
  }
  return html
}

function fromHTML(el: HTMLElement): TemplateValue {
  const builder = new TemplateValueBuilder()
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      builder.appendString(node.textContent ?? '')
    } else if (node instanceof HTMLElement) {
      if (node.classList.contains('te-token')) {
        // Tokens are editable (keeps Firefox caret working), so the span's
        // text may have drifted from `${expr}` if the user typed inside it —
        // or, when typing at the span's boundary, the browser may fold the new
        // character into the span (e.g. `${foo}` + `.` → `${foo}.`). Recover
        // the `${expr}` and split any leading/trailing literal text back out so
        // the token keeps its highlight, or dissolve into a string segment.
        const text = node.textContent ?? ''
        const match = text.match(/^(.*)\$\{(.+)\}(.*)$/s)
        if (match) {
          const [, before, expr, after] = match
          if (before) builder.appendString(before)
          builder.appendToken(expr)
          if (after) builder.appendString(after)
        } else builder.appendString(text)
      } else if (node.tagName === 'BR') {
        builder.appendString('\n')
      } else if (node.tagName === 'DIV' || node.tagName === 'P') {
        for (const child of Array.from(node.childNodes)) walk(child)
        builder.appendString('\n')
      } else {
        for (const child of Array.from(node.childNodes)) walk(child)
      }
    }
  }
  for (const child of Array.from(el.childNodes)) walk(child)
  return builder.build()
}

function templatesEqual(a: TemplateValue, b: TemplateValue): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const av = a[i], bv = b[i]
    if (typeof av === 'string' || typeof bv === 'string') {
      if (av !== bv) return false
    } else if (av.expr !== bv.expr) {
      return false
    }
  }
  return true
}

function asTemplateValue(value: ItemEditorProps['value']): TemplateValue {
  if (value === undefined) return ['']
  if (value.kind === 'template') return value.value
  if (value.kind === 'primitive' && typeof value.value === 'string') return [value.value]
  // Anything else (a function call, object, array, non-string primitive, …)
  // isn't a template shape — show it as a single interpolation token instead
  // of rendering blank.
  return [{ expr: valueToDisplayString(value) }]
}

function getTextOffset(root: HTMLElement): number | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer)) return null

  let offset = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
  let current = walker.nextNode()

  while (current) {
    if (current === range.startContainer) {
      if (current.nodeType === Node.TEXT_NODE) {
        return offset + range.startOffset
      }
      return offset
    }

    if (current.nodeType === Node.TEXT_NODE) {
      offset += current.textContent?.length ?? 0
    } else if (current instanceof HTMLElement && current.tagName === 'BR') {
      offset += 1
    }

    current = walker.nextNode()
  }

  return offset
}

function setTextOffset(root: HTMLElement, targetOffset: number | null): void {
  if (targetOffset === null) return
  const selection = window.getSelection()
  if (!selection) return

  let remaining = targetOffset
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
  let current = walker.nextNode()

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const length = current.textContent?.length ?? 0
      if (remaining <= length) {
        const range = document.createRange()
        range.setStart(current, remaining)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      remaining -= length
    } else if (current instanceof HTMLElement && current.tagName === 'BR') {
      if (remaining <= 1) {
        const parent = current.parentNode
        if (!parent) return
        const index = Array.from(parent.childNodes).indexOf(current)
        const range = document.createRange()
        range.setStart(parent, index + 1)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      remaining -= 1
    }

    current = walker.nextNode()
  }

  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Absolute character offset (token spans counted by their text length) of a (node, offset) position. */
function absOffsetOf(root: HTMLElement, node: Node, offsetInNode: number): number {
  let offset = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
  let current = walker.nextNode()
  while (current) {
    if (current === node) return offset + (current.nodeType === Node.TEXT_NODE ? offsetInNode : 0)
    if (current.nodeType === Node.TEXT_NODE) offset += current.textContent?.length ?? 0
    else if (current instanceof HTMLElement && current.tagName === 'BR') offset += 1
    current = walker.nextNode()
  }
  return offset
}

interface ActiveInterpolation {
  node: Text
  dollarOffset: number
  caret: number
  activeExpr: string
}

/**
 * The unclosed `${…` the caret currently sits inside, if any. Open means: the
 * nearest preceding `${` in the caret's text node has no `}` before the caret
 * and is not closed later in that same text node. Returns null inside an
 * existing token span or a finished `${…}`.
 */
function getActiveInterpolation(root: HTMLElement): ActiveInterpolation | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!range.collapsed) return null
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return null

  // Not inside an existing token span.
  let p: Node | null = node
  while (p && p !== root) {
    if (p instanceof HTMLElement && p.classList.contains('te-token')) return null
    p = p.parentNode
  }

  const text = node.textContent ?? ''
  const caret = range.startOffset
  const before = text.slice(0, caret)
  const dollarOffset = before.lastIndexOf('${')
  if (dollarOffset === -1) return null
  if (before.slice(dollarOffset + 2).includes('}')) return null // closed before the caret

  // Already closed later in this text node ⇒ a finished literal, not an open construct.
  const after = text.slice(caret)
  const close = after.indexOf('}')
  const nextOpen = after.indexOf('${')
  if (close !== -1 && (nextOpen === -1 || close < nextOpen)) return null

  return { node: node as Text, dollarOffset, caret, activeExpr: before.slice(dollarOffset + 2) }
}

function caretRect(root: HTMLElement): { left: number; top: number; bottom: number } {
  const selection = window.getSelection()
  if (selection && selection.rangeCount) {
    const range = selection.getRangeAt(0)
    const rects = range.getClientRects()
    const r = rects.length ? rects[0] : range.getBoundingClientRect()
    if (r && (r.left || r.top || r.bottom)) return { left: r.left, top: r.top, bottom: r.bottom }
  }
  const er = root.getBoundingClientRect()
  return { left: er.left, top: er.top, bottom: er.bottom }
}

type SuggestItem =
  | { kind: 'identifier'; node: InterpolatableIdentifier }
  | { kind: 'insert-token' }
  | { kind: 'insert-literal' }

interface SuggestState {
  items: SuggestItem[]
  index: number
  fragmentLen: number
  left: number
  top: number
}

/** Keys fully handled in keydown — recomputing suggestions on their keyup is wrong. */
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'])

function itemsEqual(a: SuggestItem[], b: SuggestItem[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item, i) => {
    const other = b[i]
    if (item.kind !== other.kind) return false
    if (item.kind === 'identifier' && other.kind === 'identifier') return item.node.name === other.node.name
    return true
  })
}

export function TemplateEditor({ value, onChange, propDef, className, placeholder, disabled, onBlur }: TemplateEditorProps) {
  const roots = propDef.interpolatables ?? []
  const tmplValue = asTemplateValue(value)
  const editorRef = useRef<HTMLDivElement>(null)
  const lastExternal = useRef(tmplValue)
  // Set when the user accepts an autocomplete suggestion. While set, typing a
  // space closes the token (so accepted identifiers commit snappily); otherwise
  // space is literal, letting free-form text contain spaces. Cleared on commit,
  // when the caret leaves the `${…`, on blur, or as soon as anything else is typed.
  const accepted = useRef(false)
  const dismissedDollar = useRef<number | null>(null)
  const [suggest, setSuggest] = useState<SuggestState | null>(null)

  const renderValue = (nextValue: TemplateValue, preserveSelection: boolean) => {
    if (!editorRef.current) return
    const selectionOffset = preserveSelection ? getTextOffset(editorRef.current) : null
    const html = toHTML(nextValue)
    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html
      if (preserveSelection) {
        setTextOffset(editorRef.current, selectionOffset)
      }
    }
  }

  useLayoutEffect(() => {
    renderValue(tmplValue, false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!templatesEqual(tmplValue, lastExternal.current) && editorRef.current) {
      lastExternal.current = tmplValue
      renderValue(tmplValue, true)
    }
  }, [tmplValue])

  const emit = (next: TemplateValue) => {
    lastExternal.current = next
    onChange(collapseTemplateValue(next))
  }

  // Recompute the autocomplete dropdown from the current caret position.
  const updateSuggestions = () => {
    const root = editorRef.current
    if (!root) return
    const active = getActiveInterpolation(root)
    if (!active) {
      dismissedDollar.current = null
      accepted.current = false // caret left the `${…`
      setSuggest(null)
      return
    }
    const absDollar = absOffsetOf(root, active.node, active.dollarOffset)
    if (dismissedDollar.current === absDollar) {
      setSuggest(null) // user chose "literal" for this construct
      return
    }
    dismissedDollar.current = null
    const { candidates, fragment } = interpolationSuggestions(active.activeExpr, roots)
    const items: SuggestItem[] = candidates.length
      ? [...candidates.map(node => ({ kind: 'identifier', node } as SuggestItem)), { kind: 'insert-literal' }]
      : [{ kind: 'insert-token' }, { kind: 'insert-literal' }]
    const rect = caretRect(root)
    setSuggest(prev => {
      // Preserve the highlighted index when the candidate set is unchanged (e.g.
      // the caret moved without altering the list), otherwise reset to the top.
      const index = prev && itemsEqual(prev.items, items) ? Math.min(prev.index, items.length - 1) : 0
      return { items, index, fragmentLen: fragment.length, left: rect.left, top: rect.bottom }
    })
  }

  // Replace the open `${expr` (through the caret) with a finished token span.
  // `trailing` literal text (e.g. the char that triggered an auto-close) is
  // appended after the token as its own text node, so the caret lands outside
  // the span — inserting it via the browser would route it into the span.
  const commitToken = (expr: string, trailing = '') => {
    const root = editorRef.current!
    const active = getActiveInterpolation(root)
    if (!active) return
    if (expr.trim() === '') {
      document.execCommand('insertText', false, '}' + trailing)
      accepted.current = false
      dismissedDollar.current = null
      setSuggest(null)
      return
    }
    const range = document.createRange()
    range.setStart(active.node, active.dollarOffset)
    range.setEnd(active.node, active.caret)
    range.deleteContents()
    const span = document.createElement('span')
    span.className = 'te-token'
    span.textContent = '${' + expr + '}'
    range.insertNode(span)

    const selection = window.getSelection()
    const caretRange = document.createRange()
    if (trailing) {
      const text = document.createTextNode(trailing)
      span.parentNode!.insertBefore(text, span.nextSibling)
      caretRange.setStart(text, trailing.length)
    } else {
      caretRange.setStartAfter(span)
    }
    caretRange.collapse(true)
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(caretRange)
    }

    emit(fromHTML(root))
    accepted.current = false
    dismissedDollar.current = null
    setSuggest(null)
  }

  // Close the open `${…` at the caret into a token (DOM-driven, so it works
  // whether or not the dropdown is showing), unless it was dismissed as literal.
  const commitActive = (trailing = ''): boolean => {
    const root = editorRef.current
    if (!root) return false
    const active = getActiveInterpolation(root)
    if (!active || active.activeExpr.trim() === '') return false
    if (dismissedDollar.current === absOffsetOf(root, active.node, active.dollarOffset)) return false
    commitToken(active.activeExpr, trailing)
    return true
  }

  // Replace the trailing `fragment` with `node.name`. When `close`, also commit
  // the token (Enter); otherwise leave it open to keep editing (Tab) and arm the
  // accepted flag so a following space closes it.
  const acceptIdentifier = (node: InterpolatableIdentifier, fragmentLen: number, close: boolean) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0)
      const r = document.createRange()
      r.setStart(range.startContainer, Math.max(0, range.startOffset - fragmentLen))
      r.setEnd(range.startContainer, range.startOffset)
      selection.removeAllRanges()
      selection.addRange(r)
    }
    document.execCommand('insertText', false, node.name) // fires input → updateSuggestions reopens
    dismissedDollar.current = null
    if (close) commitActive()
    else accepted.current = true
  }

  const acceptItem = (item: SuggestItem, fragmentLen: number, close: boolean) => {
    if (item.kind === 'identifier') {
      acceptIdentifier(item.node, fragmentLen, close)
    } else if (item.kind === 'insert-token') {
      const active = getActiveInterpolation(editorRef.current!)
      commitToken(active?.activeExpr ?? '')
    } else {
      // insert as literal text: leave the typed text untouched, suppress reopen
      const root = editorRef.current!
      const active = getActiveInterpolation(root)
      dismissedDollar.current = active ? absOffsetOf(root, active.node, active.dollarOffset) : null
      accepted.current = false
      setSuggest(null)
    }
  }

  const handleInput = () => {
    const next = fromHTML(editorRef.current!)
    renderValue(next, true)
    emit(next)
    updateSuggestions()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey

    // Dropdown navigation / acceptance.
    if (suggest) {
      const n = suggest.items.length
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggest({ ...suggest, index: (suggest.index + 1) % n }); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggest({ ...suggest, index: (suggest.index - 1 + n) % n }); return }
      if (e.key === 'Escape') { e.preventDefault(); setSuggest(null); return }
      // Enter accepts and closes (no newline); Tab accepts but leaves it open.
      if (e.key === 'Enter') { e.preventDefault(); acceptItem(suggest.items[suggest.index], suggest.fragmentLen, true); return }
      if (e.key === 'Tab') { e.preventDefault(); acceptItem(suggest.items[suggest.index], suggest.fragmentLen, false); return }
    }

    // Commit triggers, independent of the dropdown's visibility.
    if (e.key === '}') {
      if (commitActive()) e.preventDefault()
      return // committed, or fall through to a literal '}'
    }
    if (e.key === ' ' && accepted.current && commitActive(' ')) {
      e.preventDefault()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!commitActive()) document.execCommand('insertText', false, '\n')
      return
    }

    // Anything else typed ends the "just accepted" state.
    if (printable) accepted.current = false
  }

  // Navigation/accept/escape are fully handled in keydown; recomputing on their
  // keyup would reset the highlight or reopen a just-closed dropdown.
  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (NAV_KEYS.has(e.key)) return
    updateSuggestions()
  }

  const handleBlur = () => {
    setSuggest(null)
    accepted.current = false
    onBlur?.()
  }

  return (
    <>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className={className}
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseUp={updateSuggestions}
        onBlur={handleBlur}
        style={className ? undefined : {
          ...controlStyle,
          minHeight: 24,
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      />
      {suggest && (
        <ul
          className="te-suggest"
          style={{
            position: 'fixed',
            left: suggest.left,
            top: suggest.top + 4,
            zIndex: 9999,
            margin: 0,
            padding: 4,
            listStyle: 'none',
            minWidth: 160,
            maxHeight: 240,
            overflowY: 'auto',
            background: colors.menuBg,
            color: colors.menuColor,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            boxShadow: '0 4px 16px rgba(0,0,0,0.16)',
            fontSize: 13,
          }}
        >
          {suggest.items.map((item, i) => {
            const action = item.kind !== 'identifier'
            const label = item.kind === 'identifier'
              ? item.node.name + (item.node.children?.length ? ' ›' : '')
              : item.kind === 'insert-token' ? 'Insert token' : 'Insert as literal text'
            return (
              <li
                key={item.kind === 'identifier' ? item.node.name : item.kind}
                className={'te-suggest-item' + (i === suggest.index ? ' active' : '') + (action ? ' te-suggest-action' : '')}
                onMouseDown={e => {
                  e.preventDefault()
                  // Clicking a parent (has children) drills in; a leaf commits.
                  const close = !(item.kind === 'identifier' && !!item.node.children?.length)
                  acceptItem(item, suggest.fragmentLen, close)
                }}
                onMouseEnter={() => setSuggest(s => (s ? { ...s, index: i } : s))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontStyle: action ? 'italic' : 'normal',
                  borderTop: action && i > 0 && suggest.items[i - 1].kind === 'identifier'
                    ? `1px solid ${colors.border}` : undefined,
                  background: i === suggest.index ? colors.menuActiveBg : 'transparent',
                }}
              >
                {label}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
