/**
 * Groq AI integration for real-time 1-on-1 AI fallback partner.
 * Model: llama-3.3-70b-versatile
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const FALLBACK_RESPONSES = [
  "That is a profound philosophical perspective. When considering the nature of human agency and reality, how do you reconcile deterministic physical laws with subjective experience?",
  "An intriguing argument! However, from a compatibilist viewpoint, free will is not about uncaused causes, but about acting according to one's authentic motives without external coercion.",
  "Consider the epistemological boundary here: if all our observations are filtered through sensory faculties, can we ever directly access things-in-themselves, or only phenomena?",
  "That touches on a core ethical dilemma. Should the moral value of an action be judged solely by its ultimate consequences, or are certain duties categorical regardless of outcome?",
];

export async function generateGroqResponse(
  messages: ChatMessage[],
  systemPrompt: string = "You are Sokrates, an empathetic, inquisitive, and intellectually rigorous philosophical dialogue partner."
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey === "placeholder" || apiKey.trim() === "") {
    const idx = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
    return FALLBACK_RESPONSES[idx];
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || FALLBACK_RESPONSES[0];
  } catch (error) {
    console.error("[Groq AI] Error generating response:", error);
    const idx = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
    return FALLBACK_RESPONSES[idx];
  }
}

export async function streamGroqResponse(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onDone: (fullResponse: string) => void,
  systemPrompt: string = "You are Sokrates, an empathetic, inquisitive, and intellectually rigorous philosophical dialogue partner."
): Promise<void> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey === "placeholder" || apiKey.trim() === "") {
    const idx = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
    const fullText = FALLBACK_RESPONSES[idx];
    const tokens = fullText.match(/\S+|\s+/g) || [fullText];
    let accumulated = "";

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      accumulated += token;
      onChunk(token);
      await new Promise((r) => setTimeout(r, 5));
    }
    await onDone(accumulated);
    return;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Groq Streaming API error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullMessage = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.substring(6);
          if (dataStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullMessage += content;
              onChunk(content);
            }
          } catch {}
        }
      }
    }

    if (buffer.length > 0 && buffer.startsWith("data: ")) {
      try {
        const parsed = JSON.parse(buffer.substring(6));
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullMessage += content;
          onChunk(content);
        }
      } catch {}
    }

    await onDone(fullMessage || FALLBACK_RESPONSES[0]);
  } catch (error) {
    console.error("[Groq AI Streaming Error]:", error);
    const idx = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
    const fullText = FALLBACK_RESPONSES[idx];
    onChunk(fullText);
    await onDone(fullText);
  }
}
