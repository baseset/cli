import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../src/domain/observation.js";
import { extractJsxText } from "../src/extraction/jsx.js";
import { groupHeadingText } from "../src/grouping/rendered-text.js";
import {
  classifyHeadingCase,
  inferHeadingCaseConvention,
  inferHeadingCaseConventions,
} from "../src/inference/heading-case.js";

function heading(
  value: string,
  line: number,
  element = "h2",
  id = String(line),
  hasDynamicContent = false,
): Observation {
  return {
    kind: "ui.text",
    value,
    source: { path: "src/Page.tsx", line, column: 5 },
    context: {
      element,
      elementPath: [{ id, element, hasDynamicContent }],
    },
  };
}

test("classifies deterministic heading casing", () => {
  assert.equal(classifyHeadingCase("Manage your account"), "sentence");
  assert.equal(classifyHeadingCase("Vehicle History Report"), "title");
  assert.equal(classifyHeadingCase("Vehicle Licensed as a Taxi"), "title");
  assert.equal(classifyHeadingCase("VEHICLE HISTORY"), "uppercase");
  assert.equal(classifyHeadingCase("vehicle history"), "lowercase");
  assert.equal(classifyHeadingCase("Welcome back to CarSignal"), "sentence");
  assert.equal(classifyHeadingCase("CarSignal Report Overview"), "title");
});

test("can infer each supported dominant heading case", () => {
  const cases = [
    { values: ["Manage your account", "Check vehicle history", "Review your details"], expected: "sentence" },
    { values: ["Manage Your Account", "Check Vehicle History", "Review Your Details"], expected: "title" },
    { values: ["MANAGE YOUR ACCOUNT", "CHECK VEHICLE HISTORY", "REVIEW YOUR DETAILS"], expected: "uppercase" },
    { values: ["manage your account", "check vehicle history", "review your details"], expected: "lowercase" },
  ] as const;

  for (const testCase of cases) {
    const candidate = inferHeadingCaseConvention(
      testCase.values.map((value, index) => heading(value, index + 1)),
    );
    assert.equal(candidate?.dominantCase, testCase.expected);
  }
});

test("leaves ambiguous headings unknown", () => {
  assert.equal(classifyHeadingCase("Account"), "unknown");
  assert.equal(classifyHeadingCase("iPhone eStore"), "unknown");
  assert.equal(classifyHeadingCase("1234"), "unknown");
});

test("infers a dominant convention while retaining exceptions as evidence", () => {
  const observations = [
    heading("Manage your account", 1),
    heading("Check vehicle history", 2),
    heading("Review your details", 3),
    heading("Vehicle History", 4),
    heading("Not a heading", 5, "H1"),
  ];

  const candidate = inferHeadingCaseConvention(observations);

  assert.ok(candidate);
  assert.equal(candidate.kind, "ui.heading-case");
  assert.equal(candidate.description, "Headings generally use sentence case");
  assert.equal(candidate.dominantCase, "sentence");
  assert.equal(candidate.confidence, 0.75);
  assert.equal(candidate.evidenceCount, 4);
  assert.deepEqual(candidate.scope, { elements: ["h2"] });
  assert.equal(candidate.supportingEvidence.length, 3);
  assert.equal(candidate.exceptions.length, 1);
  assert.equal(candidate.exceptions[0].classification, "title");
  assert.deepEqual(candidate.exceptions[0].observations[0].source, {
    path: "src/Page.tsx",
    line: 4,
    column: 5,
  });
  assert.ok(!("violation" in candidate.exceptions[0]));
});

test("infers separately scoped candidates when heading levels differ", () => {
  const observations = [
    heading("Manage your account", 1, "h2"),
    heading("Check vehicle history", 2, "h2"),
    heading("Review your details", 3, "h2"),
    heading("Manage Your Account", 4, "h4"),
    heading("Check Vehicle History", 5, "h4"),
    heading("Review Your Details", 6, "h4"),
  ];

  const candidates = inferHeadingCaseConventions(observations);

  assert.deepEqual(candidates.map(({ description, scope }) => ({ description, scope })), [
    { description: "H2 headings generally use sentence case", scope: { elements: ["h2"] } },
    { description: "H4 headings generally use title case", scope: { elements: ["h4"] } },
  ]);
});

test("does not infer a convention from insufficient evidence", () => {
  const candidate = inferHeadingCaseConvention([
    heading("Manage your account", 1),
    heading("Check vehicle history", 2),
  ]);

  assert.equal(candidate, undefined);
});

test("does not infer a convention when casing evidence is tied", () => {
  const candidate = inferHeadingCaseConvention([
    heading("Manage your account", 1),
    heading("Check vehicle history", 2),
    heading("Manage Your Account", 3),
    heading("Check Vehicle History", 4),
  ]);

  assert.equal(candidate, undefined);
});

test("composes adjacent JSX text while preserving each source observation", () => {
  const source = `<h1>Upgrade for <span>added confidence</span></h1>`;
  const observations = extractJsxText(source, "src/Upgrade.tsx", "typescript-jsx");
  const units = groupHeadingText(observations);

  assert.deepEqual(observations.map(({ value }) => value), ["Upgrade for", "added confidence"]);
  assert.equal(units.length, 1);
  assert.equal(units[0].value, "Upgrade for added confidence");
  assert.equal(units[0].observations.length, 2);
  assert.deepEqual(units[0].observations.map(({ source: evidenceSource }) => evidenceSource), [
    { path: "src/Upgrade.tsx", line: 1, column: 5 },
    { path: "src/Upgrade.tsx", line: 1, column: 23 },
  ]);
});

test("marks JSX with runtime expressions as unknown without inventing their values", () => {
  const dynamic = extractJsxText(
    `<h1>Vehicle Licensed as a Taxi ({licenceType})</h1>`,
    "src/Vehicle.tsx",
    "typescript-jsx",
  );
  const observations = [
    heading("Manage your account", 1),
    heading("Check vehicle history", 2),
    heading("Review your details", 3),
    ...dynamic,
  ];

  const unit = groupHeadingText(dynamic)[0];
  const candidate = inferHeadingCaseConvention(observations);

  assert.equal(unit.hasDynamicContent, true);
  assert.equal(unit.value, "Vehicle Licensed as a Taxi ()");
  assert.ok(candidate);
  assert.equal(candidate.confidence, 0.75);
  assert.equal(candidate.unclassifiedEvidence.length, 1);
  assert.equal(candidate.unclassifiedEvidence[0].classification, "unknown");
  assert.equal(candidate.unclassifiedEvidence[0].observations.length, 2);
});
