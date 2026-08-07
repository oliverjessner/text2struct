function normalizeInput(input) {
  if (typeof input !== "string") throw new TypeError("input must be a string");
  return input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function positionalRecord(values, properties) {
  return Object.fromEntries(properties.map((property, index) => [property, values[index]]));
}

function parseSeparatedRecords(input, delimiter) {
  if (typeof delimiter !== "string" || delimiter.length !== 1) {
    throw new TypeError("CSV/TSV delimiter must be one character");
  }

  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += character;
      }
    } else if (character === '"' && value === "") {
      quoted = true;
    } else if (character === delimiter) {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error("Unclosed quoted value in separated input");
  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function nonEmptyRows(rows) {
  return rows.filter(row => row.some(value => value.trim() !== ""));
}

function parseDelimiter(input, parser, properties) {
  const delimiter = parser.delimiter;
  if (typeof delimiter !== "string" || delimiter.length === 0) {
    throw new TypeError("delimiter parser requires a non-empty delimiter");
  }
  return input
    .split("\n")
    .filter(line => line.trim() !== "")
    .map((line, index) => ({
      row: index + 1,
      value: positionalRecord(line.split(delimiter), properties)
    }));
}

function parseLines(input, properties) {
  const records = [];
  const blocks = input.split(/\n\s*\n/).map(block => block.split("\n").filter(Boolean));
  let sourceRow = 1;

  for (const block of blocks) {
    if (block.length === 0) continue;
    for (let offset = 0; offset < block.length; offset += properties.length) {
      records.push({
        row: sourceRow + offset,
        value: positionalRecord(block.slice(offset, offset + properties.length), properties)
      });
    }
    sourceRow += block.length + 1;
  }
  return records;
}

function parseKeyValue(input, parser) {
  const separator = parser.separator ?? ":";
  if (typeof separator !== "string" || separator.length === 0) {
    throw new TypeError("key-value parser requires a non-empty separator");
  }

  const records = [];
  const lines = input.split("\n");
  let current = {};
  let startRow = 1;

  const push = () => {
    if (Object.keys(current).length > 0) records.push({ row: startRow, value: current });
    current = {};
  };

  lines.forEach((line, index) => {
    if (line.trim() === "") {
      push();
      startRow = index + 2;
      return;
    }
    if (Object.keys(current).length === 0) startRow = index + 1;
    const separatorIndex = line.indexOf(separator);
    if (separatorIndex === -1) {
      throw new Error(`Missing key-value separator on row ${index + 1}`);
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + separator.length);
    current[key] = value;
  });
  push();
  return records;
}

function parseCsvLike(input, parser, properties, fallbackDelimiter) {
  const rows = nonEmptyRows(parseSeparatedRecords(input, parser.delimiter ?? fallbackDelimiter));
  const hasHeader = parser.header === true;
  const headers = hasHeader ? rows.shift().map(value => value.trim()) : properties;
  return rows.map((values, index) => ({
    row: index + (hasHeader ? 2 : 1),
    value: positionalRecord(values, headers)
  }));
}

export function parseRaw(input, parser, properties) {
  const normalized = normalizeInput(input);
  if (!parser || typeof parser !== "object") {
    throw new TypeError("parser must be an object");
  }

  switch (parser.type) {
    case "delimiter": return parseDelimiter(normalized, parser, properties);
    case "lines": return parseLines(normalized, properties);
    case "key-value": return parseKeyValue(normalized, parser);
    case "csv": return parseCsvLike(normalized, parser, properties, ",");
    case "tsv": return parseCsvLike(normalized, parser, properties, "\t");
    default: throw new TypeError(`Unsupported parser type \"${parser.type}\"`);
  }
}
