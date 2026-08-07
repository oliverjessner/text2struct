import { StructPasteError } from "./errors.js";
import { parseRaw } from "./parsers.js";
import { applySchema, normalizeSchema } from "./schema.js";

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function deduplicate(data, setting) {
  if (!setting) return data;
  const keys = setting === true ? null : setting;
  if (keys !== null && (!Array.isArray(keys) || keys.some(key => typeof key !== "string"))) {
    throw new TypeError("deduplicate must be a boolean or an array of property names");
  }

  const seen = new Set();
  return data.filter(record => {
    const compared = keys === null
      ? record
      : keys.map(key => record[key]);
    const signature = JSON.stringify(stableValue(compared));
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function parse(input, options = {}) {
  const schema = normalizeSchema(options.schema);
  const mode = options.errors ?? "throw";
  if (!["throw", "collect", "skip"].includes(mode)) {
    throw new TypeError('errors must be "throw", "collect", or "skip"');
  }

  const rawRecords = parseRaw(input, options.parser, Object.keys(schema));
  const data = [];
  const errors = [];

  for (const record of rawRecords) {
    const result = applySchema(record.value, schema, record.row);
    if (result.errors.length > 0) {
      if (mode === "throw") throw new StructPasteError(result.errors[0]);
      if (mode === "collect") errors.push(...result.errors);
      continue;
    }
    data.push(result.data);
  }

  const result = deduplicate(data, options.deduplicate);
  return mode === "collect" ? { data: result, errors } : result;
}
