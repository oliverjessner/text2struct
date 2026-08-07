function quoteIdentifier(identifier) {
  if (typeof identifier !== "string" || identifier.length === 0) {
    throw new TypeError("SQLite identifiers must be non-empty strings");
  }
  return `"${identifier.replaceAll('"', '""')}"`;
}

function fieldDefinition(definition) {
  return typeof definition === "string" ? { type: definition } : { ...definition };
}

function sqliteType(type) {
  switch (type) {
    case "integer":
    case "boolean": return "INTEGER";
    case "float": return "REAL";
    case "string":
    case "date":
    case "array": return "TEXT";
    default: throw new TypeError(`Unsupported SQLite schema type \"${type}\"`);
  }
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("SQLite output cannot contain non-finite numbers");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString().replaceAll("'", "''")}'`;
  if (Array.isArray(value) || typeof value === "object") {
    return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function createTableSQL(table, schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new TypeError("schema must be an object");
  }

  const columns = Object.entries(schema).map(([name, rawDefinition]) => {
    const field = fieldDefinition(rawDefinition);
    let definition = `${quoteIdentifier(name)} ${sqliteType(field.type ?? "string")}`;
    if (field.primaryKey) definition += " PRIMARY KEY";
    if (field.autoIncrement) {
      if (!field.primaryKey || field.type !== "integer") {
        throw new TypeError(`autoIncrement property \"${name}\" must be an integer primary key`);
      }
      definition += " AUTOINCREMENT";
    }
    if (field.required) definition += " NOT NULL";
    if (field.unique) definition += " UNIQUE";
    return `  ${definition}`;
  });

  return `CREATE TABLE ${quoteIdentifier(table)} (\n${columns.join(",\n")}\n);`;
}

export function insertSQL(table, records, options = {}) {
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  if (records.length === 0) return "";

  const columns = options.columns ?? [...new Set(records.flatMap(record => Object.keys(record)))];
  if (columns.length === 0) return "";
  const columnList = columns.map(quoteIdentifier).join(", ");
  const values = records.map(record => (
    `  (${columns.map(column => sqlValue(record[column])).join(", ")})`
  ));

  return `INSERT INTO ${quoteIdentifier(table)} (${columnList}) VALUES\n${values.join(",\n")};`;
}
