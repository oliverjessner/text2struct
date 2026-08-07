import test from "node:test";
import assert from "node:assert/strict";
import { convert, serialize } from "../src/index.js";
import { createTableSQL, insertSQL } from "../src/sqlite.js";

const data = [
  { name: "Oliver", city: "Salzburg", age: 34 },
  { name: "Max", city: "Berlin", age: 29 }
];

test("JSON and JSONL serialization", () => {
  assert.deepEqual(JSON.parse(serialize(data, { format: "json" })), data);
  assert.deepEqual(serialize(data, { format: "jsonl" }).split("\n").map(JSON.parse), data);
});

test("CSV and TSV serialization escape special values", () => {
  const records = [{ name: 'A, "B"', note: "two\nlines" }];
  assert.equal(
    serialize(records, { format: "csv" }),
    'name,note\n"A, ""B""","two\nlines"'
  );
  assert.equal(serialize(data.slice(0, 1), { format: "tsv", header: false }), "Oliver\tSalzburg\t34");
});

test("Markdown and YAML serialization", () => {
  assert.equal(
    serialize([{ name: "A|B", tags: ["x", "y"] }], { format: "markdown" }),
    "| name | tags |\n| --- | --- |\n| A\\|B | [\"x\",\"y\"] |"
  );
  assert.equal(
    serialize([{ name: "Oliver", age: 34, active: true, tags: ["a", "b"] }], { format: "yaml" }),
    "- name: Oliver\n  age: 34\n  active: true\n  tags: [a, b]"
  );
});

test("SQLite helpers quote identifiers and values safely", () => {
  const schema = {
    id: { type: "integer", primaryKey: true, autoIncrement: true },
    name: { type: "string", required: true },
    email: { type: "string", unique: true }
  };
  assert.equal(createTableSQL("people", schema), [
    'CREATE TABLE "people" (',
    '  "id" INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  "name" TEXT NOT NULL,',
    '  "email" TEXT UNIQUE',
    ");"
  ].join("\n"));
  assert.equal(insertSQL("people", [{ name: "O'Brien", age: 34 }]), [
    'INSERT INTO "people" ("name", "age") VALUES',
    "  ('O''Brien', 34);"
  ].join("\n"));
});

test("convert composes parsing and serialization including SQLite schema", () => {
  const output = convert({
    input: "Oliver | Salzburg | 34\nMax | Berlin | 29",
    schema: { name: "string", city: "string", age: "integer" },
    parser: { type: "delimiter", delimiter: "|" },
    output: "sqlite",
    outputOptions: { table: "people", createTable: true }
  });
  assert.match(output, /^CREATE TABLE "people"/);
  assert.match(output, /INSERT INTO "people"/);
  assert.match(output, /\('Oliver', 'Salzburg', 34\)/);
});

test("convert returns data and errors alongside output in collect mode", () => {
  const result = convert({
    input: "Oliver|34\nMax|nope",
    schema: { name: "string", age: "integer" },
    parser: { type: "delimiter", delimiter: "|" },
    errors: "collect",
    output: "json"
  });
  assert.equal(result.data.length, 1);
  assert.equal(result.errors[0].code, "INVALID_INTEGER");
  assert.deepEqual(JSON.parse(result.output), [{ name: "Oliver", age: 34 }]);
});
