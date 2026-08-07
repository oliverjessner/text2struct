import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

function run(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(`Process exited with code ${code}`), { code, stdout, stderr }));
    });
    child.stdin.end(options.input ?? "");
  });
}
const cli = new URL("../bin/structpaste.js", import.meta.url);

test("CLI converts stdin with an inline schema", async () => {
  const { stdout } = await run(process.execPath, [
    cli.pathname,
    "-",
    "--schema", "name:string,age:integer",
    "--delimiter", "|",
    "--output", "markdown"
  ], { input: "Oliver | 34\nMax | 29" });
  assert.match(stdout, /\| Oliver \| 34 \|/);
});

test("CLI accepts bare and keyed deduplication flags", async () => {
  const base = [
    cli.pathname,
    "-",
    "--schema", "name:string,email:string",
    "--delimiter", "|",
    "--output", "json"
  ];
  const input = "First|same@example.com\nSecond|same@example.com";
  const keyed = await run(process.execPath, [...base, "--deduplicate", "email"], { input });
  assert.equal(JSON.parse(keyed.stdout).length, 1);

  const identical = await run(process.execPath, [...base, "--deduplicate"], {
    input: "First|one@example.com\nFirst|one@example.com"
  });
  assert.equal(JSON.parse(identical.stdout).length, 1);
});

test("CLI reports validation failures without a stack trace", async () => {
  await assert.rejects(
    run(process.execPath, [
      cli.pathname,
      "-",
      "--schema", "age:integer",
      "--delimiter", "|"
    ], { input: "nope" }),
    error => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /INVALID_INTEGER/);
      assert.doesNotMatch(error.stderr, /at main/);
      return true;
    }
  );
});
