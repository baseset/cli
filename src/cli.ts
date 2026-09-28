#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderHtmlReport, renderJson, renderSummary } from "./presentation/output.js";
import { scanRepository } from "./scanner/scan.js";

function printUsage(): void {
  console.log("Usage: baseset scan [--json] [--output [path]]");
}

interface ScanOptions {
  json: boolean;
  writeOutput: boolean;
  outputPath?: string;
}

function parseScanOptions(flags: string[]): ScanOptions | undefined {
  const options: ScanOptions = { json: false, writeOutput: false };

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--json") {
      options.json = true;
      continue;
    }
    if (flag === "--output" || flag === "-o") {
      const outputPath = flags[index + 1];
      options.writeOutput = true;
      if (outputPath && !outputPath.startsWith("-")) {
        options.outputPath = outputPath;
        index += 1;
      }
      continue;
    }
    return undefined;
  }

  return options;
}

async function main(): Promise<void> {
  const [, , command, ...flags] = process.argv;
  const options = command === "scan" ? parseScanOptions(flags) : undefined;
  if (!options) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = await scanRepository();
  if (options.writeOutput) {
    const outputPath = options.outputPath
      ? path.resolve(options.outputPath)
      : path.join(result.repositoryRoot, ".baseset", "report.html");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${renderHtmlReport(result)}\n`, "utf8");
    console.log(`Wrote BaseSet report to ${outputPath}`);
    return;
  }
  console.log(options.json ? renderJson(result) : renderSummary(result));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`BaseSet: ${message}`);
  process.exitCode = 1;
});
