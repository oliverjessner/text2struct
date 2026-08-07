export type FieldType = "string" | "integer" | "float" | "boolean" | "date" | "array";

export interface FieldDefinition<TRecord = Record<string, unknown>> {
  type: FieldType;
  required?: boolean;
  trim?: boolean;
  separator?: string;
  transform?: (value: unknown) => unknown;
  derive?: (row: TRecord) => unknown;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
}

export type Schema = Record<string, FieldType | FieldDefinition>;

export type ParserOptions =
  | { type: "delimiter"; delimiter: string }
  | { type: "lines" }
  | { type: "key-value"; separator?: string }
  | { type: "csv"; header?: boolean; delimiter?: string }
  | { type: "tsv"; header?: boolean; delimiter?: string };

export interface ParseIssue {
  row: number;
  property: string;
  value: unknown;
  code: string;
  message: string;
}

export interface ParseOptions {
  schema: Schema;
  parser: ParserOptions;
  deduplicate?: boolean | string[];
  errors?: "throw" | "collect" | "skip";
}

export interface CollectedResult<T = Record<string, unknown>> {
  data: T[];
  errors: ParseIssue[];
}

export interface SerializeOptions {
  format?: "json" | "jsonl" | "csv" | "tsv" | "markdown" | "yaml" | "sqlite";
  columns?: string[];
  header?: boolean;
  delimiter?: string;
  pretty?: boolean;
  indent?: number;
  table?: string;
  createTable?: boolean;
  schema?: Schema;
}

export interface ConvertOptions extends Omit<ParseOptions, "errors"> {
  input: string;
  errors?: "throw" | "skip";
  output?: SerializeOptions["format"];
  outputOptions?: Omit<SerializeOptions, "format" | "schema">;
}

export interface CollectConvertOptions extends Omit<ConvertOptions, "errors"> {
  errors: "collect";
}

export class Text2StructError extends Error implements ParseIssue {
  row: number;
  property: string;
  value: unknown;
  code: string;
  toJSON(): ParseIssue;
}

export function parse<T = Record<string, unknown>>(
  input: string,
  options: ParseOptions & { errors: "collect" }
): CollectedResult<T>;
export function parse<T = Record<string, unknown>>(input: string, options: ParseOptions): T[];
export function serialize(data: Record<string, unknown>[], options?: SerializeOptions): string;
export function convert(options: CollectConvertOptions): {
  output: string;
  data: Record<string, unknown>[];
  errors: ParseIssue[];
};
export function convert(options: ConvertOptions): string;
