export interface Scene {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface Prompt {
  id: string;
  sceneId: string;
  name: string;
  content: string;
  isStarred: boolean;
  currentVersionId: string;
  tags: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Version {
  id: string;
  promptId: string;
  version: string;
  title?: string;
  content: string;
  changeLog: string;
  isProtected: boolean;
  isInitial: boolean;
  createdAt: number;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  scenes: Scene[];
  prompts: Prompt[];
  versions: Version[];
}
