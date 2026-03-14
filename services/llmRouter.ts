
import { DesignMap, AutoFillResults } from '../types';
import { generateDesignMap, analyzeCourseDocument } from './geminiService';
import {
  generateDesignMapOpenAI,
  analyzeCourseDocumentOpenAI,
  OpenAIModelConfig,
} from './openaiService';

export type LLMProvider = 'gemini' | 'openai';

export interface ModelConfig {
  step1: string;
  step2: string;
  step3: string;
  fallback: string;
}

export interface GenerateParams {
  clos: string;
  documentContent: string;
  courseContext: string;
  courseLength: string;
  plos?: string;
  ulos?: string;
  exclusions?: string;
  objectiveLocation?: string;
  courseInfo?: string;
  additionalInfo?: string;
}

export const generateDesignMapWithProvider = async (
  params: GenerateParams,
  provider: LLMProvider,
  apiKey: string,
  modelConfig?: ModelConfig
): Promise<DesignMap> => {
  if (provider === 'openai') {
    return generateDesignMapOpenAI(
      params.clos,
      params.documentContent,
      params.courseContext,
      params.courseLength,
      params.plos,
      params.ulos,
      params.exclusions,
      params.objectiveLocation,
      params.courseInfo,
      params.additionalInfo,
      apiKey,
      modelConfig as OpenAIModelConfig | undefined
    );
  }

  // Gemini path
  return generateDesignMap(
    params.clos,
    params.documentContent,
    params.courseContext,
    params.courseLength,
    params.plos,
    params.ulos,
    params.exclusions,
    params.objectiveLocation,
    params.courseInfo,
    params.additionalInfo,
    apiKey
  );
};

export const analyzeCourseDocumentWithProvider = async (
  content: string,
  geminiKey?: string,
  openaiKey?: string,
  preferredProvider?: LLMProvider
): Promise<AutoFillResults> => {
  if (preferredProvider === 'openai' && openaiKey) {
    return analyzeCourseDocumentOpenAI(content, openaiKey);
  }
  if (geminiKey) {
    return analyzeCourseDocument(content, geminiKey);
  }
  if (openaiKey) {
    return analyzeCourseDocumentOpenAI(content, openaiKey);
  }
  throw new Error('No API key available for auto-fill analysis.');
};

// Re-export detection utilities so App.tsx only needs to import from llmRouter
export { detectGeminiModels } from './geminiService';
export { detectOpenAIModels } from './openaiService';
export type { OpenAIDetectionResult } from './openaiService';
export type { GeminiDetectionResult } from './geminiService';
