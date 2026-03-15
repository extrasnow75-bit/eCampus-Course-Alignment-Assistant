
import { GoogleGenAI, Type } from "@google/genai";
import { DesignMap, AutoFillResults } from "../types";

// ── Model metadata ────────────────────────────────────────────────────────────
export const GEMINI_MODEL_LABELS: Record<string, string> = {
  'gemini-3.1-flash-lite-preview': 'Gemini Flash-Lite',
  'gemini-3-flash-preview': 'Gemini Flash',
  'gemini-3.1-pro-preview': 'Gemini Pro',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-thinking-exp': 'Gemini 2.0 Flash Thinking',
  'gemini-2.0-flash-thinking-exp-01-21': 'Gemini 2.0 Flash Thinking',
  'gemini-2.5-flash-preview-04-17': 'Gemini 2.5 Flash',
  'gemini-2.5-pro-preview-03-25': 'Gemini 2.5 Pro',
  'gemini-2.5-pro-exp-03-25': 'Gemini 2.5 Pro',
};

export const getGeminiModelLabel = (model: string): string =>
  GEMINI_MODEL_LABELS[model] ?? model;

// Determine tier from model name patterns
export const getGeminiModelTier = (model: string): 'low' | 'mid' | 'high' => {
  const m = model.toLowerCase();
  if (m.includes('nano') || m.includes('lite') || m.includes('flash-lite')) return 'low';
  if (m.includes('thinking') || m.includes('pro') || m.includes('ultra')) return 'high';
  if (m.includes('flash')) return 'mid';
  return 'mid';
};

// Deprecated static export kept for compatibility
export const GEMINI_MODEL_TIERS: Record<string, 'low' | 'mid' | 'high'> = {
  'gemini-3.1-flash-lite-preview': 'low',
  'gemini-3-flash-preview': 'mid',
  'gemini-3.1-pro-preview': 'high',
};

export interface GeminiModelConfig {
  step1: string;
  step2: string;
  step3: string;
  fallback: string;
}

export interface GeminiDetectionResult {
  valid: boolean;
  availableModels: string[];
  recommended: GeminiModelConfig;
}

// Fetch all generateContent-capable Gemini models from the API (free, no tokens)
const fetchGeminiModels = async (apiKey: string): Promise<string[] | null> => {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const models: string[] = (data.models ?? [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => (m.name as string).replace('models/', ''))
      .filter((id: string) => id.startsWith('gemini'));
    console.log('[Gemini] All available models:', models);
    return models.length > 0 ? models : null;
  } catch {
    return null;
  }
};

const sortGeminiByTier = (models: string[]): string[] =>
  [...models].sort((a, b) => {
    const tierVal = { high: 2, mid: 1, low: 0 };
    const diff = tierVal[getGeminiModelTier(b)] - tierVal[getGeminiModelTier(a)];
    if (diff !== 0) return diff;
    // Within same tier, prefer non-preview/non-exp (stable) models first
    const aExp = a.includes('preview') || a.includes('exp') ? 1 : 0;
    const bExp = b.includes('preview') || b.includes('exp') ? 1 : 0;
    return aExp - bExp;
  });

// Fallback models to test if the API listing is unavailable
const FALLBACK_TEST_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-thinking-exp',
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.5-pro-preview-03-25',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
];

export const detectGeminiModels = async (apiKey: string): Promise<GeminiDetectionResult> => {
  const invalid: GeminiDetectionResult = {
    valid: false,
    availableModels: [],
    recommended: { step1: 'gemini-2.0-flash-lite', step2: 'gemini-2.0-flash', step3: 'gemini-2.0-flash-thinking-exp', fallback: 'gemini-2.0-flash' },
  };

  // Step 1: Try the models listing API (free, no tokens)
  let available = await fetchGeminiModels(apiKey);

  // Step 2: If listing unavailable, fall back to test calls
  if (available === null) {
    const ai = new GoogleGenAI({ apiKey });
    available = [];
    for (const model of FALLBACK_TEST_MODELS) {
      try {
        await ai.models.generateContent({ model, contents: 'Say ok', config: { maxOutputTokens: 5 } });
        available.push(model);
      } catch { /* not available */ }
    }
    if (available.length === 0) return invalid;
  }

  const sorted = sortGeminiByTier(available);
  const best = sorted[0];
  const low = sorted[sorted.length - 1];
  const mid = sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
  const fallback = sorted.length > 1 ? sorted[1] : sorted[0];

  console.log('[Gemini] Recommended — step1:', low, '| step2:', mid, '| step3:', best, '| fallback:', fallback);

  return {
    valid: true,
    availableModels: sorted,
    recommended: { step1: low, step2: mid, step3: best, fallback },
  };
};

export const analyzeCourseDocument = async (content: string, apiKey?: string, model?: string): Promise<AutoFillResults> => {
  const activeKey = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error("No Gemini API key provided. Please set your key in Settings.");
  }
  const ai = new GoogleGenAI({ apiKey: activeKey });
  const activeModel = model || 'gemini-2.0-flash';

  const systemInstruction = `
    You are an expert instructional designer. Analyze the provided course design document and extract specific details to help fill out a course alignment form.

    EXTRACT:
    - Course Context: Undergraduate, Master's, Doctoral, or Professional Development.
    - Course Info: Dept, number, and title (e.g., MATH 108: Intermediate Algebra).
    - Course Length: Duration of the course (e.g., 7 weeks, 15 weeks, 1 semester).
    - CLOs: Course Learning Objectives.
    - PLOs: Program Learning Objectives (if present).
    - ULOs: University Learning Objectives (if present).
    - Objective Location: Where module-level objectives are typically found in this specific document.
  `;

  const response = await ai.models.generateContent({
    model: activeModel,
    contents: `Analyze this document content and return JSON:\n\n${content.substring(0, 20000)}`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          courseContext: { type: Type.STRING, enum: ['Undergraduate', "Master's", 'Doctoral', 'Professional Development', 'Other'] },
          courseInfo: { type: Type.STRING },
          courseLength: { type: Type.STRING },
          clos: { type: Type.STRING },
          plos: { type: Type.STRING },
          ulos: { type: Type.STRING },
          objectiveLocation: { type: Type.STRING }
        },
        required: ["courseContext", "courseInfo", "courseLength", "clos", "objectiveLocation"]
      }
    }
  });

  if (!response.text) throw new Error("Analysis failed");
  return JSON.parse(response.text) as AutoFillResults;
};

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1: Extract document structure into compact JSON (Token Distillation)
// Uses: Gemini 3.1 Pro (better at complex extraction)
// ══════════════════════════════════════════════════════════════════════════════
interface ExtractedDocumentStructure {
  courseTitle: string;
  modules: Array<{
    moduleName: string;
    objectives?: string[];
    items: Array<{
      type: 'Reading' | 'Multimedia' | 'Quiz' | 'Assignment' | 'Discussion' | 'Other';
      title: string;
    }>;
    summary: string;
  }>;
  plos: string[];
}

const extractDocumentStructure = async (
  documentContent: string,
  courseInfo: string,
  courseContext: string,
  courseLength: string,
  objectiveLocation: string,
  exclusions: string,
  apiKey: string,
  model = 'gemini-2.0-flash'
): Promise<ExtractedDocumentStructure> => {
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are an expert instructional designer specializing in document structure extraction.
Your task is to extract ONLY the essential structure from the course design document.

EXTRACT AND RETURN:
1. Course Title
2. List of all modules/units with:
   - Module name
   - Any existing module-level objectives (if found at: ${objectiveLocation})
   - Course items (Readings, Multimedia, Quizzes, Assignments, Discussions)
   - Brief summary of module content
3. Program Learning Objectives (if mentioned)

IMPORTANT:
- EXCLUDE: ${exclusions}
- Focus on structure and content organization, NOT alignment analysis
- Keep descriptions brief and focused
- Output ONLY valid JSON, no additional text
  `;

  const response = await ai.models.generateContent({
    model, // Step 1: lowest-tier model (handles full document read)
    contents: `Extract document structure:\n\n${documentContent}`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          courseTitle: { type: Type.STRING },
          modules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                moduleName: { type: Type.STRING },
                objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, enum: ['Reading', 'Multimedia', 'Quiz', 'Assignment', 'Discussion', 'Other'] },
                      title: { type: Type.STRING }
                    },
                    required: ["type", "title"]
                  }
                },
                summary: { type: Type.STRING }
              },
              required: ["moduleName", "items", "summary"]
            }
          },
          plos: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["courseTitle", "modules", "plos"]
      }
    }
  });

  if (!response.text) throw new Error("Document extraction failed");
  return JSON.parse(response.text) as ExtractedDocumentStructure;
};

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2: Generate MLOs and QM Feedback (uses extracted JSON, not full document)
// Uses: Gemini 3.1 Flash-Lite (faster, cheaper, sufficient for structured data)
// ══════════════════════════════════════════════════════════════════════════════
interface MLOsAndFeedback {
  mlosByModule: Array<{
    moduleName: string;
    objectives: string[];
    isGenerated: boolean;
  }>;
  qmFeedback: {
    qm2_1: string;
    qm2_2: string;
    qm2_3: string;
    qm2_4: string;
    qm2_5: string;
  };
  executiveSummary: string;
}

const generateMLOsAndFeedback = async (
  extracted: ExtractedDocumentStructure,
  clos: string,
  courseContext: string,
  courseLength: string,
  apiKey: string,
  model = 'gemini-2.0-flash'
): Promise<MLOsAndFeedback> => {
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are an expert instructional designer evaluating Course Learning Objectives against QM+ Standards.

TASK:
1. For each module in the extracted document:
   - If objectives exist, mark as extracted (isGenerated: false)
   - If NO objectives exist, generate 1-2 measurable objectives using Bloom's Taxonomy verbs
   - Mark generated objectives (isGenerated: true)

2. Evaluate the course against QM 2.1-2.5 Standards based on the module structure, objectives, and items provided

KEEP RESPONSES BRIEF BUT SUBSTANTIVE.
Output ONLY valid JSON, no additional text.
  `;

  const modulesText = extracted.modules
    .map(m => `${m.moduleName}: ${m.summary}\nItems: ${m.items.map(i => i.title).join('; ')}\nExtracted objectives: ${m.objectives?.join('; ') || 'None found'}`)
    .join('\n\n');

  const response = await ai.models.generateContent({
    model, // Step 2: mid-tier model
    contents: `
Course Context: ${courseContext} (${courseLength})
CLOs: ${clos}

Module Structure:
${modulesText}

Generate MLOs and provide QM feedback.
    `,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mlosByModule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                moduleName: { type: Type.STRING },
                objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                isGenerated: { type: Type.BOOLEAN }
              },
              required: ["moduleName", "objectives", "isGenerated"]
            }
          },
          qmFeedback: {
            type: Type.OBJECT,
            properties: {
              qm2_1: { type: Type.STRING },
              qm2_2: { type: Type.STRING },
              qm2_3: { type: Type.STRING },
              qm2_4: { type: Type.STRING },
              qm2_5: { type: Type.STRING }
            },
            required: ["qm2_1", "qm2_2", "qm2_3", "qm2_4", "qm2_5"]
          },
          executiveSummary: { type: Type.STRING }
        },
        required: ["mlosByModule", "qmFeedback", "executiveSummary"]
      }
    }
  });

  if (!response.text) throw new Error("MLO and feedback generation failed");
  return JSON.parse(response.text) as MLOsAndFeedback;
};

// ══════════════════════════════════════════════════════════════════════════════
// STEP 3: Create alignment mappings (uses extracted JSON + objectives, not full doc)
// Uses: Gemini 3.1 Flash-Lite (sufficient for mapping already-structured data)
// ══════════════════════════════════════════════════════════════════════════════
interface AlignmentResult {
  ulos: Array<{ id: string; name: string; category: 'Interdisciplinary' | 'Disciplinary'; addressed: boolean; reasoning: string }>;
  clos: string[];
  cloMappings: Array<{
    clo: string;
    alignedModules: Array<{
      moduleName: string;
      objective: string;
      items: Array<{ type: string; title: string }>;
    }>;
    findings: string;
    recommendations: string;
  }>;
  moduleMappings: Array<{
    moduleName: string;
    relevantCLOs: string[];
    relevantMLOs: string[];
    findings: string;
    recommendations: string;
  }>;
  usedFallback: boolean;
}

const createAlignmentMappings = async (
  extracted: ExtractedDocumentStructure,
  mlos: Array<{ moduleName: string; objectives: string[] }>,
  clos: string,
  plos: string | undefined,
  ulos: string | undefined,
  courseContext: string,
  courseLength: string,
  courseInfo: string,
  apiKey: string,
  step3Model = 'gemini-2.0-flash-thinking-exp',
  fallbackModel = 'gemini-2.0-flash'
): Promise<AlignmentResult> => {
  const ai = new GoogleGenAI({ apiKey });

  const bsuULOs = `
- Written Communication: Write effectively in multiple contexts
- Oral Communication: Communicate effectively in speech
- Critical Inquiry: Engage in effective critical inquiry
- Ethics: Analyze ethical issues in personal, professional, and civic life
- Mathematical Reasoning: Apply mathematical knowledge
- Natural, Physical, and Applied Sciences: Apply scientific inquiry
- Visual and Performing Arts: Apply knowledge of visual and performing arts
- Humanities: Apply knowledge of humanities disciplines
- Social Sciences: Apply knowledge of social sciences
  `;

  const systemInstruction = `
You are an expert instructional design specialist. Your task is to map course objectives to learning outcomes.

BASED ON THE PROVIDED EXTRACTED STRUCTURE:
1. Map each CLO to relevant modules and objectives
2. Identify which University Learning Objectives (ULOs) are addressed
3. Provide findings and recommendations for each CLO and module

For each ULO, determine if it's addressed and provide brief reasoning.
Keep findings and recommendations concise but substantive.

Output ONLY valid JSON, no additional text.
  `;

  const mloText = mlos.map(m => `${m.moduleName}: ${m.objectives.join('; ')}`).join('\n');
  const moduleSummaries = extracted.modules.map(m => `${m.moduleName}: ${m.items.map(i => `[${i.type}] ${i.title}`).join('; ')}`).join('\n');

  // Try Pro first for highest quality alignment; fall back to Flash-Lite if free tier blocks Pro
  const isQuotaError = (err: any): boolean => {
    const msg = err?.message || err?.toString() || '';
    return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
  };

  const tryAlignment = async (model: string) => ai.models.generateContent({
    model,
    contents: `
Course: ${courseInfo || 'N/A'} (${courseContext}, ${courseLength})

CLOs:
${clos}

${plos ? `PLOs:\n${plos}\n` : ''}

Module Learning Objectives:
${mloText}

Module Items:
${moduleSummaries}

BSU University Learning Objectives:
${bsuULOs}

${ulos ? `User-provided ULOs:\n${ulos}\n` : ''}

Create complete alignment mappings.
    `,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ulos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                category: { type: Type.STRING, enum: ['Interdisciplinary', 'Disciplinary'] },
                addressed: { type: Type.BOOLEAN },
                reasoning: { type: Type.STRING }
              },
              required: ["id", "name", "category", "addressed", "reasoning"]
            }
          },
          clos: { type: Type.ARRAY, items: { type: Type.STRING } },
          cloMappings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clo: { type: Type.STRING },
                alignedModules: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      moduleName: { type: Type.STRING },
                      objective: { type: Type.STRING },
                      items: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            type: { type: Type.STRING, enum: ['Reading', 'Multimedia', 'Quiz', 'Assignment', 'Discussion', 'Other'] },
                            title: { type: Type.STRING }
                          },
                          required: ["type", "title"]
                        }
                      }
                    },
                    required: ["moduleName", "objective", "items"]
                  }
                },
                findings: { type: Type.STRING },
                recommendations: { type: Type.STRING }
              },
              required: ["clo", "alignedModules", "findings", "recommendations"]
            }
          },
          moduleMappings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                moduleName: { type: Type.STRING },
                relevantCLOs: { type: Type.ARRAY, items: { type: Type.STRING } },
                relevantMLOs: { type: Type.ARRAY, items: { type: Type.STRING } },
                findings: { type: Type.STRING },
                recommendations: { type: Type.STRING }
              },
              required: ["moduleName", "relevantCLOs", "relevantMLOs", "findings", "recommendations"]
            }
          }
        },
        required: ["ulos", "clos", "cloMappings", "moduleMappings"]
      }
    }
  });

  // Attempt step3 model first (highest tier), fall back on quota errors
  let response;
  let usedFallback = false;
  try {
    response = await tryAlignment(step3Model);
  } catch (err) {
    if (isQuotaError(err)) {
      console.warn(`${step3Model} quota exceeded — retrying with fallback: ${fallbackModel}`);
      usedFallback = true;
      response = await tryAlignment(fallbackModel);
    } else {
      throw err;
    }
  }

  if (!response.text) throw new Error("Alignment mapping creation failed");
  return { ...(JSON.parse(response.text) as AlignmentResult), usedFallback };
};

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC API: generateDesignMap (3-step distillation internally)
// ══════════════════════════════════════════════════════════════════════════════
export const generateDesignMap = async (
  clos: string,
  documentContent: string,
  courseContext: string,
  courseLength: string,
  plos?: string,
  ulos?: string,
  exclusions?: string,
  objectiveLocation?: string,
  courseInfo?: string,
  additionalInfo?: string,
  apiKey?: string,
  modelConfig?: GeminiModelConfig
): Promise<DesignMap> => {
  const activeKey = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error("No Gemini API key provided. Please set your key in Settings.");
  }

  // Use model config if provided, otherwise fall back to sensible defaults
  const step1Model = modelConfig?.step1 || 'gemini-2.0-flash';
  const step2Model = modelConfig?.step2 || 'gemini-2.0-flash';
  const step3Model = modelConfig?.step3 || 'gemini-2.0-flash-thinking-exp';
  const fallbackModel = modelConfig?.fallback || 'gemini-2.0-flash';

  try {
    // STEP 1: Extract document structure using lowest-tier model
    const extracted = await extractDocumentStructure(
      documentContent,
      courseInfo || "N/A",
      courseContext,
      courseLength,
      objectiveLocation || "Module Introduction sections",
      exclusions || "Instructor Resources, Student Resources, and Getting Started modules",
      activeKey,
      step1Model
    );

    // STEP 2: Generate MLOs and QM Feedback using mid-tier model
    const mlosAndFeedback = await generateMLOsAndFeedback(
      extracted,
      clos,
      courseContext,
      courseLength,
      activeKey,
      step2Model
    );

    // STEP 3: Create alignment mappings using highest-tier model with fallback
    const alignment = await createAlignmentMappings(
      extracted,
      mlosAndFeedback.mlosByModule,
      clos,
      plos,
      ulos,
      courseContext,
      courseLength,
      courseInfo || "N/A",
      activeKey,
      step3Model,
      fallbackModel
    );

    // Combine all results into final DesignMap
    const result: DesignMap = {
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
            title: item.title
          }))
        }))
      })),
      moduleMappings: alignment.moduleMappings,
      usedFallbackModel: alignment.usedFallback ?? false
    };

    return result;
  } catch (error: any) {
    console.error("Design map generation error:", error);
    throw new Error(`Failed to generate design map: ${error.message || 'Unknown error'}`);
  }
};
