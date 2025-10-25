// src/lib/ai.ts
export async function generateWithAI(prompt: string): Promise<string> {
  try {
    const ai = (window as any)?.lovable?.ai;
    if (ai?.generate) {
      const res = await ai.generate({ prompt });
      const text = (res as any)?.text ?? "";
      return String(text || "").trim();
    }
  } catch (_e) {}
  return ""; // fallback: sin texto si no hay IA
}
