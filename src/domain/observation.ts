export interface Observation {
  kind: string;
  value: string;
  source: {
    path: string;
    line?: number;
    column?: number;
  };
  context?: Record<string, unknown>;
}
