import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../src/domain/observation.js";
import { inferHeadingCaseConvention } from "../src/inference/heading-case.js";
import { renderHtmlReport } from "../src/presentation/output.js";
import type { ScanResult } from "../src/scanner/scan.js";

function heading(value: string, line: number): Observation {
  return {
    kind: "ui.text",
    value,
    source: { path: "src/Page.tsx", line, column: 5 },
    context: {
      element: "h2",
      elementPath: [{ id: String(line), element: "h2", hasDynamicContent: false }],
    },
  };
}

test("renders candidate evidence and escapes repository content", () => {
  const observations = [
    heading("Manage your account", 1),
    heading("Check vehicle history", 2),
    heading("Review your details", 3),
    heading("Vehicle <History>", 4),
  ];
  const candidate = inferHeadingCaseConvention(observations);
  assert.ok(candidate);
  const result: ScanResult = {
    repositoryRoot: "/example/<repository>",
    filesDiscovered: 12,
    relevantFilesAnalysed: 4,
    files: [],
    observations,
    candidateConventions: [candidate],
  };

  const report = renderHtmlReport(result);

  assert.match(report, /Headings generally use sentence case/);
  assert.match(report, /viewBox="0 0 195\.6 36\.73"/);
  assert.match(report, /aria-labelledby="baseset-logo-title"/);
  assert.match(report, /fill="#745fa6"/);
  assert.match(report, /75\.0%/);
  assert.match(report, /Vehicle &lt;History&gt;/);
  assert.match(report, /src\/Page\.tsx:4:5/);
  assert.match(report, /\/example\/&lt;repository&gt;/);
  assert.doesNotMatch(report, /Vehicle <History>/);
  assert.doesNotMatch(report, /violation/i);
});
