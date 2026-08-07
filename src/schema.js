import { issue } from "./errors.js";

const SUPPORTED_TYPES = new Set([
  "string",
  "integer",
  "float",
  "boolean",
  "date",
  "array"
]);

export function normalizeSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new TypeError("schema must be an object");
  }

  const normalized = {};
  for (const [name, definition] of Object.entries(schema)) {
    const field = typeof definition === "string"
      ? { type: definition }
      : { ...definition };

    if (!field.type) field.type = "string";
    if (!SUPPORTED_TYPES.has(field.type)) {
      throw new TypeError(`Unsupported type \"${field.type}\" for property \"${name}\"`);
    }
    if (field.transform !== undefined && typeof field.transform !== "function") {
      throw new TypeError(`transform for property \"${name}\" must be a function`);
    }
    if (field.derive !== undefined && typeof field.derive !== "function") {
      throw new TypeError(`derive for property \"${name}\" must be a function`);
    }
    normalized[name] = field;
  }
  return normalized;
}

function printable(value) {
  if (typeof value === "string") return `\"${value}\"`;
  if (value === undefined) return "undefined";
  return JSON.stringify(value);
}

function invalid(row, property, value, type) {
  return issue(
    row,
    property,
    value,
    `INVALID_${type.toUpperCase()}`,
    `Expected ${type}, received ${printable(value)}`
  );
}

function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

function convertValue(value, field, context) {
  const { row, property } = context;

  if (typeof value === "string" && field.trim !== false) value = value.trim();

  if (field.transform) {
    try {
      value = field.transform(value);
    } catch (error) {
      return { error: issue(row, property, value, "TRANSFORM_ERROR", error.message) };
    }
  }

  if (isEmpty(value)) {
    if (field.required) {
      return {
        error: issue(
          row,
          property,
          value,
          "REQUIRED",
          `Property \"${property}\" is required`
        )
      };
    }
    return { value: field.type === "string" && value === "" ? "" : null };
  }

  switch (field.type) {
    case "string":
      return { value: String(value) };

    case "integer": {
      if (typeof value === "number" && Number.isSafeInteger(value)) return { value };
      if (typeof value === "string" && /^[+-]?\d+$/.test(value)) {
        const parsed = Number(value);
        if (Number.isSafeInteger(parsed)) return { value: parsed };
      }
      return { error: invalid(row, property, value, "integer") };
    }

    case "float": {
      if (typeof value === "number" && Number.isFinite(value)) return { value };
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return { value: parsed };
      }
      return { error: invalid(row, property, value, "float") };
    }

    case "boolean": {
      if (typeof value === "boolean") return { value };
      if (typeof value === "number" && (value === 0 || value === 1)) {
        return { value: value === 1 };
      }
      if (typeof value === "string") {
        const normalized = value.toLowerCase();
        if (["true", "1", "yes", "y", "on"].includes(normalized)) return { value: true };
        if (["false", "0", "no", "n", "off"].includes(normalized)) return { value: false };
      }
      return { error: invalid(row, property, value, "boolean") };
    }

    case "date": {
      if (value instanceof Date && !Number.isNaN(value.getTime())) return { value };
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return { value: parsed };
      return { error: invalid(row, property, value, "date") };
    }

    case "array": {
      if (Array.isArray(value)) return { value };
      if (typeof value === "string") {
        const separator = field.separator ?? ",";
        return {
          value: value.split(separator).map(item => field.trim === false ? item : item.trim())
        };
      }
      return { error: invalid(row, property, value, "array") };
    }
  }
}

export function applySchema(raw, schema, row) {
  const data = {};
  const errors = [];

  for (const [property, field] of Object.entries(schema)) {
    if (field.derive) continue;
    const result = convertValue(raw[property], field, { row, property });
    if (result.error) errors.push(result.error);
    else data[property] = result.value;
  }

  for (const [property, field] of Object.entries(schema)) {
    if (!field.derive) continue;
    let derived;
    try {
      derived = field.derive(data);
    } catch (error) {
      errors.push(issue(row, property, undefined, "DERIVE_ERROR", error.message));
      continue;
    }
    const result = convertValue(derived, { ...field, derive: undefined }, { row, property });
    if (result.error) errors.push(result.error);
    else data[property] = result.value;
  }

  return { data, errors };
}
