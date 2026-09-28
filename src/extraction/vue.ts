import { NodeTypes, parse } from "@vue/compiler-dom";
import type { TemplateChildNode } from "@vue/compiler-dom";
import type { Observation } from "../domain/observation.js";

function normaliseText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

interface ElementPathEntry {
  id: string;
  element: string;
  hasDynamicContent: boolean;
}

function hasDynamicContent(nodes: TemplateChildNode[]): boolean {
  return nodes.some((node) => node.type === NodeTypes.INTERPOLATION
    || (node.type === NodeTypes.ELEMENT && hasDynamicContent(node.children)));
}

export function extractVueText(source: string, sourcePath: string): Observation[] {
  const templateMatch = /<template(?:\s[^>]*)?>([\s\S]*?)<\/template\s*>/i.exec(source);
  if (!templateMatch || templateMatch.index === undefined) return [];

  const template = templateMatch[1];
  const contentStart = templateMatch.index + templateMatch[0].indexOf(template);
  const prefix = source.slice(0, contentStart);
  const lineOffset = prefix.split("\n").length - 1;
  const firstLineColumnOffset = prefix.length - prefix.lastIndexOf("\n") - 1;
  const root = parse(template, { comments: false });
  const observations: Observation[] = [];

  function visit(nodes: TemplateChildNode[], elementPath: ElementPathEntry[]): void {
    for (const node of nodes) {
      if (node.type !== NodeTypes.ELEMENT) continue;
      const nextPath = [...elementPath, {
        id: String(node.loc.start.offset),
        element: node.tag,
        hasDynamicContent: hasDynamicContent(node.children),
      }];
      for (const child of node.children) {
        if (child.type !== NodeTypes.TEXT) continue;
        const value = normaliseText(child.content);
        if (!value) continue;
        const localLine = child.loc.start.line;
        observations.push({
          kind: "ui.text",
          value,
          source: {
            path: sourcePath,
            line: localLine + lineOffset,
            column: child.loc.start.column + (localLine === 1 ? firstLineColumnOffset : 0),
          },
          context: { element: node.tag, elementPath: nextPath },
        });
      }
      visit(node.children, nextPath);
    }
  }

  visit(root.children, []);
  return observations;
}
