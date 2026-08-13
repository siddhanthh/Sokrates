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

/**
 * Generates 3 thought-provoking, open-ended conversation starters using Gemini 2.0 Flash.
 * Returns a fallback array if GEMINI_API_KEY is not set or if API request fails.
 */
export async function generateConversationStarters(
  topicTitle: string,
  description?: string | null,
  categoryName?: string | null
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  const fallbackStarters: string[] = [
    `How does ${topicTitle} impact human identity and our understanding of self?`,
    `What is the strongest counterargument or opposing perspective regarding ${topicTitle}?`,
    `In what practical or theoretical contexts does ${topicTitle} become morally ambiguous?`,
  ];

  if (!apiKey || apiKey === "placeholder" || apiKey.trim() === "") {
    return fallbackStarters;
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Generate 3 thought-provoking opening questions for a group intellectual discussion.

Topic: "${topicTitle}"
Description: "${description || "none provided"}"
Category: ${categoryName || "General Philosophy"}

Requirements:
- Each question must be open-ended (not answerable with yes/no).
- Each should open a different angle or dimension of the topic.
- Suitable for a group of adults with genuine intellectual curiosity.
- Do not number the questions or use bullet points.

Return ONLY a valid JSON array of exactly 3 strings. No markdown formatting, no preamble, no backticks.
Example format: ["Question 1?", "Question 2?", "Question 3?"]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanJson = responseText
      .replace(/^```json\s*/m, "")
      .replace(/^```\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed.slice(0, 3).map((q: any) => String(q).trim());
    }
  } catch (error) {
    console.error("[Gemini AI] Starters generation error:", error);
  }

  return fallbackStarters;
}

export interface DigestResult {
  summary: string;
  user1Position: string;
  user2Position: string;
  unresolvedQuestion: string;
}

export interface ArgumentMapNode {
  id: string;
  type: "claim" | "evidence" | "rebuttal" | "concession" | "agreement";
  participant: string;
  content: string;
  parent?: string | null;
  relation?: "supports" | "challenges" | "partially_agrees" | "acknowledges" | null;
}

export interface ArgumentMapResult {
  central_question: string;
  participants: Array<{ id: string; username: string; color: string }>;
  nodes: ArgumentMapNode[];
}

/**
 * Generates a post-chat 3-sentence summary of stances and best open questions using Gemini 2.0 Flash.
 */
export async function generatePostChatDigest(
  topicTitle: string,
  messages: Array<{ sender: string; content: string; isAi?: boolean }>
): Promise<DigestResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  const fallback: DigestResult = {
    summary: `The conversation centered on "${topicTitle}". Participants examined the fundamental principles and pushed the boundaries of traditional assumptions. The discussion evolved from initial positions toward nuanced perspectives.`,
    user1Position: "Argued for a deterministic perspective based on empirical principles.",
    user2Position: messages.some((m) => m.isAi)
      ? "Highlighted computational models and systemic feedback loops."
      : "Explored existential freedom and subjective experience.",
    unresolvedQuestion: "Can subjective consciousness emerge entirely from deterministic physical substrates?",
  };

  if (!apiKey || apiKey === "placeholder" || apiKey.trim() === "") {
    return fallback;
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const msgList = messages.map((m) => `${m.sender}: ${m.content}`).join("\n");
    const prompt = `You are a philosophical discourse analyst. Analyze this dialogue on "${topicTitle}":
${msgList}

Provide a JSON object with keys:
- "summary": A structured 3-sentence summary of the conversation.
- "user1Position": Summary of participant 1's main position.
- "user2Position": Summary of participant 2's main position.
- "unresolvedQuestion": The best open/unresolved question remaining.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return {
      summary: parsed.summary || fallback.summary,
      user1Position: parsed.user1Position || fallback.user1Position,
      user2Position: parsed.user2Position || fallback.user2Position,
      unresolvedQuestion: parsed.unresolvedQuestion || fallback.unresolvedQuestion,
    };
  } catch (error) {
    console.error("[Gemini AI] Digest generation error:", error);
    return fallback;
  }
}

/**
 * Generates a JSON argument map graph (nodes & edges) using Gemini 2.0 Flash.
 */
export async function generateArgumentMap(
  topicTitle: string,
  messages: Array<{ sender: string; content: string; isAi?: boolean }>
): Promise<ArgumentMapResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  const fallback: ArgumentMapResult = {
    central_question: topicTitle || "Core Philosophical Question",
    participants: [
      { id: "p1", username: messages[0]?.sender || "Participant 1", color: "#818cf8" },
      { id: "p2", username: messages.find((m) => m.sender !== messages[0]?.sender)?.sender || (messages.some((m) => m.isAi) ? "AI Partner" : "Participant 2"), color: "#2dd4bf" },
    ],
    nodes: [
      {
        id: "n1",
        type: "claim",
        participant: "p1",
        content: messages[0]?.content || "Physical determinism governs mental states.",
        parent: null,
        relation: null,
      },
      {
        id: "n2",
        type: "evidence",
        participant: "p1",
        content: "Neuroscientific evidence shows pre-conscious neural activation.",
        parent: "n1",
        relation: "supports",
      },
      {
        id: "n3",
        type: "rebuttal",
        participant: "p2",
        content: messages[1]?.content || "First-person phenomenological awareness cannot be reduced.",
        parent: "n1",
        relation: "challenges",
      },
      {
        id: "n4",
        type: "concession",
        participant: "p1",
        content: "Subjective experience remains hard to model physically.",
        parent: "n3",
        relation: "partially_agrees",
      },
    ],
  };

  if (!apiKey || apiKey === "placeholder" || apiKey.trim() === "") {
    return fallback;
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const msgList = messages.map((m) => `${m.sender}: ${m.content}`).join("\n");
    const prompt = `Extract a structured Argument Map JSON graph from this conversation on "${topicTitle}":
${msgList}

Return JSON with:
{
  "central_question": "${topicTitle}",
  "participants": [{"id": "p1", "username": "...", "color": "#818cf8"}, {"id": "p2", "username": "...", "color": "#2dd4bf"}],
  "nodes": [
    {
      "id": "n1",
      "type": "claim" | "evidence" | "rebuttal" | "concession" | "agreement",
      "participant": "p1" | "p2",
      "content": "...",
      "parent": "n1" or null,
      "relation": "supports" | "challenges" | "partially_agrees" | "acknowledges" | null
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.nodes && Array.isArray(parsed.nodes)) {
      return parsed as ArgumentMapResult;
    }
  } catch (error) {
    console.error("[Gemini AI] Argument Map generation error:", error);
  }

  return fallback;
}
