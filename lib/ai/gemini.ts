import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Fallback generator for offline/local execution.
 * Produces a deterministic 768-dimensional unit-normalized vector for a given input text.
 */
export function generateFallbackEmbedding(text: string): number[] {
  const vec = new Array(768).fill(0);
  const sanitized = text || "";
  const tokens = sanitized.split(/[\s,]+/).filter(Boolean);
  const inputs = tokens.length > 0 ? tokens : [sanitized];

  for (let i = 0; i < inputs.length; i++) {
    const str = inputs[i];
    let hash = 0;
    for (let c = 0; c < str.length; c++) {
      hash = (hash << 5) - hash + str.charCodeAt(c);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 768;
    vec[idx] += 1.0;
  }

  // Normalize to unit length
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1.0;
  return vec.map((v) => v / norm);
}

/**
 * Generates a 768-dimensional normalized embedding vector for the input text using Gemini text-embedding-004.
 * Fallbacks to deterministic unit-vector generator when offline or API key is unavailable.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "placeholder" || apiKey.trim() === "") {
    return generateFallbackEmbedding(text);
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    const values = result.embedding?.values;

    if (Array.isArray(values) && values.length > 0) {
      let vec = values.slice(0, 768);
      while (vec.length < 768) {
        vec.push(0);
      }
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1.0;
      return vec.map((v) => v / norm);
    }
  } catch (error) {
    // Graceful fallback on API or network failure
  }

  return generateFallbackEmbedding(text);
}
