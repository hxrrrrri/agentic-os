export interface MemoryItem {
  id: string;
  filePath: string;
  title: string;
  type: "raw" | "wiki" | "project" | "content" | "daily" | "run" | "config" | "preference";
  tags: string[];
  summary: string;
  lastUpdated: string;
  embeddingPlaceholder: string;
  importanceScore: number;
}

export interface VaultFile {
  path: string;
  name: string;
  type: "file" | "directory";
  size: number;
  updatedAt: string;
  status: "created" | "updated" | "indexed";
}
