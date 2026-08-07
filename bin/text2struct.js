#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";
import { parseArgs } from "node:util";
import { convert, Text2StructError } from "../src/index.js";

const HELP = `Text2Struct — convert text lists into structured data

Usage:
  text2struct [file|-] --schema <schema> [options]

Options:
  --schema <value>       Inline name:type pairs or path to a JSON schema (required)
  --delimiter <value>    Parse each non-empty line using this delimiter
  --parser <type>        delimiter, lines, key-value, csv, or tsv
  --separator <value>    Key/value separator (default: :)
  --header               Treat the first CSV/TSV row as a header
  --output <format>      json, jsonl, csv, tsv, markdown, yaml, sqlite (default: json)
  --deduplicate [keys]   Remove duplicates; optional comma-separated property names
  --errors <mode>        throw, collect, or skip (default: throw)
  --table <name>         SQLite table name (default: records)
  --create-table         Include a SQLite CREATE TABLE statement
  --no-header            Omit the header from CSV/TSV output
  -h, --help             Show this help
  -v, --version          Show the installed version
`;

function inlineSchema(value) {
  const schema = {};
  for (const entry of value.split(",")) {
    const separator = entry.lastIndexOf(":");
    if (separator < 1 || separator === entry.length - 1) {
      throw new Error(`Invalid schema entry \"${entry}\"; expected name:type`);
    }
    schema[entry.slice(0, separator).trim()] = entry.slice(separator + 1).trim();
  }
  return schema;
}

async function readSchema(value) {
  if (!value) throw new Error("--schema is required");
  if (value.trim().startsWith("{")) return JSON.parse(value);
  if (value.includes(":") && !value.endsWith(".json")) return inlineSchema(value);
  return JSON.parse(await readFile(value, "utf8"));
}

async function readStdin() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function main() {
  const args = process.argv.slice(2).map((argument, index, all) => {
    if (argument !== "--deduplicate") return argument;
    const next = all[index + 1];
    return !next || next.startsWith("-") ? "--deduplicate=__all__" : argument;
  });
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      schema: { type: "string" },
      delimiter: { type: "string" },
      parser: { type: "string" },
      separator: { type: "string" },
      header: { type: "boolean" },
      "no-header": { type: "boolean" },
      output: { type: "string", default: "json" },
      deduplicate: { type: "string" },
      errors: { type: "string", default: "throw" },
      table: { type: "string", default: "records" },
      "create-table": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" }
    },
    tokens: false
  });

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }
  if (values.version) {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }

  const schema = await readSchema(values.schema);
  const file = positionals[0];
  if (positionals.length > 1) throw new Error("Only one input file may be provided");
  const input = !file || file === "-" ? await readStdin() : await readFile(file, "utf8");

  let parserType = values.parser;
  if (!parserType) parserType = values.delimiter !== undefined ? "delimiter" : "lines";
  const parser = { type: parserType };
  if (values.delimiter !== undefined) parser.delimiter = values.delimiter;
  if (values.separator !== undefined) parser.separator = values.separator;
  if (values.header) parser.header = true;

  const deduplicate = values.deduplicate === undefined
    ? false
    : values.deduplicate !== "__all__"
      ? values.deduplicate.split(",").map(key => key.trim()).filter(Boolean)
      : true;

  const result = convert({
    input,
    schema,
    parser,
    deduplicate,
    errors: values.errors,
    output: values.output,
    outputOptions: {
      table: values.table,
      createTable: values["create-table"] ?? false,
      header: !values["no-header"]
    }
  });

  if (values.errors === "collect") {
    process.stdout.write(`${result.output}\n`);
    if (result.errors.length > 0) process.stderr.write(`${JSON.stringify(result.errors, null, 2)}\n`);
    process.exitCode = result.errors.length > 0 ? 2 : 0;
  } else {
    process.stdout.write(`${result}\n`);
  }
}

main().catch(error => {
  const message = error instanceof Text2StructError
    ? JSON.stringify(error.toJSON())
    : error.message;
  process.stderr.write(`text2struct: ${message}\n`);
  process.exitCode = 1;
});
