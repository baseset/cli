import ts from "typescript";
import type { Observation } from "../domain/observation.js";
import type { SourceType } from "../discovery/files.js";

const SCRIPT_KINDS: Record<Exclude<SourceType, "vue">, ts.ScriptKind> = {
  typescript: ts.ScriptKind.TS,
  "typescript-jsx": ts.ScriptKind.TSX,
  // JSX is commonly shipped in .js files, and the JSX parser also accepts plain JS.
  javascript: ts.ScriptKind.JSX,
  "javascript-jsx": ts.ScriptKind.JSX,
};

function normaliseText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

interface ElementPathEntry {
  id: string;
  element: string;
  hasDynamicContent: boolean;
}

function hasDynamicContent(node: ts.JsxElement): boolean {
  let dynamic = false;
  function inspect(child: ts.Node): void {
    if (ts.isJsxExpression(child) && child.expression) {
      dynamic = true;
      return;
    }
    if (ts.isJsxElement(child) || ts.isJsxFragment(child)) {
      child.children.forEach(inspect);
    }
  }
  node.children.forEach(inspect);
  return dynamic;
}

export function extractJsxText(
  source: string,
  sourcePath: string,
  sourceType: Exclude<SourceType, "vue">,
): Observation[] {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    SCRIPT_KINDS[sourceType],
  );
  const observations: Observation[] = [];

  function visit(node: ts.Node, elementPath: ElementPathEntry[]): void {
    if (ts.isJsxElement(node)) {
      const element = node.openingElement.tagName.getText(sourceFile);
      const nextPath = [...elementPath, {
        id: String(node.openingElement.getStart(sourceFile)),
        element,
        hasDynamicContent: hasDynamicContent(node),
      }];
      for (const child of node.children) {
        if (ts.isJsxText(child)) {
          const value = normaliseText(child.getText(sourceFile));
          if (!value) continue;
          const position = sourceFile.getLineAndCharacterOfPosition(child.getStart(sourceFile));
          observations.push({
            kind: "ui.text",
            value,
            source: {
              path: sourcePath,
              line: position.line + 1,
              column: position.character + 1,
            },
            context: { element, elementPath: nextPath },
          });
        } else {
          visit(child, nextPath);
        }
      }
      return;
    }
    ts.forEachChild(node, (child) => visit(child, elementPath));
  }

  visit(sourceFile, []);
  return observations;
}
