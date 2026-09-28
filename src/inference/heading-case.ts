import type { Observation } from "../domain/observation.js";
import { groupHeadingText } from "../grouping/rendered-text.js";
import type { RenderedTextUnit } from "../grouping/rendered-text.js";

export type HeadingCase = "sentence" | "title" | "uppercase" | "lowercase" | "unknown";

export interface HeadingCaseEvidence extends RenderedTextUnit {
  classification: HeadingCase;
}

export interface CandidateConvention {
  kind: "ui.heading-case";
  description: string;
  dominantCase: Exclude<HeadingCase, "unknown">;
  confidence: number;
  evidenceCount: number;
  scope: {
    elements: string[];
  };
  supportingEvidence: HeadingCaseEvidence[];
  exceptions: HeadingCaseEvidence[];
  unclassifiedEvidence: HeadingCaseEvidence[];
}

const MINIMUM_EVIDENCE = 3;
const MINIMUM_CONFIDENCE = 0.75;
const MINOR_TITLE_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor",
  "of", "on", "or", "over", "per", "the", "to", "up", "via", "with",
]);

function words(value: string): string[] {
  return value.match(/\p{L}+/gu) ?? [];
}

function isUppercaseWord(value: string): boolean {
  return value === value.toUpperCase() && value !== value.toLowerCase();
}

function isCapitalisedWord(value: string): boolean {
  const [first = "", ...rest] = [...value];
  return first === first.toUpperCase()
    && first !== first.toLowerCase()
    && rest.join("") === rest.join("").toLowerCase();
}

function startsWithUppercase(value: string): boolean {
  const [first = ""] = [...value];
  return first === first.toUpperCase() && first !== first.toLowerCase();
}

export function classifyHeadingCase(value: string): HeadingCase {
  const tokens = words(value);
  if (tokens.length === 0) return "unknown";
  const letters = tokens.join("");
  if (letters === letters.toUpperCase()) return "uppercase";
  if (letters === letters.toLowerCase()) return "lowercase";
  if (tokens.length === 1) return "unknown";

  const titleWords = tokens.filter(startsWithUppercase);
  const isTitleCase = titleWords.length >= 2 && tokens.every((token, index) => {
    if (startsWithUppercase(token)) return true;
    return index > 0 && index < tokens.length - 1 && MINOR_TITLE_WORDS.has(token.toLowerCase());
  });
  if (isTitleCase) return "title";

  const first = tokens[0];
  if ((isCapitalisedWord(first) || isUppercaseWord(first) || startsWithUppercase(first))
    && tokens.slice(1).some((token) => token === token.toLowerCase())) {
    return "sentence";
  }
  return "unknown";
}

function descriptionFor(
  headingCase: Exclude<HeadingCase, "unknown">,
  element?: string,
): string {
  const label = headingCase === "uppercase" ? "uppercase" : `${headingCase} case`;
  return `${element ? `${element.toUpperCase()} headings` : "Headings"} generally use ${label}`;
}

function classifyEvidence(units: RenderedTextUnit[]): HeadingCaseEvidence[] {
  return units.map((unit) => ({
    ...unit,
    classification: unit.hasDynamicContent ? "unknown" : classifyHeadingCase(unit.value),
  }));
}

function inferFromEvidence(
  evidence: HeadingCaseEvidence[],
  element?: string,
): CandidateConvention | undefined {
  if (evidence.length < MINIMUM_EVIDENCE) return undefined;

  const counts = new Map<Exclude<HeadingCase, "unknown">, number>();
  for (const item of evidence) {
    if (item.classification === "unknown") continue;
    counts.set(item.classification, (counts.get(item.classification) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const [dominant] = ranked;
  if (!dominant || ranked[1]?.[1] === dominant[1]) return undefined;

  const [dominantCase, supportingCount] = dominant;
  const confidence = supportingCount / evidence.length;
  if (confidence < MINIMUM_CONFIDENCE) return undefined;

  return {
    kind: "ui.heading-case",
    description: descriptionFor(dominantCase, element),
    dominantCase,
    confidence,
    evidenceCount: evidence.length,
    scope: { elements: element ? [element] : [...new Set(evidence.map((item) => item.element))].sort() },
    supportingEvidence: evidence.filter(({ classification }) => classification === dominantCase),
    exceptions: evidence.filter(
      ({ classification }) => classification !== dominantCase && classification !== "unknown",
    ),
    unclassifiedEvidence: evidence.filter(({ classification }) => classification === "unknown"),
  };
}

export function inferHeadingCaseConvention(observations: Observation[]): CandidateConvention | undefined {
  return inferFromEvidence(classifyEvidence(groupHeadingText(observations)));
}

export function inferHeadingCaseConventions(observations: Observation[]): CandidateConvention[] {
  const evidence = classifyEvidence(groupHeadingText(observations));
  const repositoryWide = inferFromEvidence(evidence);
  if (repositoryWide) return [repositoryWide];

  const byElement = new Map<string, HeadingCaseEvidence[]>();
  for (const item of evidence) {
    const element = item.element.toLowerCase();
    const group = byElement.get(element) ?? [];
    group.push(item);
    byElement.set(element, group);
  }
  return ["h1", "h2", "h3", "h4", "h5", "h6"]
    .map((element) => inferFromEvidence(byElement.get(element) ?? [], element))
    .filter((candidate): candidate is CandidateConvention => candidate !== undefined);
}
