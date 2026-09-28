import { readFile } from "node:fs/promises";
import type { Observation } from "../domain/observation.js";
import { discoverFiles, findRepositoryRoot } from "../discovery/files.js";
import type { DiscoveredFile } from "../discovery/files.js";
import { extractJsxText } from "../extraction/jsx.js";
import { extractVueText } from "../extraction/vue.js";
import { inferHeadingCaseConventions } from "../inference/heading-case.js";
import type { CandidateConvention } from "../inference/heading-case.js";

export interface ScanResult {
  repositoryRoot: string;
  filesDiscovered: number;
  relevantFilesAnalysed: number;
  files: Array<Pick<DiscoveredFile, "path" | "sourceType">>;
  observations: Observation[];
  candidateConventions: CandidateConvention[];
}

export async function scanRepository(from = process.cwd()): Promise<ScanResult> {
  const repositoryRoot = await findRepositoryRoot(from);
  const files = await discoverFiles(repositoryRoot);
  const relevantFiles = files.filter(
    (file): file is DiscoveredFile & { sourceType: NonNullable<DiscoveredFile["sourceType"]> } =>
      file.sourceType !== undefined,
  );
  const observations: Observation[] = [];

  for (const file of relevantFiles) {
    const source = await readFile(file.absolutePath, "utf8");
    if (file.sourceType === "vue") {
      observations.push(...extractVueText(source, file.path));
    } else {
      observations.push(...extractJsxText(source, file.path, file.sourceType));
    }
  }

  return {
    repositoryRoot,
    filesDiscovered: files.length,
    relevantFilesAnalysed: relevantFiles.length,
    files: relevantFiles.map(({ path, sourceType }) => ({ path, sourceType })),
    observations,
    candidateConventions: inferHeadingCaseConventions(observations),
  };
}
