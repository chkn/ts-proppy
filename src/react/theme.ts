import type { CSSProperties } from "react";

/**
 * Shared style tokens for the built-in editors.
 *
 * Every value here is a CSS custom property with a fallback, so a host can
 * re-skin the whole editor tree by defining `--proppy-*` once rather than
 * passing `className` into every leaf. Only `className` overrides these
 * inline styles (see `ItemEditorProps.className`); a host that wants full
 * control still has that escape hatch.
 */
export const colors = {
  border: "var(--proppy-border, #e2e2e6)",
  containerBg: "var(--proppy-container-bg, #fafafa)",
  buttonBg: "var(--proppy-button-bg, #f5f5f5)",
  buttonColor: "var(--proppy-button-color, inherit)",
  inputBg: "var(--proppy-input-bg, #fff)",
  inputColor: "var(--proppy-input-color, inherit)",
  textPrimary: "var(--proppy-text-primary, inherit)",
  textMuted: "var(--proppy-text-muted, #999)",
  textSecondary: "var(--proppy-text-secondary, #666)",
  dangerBg: "var(--proppy-danger-bg, #fee)",
  dangerBorder: "var(--proppy-danger-border, #fcc)",
  dangerColor: "var(--proppy-danger-color, inherit)",
  menuBg: "var(--proppy-menu-bg, #fff)",
  menuColor: "var(--proppy-menu-color, inherit)",
  menuActiveBg: "var(--proppy-menu-active-bg, #eef)",
} as const;

export const radius = { sm: 5, md: 7 };

/** Base style for text/number/select-style controls. Skipped entirely when `className` is set. */
export const controlStyle: CSSProperties = {
  width: "100%",
  padding: "5px 8px",
  background: colors.inputBg,
  color: colors.inputColor,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  fontSize: 12.5,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

/** A quiet, secondary-looking button (add/remove item, JSON toggle, disclosure). */
export const buttonStyle: CSSProperties = {
  padding: "3px 8px",
  background: colors.buttonBg,
  color: colors.buttonColor,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  fontSize: 11,
  fontFamily: "inherit",
  cursor: "pointer",
};

/** The left-rule "tree" indent used to show nesting without stacking boxes. */
export const nestedGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  paddingLeft: 12,
  borderLeft: `2px solid ${colors.border}`,
};

export const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: colors.textPrimary,
};

export const typeBadgeStyle: CSSProperties = {
  fontWeight: 400,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 11,
  color: colors.textMuted,
  marginLeft: 6,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const descriptionStyle: CSSProperties = {
  fontSize: 11,
  color: colors.textSecondary,
  marginTop: 2,
  marginBottom: 4,
  lineHeight: 1.4,
};

/**
 * Rendered height of a bare {@link PropRow} header line (name + type badge,
 * no description) — the vertical space something needs to skip to line up
 * with a complex row's own body instead of its label. Kept as one constant
 * so anything that needs it moves in step with the header's own font size.
 */
export const rowHeaderHeight = 16;
