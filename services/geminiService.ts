
import { GoogleGenAI, Type } from "@google/genai";
import { DesignMap, AutoFillResults } from "../types";

export const analyzeCourseDocument = async (content: string, apiKey?: string): Promise<AutoFillResults> => {
  const activeKey = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error("No Gemini API key provided. Please set your key in Settings.");
  }
  const ai = new GoogleGenAI({ apiKey: activeKey });
  
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
    model: "gemini-3-flash-preview",
    contents: `Analyze this document content and return JSON:\n\n${content.substring(0, 20000)}`, // Truncate if extreme, but flash handles large context
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
  apiKey?: string
): Promise<DesignMap> => {
  const activeKey = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error("No Gemini API key provided. Please set your key in Settings.");
  }
  const ai = new GoogleGenAI({ apiKey: activeKey });
  
  const systemInstruction = `
    You are an expert instructional designer and evaluation specialist for Boise State University.
    Your task is to create a draft course design map and evaluate it against Boise State's QM+ Standards.
    
    COURSE PARAMETERS:
    - Level: ${courseContext}
    - Duration: ${courseLength}
    
    GUIDANCE ON QM+ STANDARDS (General Standard 2):
    - QM 2.1: Course-level objectives (CLOs) must be measurable (e.g., use active verbs, avoid "understand" or "learn").
    - QM 2.2: Module-level objectives (MLOs) must be measurable and consistent with CLOs.
    - QM 2.3: Objectives must be clearly stated, learner-centered (written from learner's perspective), and prominently located.
    - QM 2.4: The relationship between objectives, learning activities, and assessments must be clear (a "straight line").
    - QM 2.5: Objectives must reflect the course level (e.g., 100-level = identify/describe; 400-level = evaluate/analyze; 800-level = design/create).
    
    BOISE STATE UNIVERSITY LEARNING OBJECTIVES (ULOs) DEFINITIONS:
    - Written Communication: Write effectively in multiple contexts, for a variety of audiences. (Note: Any course with written assignments, essays, or reports should likely address this).
    - Oral Communication: Communicate effectively in speech, both as a speaker and listener.
    - Critical Inquiry: Engage in effective critical inquiry by defining problems, gathering and evaluating evidence, and determining the adequacy of argumentative discourse.
    - Ethics: Analyze ethical issues in personal, professional, and civic life and produce reasoned evaluations of competing value systems and ethical claims.
    - Mathematical Reasoning: Apply knowledge and the methods of reasoning characteristic of mathematics to solve college-level problems.
    - Natural, Physical, and Applied Sciences: Apply knowledge and the methods characteristic of scientific inquiry to think critically about and solve theoretical and practical problems about physical structures and processes.
    - Visual and Performing Arts: Apply knowledge and methods characteristic of visual and performing arts to explain and appreciate the significance of aesthetic products and creative activities.
    - Humanities: Apply knowledge and the methods of inquiry characteristic of humanities disciplines to interpret and produce texts expressive of the human condition.
    - Social Sciences: Apply knowledge and the methods of inquiry characteristic of the social sciences to explain and evaluate human behavior and institutions.
    
    PROCESS:
    1. Analyze the provided Design Document for an ${courseContext} course that lasts ${courseLength}.
    2. Extract Module Objectives. Guidance on location: ${objectiveLocation || "Found under 'Module Introduction' sections"}.
    3. Identify the module name (e.g., "Module 1", "Week 1") for each objective.
    4. Identify and list related course items (Readings, Multimedia, Quizzes, Assignments, Discussions) for each objective.
    5. Map these MLOs and items to the Course Learning Objectives (CLOs) provided.
    6. Evaluate which Boise State ULOs are addressed by the course content, objectives, and assessments. For EACH ULO listed above, determine if it is "Addressed" or "Not Addressed" and provide a brief justification (Reasoning).
    7. Identify any Program Learning Objectives (PLOs) mentioned in the document.
    8. Evaluate the course content against QM 2.1 through 2.5 based on the guidance above.
    9. STRICTLY EXCLUDE content from modules or sections matching: ${exclusions || "Instructor Resources, Student Resources, and Getting Started modules. Also exclude any unpublished course content."}.
    10. For each CLO, provide "Findings" and "Recommendations".
    
    OUTPUT FORMAT:
    Return a JSON object matching the requested schema. Use the Course identification: ${courseInfo || "DEPT ###: Course Title"}.
    
    The JSON must include:
    - executiveSummary: A high-level overview of the alignment state.
    - plos: An array of strings, each being a Program Learning Objective.
    - clos: An array of strings, each being a Course Learning Objective.
    - mlosByModule: An array of objects, each containing a moduleName and an array of objectives (MLOs).
    - qmFeedback: Feedback for QM standards 2.1 through 2.5.
    - cloMappings: Alignment organized by CLOs. For each CLO, list relevant module objectives and items, findings, and recommendations.
    - moduleMappings: Alignment organized by Modules. For each module, list relevant CLOs, MLOs, findings, and recommendations.
  `;

  const prompt = `
    COURSE INFO: ${courseInfo || 'N/A'}
    COURSE LENGTH: ${courseLength}
    CLOs: ${clos}
    ${plos ? `PLOs: ${plos}` : ''}
    ${ulos ? `ULOs: ${ulos}` : ''}
    DESIGN DOC: ${documentContent}
    CONTEXT: ${courseContext}
    ${additionalInfo ? `ADDITIONAL INFO: ${additionalInfo}` : ''}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          courseTitle: { type: Type.STRING },
          courseLength: { type: Type.STRING },
          executiveSummary: { type: Type.STRING },
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
          plos: { type: Type.ARRAY, items: { type: Type.STRING } },
          clos: { type: Type.ARRAY, items: { type: Type.STRING } },
          mlosByModule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                moduleName: { type: Type.STRING },
                objectives: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["moduleName", "objectives"]
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
        required: ["courseTitle", "courseLength", "executiveSummary", "ulos", "plos", "clos", "mlosByModule", "qmFeedback", "cloMappings", "moduleMappings"]
      }
    }
  });

  if (!response.text) throw new Error("No response generated.");
  return JSON.parse(response.text) as DesignMap;
};
