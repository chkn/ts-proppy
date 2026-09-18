import type { PropValue } from '../../types/prop-value.js'
import type { InterpolatableIdentifier } from '../../types/prop-definition.js'
import { interpolatablePaths } from '../../editing/interpolation.js'
import { referenceToSource } from '../../editing/value-to-string.js'
import { buttonStyle, colors, controlStyle, monoFont, radius } from '../theme.js'

/** The token chip a reference is shown as — the same look as a template's `${…}`. */
export function ReferenceChip({ path }: { path: readonly string[] }) {
  return (
    <span
      className="te-token"
      data-proppy-editor="reference"
      style={{
        fontFamily: monoFont,
        fontSize: 12,
        padding: '1px 6px',
        borderRadius: radius.sm,
        background: colors.menuActiveBg,
        whiteSpace: 'nowrap',
      }}
    >
      {'${' + referenceToSource(path) + '}'}
    </span>
  )
}

/**
 * A slot holding a {@link PropValue} of kind `reference`: the chip, a choice of
 * another parameter to reference, and a way back to a literal value.
 */
export function ReferenceEditor({
  path,
  interpolatables,
  onChange,
  onClear,
  disabled,
}: {
  path: readonly string[]
  interpolatables: readonly InterpolatableIdentifier[]
  onChange: (value: PropValue) => void
  /** Replaces the reference with a literal value of the slot's type. */
  onClear: () => void
  disabled?: boolean
}) {
  const paths = interpolatablePaths(interpolatables)
  const current = path.join('.')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <ReferenceChip path={path} />
      {paths.length > 0 && (
        <select
          aria-label="Parameter"
          value={current}
          disabled={disabled}
          onChange={e => onChange({ kind: 'reference', path: e.target.value.split('.') })}
          style={{ ...controlStyle, width: 'auto', flex: '0 1 auto' }}
        >
          {!paths.some(p => p.join('.') === current) && <option value={current}>{referenceToSource(path)}</option>}
          {paths.map(p => (
            <option key={p.join('.')} value={p.join('.')}>
              {referenceToSource(p)}
            </option>
          ))}
        </select>
      )}
      <button type="button" onClick={onClear} disabled={disabled} style={buttonStyle} title="Use a value instead">
        Use value
      </button>
    </div>
  )
}

/**
 * The "use a parameter" choice offered beside a non-string slot's own editor
 * when interpolatables are in scope. Choosing one sets a reference in place of
 * the literal.
 */
export function ParameterMenu({
  interpolatables,
  onChange,
  disabled,
}: {
  interpolatables: readonly InterpolatableIdentifier[]
  onChange: (value: PropValue) => void
  disabled?: boolean
}) {
  const paths = interpolatablePaths(interpolatables)
  if (paths.length === 0) return null
  return (
    <select
      aria-label="Use parameter"
      value=""
      disabled={disabled}
      data-proppy-editor="parameter-menu"
      onChange={e => e.target.value && onChange({ kind: 'reference', path: e.target.value.split('.') })}
      style={{ ...buttonStyle, alignSelf: 'flex-start' }}
    >
      <option value="">{'${…}'}</option>
      {paths.map(p => (
        <option key={p.join('.')} value={p.join('.')}>
          {referenceToSource(p)}
        </option>
      ))}
    </select>
  )
}
