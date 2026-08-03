export interface Scene {
  id: string;
  userId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface VariableDef {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: string;
}

export interface Prompt {
  id: string;
  userId: string;
  sceneId: string;
  name: string;
  content: string;
  isStarred: boolean;
  currentVersionId: string;
  tags: string[];
  notes: string;
  variables?: VariableDef[];
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
  score?: number;
  testOutput?: string;
  modelInfo?: string;
  createdAt: number;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  scenes: Scene[];
  prompts: Prompt[];
  versions: Version[];
}

export type { User } from './auth';
export type { LoginForm, RegisterForm } from './auth';
