import test from "node:test";
import assert from "node:assert/strict";
import { parse, Text2StructError } from "../src/index.js";

const peopleSchema = { name: "string", city: "string", age: "integer" };

test("delimiter parser converts values and removes identical records", () => {
  const data = parse("Oliver | Salzburg | 34\nMax | Berlin | 29\nOliver | Salzburg | 34", {
    schema: peopleSchema,
    parser: { type: "delimiter", delimiter: "|" },
    deduplicate: true
  });
  assert.deepEqual(data, [
    { name: "Oliver", city: "Salzburg", age: 34 },
    { name: "Max", city: "Berlin", age: 29 }
  ]);
});

test("lines parser groups values by schema width", () => {
  const data = parse("Oliver\nSalzburg\n34\n\nMax\nBerlin\n29", {
    schema: peopleSchema,
    parser: { type: "lines" }
  });
  assert.equal(data.length, 2);
  assert.deepEqual(data[1], { name: "Max", city: "Berlin", age: 29 });
});

test("key-value parser splits on only the first separator", () => {
  const data = parse("name: Oliver\nurl: https://example.com:443\n\nname: Max\nurl: /max", {
    schema: { name: "string", url: "string" },
    parser: { type: "key-value", separator: ":" }
  });
  assert.deepEqual(data[0], { name: "Oliver", url: "https://example.com:443" });
});

test("CSV parser handles headers, escaped quotes, delimiters and newlines", () => {
  const data = parse('age,name,note\n34,"Oliver, O.","hello\nworld"\n29,"Max ""M""",ok', {
    schema: { name: "string", age: "integer", note: "string" },
    parser: { type: "csv", header: true }
  });
  assert.deepEqual(data, [
    { name: "Oliver, O.", age: 34, note: "hello\nworld" },
    { name: 'Max "M"', age: 29, note: "ok" }
  ]);
});

test("TSV parser supports positional records", () => {
  assert.deepEqual(parse("Oliver\t34", {
    schema: { name: "string", age: "integer" },
    parser: { type: "tsv" }
  }), [{ name: "Oliver", age: 34 }]);
});

test("all supported types, transforms and derived fields are applied", () => {
  const [row] = parse("alice | 42 | 3.5 | yes | 2026-08-07 | one; two", {
    schema: {
      name: { type: "string", transform: value => value.toUpperCase() },
      count: "integer",
      price: "float",
      active: "boolean",
      createdAt: "date",
      tags: { type: "array", separator: ";" },
      label: { type: "string", derive: value => `${value.name}-${value.count}` }
    },
    parser: { type: "delimiter", delimiter: "|" }
  });
  assert.equal(row.name, "ALICE");
  assert.equal(row.count, 42);
  assert.equal(row.price, 3.5);
  assert.equal(row.active, true);
  assert.equal(row.createdAt.toISOString(), "2026-08-07T00:00:00.000Z");
  assert.deepEqual(row.tags, ["one", "two"]);
  assert.equal(row.label, "ALICE-42");
});

test("deduplication by keys keeps the first record", () => {
  const data = parse("First|same@example.com\nSecond|same@example.com", {
    schema: { name: "string", email: "string" },
    parser: { type: "delimiter", delimiter: "|" },
    deduplicate: ["email"]
  });
  assert.deepEqual(data, [{ name: "First", email: "same@example.com" }]);
});

test("throw, collect, and skip error modes behave consistently", () => {
  const options = {
    schema: { name: { type: "string", required: true }, age: "integer" },
    parser: { type: "delimiter", delimiter: "|" }
  };
  assert.throws(() => parse("Oliver|abc", options), error => {
    assert.ok(error instanceof Text2StructError);
    assert.equal(error.code, "INVALID_INTEGER");
    assert.equal(error.row, 1);
    return true;
  });
  assert.deepEqual(parse("Oliver|34\nMax|abc", { ...options, errors: "collect" }), {
    data: [{ name: "Oliver", age: 34 }],
    errors: [{
      row: 2,
      property: "age",
      value: "abc",
      code: "INVALID_INTEGER",
      message: 'Expected integer, received "abc"'
    }]
  });
  assert.deepEqual(parse("Oliver|34\nMax|abc", { ...options, errors: "skip" }), [
    { name: "Oliver", age: 34 }
  ]);
});
