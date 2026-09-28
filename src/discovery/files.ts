import { execFile } from "node:child_process";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  "vendor",
  "dist",
  "build",
  "out",
  "coverage",
  "generated",
  ".next",
  ".nuxt",
  ".output",
  ".baseset",
]);

export type SourceType = "typescript" | "typescript-jsx" | "javascript" | "javascript-jsx" | "vue";

export interface DiscoveredFile {
  path: string;
  absolutePath: string;
  sourceType?: SourceType;
}

const SOURCE_TYPES: Partial<Record<string, SourceType>> = {
  ".ts": "typescript",
  ".tsx": "typescript-jsx",
  ".js": "javascript",
  ".jsx": "javascript-jsx",
  ".vue": "vue",
};

export async function findRepositoryRoot(from: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", from, "rev-parse", "--show-toplevel"]);
    return stdout.trim();
  } catch {
    throw new Error(`Not inside a Git repository: ${from}`);
  }
}

function isExcluded(relativePath: string): boolean {
  return relativePath.split("/").some((segment) => EXCLUDED_DIRECTORIES.has(segment));
}

export async function discoverFiles(repositoryRoot: string): Promise<DiscoveredFile[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["-C", repositoryRoot, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
  );

  const paths = stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((filePath) => !isExcluded(filePath))
    .sort((left, right) => left.localeCompare(right));
  const files = await Promise.all(paths.map(async (filePath): Promise<DiscoveredFile | undefined> => {
    const absolutePath = path.join(repositoryRoot, filePath);
    try {
      if (!(await lstat(absolutePath)).isFile()) return undefined;
    } catch {
      // The index can still contain a tracked file deleted from the working tree.
      return undefined;
    }
    return {
      path: filePath,
      absolutePath,
      sourceType: SOURCE_TYPES[path.extname(filePath).toLowerCase()],
    };
  }));

  return files.filter((file): file is DiscoveredFile => file !== undefined);
}
