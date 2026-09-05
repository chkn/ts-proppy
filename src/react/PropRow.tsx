import type React from "react";
import { useState } from "react";
import type { PropType } from "../types/prop-type.js";
import { isComplexPropType } from "./complex-type.js";
import { DEFAULT_SYNTAX_MAX, shortSyntax, typeSummary } from "./format-syntax.js";
import {
  colors,
  descriptionStyle,
  labelStyle,
  typeBadgeStyle,
} from "./theme.js";

export interface PropRowProps {
  name: string;
  type: PropType;
  optional: boolean;
  description?: string;
  /** Rendered right-aligned in the header, alongside the disclosure toggle (e.g. a JSON/remove button). */
  actions?: React.ReactNode;
  /** The field's own editor. */
  children: React.ReactNode;
  /** Collapsed on first render. Only meaningful when the type is complex — see {@link isComplexPropType}. */
  defaultCollapsed?: boolean;
}

/**
 * One field's header (name, required marker, type, description) plus its
 * editor — shared by every place a {@link PropDefinition} list gets rendered
 * (`PropsEditor`, `ObjectEditor`, `TupleEditor`, `DiscriminatedUnionEditor`),
 * so they read as one consistent tree instead of four slightly different ones.
 *
 * A complex type (object/array/tuple/open union) gets a disclosure triangle
 * and a short summary in place of its full `syntax` — the editor rendered
 * right below it already shows the shape, so repeating it as text is just
 * noise. A leaf type keeps its `syntax`, truncated with the full text still
 * reachable via `title`, since that's the only place it appears at all.
 */
export function PropRow({
  name,
  type,
  optional,
  description,
  actions,
  children,
  defaultCollapsed,
}: PropRowProps) {
  const collapsible = isComplexPropType(type);
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed && collapsible);

  const summary = typeSummary(type);
  const typeText = summary ?? shortSyntax(type.syntax);
  const typeTitle = summary
    ? type.syntax
    : type.syntax.length > DEFAULT_SYNTAX_MAX
      ? type.syntax
      : undefined;

  const nameAndType = (
    <>
      {collapsible && (
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 auto",
            fontSize: 14,
            fontWeight: 700,
            color: colors.textMuted,
            lineHeight: 1,
            transform: collapsed ? "rotate(-90deg)" : "none",
            transition: "transform .1s ease",
          }}
        >
          ▾
        </span>
      )}
      <span style={{ ...labelStyle, flex: "0 0 auto" }}>
        {name}
        {optional ? "" : " *"}
      </span>
      <span style={{ ...typeBadgeStyle, flex: "1 1 auto" }} title={typeTitle}>
        {typeText}
      </span>
    </>
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        {collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? `Expand ${name || "item"}`
                : `Collapse ${name || "item"}`
            }
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              minWidth: 0,
              flex: "1 1 auto",
              border: "none",
              background: "none",
              padding: "4px 0",
              margin: "-4px 0",
              font: "inherit",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {nameAndType}
          </button>
        ) : (
          <span
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              minWidth: 0,
            }}
          >
            {nameAndType}
          </span>
        )}
        {actions}
      </div>
      {description && !collapsed && (
        <div style={descriptionStyle}>{description}</div>
      )}
      {/* Hidden rather than unmounted, so collapsing a row doesn't discard
          state (a drafted value, a picked union member) held by its editor. */}
      <div hidden={collapsed}>{children}</div>
    </div>
  );
}
