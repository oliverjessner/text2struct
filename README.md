# StructPaste

Convert text lists into structured data.

StructPaste is a small, dependency-free JavaScript library and CLI for turning
plain text into JSON, JSON Lines, CSV, TSV, Markdown tables, YAML, or
SQLite-compatible SQL. You define the properties; StructPaste handles parsing,
type conversion, validation, transformation, deduplication, and output.

## Install

```bash
npm install structpaste
```

For the CLI:

```bash
npm install -g structpaste
```

## Quick start

```js
import { convert } from 'structpaste';

const result = convert({
    input: `
Oliver | Salzburg | 34
Max | Berlin | 29
Oliver | Salzburg | 34
`,
    schema: {
        name: 'string',
        city: 'string',
        age: 'integer',
    },
    parser: {
        type: 'delimiter',
        delimiter: '|',
    },
    deduplicate: true,
    output: 'json',
});

console.log(result);
```

`result` is a JSON string containing:

```json
[
    { "name": "Oliver", "city": "Salzburg", "age": 34 },
    { "name": "Max", "city": "Berlin", "age": 29 }
]
```

## API

### `parse(input, options)`

Turn text into JavaScript objects:

```js
import { parse } from 'structpaste';

const data = parse('Oliver | Salzburg | 34', {
    schema: {
        name: 'string',
        city: 'string',
        age: 'integer',
    },
    parser: {
        type: 'delimiter',
        delimiter: '|',
    },
});
```

### `serialize(data, options)`

Convert records to another format:

```js
import { serialize } from 'structpaste';

const markdown = serialize(data, { format: 'markdown' });
```

Supported formats are `json`, `jsonl`, `csv`, `tsv`, `markdown`, `yaml`, and
`sqlite`.

### `convert(options)`

Parse and serialize in one operation:

```js
const output = convert({ input, schema, parser, output: 'markdown' });
```

## Schema

A simple schema maps property names to types:

```js
const schema = {
    name: 'string',
    age: 'integer',
    price: 'float',
    active: 'boolean',
    createdAt: 'date',
    tags: 'array',
};
```

Supported types are `string`, `integer`, `float`, `boolean`, `date`, and
`array`. Dates become `Date` instances. Boolean input accepts
`true`/`false`, `1`/`0`, `yes`/`no`, `y`/`n`, and `on`/`off`.

Fields can also use advanced definitions:

```js
const schema = {
    name: {
        type: 'string',
        required: true,
        trim: true,
    },
    tags: {
        type: 'array',
        separator: ',',
    },
};
```

Whitespace is trimmed by default; use `trim: false` to preserve it.

Transform incoming values or derive properties from the converted row:

```js
const schema = {
    title: {
        type: 'string',
        transform: value => value.trim(),
    },
    slug: {
        type: 'string',
        derive: row => slugify(row.title),
    },
};
```

## Parsers

Delimiter-separated lines:

```js
parser: { type: "delimiter", delimiter: "|" }
```

Consecutive lines grouped by the number of schema properties:

```js
parser: {
    type: 'lines';
}
```

Blank-line-separated key/value records:

```js
parser: { type: "key-value", separator: ":" }
```

CSV and TSV, with optional headers:

```js
parser: { type: "csv", header: true }
parser: { type: "tsv", header: true }
```

The CSV and TSV parsers support quoted delimiters, escaped quotes, and quoted
newlines.

## Deduplication

Deduplication is disabled by default. Remove identical records with:

```js
deduplicate: true;
```

Or compare selected properties:

```js
deduplicate: ['email'];
deduplicate: ['name', 'city'];
```

The first matching record is kept.

## Error handling

The default `throw` mode raises a `StructPasteError` on the first invalid row:

```js
parse(input, { schema, parser, errors: 'throw' });
```

`skip` discards invalid rows. `collect` returns valid data and every validation
issue:

```js
const result = parse(input, {
    schema,
    parser,
    errors: 'collect',
});

// {
//   data: [],
//   errors: [{
//     row: 2,
//     property: "age",
//     value: "abc",
//     code: "INVALID_INTEGER",
//     message: 'Expected integer, received "abc"'
//   }]
// }
```

With `convert()`, collect mode returns `{ output, data, errors }`.

## SQLite

```js
const sql = convert({
    input: 'Oliver | Salzburg | 34\nMax | Berlin | 29',
    schema: {
        name: 'string',
        city: 'string',
        age: 'integer',
    },
    parser: { type: 'delimiter', delimiter: '|' },
    output: 'sqlite',
    outputOptions: {
        table: 'people',
        createTable: true,
    },
});
```

SQLite-specific schema properties are supported:

```js
const schema = {
    id: {
        type: 'integer',
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: 'string',
        required: true,
    },
    email: {
        type: 'string',
        unique: true,
    },
};
```

Helpers are available as a separate export:

```js
import { createTableSQL, insertSQL } from 'structpaste/sqlite';

const create = createTableSQL('people', schema);
const insert = insertSQL('people', [{ name: 'Oliver', age: 34 }]);
```

## CLI

```bash
structpaste people.txt \
  --schema 'name:string,city:string,age:integer' \
  --delimiter '|' \
  --output json
```

Other examples:

```bash
# Markdown table
structpaste people.txt \
  --schema 'name:string,city:string,age:integer' \
  --delimiter '|' \
  --output markdown

# Deduplicate by email
structpaste people.txt \
  --schema 'name:string,email:string' \
  --delimiter '|' \
  --deduplicate email \
  --output json

# SQLite using a JSON schema file
structpaste people.txt \
  --schema schema.json \
  --delimiter '|' \
  --output sqlite \
  --table people \
  --create-table

# Read from stdin
printf 'Oliver|34\n' | structpaste - \
  --schema 'name:string,age:integer' \
  --delimiter '|'
```

Run `structpaste --help` for all options.

## Philosophy

```text
Text
  ↓
Parse
  ↓
Structured Records
  ↓
Transform / Validate / Deduplicate
  ↓
Serialize
```

The parser and output format are independent, so the same parsed records can be
used by the CLI, another Node.js application, or database tools without coupling
them to one input format.
