
export interface CourseItem {
  type: 'Reading' | 'Multimedia' | 'Quiz' | 'Assignment' | 'Discussion' | 'Other';
  title: string;
}

export interface ModuleObjective {
  moduleName: string;
  objective: string;
  items: CourseItem[];
}

export interface CLOMapping {
  clo: string;
  alignedModules: ModuleObjective[];
  findings: string;
  recommendations: string;
}

export interface QMFeedback {
  qm2_1: string;
  qm2_2: string;
  qm2_3: string;
  qm2_4: string;
  qm2_5: string;
}

export interface ULOStatus {
  id: string;
  name: string;
  category: 'Interdisciplinary' | 'Disciplinary';
  addressed: boolean;
  reasoning: string;
}

export interface ModuleMLOs {
  moduleName: string;
  objectives: string[];
  isGenerated?: boolean;
}

export interface ModuleMapping {
  moduleName: string;
  relevantCLOs: string[];
  relevantMLOs: string[];
  findings: string;
  recommendations: string;
}

export interface DesignMap {
  courseTitle: string;
  courseLength: string;
  executiveSummary: string;
  ulos: ULOStatus[];
  plos: string[];
  clos: string[];
  mlosByModule: ModuleMLOs[];
  qmFeedback: QMFeedback;
  cloMappings: CLOMapping[];
  moduleMappings: ModuleMapping[];
  usedFallbackModel?: boolean; // true when Pro was unavailable and Flash-Lite was used instead
}

export type LLMProvider = 'gemini' | 'openai';

export interface StoredModelConfig {
  step1: string;
  step2: string;
  step3: string;
  fallback: string;
}

export interface AutoFillResults {
  courseContext: string;
  courseInfo: string;
  courseLength: string;
  clos: string;
  plos: string;
  ulos: string;
  objectiveLocation: string;
}
