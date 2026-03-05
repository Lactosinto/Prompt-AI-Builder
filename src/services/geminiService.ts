import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Suggestion {
  label: string;
  tokens: string;
}

export interface PromptAnalysis {
  translatedPrompt: string;
  grammarIssues: string[];
  typos: { original: string; correction: string }[];
  optimizedPrompt: string;
  suggestions: Suggestion[];
  redundancies?: string[];
  troubleshooting?: string;
}

export type AnalysisMode = 'translator' | 'auditor' | 'vision' | 'troubleshooter';

export async function generatePromptFromImage(base64Image: string, mimeType: string, additionalIdea?: string): Promise<PromptAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
      {
        text: `Analyze this image deeply to create a professional Stable Diffusion prompt using Danbooru-style tagging (similar to Rule34). 
        ${additionalIdea ? `ADDITIONAL USER IDEA TO INCORPORATE: "${additionalIdea}". You MUST integrate this idea into the prompt naturally, matching the interactions and context of the image.` : ''}
        Provide a very detailed breakdown focusing on:
        1. Subject & Anatomy: Precise body structure, anatomy, facial features, skin texture, and micro-expressions.
        2. Pose & Action: Describe the exact pose in detail (including finger placement, limb orientation, and weight distribution).
        3. Environment & Lighting: Detailed background, atmospheric effects, and complex lighting (e.g., volumetric lighting, rim light).
        4. Artistic Style & Technicals: Specific medium, art style, and high-end rendering terms (e.g., "subsurface scattering", "unreal engine 5", "8k resolution").
        5. Use comma-separated tags for the final prompt.
        
        CRITICAL TAGGING RULES:
        - Use high-frequency Danbooru/Rule34 tags that are semantically relevant to the image.
        - DO NOT add new fetishes or sexual themes not present in the image.
        - DO NOT add or change the pose UNLESS explicitly requested by the ADDITIONAL USER IDEA.
        - Avoid redundant or conflicting tags.
        - Only strengthen existing visual descriptions using professional tagging terminology.
        
        Return the result in JSON format with the following structure:
        {
          "translatedPrompt": "The raw descriptive prompt",
          "grammarIssues": [],
          "typos": [],
          "optimizedPrompt": "The descriptive prompt with added quality tags and semantically relevant high-frequency Danbooru tags.",
          "suggestions": [
            { "label": "Suggestion description", "tokens": "actual, prompt, tags, to, add" }
          ]
        }`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translatedPrompt: { type: Type.STRING },
          grammarIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
          typos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                correction: { type: Type.STRING }
              }
            }
          },
          optimizedPrompt: { type: Type.STRING },
          suggestions: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "Descriptive text of the suggestion" },
                tokens: { type: Type.STRING, description: "The actual Stable Diffusion tags/tokens for this suggestion" }
              },
              required: ["label", "tokens"]
            } 
          }
        },
        required: ["translatedPrompt", "grammarIssues", "typos", "optimizedPrompt", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export interface RealtimeAssistance {
  recommendations: string[];
  warnings: string[];
  typos: { original: string; correction: string }[];
}

export async function getRealtimeAssistance(input: string): Promise<RealtimeAssistance> {
  if (!input || input.length < 5) return { recommendations: [], warnings: [], typos: [] };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `As a Stable Diffusion prompt assistant, analyze this partial input: "${input}"
    
    1. Provide 3-4 relevant next-word or contextual completions (e.g., "standing on the" -> "beach", "rooftop").
    2. Identify immediate redundancies or conflicting tags.
    3. Fix typos/grammar.
    
    Return JSON: { "recommendations": [], "warnings": [], "typos": [{ "original": "", "correction": "" }] }`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
          typos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                correction: { type: Type.STRING }
              }
            }
          }
        },
        required: ["recommendations", "warnings", "typos"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeAndOptimizePrompt(input: string, mode: AnalysisMode = 'translator', additionalIdea?: string): Promise<PromptAnalysis> {
  let systemPrompt = "";
  
  if (mode === 'translator') {
    systemPrompt = `Analyze and optimize this Stable Diffusion prompt using Danbooru-style tagging (similar to Rule34). 
       Input: "${input}"
       ${additionalIdea ? `ADDITIONAL USER IDEA TO INCORPORATE: "${additionalIdea}". You MUST integrate this idea into the prompt naturally, matching the interactions and context.` : ''}
       Tasks:
       1. If the input is in Indonesian, translate it to professional English Stable Diffusion prompt style (comma-separated tags, descriptive).
       2. Identify grammar issues in the English version.
       3. Identify typos and provide corrections.
       4. Create a highly optimized version using high-frequency Danbooru tags and common SD keywords (e.g., "masterpiece", "highly detailed", "8k").
       
       CRITICAL TAGGING RULES:
       - Use tags that are semantically relevant to the input.
       - DO NOT add new fetishes or sexual themes.
       - DO NOT add or change the pose UNLESS explicitly requested by the ADDITIONAL USER IDEA.
       - Avoid redundant or conflicting tags.
       - Only strengthen existing visual descriptions.
       
        5. Provide suggestions for improvement. Each suggestion must include a label (description) and the actual tokens/tags to achieve it.`;
  } else if (mode === 'auditor') {
    systemPrompt = `Audit this existing Stable Diffusion prompt for errors and redundancies.
       Input: "${input}"
       ${additionalIdea ? `ADDITIONAL USER IDEA TO INCORPORATE: "${additionalIdea}". You MUST integrate this idea into the prompt naturally, matching the interactions and context.` : ''}
       Tasks:
       1. Identify typos and provide corrections.
       2. Identify grammar issues or awkward phrasing.
       3. Detect redundant or conflicting tags (e.g., "lying on back" and "lying on chair" in the same prompt).
       4. Suggest a cleaned-up, non-redundant version of the prompt.
       5. Provide specific suggestions to avoid "overcooking" or confusing the AI model. Each suggestion must include a label and the actual tokens/tags.`;
  } else if (mode === 'troubleshooter') {
    systemPrompt = `You are a Stable Diffusion expert consultant. The user is asking a question or reporting an issue with their generation results.
       User Question/Issue: "${input}"
       ${additionalIdea ? `CONTEXT/PROMPT USED: "${additionalIdea}"` : ''}
       
       Tasks:
       1. Analyze why the issue might be happening (e.g., prompt weight too low, conflicting tags, model limitations, missing keywords).
       2. Provide a clear, concise explanation in Indonesian of the root cause.
       3. Suggest specific prompt modifications or technical settings (like CFG scale, steps, or negative prompts) to fix the issue.
       4. Provide an "optimizedPrompt" that specifically addresses the user's complaint (e.g., if a character is missing, strengthen the character's tags and placement keywords).
       
       Return the result in JSON format with the following structure:
       {
         "translatedPrompt": "A brief summary of the issue in English",
         "grammarIssues": [],
         "typos": [],
         "optimizedPrompt": "The corrected/improved prompt to fix the issue",
         "suggestions": [
           { "label": "Technical tip description", "tokens": "actual, tags, or, settings" }
         ],
         "troubleshooting": "Penjelasan lengkap dalam bahasa Indonesia mengenai solusi masalah tersebut"
       }`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: systemPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translatedPrompt: { type: Type.STRING, description: "The English translation or the original prompt if already English" },
          grammarIssues: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          typos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                correction: { type: Type.STRING }
              }
            }
          },
          optimizedPrompt: { type: Type.STRING, description: "The cleaned up or optimized version" },
          suggestions: {
            type: Type.ARRAY,
            items: { 
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                tokens: { type: Type.STRING }
              },
              required: ["label", "tokens"]
            }
          },
          redundancies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of redundant or conflicting tags found"
          }
        },
        required: ["translatedPrompt", "grammarIssues", "typos", "optimizedPrompt", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
