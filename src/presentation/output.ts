import type { ScanResult } from "../scanner/scan.js";
import type { HeadingCaseEvidence } from "../inference/heading-case.js";
import { BASESET_LOGO_SVG } from "./logo.js";

export function renderSummary(result: ScanResult): string {
  return [
    "BaseSet",
    "",
    "Scanning repository...",
    "",
    `✓ ${result.filesDiscovered} files discovered`,
    `✓ ${result.relevantFilesAnalysed} relevant files analysed`,
    `✓ ${result.observations.length} observations collected`,
    `✓ ${result.candidateConventions.length} candidate conventions inferred`,
  ].join("\n");
}

export function renderJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sourceLabel(evidence: HeadingCaseEvidence): string {
  const source = evidence.observations[0]?.source;
  if (!source) return "Unknown source";
  return [source.path, source.line, source.column].filter((part) => part !== undefined).join(":");
}

function evidenceList(title: string, evidence: HeadingCaseEvidence[]): string {
  if (evidence.length === 0) return "";
  const items = evidence.map((item) => `
    <li>
      <span class="evidence-value">${escapeHtml(item.value)}</span>
      <span class="classification">${escapeHtml(item.classification)}</span>
      <code>${escapeHtml(sourceLabel(item))}</code>
    </li>`).join("");
  return `<section class="evidence"><h3>${escapeHtml(title)} <span>${evidence.length}</span></h3><ul>${items}</ul></section>`;
}

export function renderHtmlReport(result: ScanResult): string {
  const candidates = result.candidateConventions.length === 0
    ? `<div class="empty"><h2>No candidate conventions found</h2><p>The available evidence did not meet the inference threshold.</p></div>`
    : result.candidateConventions.map((candidate) => `
      <article class="candidate">
        <div class="candidate-heading">
          <div><span class="label">Candidate convention</span><h2>${escapeHtml(candidate.description)}</h2></div>
          <strong class="confidence">${(candidate.confidence * 100).toFixed(1)}%</strong>
        </div>
        <p class="scope">Scope: ${candidate.scope.elements.map((element) => escapeHtml(element.toUpperCase())).join(", ")}</p>
        <dl>
          <div><dt>Evidence</dt><dd>${candidate.evidenceCount}</dd></div>
          <div><dt>Supporting</dt><dd>${candidate.supportingEvidence.length}</dd></div>
          <div><dt>Other classified</dt><dd>${candidate.exceptions.length}</dd></div>
          <div><dt>Unclassified</dt><dd>${candidate.unclassifiedEvidence.length}</dd></div>
        </dl>
        ${evidenceList("Supporting evidence", candidate.supportingEvidence)}
        ${evidenceList("Other classified evidence", candidate.exceptions)}
        ${evidenceList("Unclassified evidence", candidate.unclassifiedEvidence)}
      </article>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BaseSet scan report</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; color: #172033; background: #f5f7fb; }
    body { margin: 0; }
    main { width: min(960px, calc(100% - 32px)); margin: 48px auto; }
    header { margin-bottom: 28px; }
    .brand { margin-bottom: 28px; }
    .report-logo { display: block; width: 196px; height: auto; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 8px; font-size: 2rem; }
    .repository { color: #5d6678; word-break: break-all; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0 32px; }
    .summary div, .candidate, .empty { border: 1px solid #dce1ea; border-radius: 12px; background: white; box-shadow: 0 4px 18px rgba(23, 32, 51, .05); }
    .summary div { padding: 16px; }
    .summary strong { display: block; font-size: 1.5rem; }
    .summary span, .scope { color: #687286; }
    .candidate, .empty { padding: 24px; margin-bottom: 20px; }
    .candidate-heading { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
    .label { color: #5261d6; font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .candidate h2 { margin: 6px 0 0; }
    .confidence { color: #176b4d; font-size: 1.5rem; }
    dl { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 20px 0; }
    dl div { border-radius: 8px; background: #f5f7fb; padding: 12px; }
    dt { color: #687286; font-size: .8rem; }
    dd { margin: 3px 0 0; font-size: 1.15rem; font-weight: 700; }
    .evidence { margin-top: 24px; }
    .evidence h3 span { color: #687286; font-weight: 400; }
    ul { margin: 0; padding: 0; list-style: none; }
    li { display: grid; grid-template-columns: minmax(180px, 1fr) auto minmax(220px, auto); gap: 12px; padding: 10px 0; border-top: 1px solid #e8ebf1; align-items: baseline; }
    .classification { color: #5261d6; font-size: .8rem; }
    code { color: #687286; font-size: .78rem; text-align: right; overflow-wrap: anywhere; }
    @media (max-width: 700px) { .summary, dl { grid-template-columns: repeat(2, 1fr); } li { grid-template-columns: 1fr; gap: 3px; } code { text-align: left; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand">${BASESET_LOGO_SVG}</div>
      <h1>Scan report</h1>
      <p class="repository">${escapeHtml(result.repositoryRoot)}</p>
    </header>
    <section class="summary" aria-label="Scan summary">
      <div><strong>${result.filesDiscovered}</strong><span>Files discovered</span></div>
      <div><strong>${result.relevantFilesAnalysed}</strong><span>Relevant files</span></div>
      <div><strong>${result.observations.length}</strong><span>Observations</span></div>
      <div><strong>${result.candidateConventions.length}</strong><span>Candidate conventions</span></div>
    </section>
    ${candidates}
  </main>
</body>
</html>`;
}
