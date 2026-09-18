import type { PropType } from "./prop-type.js";
import type { CalleeBinding, PropValue } from "./prop-value.js";
import type { SourceSpan } from "./source-location.js";

/** An identifier (or nested object) available for `${...}` interpolation in template strings. */
export interface InterpolatableIdentifier {
  name: string;
  children?: InterpolatableIdentifier[];
}

export interface PropDefinition {
  name: string;
  type: PropType;
  optional: boolean;
  description?: string;
  /** Default value for this property */
  defaultValue?: PropValue;
  /** Identifiers available for template interpolation. When set, string editors show the template editor. */
  interpolatables?: InterpolatableIdentifier[];
  /**
   * Ready-made values and factories offered for this slot beside its own
   * editor — a model picker's providers and presets, say, or the functions
   * that build a question. See {@link ValueCatalog}.
   */
  catalogs?: ValueCatalog[];
  /** Source span of the value expression (for editing existing properties) */
  valueSpan?: SourceSpan;
  /** Source span of the full property including name, colon, value, trailing comma/whitespace (for removal) */
  fullSpan?: SourceSpan;
}

/** One way of choosing a value for a slot, e.g. "Provider" or "Gateway" for a model. */
export interface ValueCatalog {
  /** Shown on the toggle between catalogs, when a slot has more than one. */
  label: string;
  description?: string;
  groups: ValueCatalogGroup[];
  /**
   * Offer a free-form entry: `true` for the slot's own editor, or a definition
   * narrowing it to part of the slot's type (one member of a union, say).
   */
  literal?: boolean | PropDefinition;
}

/** A labelled set of choices within a {@link ValueCatalog}. */
export interface ValueCatalogGroup {
  label: string;
  /** Host-interpreted icon key. See `CatalogIconContext`. */
  icon?: string;
  /** Ready-made values, e.g. `openai("gpt-5.5")` labelled "GPT-5.5". */
  presets?: ValueCatalogPreset[];
  /** Calls to this function fill the slot, edited argument by argument. */
  factory?: ValueFactory;
}

/** A ready-made value with a friendly label. */
export interface ValueCatalogPreset {
  label: string;
  value: PropValue;
}

/** A function whose call produces a value for a slot, and where its callee comes from. */
export interface ValueFactory {
  /** A `function`-kind definition; `name` is the callee. */
  def: PropDefinition;
  binding: CalleeBinding | CalleeBinding[];
}
