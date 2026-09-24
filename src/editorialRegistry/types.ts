export type RegistrySourceKind = 'MYTHOS' | 'MMLU' | 'ARC' | 'OPENBOOK_QA' | 'QASC' | 'GENERIC';

export interface RegistryUsage {
  source: RegistrySourceKind;
  sourceId: string;
  level?: string;
  questionId?: string;
  title?: string;
  question?: string;
  explanation?: string;
  terms: string[];
  disciplines: string[];
  conceptId?: string;
  claimKey?: string;
  sourceFile: string;
}

export interface RegistrySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  sources: Array<{source: RegistrySourceKind; records: number}>;
  usages: RegistryUsage[];
}

export interface RegistrySearchResult extends RegistryUsage {
  score: number;
  matchedTerms: string[];
}
