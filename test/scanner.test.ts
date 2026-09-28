import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { scanRepository } from "../src/scanner/scan.js";

const execFileAsync = promisify(execFile);
const fixturePath = path.resolve("test/fixtures/repository");
const cliPath = fileURLToPath(new URL("../src/cli.js", import.meta.url));

async function createRepository(withFixture = true): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "baseset-test-"));
  const root = path.join(temporaryRoot, "repository");
  await mkdir(root);
  if (withFixture) {
    await cp(fixturePath, root, { recursive: true });
    const ignoredDirectory = path.join(root, "ignored");
    await mkdir(ignoredDirectory, { recursive: true });
    await writeFile(
      path.join(ignoredDirectory, "Hidden.tsx"),
      "export const Hidden = () => <button>Ignored text</button>;\n",
    );
    const dependencyDirectory = path.join(root, "node_modules/example");
    await mkdir(dependencyDirectory, { recursive: true });
    await writeFile(
      path.join(dependencyDirectory, "Dependency.jsx"),
      "export const Dependency = () => <button>Dependency text</button>;\n",
    );
  }
  await execFileAsync("git", ["init", "--quiet", root]);
  return { root, cleanup: () => rm(temporaryRoot, { recursive: true, force: true }) };
}

test("extracts provenance-aware text from JSX and Vue templates", async (t) => {
  const repository = await createRepository();
  t.after(repository.cleanup);

  const result = await scanRepository(path.join(repository.root, "src"));
  const compact = result.observations.map(({ value, source, context }) => ({
    value,
    source,
    context: { element: context?.element },
  }));

  assert.deepEqual(compact, [
    {
      value: "Account settings",
      source: { path: "src/Header.jsx", line: 1, column: 37 },
      context: { element: "header" },
    },
    {
      value: "Continue",
      source: { path: "src/Legacy.js", line: 1, column: 37 },
      context: { element: "button" },
    },
    {
      value: "Your account",
      source: { path: "src/Login.tsx", line: 4, column: 11 },
      context: { element: "h1" },
    },
    {
      value: "Log in",
      source: { path: "src/Login.tsx", line: 5, column: 15 },
      context: { element: "button" },
    },
    {
      value: "Sign in",
      source: { path: "src/Login.tsx", line: 6, column: 15 },
      context: { element: "Button" },
    },
    {
      value: "Profile details",
      source: { path: "src/Panel.vue", line: 3, column: 9 },
      context: { element: "h2" },
    },
    {
      value: "Save changes",
      source: { path: "src/Panel.vue", line: 4, column: 19 },
      context: { element: "ActionButton" },
    },
  ]);
  assert.ok(result.observations.every((observation) => observation.kind === "ui.text"));
});

test("classifies supported files and excludes ignored, generated, and dependency files", async (t) => {
  const repository = await createRepository();
  t.after(repository.cleanup);

  const result = await scanRepository(repository.root);

  assert.deepEqual(result.files, [
    { path: "src/empty.ts", sourceType: "typescript" },
    { path: "src/Header.jsx", sourceType: "javascript-jsx" },
    { path: "src/Legacy.js", sourceType: "javascript" },
    { path: "src/Login.tsx", sourceType: "typescript-jsx" },
    { path: "src/Panel.vue", sourceType: "vue" },
  ]);
  assert.equal(result.relevantFilesAnalysed, 5);
  assert.ok(result.observations.every(({ value }) => !value.includes("Ignored")));
  assert.ok(result.observations.every(({ value }) => !value.includes("Generated")));
  assert.ok(result.observations.every(({ value }) => !value.includes("Dependency")));
});

test("returns an empty result for an empty repository", async (t) => {
  const repository = await createRepository(false);
  t.after(repository.cleanup);

  const result = await scanRepository(repository.root);

  assert.equal(result.filesDiscovered, 0);
  assert.equal(result.relevantFilesAnalysed, 0);
  assert.deepEqual(result.observations, []);
  assert.deepEqual(result.candidateConventions, []);
});

test("writes an HTML findings report to the BaseSet output directory", async (t) => {
  const repository = await createRepository();
  t.after(repository.cleanup);
  const outputPath = path.join(repository.root, ".baseset", "report.html");
  const initialScan = await scanRepository(repository.root);

  const { stdout } = await execFileAsync(
    process.execPath,
    [cliPath, "scan", "--output"],
    { cwd: repository.root },
  );
  const output = await readFile(outputPath, "utf8");
  const subsequentScan = await scanRepository(repository.root);

  assert.match(stdout, /Wrote BaseSet report/);
  assert.match(output, /<!doctype html>/);
  assert.match(output, /BaseSet scan report/);
  assert.match(output, /7<\/strong><span>Observations/);
  assert.equal(subsequentScan.filesDiscovered, initialScan.filesDiscovered);
});
