import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { valueToDisplayString } from "../../editing/value-to-string.js";
import {
  activeCatalogIndex,
  defaultCall,
  findFactory,
  findPreset,
  literalDefinition,
  valueFitsType,
} from "../../types/catalog.js";
import type {
  PropDefinition,
  ValueCatalog,
} from "../../types/prop-definition.js";
import type { PropValue } from "../../types/prop-value.js";
import { useCatalogIcon } from "../catalog-icon-context.js";
import { ItemEditor } from "../ItemEditor.js";
import { buttonStyle, colors, controlStyle, radius } from "../theme.js";
import type { EditorPlugin, SlotPath } from "../types.js";
import { FunctionCallEditor } from "./FunctionCallEditor.js";

interface CatalogEditorProps {
  /** The slot's definition, `catalogs` included. */
  propDef: PropDefinition;
  value: PropValue | undefined;
  onChange: (value: PropValue) => void;
  plugins?: EditorPlugin[];
  /**
   * When set, the editor's parts are styled by class instead of inline:
   * `proppy-catalog-trigger`, `-label`, `-label-annotation`, `-source`,
   * `-chevron`, `-menu`, `-modes`, `-mode`, `-group`, `-group-header`,
   * `-option`, `-check`, `-option-label`, `-option-source`, `-custom`,
   * `-literal`, `-call`, and `-kind` for a factory-only slot's picker.
   */
  className?: string;
  path?: SlotPath;
  disabled?: boolean;
}

/** A value as a label: plain text for a string, its source otherwise. */
function plainLabel(value: PropValue): string {
  return value.kind === "primitive" &&
    typeof value.value === "string" &&
    value.displayValue === undefined
    ? value.value
    : valueToDisplayString(value);
}

/** Whether any catalog offers something to pick from a menu (a preset or free-form entry). */
function hasPickables(catalogs: readonly ValueCatalog[]): boolean {
  return catalogs.some(c => c.literal || c.groups.some(g => g.presets?.length));
}

/**
 * Editor for a slot with {@link ValueCatalog}s: a picker over ready-made values
 * beside the slot's own editing.
 *
 * - Presets are listed by group, and a value equal to one shows as its label.
 * - A group with a factory offers a row that inserts a call with default
 *   arguments; a value calling a known factory is then edited argument by
 *   argument in a {@link FunctionCallEditor}.
 * - A catalog with a `literal` entry offers a free-form editor, narrowed to
 *   part of the slot's type when the catalog says so.
 * - A slot whose catalogs are only factories (no presets, no free-form entry)
 *   skips the menu: an empty slot offers a choice of factory, a call to one is
 *   edited in place, and any other value goes to the slot's own editor.
 */
export function CatalogEditor(props: CatalogEditorProps) {
  const catalogs = props.propDef.catalogs ?? [];
  return hasPickables(catalogs) ? (
    <CatalogPicker {...props} catalogs={catalogs} />
  ) : (
    <FactoryChooser {...props} catalogs={catalogs} />
  );
}

function FactoryChooser({
  propDef,
  catalogs,
  value,
  onChange,
  plugins,
  className,
  path,
  disabled,
}: CatalogEditorProps & { catalogs: ValueCatalog[] }) {
  const slot: PropDefinition = { ...propDef, catalogs: undefined };
  const factories = catalogs.flatMap(c =>
    c.groups.flatMap(g =>
      g.factory ? [{ group: g, factory: g.factory }] : [],
    ),
  );
  const match = findFactory(catalogs, value);

  // Only ever shown for an empty slot, so nothing is selected yet.
  const select = (
    <select
      value=""
      disabled={disabled}
      aria-label="Kind"
      className={className ? "proppy-catalog-kind" : undefined}
      style={
        className
          ? undefined
          : { ...controlStyle, width: "auto", alignSelf: "flex-start" }
      }
      onChange={e => {
        const chosen = factories.find(
          f => f.factory.def.name === e.target.value,
        );
        if (chosen) onChange(defaultCall(chosen.factory));
      }}
    >
      <option value="">Choose…</option>
      {factories.map(({ group, factory }) => (
        <option key={factory.def.name} value={factory.def.name}>
          {group.label}
        </option>
      ))}
    </select>
  );

  if (match && value?.kind === "functionCall") {
    return (
      <div
        data-proppy-editor="catalog"
        className={className}
        style={{ display: "flex", flexDirection: "column", gap: 4 }}
      >
        <FunctionCallEditor
          value={value}
          def={match.factory.def}
          onChange={onChange}
          plugins={plugins}
          path={path}
          disabled={disabled}
        />
      </div>
    );
  }
  if (!value) {
    return (
      <div data-proppy-editor="catalog" className={className}>
        {select}
      </div>
    );
  }
  return (
    <ItemEditor
      propDef={slot}
      value={value}
      onChange={onChange}
      plugins={plugins}
      path={path}
      disabled={disabled}
    />
  );
}

function CatalogPicker({
  propDef,
  catalogs,
  value,
  onChange,
  plugins,
  className,
  path,
  disabled,
}: CatalogEditorProps & { catalogs: ValueCatalog[] }) {
  const renderIcon = useCatalogIcon();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(() =>
    activeCatalogIndex(catalogs, propDef, value),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Fixed rather than absolute, so a scrolling or clipping ancestor can't cut
  // the menu off.
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    minWidth: number;
  } | null>(null);
  const styled = !className;
  const cls = (part: string) => (styled ? undefined : `proppy-catalog-${part}`);

  // Follow the value into its catalog when it changes from outside.
  const valueKey = value ? JSON.stringify(value) : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the serialized value only, so catalogs/propDef identity churn cannot fight the user's own selection while the menu is open.
  useEffect(() => {
    if (!open) setMode(activeCatalogIndex(catalogs, propDef, value));
  }, [valueKey]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r)
        setPosition({ left: r.left, top: r.bottom + 2, minWidth: r.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const preset = findPreset(catalogs, value);
  const factory = preset ? undefined : findFactory(catalogs, value);
  const iconKey =
    preset !== undefined
      ? catalogs[preset.catalogIndex].groups[preset.groupIndex].icon
      : factory !== undefined
        ? catalogs[factory.catalogIndex].groups[factory.groupIndex].icon
        : undefined;
  const display = value ? valueToDisplayString(value) : undefined;
  // With nothing set, say what the slot falls back to.
  const fallback =
    !value && propDef.defaultValue ? propDef.defaultValue : undefined;
  const fallbackLabel =
    fallback &&
    (findPreset(catalogs, fallback)?.preset.label ?? plainLabel(fallback));
  const label =
    preset?.preset.label ?? (value && plainLabel(value)) ?? fallbackLabel;
  // True placeholder ("Select…") reads as muted throughout; a fallback's
  // label reads like a normal value, with only the "(default)" note muted.
  const isPlaceholder = !value && !fallback;

  const emit = (next: PropValue, close = true) => {
    onChange(next);
    if (close) setOpen(false);
  };

  const catalog = catalogs[Math.min(mode, catalogs.length - 1)];
  const literal = literalDefinition(catalog, propDef);
  const literalValue =
    literal &&
    value &&
    !preset &&
    !factory &&
    valueFitsType(literal.type, value)
      ? value
      : undefined;

  const s = (style: CSSProperties) => (styled ? style : undefined);

  return (
    <div
      ref={rootRef}
      data-proppy-editor="catalog"
      className={className}
      style={{ position: "relative" }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={cls("trigger")}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={display}
        onClick={() => setOpen(o => !o)}
        style={s({
          ...controlStyle,
          display: "flex",
          alignItems: "center",
          gap: 6,
          textAlign: "left",
          cursor: disabled ? "default" : "pointer",
        })}
      >
        {renderIcon?.(iconKey, 18)}
        <span
          className={
            cls("label") &&
            `${cls("label")}${isPlaceholder ? " placeholder" : ""}`
          }
          style={s({
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: isPlaceholder ? colors.textMuted : undefined,
          })}
        >
          {label ?? "Select…"}
          {fallback && (
            <span
              className={cls("label-annotation")}
              style={s({ color: colors.textMuted })}
            >
              {" "}
              (default)
            </span>
          )}
        </span>
        {preset && display && (
          <span
            className={cls("source")}
            style={s({ fontSize: 11, color: colors.textMuted })}
          >
            {display}
          </span>
        )}
        <span
          aria-hidden
          className={cls("chevron")}
          style={s({ color: colors.textMuted })}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className={cls("menu")}
          role="listbox"
          style={{
            position: "fixed",
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            minWidth: position?.minWidth,
            zIndex: 9999,
            visibility: position ? undefined : "hidden",
            ...s({
              maxHeight: 420,
              overflowY: "auto",
              padding: 4,
              background: colors.menuBg,
              color: colors.menuColor,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
              fontSize: 12.5,
            }),
          }}
        >
          {catalogs.length > 1 && (
            <div
              className={cls("modes")}
              style={s({ display: "flex", gap: 4, padding: 4 })}
            >
              {catalogs.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={
                    cls("mode") &&
                    `${cls("mode")}${i === mode ? " active" : ""}`
                  }
                  aria-pressed={i === mode}
                  title={c.description}
                  onClick={() => setMode(i)}
                  style={s({
                    ...buttonStyle,
                    flex: 1,
                    background:
                      i === mode ? colors.menuActiveBg : colors.buttonBg,
                  })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {catalog.groups.map((group, gi) => {
            const presets = group.presets ?? [];
            if (presets.length === 0 && !group.factory) return null;
            return (
              <div
                key={gi}
                className={cls("group")}
                style={s({ padding: "4px 0" })}
              >
                <div
                  className={cls("group-header")}
                  style={s({
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.textSecondary,
                  })}
                >
                  {renderIcon?.(group.icon, 14)}
                  <span>{group.label}</span>
                </div>
                {presets.map((p, pi) => {
                  const selected =
                    preset?.catalogIndex === mode &&
                    preset.groupIndex === gi &&
                    preset.preset === p;
                  return (
                    <button
                      key={pi}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={
                        cls("option") &&
                        `${cls("option")}${selected ? " selected" : ""}`
                      }
                      onClick={() => emit(p.value)}
                      style={s({
                        display: "flex",
                        width: "100%",
                        gap: 8,
                        padding: "4px 8px",
                        border: "none",
                        borderRadius: 4,
                        background: selected
                          ? colors.menuActiveBg
                          : "transparent",
                        color: "inherit",
                        font: "inherit",
                        textAlign: "left",
                        cursor: "pointer",
                      })}
                    >
                      <span
                        aria-hidden
                        className={cls("check")}
                        style={s({ width: 12 })}
                      >
                        {selected ? "✓" : ""}
                      </span>
                      <span
                        className={cls("option-label")}
                        style={s({ flex: 1 })}
                      >
                        {p.label}
                      </span>
                      <span
                        className={cls("option-source")}
                        style={s({ fontSize: 11, color: colors.textMuted })}
                      >
                        {valueToDisplayString(p.value)}
                      </span>
                    </button>
                  );
                })}
                {group.factory && (
                  <button
                    type="button"
                    className={cls("custom")}
                    onClick={() => emit(defaultCall(group.factory!))}
                    style={s({
                      display: "block",
                      width: "100%",
                      padding: "4px 8px 4px 28px",
                      border: "none",
                      borderRadius: 4,
                      background:
                        factory?.catalogIndex === mode &&
                        factory.groupIndex === gi
                          ? colors.menuActiveBg
                          : "transparent",
                      color: colors.textSecondary,
                      font: "inherit",
                      fontStyle: "italic",
                      textAlign: "left",
                      cursor: "pointer",
                    })}
                  >
                    Custom {group.factory.def.name}(…)
                  </button>
                )}
              </div>
            );
          })}

          {literal && (
            <div
              className={cls("literal")}
              style={s({ padding: 8, borderTop: `1px solid ${colors.border}` })}
            >
              <ItemEditor
                propDef={literal}
                value={literalValue}
                onChange={next => emit(next, false)}
                plugins={plugins}
                path={path}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {factory && value?.kind === "functionCall" && (
        <div style={s({ marginTop: 4 })} className={cls("call")}>
          <FunctionCallEditor
            value={value}
            def={factory.factory.def}
            onChange={onChange}
            plugins={plugins}
            path={path}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
