import type { Schema } from "./index.js";

export function createTableSQL(table: string, schema: Schema): string;
export function insertSQL(
  table: string,
  records: Record<string, unknown>[],
  options?: { columns?: string[] }
): string;
