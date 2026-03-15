
import { DesignMap, AutoFillResults } from '../types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ── Model metadata ────────────────────────────────────────────────────────────
export const OPENAI_MODEL_LABELS: Record<string, string> = {
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4o': 'GPT-4o',
  'gpt-5.4': 'GPT-5.4 Thinking',
  'gpt-5.4-pro': 'GPT-5.4 Pro',
};

export const OPENAI_MODEL_TIERS: Record<string, 'low' | 'mid' | 'high'> = {
  'gpt-4o-mini': 'low',
  'gpt-4o': 'mid',
  'gpt-5.4': 'high',
  'gpt-5.4-pro': 'high',
};

export interface OpenAIModelConfig {
  step1: string;
  step2: string;
  step3: string;
  fallback: string;
}

export interface OpenAIDetectionResult {
  valid: boolean;
  availableModels: string[];
  recommended: OpenAIModelConfig;
}

const isReasoningModel = (model: string): boolean =>
  model === 'gpt-5.4' || model === 'gpt-5.4-pro' || /^o\d/.test(model);

// ── Low-level helpers ─────────────────────────────────────────────────────────
const callOpenAI = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4000
): Promise<string> => {
  const reasoning = isReasoningModel(model);
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_completion_tokens: reasoning ? maxTokens * 2 : maxTokens,
    ...(reasoning
      ? { reasoning: { effort: 'high' } }
      : { response_format: { type: 'json_object' } }),
  };

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');
  return content;
};

const parseJSON = (text: string): any => {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) { try { return JSON.parse(match[1]); } catch {} }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch {} }
  throw new Error('Failed to parse JSON response from OpenAI');
};

// ── Model detection ───────────────────────────────────────────────────────────

// Known models we support, in priority order (highest to lowest)
const KNOWN_MODELS = ['gpt-5.4-pro', 'gpt-5.4', 'gpt-4o', 'gpt-4o-mini'];

const fetchAvailableModels = async (apiKey: string): Promise<string[] | null> => {
  // Use the /models endpoint (free GET, no tokens used) to validate key + list models
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ids: string[] = (data.data ?? []).map((m: any) => m.id as string);
    // Filter to only models we know about and support
    return KNOWN_MODELS.filter(m => ids.includes(m));
  } catch {
    return null;
  }
};

const testOpenAIModel = async (apiKey: string, model: string): Promise<boolean> => {
  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Say ok' }], max_completion_tokens: 5 }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const detectOpenAIModels = async (apiKey: string): Promise<OpenAIDetectionResult> => {
  // Step 1: Use /models endpoint to validate key and discover available models (free, no tokens)
  let available = await fetchAvailableModels(apiKey);

  // Step 2: If /models endpoint failed (e.g. institutional restrictions), fall back to test calls
  if (available === null) {
    // Try each known model via test call; key is valid if at least one succeeds
    available = [];
    for (const model of KNOWN_MODELS) {
      if (await testOpenAIModel(apiKey, model)) available.push(model);
    }
    if (available.length === 0) {
      return {
        valid: false,
        availableModels: [],
        recommended: { step1: 'gpt-4o-mini', step2: 'gpt-4o', step3: 'gpt-4o', fallback: 'gpt-4o-mini' },
      };
    }
  } else if (available.length === 0) {
    // /models worked but returned no known models — key is valid but no supported models found
    // Fall back to test calls in case our KNOWN_MODELS list just needs updating
    for (const model of KNOWN_MODELS) {
      if (await testOpenAIModel(apiKey, model)) available.push(model);
    }
    if (available.length === 0) {
      return {
        valid: false,
        availableModels: [],
        recommended: { step1: 'gpt-4o-mini', step2: 'gpt-4o', step3: 'gpt-4o', fallback: 'gpt-4o-mini' },
      };
    }
  }

  const best =
    available.find(m => m === 'gpt-5.4-pro') ??
    available.find(m => m === 'gpt-5.4') ??
    (available.includes('gpt-4o') ? 'gpt-4o' : 'gpt-4o-mini');
  const mid = available.includes('gpt-4o') ? 'gpt-4o' : available[0];
  const low = available.includes('gpt-4o-mini') ? 'gpt-4o-mini' : available[available.length - 1];
  const fallback = available.includes('gpt-4o') ? 'gpt-4o' : available[available.length - 1];

  return {
    valid: true,
    availableModels: available,
    recommended: { step1: low, step2: mid, step3: best, fallback },
  };
};

// ── Auto-fill ─────────────────────────────────────────────────────────────────
export const analyzeCourseDocumentOpenAI = async (
  content: string,
  apiKey: string,
  model = 'gpt-4o-mini'
): Promise<AutoFillResults> => {
  const systemPrompt = `You are an expert instructional designer. Analyze the provided course design document and extract specific details.
Return a JSON object with these fields:
- courseContext: one of "Undergraduate", "Master's", "Doctoral", "Professional Development", "Other"
- courseInfo: department, number, and title (e.g., "MATH 108: Intermediate Algebra")
- courseLength: duration (e.g., "7 weeks")
- clos: course learning objectives as a single string
- plos: program learning objectives as a string (empty string if not found)
- ulos: university learning objectives as a string (empty string if not found)
- objectiveLocation: description of where module-level objectives are found in this document`;

  const text = await callOpenAI(
    apiKey, model, systemPrompt,
    `Analyze this document and return JSON:\n\n${content.substring(0, 20000)}`, 800
  );
  return parseJSON(text) as AutoFillResults;
};

// ── Internal pipeline interfaces ──────────────────────────────────────────────
interface ExtractedDocumentStructure {
  courseTitle: string;
  modules: Array<{
    moduleName: string;
    objectives?: string[];
    items: Array<{ type: 'Reading' | 'Multimedia' | 'Quiz' | 'Assignment' | 'Discussion' | 'Other'; title: string }>;
    summary: string;
  }>;
  plos: string[];
}

interface MLOsAndFeedback {
  mlosByModule: Array<{ moduleName: string; objectives: string[]; isGenerated: boolean }>;
  qmFeedback: { qm2_1: string; qm2_2: string; qm2_3: string; qm2_4: string; qm2_5: string };
  executiveSummary: string;
}

interface AlignmentResult {
  ulos: Array<{ id: string; name: string; category: 'Interdisciplinary' | 'Disciplinary'; addressed: boolean; reasoning: string }>;
  clos: string[];
  cloMappings: Array<{
    clo: string;
    alignedModules: Array<{ moduleName: string; objective: string; items: Array<{ type: string; title: string }> }>;
    findings: string;
    recommendations: string;
  }>;
  moduleMappings: Array<{ moduleName: string; relevantCLOs: string[]; relevantMLOs: string[]; findings: string; recommendations: string }>;
  usedFallback: boolean;
}

// ── Step 1: Extract document structure ────────────────────────────────────────
const extractDocumentStructureOpenAI = async (
  documentContent: string,
  courseInfo: string,
  courseContext: string,
  courseLength: string,
  objectiveLocation: string,
  exclusions: string,
  apiKey: string,
  model: string
): Promise<ExtractedDocumentStructure> => {
  const systemPrompt = `You are an expert instructional designer. Extract ONLY the essential structure from this course design document.
Return JSON with this exact structure:
{
  "courseTitle": "string",
  "modules": [
    {
      "moduleName": "string",
      "objectives": ["string"],
      "items": [{"type": "Reading|Multimedia|Quiz|Assignment|Discussion|Other", "title": "string"}],
      "summary": "brief content summary"
    }
  ],
  "plos": ["string"]
}
For objectives: only include them if explicitly found at: ${objectiveLocation}. Omit the objectives field entirely if none are found for a module.
EXCLUDE from modules: ${exclusions}
Output ONLY valid JSON, no extra text.`;

  const text = await callOpenAI(
    apiKey, model, systemPrompt,
    `Course: ${courseInfo} (${courseContext}, ${courseLength})\n\nExtract structure from:\n\n${documentContent}`,
    4000
  );
  return parseJSON(text) as ExtractedDocumentStructure;
};

// ── Step 2: Generate MLOs and QM Feedback ────────────────────────────────────
const generateMLOsAndFeedbackOpenAI = async (
  extracted: ExtractedDocumentStructure,
  clos: string,
  courseContext: string,
  courseLength: string,
  apiKey: string,
  model: string
): Promise<MLOsAndFeedback> => {
  const systemPrompt = `You are an expert instructional designer specializing in QM+ Standards and learning objective writing.
Given a course structure and CLOs, do two things:
1. For each module: if objectives already exist, list them with isGenerated:false. If absent, generate 1-2 measurable Bloom's Taxonomy objectives aligned with CLOs, mark isGenerated:true.
2. Evaluate the course against QM Standards 2.1-2.5.
Return JSON with this exact structure:
{
  "mlosByModule": [{"moduleName": "string", "objectives": ["string"], "isGenerated": boolean}],
  "qmFeedback": {"qm2_1": "string", "qm2_2": "string", "qm2_3": "string", "qm2_4": "string", "qm2_5": "string"},
  "executiveSummary": "2-3 paragraph summary of alignment findings"
}
Output ONLY valid JSON, no extra text.`;

  const modulesText = extracted.modules
    .map(m => `${m.moduleName}: ${m.summary}\nItems: ${m.items.map(i => i.title).join('; ')}\nObjectives: ${m.objectives?.join('; ') || 'None found'}`)
    .join('\n\n');

  const text = await callOpenAI(
    apiKey, model, systemPrompt,
    `Course Context: ${courseContext} (${courseLength})\nCLOs:\n${clos}\n\nModules:\n${modulesText}`,
    3000
  );
  return parseJSON(text) as MLOsAndFeedback;
};

const BSU_ULOS = `Interdisciplinary ULOs:
ULO-I-1: Apply critical thinking through analyzing, synthesizing, and evaluating information
ULO-I-2: Demonstrate effective written, oral, and visual communication
ULO-I-3: Demonstrate quantitative, scientific, and information literacy
ULO-I-4: Demonstrate ethical reasoning and civic engagement

Disciplinary ULOs:
ULO-D-1: Demonstrate mastery of disciplinary knowledge, concepts, and methods
ULO-D-2: Apply disciplinary skills and practices
ULO-D-3: Engage in creative and innovative thinking within the discipline`;

// ── Step 3: Create alignment mappings ────────────────────────────────────────
const createAlignmentMappingsOpenAI = async (
  extracted: ExtractedDocumentStructure,
  mlosByModule: MLOsAndFeedback['mlosByModule'],
  clos: string,
  plos: string | undefined,
  ulos: string | undefined,
  courseContext: string,
  courseLength: string,
  courseInfo: string,
  apiKey: string,
  alignmentModel: string,
  fallbackModel: string
): Promise<AlignmentResult> => {
  const mloText = mlosByModule.map(m => `${m.moduleName}: ${m.objectives.join('; ')}`).join('\n');
  const moduleSummaries = extracted.modules
    .map(m => `${m.moduleName}: ${m.items.map(i => `${i.type}: ${i.title}`).join('; ')}`)
    .join('\n');

  const systemPrompt = `You are an expert instructional designer. Create comprehensive course alignment mappings.
Return JSON with this exact structure:
{
  "ulos": [{"id": "ULO-I-1", "name": "string", "category": "Interdisciplinary|Disciplinary", "addressed": boolean, "reasoning": "string"}],
  "clos": ["string"],
  "cloMappings": [{
    "clo": "string",
    "alignedModules": [{"moduleName": "string", "objective": "string", "items": [{"type": "Reading|Multimedia|Quiz|Assignment|Discussion|Other", "title": "string"}]}],
    "findings": "string",
    "recommendations": "string"
  }],
  "moduleMappings": [{"moduleName": "string", "relevantCLOs": ["string"], "relevantMLOs": ["string"], "findings": "string", "recommendations": "string"}]
}
Output ONLY valid JSON, no extra text.`;

  const userMessage = `Course: ${courseInfo} (${courseContext}, ${courseLength})
CLOs:
${clos}
${plos ? `\nPLOs:\n${plos}` : ''}
Module Learning Objectives:
${mloText}
Module Items:
${moduleSummaries}
BSU University Learning Objectives:
${BSU_ULOS}
${ulos ? `\nUser-provided ULOs:\n${ulos}` : ''}
Create complete alignment mappings.`;

  const isQuotaError = (err: any): boolean => {
    const msg = err?.message || err?.toString() || '';
    return msg.includes('429') || msg.includes('quota') || msg.includes('rate_limit') || msg.includes('insufficient_quota');
  };

  let usedFallback = false;
  let text: string;
  try {
    text = await callOpenAI(apiKey, alignmentModel, systemPrompt, userMessage, 6000);
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn('Alignment model quota exceeded — retrying with fallback model');
      usedFallback = true;
      text = await callOpenAI(apiKey, fallbackModel, systemPrompt, userMessage, 6000);
    } else {
      throw err;
    }
  }

  return { ...(parseJSON(text) as Omit<AlignmentResult, 'usedFallback'>), usedFallback };
};

// ── Public API ────────────────────────────────────────────────────────────────
export const generateDesignMapOpenAI = async (
  clos: string,
  documentContent: string,
  courseContext: string,
  courseLength: string,
  plos?: string,
  ulos?: string,
  exclusions?: string,
  objectiveLocation?: string,
  courseInfo?: string,
  _additionalInfo?: string,
  apiKey?: string,
  modelConfig?: OpenAIModelConfig
): Promise<DesignMap> => {
  if (!apiKey) throw new Error('No OpenAI API key provided. Please add your key in Initial Setup.');

  const config: OpenAIModelConfig = modelConfig ?? {
    step1: 'gpt-4o-mini',
    step2: 'gpt-4o',
    step3: 'gpt-5.4',
    fallback: 'gpt-4o',
  };

  try {
    const extracted = await extractDocumentStructureOpenAI(
      documentContent,
      courseInfo || 'N/A',
      courseContext,
      courseLength,
      objectiveLocation || 'Module Introduction sections',
      exclusions || 'Instructor Resources, Student Resources, and Getting Started modules',
      apiKey,
      config.step1
    );

    const mlosAndFeedback = await generateMLOsAndFeedbackOpenAI(
      extracted, clos, courseContext, courseLength, apiKey, config.step2
    );

    const alignment = await createAlignmentMappingsOpenAI(
      extracted,
      mlosAndFeedback.mlosByModule,
      clos, plos, ulos,
      courseContext, courseLength,
      courseInfo || 'N/A',
      apiKey,
      config.step3,
      config.fallback
    );

    return {
      courseTitle: extracted.courseTitle,
      courseLength,
      executiveSummary: mlosAndFeedback.executiveSummary,
      ulos: alignment.ulos,
      plos: extracted.plos || (plos ? plos.split('\n').filter(p => p.trim()) : []),
      clos: alignment.clos,
      mlosByModule: mlosAndFeedback.mlosByModule,
      qmFeedback: mlosAndFeedback.qmFeedback,
      cloMappings: alignment.cloMappings.map(mapping => ({
        ...mapping,
        alignedModules: mapping.alignedModules.map(mo => ({
          ...mo,
          items: mo.items.map(item => ({
            type: item.type as 'Reading' | 'Multimedia' | 'Quiz' | 'Assignment' | 'Discussion' | 'Other',
            title: item.title,
          })),
        })),
      })),
      moduleMappings: alignment.moduleMappings,
      usedFallbackModel: alignment.usedFallback ?? false,
    };
  } catch (error: any) {
    throw new Error(`Failed to generate design map: ${error.message || 'Unknown error'}`);
  }
};
