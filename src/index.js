import { parse } from "./parse.js";
import { serialize } from "./serialize.js";

export { StructPasteError } from "./errors.js";
export { parse } from "./parse.js";
export { serialize } from "./serialize.js";

export function convert(options = {}) {
  const {
    input,
    schema,
    parser,
    deduplicate,
    errors,
    output = "json",
    outputOptions = {}
  } = options;

  const parsed = parse(input, { schema, parser, deduplicate, errors });
  if (errors === "collect") {
    return {
      output: serialize(parsed.data, {
        ...outputOptions,
        format: output,
        schema
      }),
      data: parsed.data,
      errors: parsed.errors
    };
  }

  return serialize(parsed, {
    ...outputOptions,
    format: output,
    schema
  });
}
