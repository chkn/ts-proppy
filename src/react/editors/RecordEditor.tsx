import { useEffect, useState } from "react";
import { defaultCall } from "../../types/catalog.js";
import { defaultValueForType } from "../../types/default-value.js";
import type {
  PropDefinition,
  ValueFactory,
} from "../../types/prop-definition.js";
import type { PropValue } from "../../types/prop-value.js";
import {
  recordKeyError,
  renameRecordKey,
  uniqueRecordKey,
} from "../../types/record-entries.js";
import { isComplexPropType } from "../complex-type.js";
import { ItemEditor } from "../ItemEditor.js";
import {
  addButtonStyle,
  colors,
  controlStyle,
  dangerButtonStyle,
  monoFont,
  nestedGroupStyle,
} from "../theme.js";
import type { EditorPlugin, SlotPath } from "../types.js";

interface RecordEditorProps {
  /** The definition every entry's value is edited against. */
  value: PropDefinition;
  current: PropValue | undefined;
  onChange: (value: PropValue) => void;
  plugins?: EditorPlugin[];
  path?: SlotPath;
  disabled?: boolean;
}

/**
 * An entry's key, edited as a draft and committed on blur or Enter. Committing
 * renames the entry in place; an empty or duplicate key is flagged and never
 * committed, and leaving the field restores the key it had.
 */
function RecordKeyInput({
  entryKey,
  properties,
  onRename,
  disabled,
}: {
  entryKey: string;
  properties: Record<string, PropValue>;
  onRename: (next: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(entryKey);
  useEffect(() => setDraft(entryKey), [entryKey]);
  const error = recordKeyError(properties, entryKey, draft);

  const commit = () => {
    if (error) setDraft(entryKey);
    else if (draft !== entryKey) onRename(draft);
  };

  return (
    <input
      type="text"
      value={draft}
      aria-label="Key"
      aria-invalid={!!error}
      title={error ?? undefined}
      readOnly={disabled}
      data-proppy-editor="record-key"
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(entryKey);
        }
      }}
      style={{
        ...controlStyle,
        fontFamily: monoFont,
        fontWeight: 500,
        borderColor: error ? colors.dangerBorder : colors.border,
      }}
    />
  );
}

/** Every factory offered for a record's values, with its group's label. */
export function recordFactories(
  valueDef: PropDefinition,
): { label: string; factory: ValueFactory }[] {
  return (valueDef.catalogs ?? []).flatMap(c =>
    c.groups.flatMap(g =>
      g.factory ? [{ label: g.label, factory: g.factory }] : [],
    ),
  );
}

/**
 * Editor for a `record` {@link PropType}: one row per entry, each an editable
 * key above its value's editor. Keys are renamed in place, so entries keep
 * their order; they must be non-empty and unique.
 */
export function RecordEditor({
  value: valueDef,
  current,
  onChange,
  plugins,
  path = [],
  disabled,
}: RecordEditorProps) {
  const properties: Record<string, PropValue> =
    current?.kind === "object" ? current.properties : {};
  const entries = Object.entries(properties);

  const emit = (next: Record<string, PropValue>) =>
    onChange({ kind: "object", properties: next });

  const addEntry = () => {
    const key = uniqueRecordKey(properties);
    emit({
      ...properties,
      [key]: valueDef.defaultValue ?? defaultValueForType(valueDef.type),
    });
  };

  // When entries are built by factories (a record of questions, say), adding
  // one means choosing which.
  const factories = recordFactories(valueDef);
  const addFrom = (name: string) => {
    const factory = factories.find(f => f.factory.def.name === name)?.factory;
    if (!factory) return;
    emit({
      ...properties,
      [uniqueRecordKey(properties, factory.def.name)]: defaultCall(factory),
    });
  };

  const removeEntry = (key: string) => {
    const next = { ...properties };
    delete next[key];
    emit(next);
  };

  const complex = isComplexPropType(valueDef.type);

  return (
    <div style={nestedGroupStyle} data-proppy-editor="record">
      {entries.map(([key, entryValue], index) => (
        <div
          key={index}
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <RecordKeyInput
              entryKey={key}
              properties={properties}
              onRename={next => emit(renameRecordKey(properties, key, next))}
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() => removeEntry(key)}
              aria-label={`Remove ${key}`}
              disabled={disabled}
              style={dangerButtonStyle}
            >
              ×
            </button>
          </div>
          <div style={complex ? undefined : { paddingLeft: 8 }}>
            <ItemEditor
              propDef={{ ...valueDef, name: key }}
              value={entryValue}
              onChange={next => emit({ ...properties, [key]: next })}
              plugins={plugins}
              path={[...path, key]}
              disabled={disabled}
            />
          </div>
        </div>
      ))}
      {factories.length > 0 ? (
        <select
          value=""
          disabled={disabled}
          aria-label="Add entry"
          data-proppy-editor="record-add"
          onChange={e => addFrom(e.target.value)}
          style={addButtonStyle}
        >
          <option value="">+ Add entry…</option>
          {factories.map(({ label, factory }) => (
            <option key={factory.def.name} value={factory.def.name}>
              {label}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          onClick={addEntry}
          disabled={disabled}
          data-proppy-editor="record-add"
          style={addButtonStyle}
        >
          + Add entry
        </button>
      )}
    </div>
  );
}
