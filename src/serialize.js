import { createTableSQL, insertSQL } from "./sqlite.js";

function validateData(data) {
  if (!Array.isArray(data)) throw new TypeError("data must be an array");
  if (data.some(record => !record || typeof record !== "object" || Array.isArray(record))) {
    throw new TypeError("every record must be an object");
  }
}

function columnsFor(data, configured) {
  return configured ?? [...new Set(data.flatMap(record => Object.keys(record)))];
}

function scalar(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function separated(data, delimiter, options) {
  const columns = columnsFor(data, options.columns);
  const escape = value => {
    const text = scalar(value);
    if (text.includes(delimiter) || /["\r\n]/.test(text) || /^\s|\s$/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const rows = [];
  if (options.header !== false) rows.push(columns.map(escape).join(delimiter));
  for (const record of data) {
    rows.push(columns.map(column => escape(record[column])).join(delimiter));
  }
  return rows.join("\n");
}

function markdown(data, options) {
  const columns = columnsFor(data, options.columns);
  if (columns.length === 0) return "";
  const escape = value => scalar(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, "<br>");
  const row = values => `| ${values.map(escape).join(" | ")} |`;
  return [
    row(columns),
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...data.map(record => row(columns.map(column => record[column])))
  ].join("\n");
}

function yamlString(value) {
  if (value === "") return "''";
  if (/^[A-Za-z0-9_./-]+$/.test(value) && !/^(?:null|true|false|yes|no|on|off|~)$/i.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function yamlScalar(value) {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return yamlString(value.toISOString());
  if (typeof value === "string") return yamlString(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(yamlScalar).join(", ")}]`;
  return JSON.stringify(value);
}

function yaml(data) {
  if (data.length === 0) return "[]";
  return data.map(record => {
    const entries = Object.entries(record);
    if (entries.length === 0) return "- {}";
    return entries.map(([key, value], index) => (
      `${index === 0 ? "-" : " "} ${yamlString(key)}: ${yamlScalar(value)}`
    )).join("\n");
  }).join("\n");
}

function sqlite(data, options) {
  const table = options.table ?? "records";
  const statements = [];
  if (options.createTable) {
    if (!options.schema) throw new TypeError("SQLite createTable output requires a schema");
    statements.push(createTableSQL(table, options.schema));
  }
  const insert = insertSQL(table, data, {
    columns: options.columns ?? (options.schema ? Object.keys(options.schema) : undefined)
  });
  if (insert) statements.push(insert);
  return statements.join("\n\n");
}

export function serialize(data, options = {}) {
  validateData(data);
  const format = options.format ?? "json";

  switch (format) {
    case "json": return JSON.stringify(data, null, options.pretty === false ? 0 : (options.indent ?? 2));
    case "jsonl": return data.map(record => JSON.stringify(record)).join("\n");
    case "csv": return separated(data, options.delimiter ?? ",", options);
    case "tsv": return separated(data, options.delimiter ?? "\t", options);
    case "markdown": return markdown(data, options);
    case "yaml": return yaml(data);
    case "sqlite": return sqlite(data, options);
    default: throw new TypeError(`Unsupported output format \"${format}\"`);
  }
}
