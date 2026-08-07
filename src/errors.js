export class Text2StructError extends Error {
  constructor(issue) {
    super(issue.message);
    this.name = "Text2StructError";
    this.row = issue.row;
    this.property = issue.property;
    this.value = issue.value;
    this.code = issue.code;
  }

  toJSON() {
    return {
      row: this.row,
      property: this.property,
      value: this.value,
      code: this.code,
      message: this.message
    };
  }
}

export function issue(row, property, value, code, message) {
  return { row, property, value, code, message };
}
