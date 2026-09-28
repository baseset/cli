import type { Observation } from "../domain/observation.js";

const HEADING_ELEMENTS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

interface ElementPathEntry {
  id: string;
  element: string;
  hasDynamicContent?: boolean;
}

export interface RenderedTextUnit {
  kind: "ui.text.rendered";
  value: string;
  element: string;
  hasDynamicContent: boolean;
  observations: Observation[];
}

function elementPath(observation: Observation): ElementPathEntry[] {
  const value = observation.context?.elementPath;
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ElementPathEntry => {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.id === "string" && typeof candidate.element === "string";
  });
}

function composeText(observations: Observation[]): string {
  return observations
    .map(({ value }) => value)
    .join(" ")
    .replace(/\s+([,.;:!?%)\]}])/g, "$1")
    .replace(/([(\[{])\s+/g, "$1")
    .trim();
}

/** Groups exact source observations into heading-sized rendered text units. */
export function groupHeadingText(observations: Observation[]): RenderedTextUnit[] {
  const groups = new Map<string, { element: string; dynamic: boolean; observations: Observation[] }>();

  for (const observation of observations) {
    if (observation.kind !== "ui.text") continue;
    const path = elementPath(observation);
    const heading = [...path].reverse().find(({ element }) => HEADING_ELEMENTS.has(element));
    const contextElement = observation.context?.element;
    const fallbackElement = typeof contextElement === "string" ? contextElement : undefined;
    const element = heading?.element ?? fallbackElement;
    if (!element || !HEADING_ELEMENTS.has(element)) continue;

    const key = heading
      ? `${observation.source.path}:${heading.id}`
      : `${observation.source.path}:${observation.source.line ?? "?"}:${observation.source.column ?? "?"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.observations.push(observation);
      existing.dynamic ||= heading?.hasDynamicContent === true;
    } else {
      groups.set(key, {
        element,
        dynamic: heading?.hasDynamicContent === true,
        observations: [observation],
      });
    }
  }

  return [...groups.values()].map((group) => ({
    kind: "ui.text.rendered",
    value: composeText(group.observations),
    element: group.element,
    hasDynamicContent: group.dynamic,
    observations: group.observations,
  }));
}
