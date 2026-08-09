export interface LevelBundleManifest {
  version: number;
  schemaVersion: number;
  storagePath: string;
  sha256: string;
  questionCount: number;
  byteSize: number;
  lang: string;
  publishedAt?: string | any;
}

export interface LevelQuestionBundle {
  schemaVersion: number;
  contentVersion: number;
  category: string;
  resolvedCategory: string;
  levelId: string;
  lang: string;
  publishedAt: string;
  questions: Array<{ id: string; data: Record<string, unknown> }>;
}

export interface LevelBundlePublishResult extends LevelBundleManifest {
  resolvedCategory: string;
}
